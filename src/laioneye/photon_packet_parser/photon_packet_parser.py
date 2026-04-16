import io
import struct

from laioneye.photon_packet_parser.command_type import CommandType
from laioneye.photon_packet_parser.crc_calculator import CrcCalculator
from laioneye.photon_packet_parser.message_type import MessageType
from laioneye.photon_packet_parser.protocol18_deserializer import Protocol18Deserializer
from laioneye.photon_packet_parser.segmented_packet import SegmentedPacket

COMMAND_HEADER_LENGTH = 12
PHOTON_HEADER_LENGTH = 12


class PhotonPacketParser:
    def __init__(self, on_event, on_request, on_response):
        self._pending_segments = {}
        self.on_event = on_event
        self.on_request = on_request
        self.on_response = on_response

    # MITIGATOR Challenge Response Packet
    def is_mcr_packet(self, payload):
        signatures = {
            b"\x4d\x43\x52\x48\x33\x31\x31\x30",
            b"\xe9\x71\x2d\xd5\x00\x01\x00\x00",
            b"\xe9\x71\x2d\xd5\x01\x01\x00\x00",
            b"\xe9\x71\x2d\xd5\x11\x01\x00\x00",
        }
        return payload[:8] in signatures

    def handle_payload(self, payload):
        if self.is_mcr_packet(payload):
            return

        payload = memoryview(payload)
        if len(payload) < PHOTON_HEADER_LENGTH:
            return

        try:
            offset = 0
            _, offset = self.read_short(payload, offset)
            flags, offset = self.read_byte(payload, offset)
            command_count, offset = self.read_byte(payload, offset)
            _, offset = self.read_int(payload, offset)
            _, offset = self.read_int(payload, offset)
        except (EOFError, struct.error):
            return

        if flags == 1:
            return

        if flags == 0xCC:
            if len(payload) < offset + 4:
                return

            crc = struct.unpack_from(">I", payload, 0)[0]
            payload_with_zeroed_crc = bytearray(payload)
            struct.pack_into(">I", payload_with_zeroed_crc, offset, 0)

            if crc != CrcCalculator.calculate(
                payload_with_zeroed_crc, len(payload_with_zeroed_crc)
            ):
                return

        for _ in range(command_count):
            offset = self.handle_command(payload, offset)
            if offset is None:
                return

    def handle_command(self, source: memoryview, offset: int):
        try:
            command_type, offset = self.read_byte(source, offset)
            _, offset = self.read_byte(source, offset)
            _, offset = self.read_byte(source, offset)
            offset = self.skip_bytes(source, offset, 1)
            command_length, offset = self.read_int(source, offset)
            _, offset = self.read_int(source, offset)
        except (EOFError, struct.error):
            return None

        command_length -= COMMAND_HEADER_LENGTH
        if command_length < 0:
            return None

        if command_type == CommandType.Disconnect.value:
            return offset
        if command_type == CommandType.SendUnreliable.value:
            try:
                offset = self.skip_bytes(source, offset, 4)
            except EOFError:
                return None

            command_length -= 4
            if command_length < 0:
                return None

            return self.handle_send_reliable(source, offset, command_length)
        if command_type == CommandType.SendReliable.value:
            return self.handle_send_reliable(source, offset, command_length)
        if command_type == CommandType.SendFragment.value:
            return self.handle_send_fragment(source, offset, command_length)

        try:
            return self.skip_bytes(source, offset, command_length)
        except EOFError:
            return None

    def handle_send_reliable(
        self, source: memoryview, offset: int, command_length: int
    ):
        try:
            offset = self.skip_bytes(source, offset, 1)
            command_length -= 1
            message_type, offset = self.read_byte(source, offset)
            command_length -= 1
        except (EOFError, struct.error):
            return None

        if command_length < 0:
            return None

        operation_end = offset + command_length
        if operation_end > len(source):
            return None

        payload = io.BytesIO(source[offset:operation_end].tobytes())
        offset = operation_end

        try:
            if message_type == MessageType.OperationRequest.value:
                request_data = Protocol18Deserializer.deserialize_operation_request(
                    payload
                )
                self.on_request(request_data)
            elif message_type == MessageType.OperationResponse.value:
                response_data = Protocol18Deserializer.deserialize_operation_response(
                    payload
                )
                self.on_response(response_data)
            elif message_type == MessageType.Event.value:
                event_data = Protocol18Deserializer.deserialize_event_data(payload)
                self.on_event(event_data)
        except (EOFError, ValueError, struct.error):
            return None

        return offset

    def handle_send_fragment(self, source: memoryview, offset: int, command_length: int):
        try:
            start_sequence_number, offset = self.read_int(source, offset)
            command_length -= 4
            _, offset = self.read_int(source, offset)
            command_length -= 4
            _, offset = self.read_int(source, offset)
            command_length -= 4
            total_length, offset = self.read_int(source, offset)
            command_length -= 4
            fragment_offset, offset = self.read_int(source, offset)
            command_length -= 4
        except (EOFError, struct.error):
            return None

        fragment_length = command_length
        if total_length <= 0 or fragment_length <= 0:
            return None

        return self.handle_segmented_payload(
            start_sequence_number,
            total_length,
            fragment_length,
            fragment_offset,
            source,
            offset,
        )

    def handle_finished_segmented_packet(self, total_payload: bytearray):
        self.handle_send_reliable(memoryview(total_payload), 0, len(total_payload))

    def handle_segmented_payload(
        self,
        start_sequence_number,
        total_length,
        fragment_length,
        fragment_offset,
        source: memoryview,
        offset: int,
    ):
        segmented_packet = self.get_segmented_packet(
            start_sequence_number, total_length
        )

        if fragment_offset < 0 or fragment_offset > segmented_packet.total_length:
            self._pending_segments.pop(start_sequence_number, None)
            return None

        fragment_end = fragment_offset + fragment_length
        if fragment_end > segmented_packet.total_length:
            self._pending_segments.pop(start_sequence_number, None)
            return None

        payload_end = offset + fragment_length
        if payload_end > len(source):
            self._pending_segments.pop(start_sequence_number, None)
            return None

        segmented_packet.total_payload[fragment_offset:fragment_end] = source[
            offset:payload_end
        ]

        for index in range(fragment_offset, fragment_end):
            if segmented_packet.received_bytes[index]:
                continue

            segmented_packet.received_bytes[index] = 1
            segmented_packet.received_bytes_count += 1

        if segmented_packet.received_bytes_count >= segmented_packet.total_length:
            self._pending_segments.pop(start_sequence_number, None)
            self.handle_finished_segmented_packet(segmented_packet.total_payload)

        return payload_end

    def get_segmented_packet(self, start_sequence_number, total_length):
        segmented_packet = self._pending_segments.get(start_sequence_number)
        if segmented_packet is not None:
            if segmented_packet.total_length == total_length:
                return segmented_packet

            self._pending_segments.pop(start_sequence_number, None)

        segmented_packet = SegmentedPacket(total_length=total_length)
        self._pending_segments[start_sequence_number] = segmented_packet
        return segmented_packet

    @staticmethod
    def read_byte(source: memoryview, offset: int):
        if offset < 0 or offset >= len(source):
            raise EOFError("Failed to read 1 byte.")

        return source[offset], offset + 1

    @staticmethod
    def read_short(source: memoryview, offset: int):
        if offset < 0 or offset + 2 > len(source):
            raise EOFError("Failed to read 2 bytes.")

        return struct.unpack_from(">h", source, offset)[0], offset + 2

    @staticmethod
    def read_int(source: memoryview, offset: int):
        if offset < 0 or offset + 4 > len(source):
            raise EOFError("Failed to read 4 bytes.")

        return struct.unpack_from(">i", source, offset)[0], offset + 4

    @staticmethod
    def skip_bytes(source: memoryview, offset: int, count: int):
        if count < 0 or offset < 0 or offset + count > len(source):
            raise EOFError(f"Failed to skip {count} bytes.")

        return offset + count
