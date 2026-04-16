import io
import struct
from dataclasses import dataclass

from laioneye.photon_packet_parser.event_data import EventData
from laioneye.photon_packet_parser.operation_request import OperationRequest
from laioneye.photon_packet_parser.operation_response import OperationResponse
from laioneye.photon_packet_parser.protocol18_type import Protocol18Type

MAX_SLIM_CUSTOM_TYPE_CODE = 228
BOOL_MASKS = (1, 2, 4, 8, 16, 32, 64, 128)


@dataclass(frozen=True)
class Protocol18CustomType:
    type_code: int
    data: bytes


class Protocol18Deserializer:
    @staticmethod
    def deserialize(input: io.BytesIO, type_code: int | None = None):
        if type_code is None:
            type_code = Protocol18Deserializer.deserialize_byte(input)

        if (
            Protocol18Type.CUSTOM_TYPE_SLIM.value
            <= type_code
            <= MAX_SLIM_CUSTOM_TYPE_CODE
        ):
            return Protocol18Deserializer.deserialize_custom_type(
                input, slim_type_code=type_code
            )

        if type_code == Protocol18Type.BOOLEAN.value:
            return Protocol18Deserializer.deserialize_boolean(input)
        if type_code == Protocol18Type.BYTE.value:
            return Protocol18Deserializer.deserialize_byte(input)
        if type_code == Protocol18Type.SHORT.value:
            return Protocol18Deserializer.deserialize_short(input)
        if type_code == Protocol18Type.FLOAT.value:
            return Protocol18Deserializer.deserialize_float(input)
        if type_code == Protocol18Type.DOUBLE.value:
            return Protocol18Deserializer.deserialize_double(input)
        if type_code == Protocol18Type.STRING.value:
            return Protocol18Deserializer.deserialize_string(input)
        if type_code == Protocol18Type.NULL.value:
            return None
        if type_code == Protocol18Type.COMPRESSED_INT.value:
            return Protocol18Deserializer.read_compressed_int32(input)
        if type_code == Protocol18Type.COMPRESSED_LONG.value:
            return Protocol18Deserializer.read_compressed_int64(input)
        if type_code == Protocol18Type.INT1.value:
            return Protocol18Deserializer.read_int1(input, sign_negative=False)
        if type_code == Protocol18Type.INT1_NEGATIVE.value:
            return Protocol18Deserializer.read_int1(input, sign_negative=True)
        if type_code == Protocol18Type.INT2.value:
            return Protocol18Deserializer.read_int2(input, sign_negative=False)
        if type_code == Protocol18Type.INT2_NEGATIVE.value:
            return Protocol18Deserializer.read_int2(input, sign_negative=True)
        if type_code == Protocol18Type.LONG1.value:
            return Protocol18Deserializer.read_long1(input, sign_negative=False)
        if type_code == Protocol18Type.LONG1_NEGATIVE.value:
            return Protocol18Deserializer.read_long1(input, sign_negative=True)
        if type_code == Protocol18Type.LONG2.value:
            return Protocol18Deserializer.read_long2(input, sign_negative=False)
        if type_code == Protocol18Type.LONG2_NEGATIVE.value:
            return Protocol18Deserializer.read_long2(input, sign_negative=True)
        if type_code == Protocol18Type.CUSTOM.value:
            return Protocol18Deserializer.deserialize_custom_type(input)
        if type_code == Protocol18Type.DICTIONARY.value:
            return Protocol18Deserializer.deserialize_dictionary(input)
        if type_code == Protocol18Type.HASHTABLE.value:
            return Protocol18Deserializer.deserialize_hash_table(input)
        if type_code == Protocol18Type.OBJECTARRAY.value:
            return Protocol18Deserializer.deserialize_object_array(input)
        if type_code == Protocol18Type.OPERATIONREQUEST.value:
            return Protocol18Deserializer.deserialize_operation_request(input)
        if type_code == Protocol18Type.OPERATIONRESPONSE.value:
            return Protocol18Deserializer.deserialize_operation_response(input)
        if type_code == Protocol18Type.EVENTDATA.value:
            return Protocol18Deserializer.deserialize_event_data(input)
        if type_code == Protocol18Type.BOOLEAN_FALSE.value:
            return False
        if type_code == Protocol18Type.BOOLEAN_TRUE.value:
            return True
        if type_code == Protocol18Type.SHORT_ZERO.value:
            return 0
        if type_code == Protocol18Type.INT_ZERO.value:
            return 0
        if type_code == Protocol18Type.LONG_ZERO.value:
            return 0
        if type_code == Protocol18Type.FLOAT_ZERO.value:
            return 0.0
        if type_code == Protocol18Type.DOUBLE_ZERO.value:
            return 0.0
        if type_code == Protocol18Type.BYTE_ZERO.value:
            return 0
        if type_code == Protocol18Type.ARRAY.value:
            return Protocol18Deserializer.deserialize_array_in_array(input)
        if type_code == Protocol18Type.BOOLEANARRAY.value:
            return Protocol18Deserializer.deserialize_boolean_array(input)
        if type_code == Protocol18Type.BYTEARRAY.value:
            return Protocol18Deserializer.deserialize_byte_array(input)
        if type_code == Protocol18Type.SHORTARRAY.value:
            return Protocol18Deserializer.deserialize_short_array(input)
        if type_code == Protocol18Type.FLOATARRAY.value:
            return Protocol18Deserializer.deserialize_float_array(input)
        if type_code == Protocol18Type.DOUBLEARRAY.value:
            return Protocol18Deserializer.deserialize_double_array(input)
        if type_code == Protocol18Type.STRINGARRAY.value:
            return Protocol18Deserializer.deserialize_string_array(input)
        if type_code == Protocol18Type.COMPRESSED_INT_ARRAY.value:
            return Protocol18Deserializer.deserialize_compressed_int_array(input)
        if type_code == Protocol18Type.COMPRESSED_LONG_ARRAY.value:
            return Protocol18Deserializer.deserialize_compressed_long_array(input)
        if type_code == Protocol18Type.CUSTOM_TYPE_ARRAY.value:
            return Protocol18Deserializer.deserialize_custom_type_array(input)
        if type_code == Protocol18Type.DICTIONARY_ARRAY.value:
            return Protocol18Deserializer.deserialize_dictionary_array(input)
        if type_code == Protocol18Type.HASHTABLE_ARRAY.value:
            return Protocol18Deserializer.deserialize_hash_table_array(input)

        raise ValueError(f"Protocol18 type code {type_code} is not supported.")

    @staticmethod
    def deserialize_operation_request(input: io.BytesIO):
        operation_code = Protocol18Deserializer.deserialize_byte(input)
        parameters = Protocol18Deserializer.deserialize_parameter_table(input)
        return OperationRequest(operation_code, parameters)

    @staticmethod
    def deserialize_operation_response(input: io.BytesIO):
        operation_code = Protocol18Deserializer.deserialize_byte(input)
        return_code = Protocol18Deserializer.deserialize_short(input)
        debug_message = Protocol18Deserializer.deserialize(
            input, Protocol18Deserializer.deserialize_byte(input)
        )
        if not isinstance(debug_message, str):
            debug_message = ""
        parameters = Protocol18Deserializer.deserialize_parameter_table(input)
        return OperationResponse(operation_code, return_code, debug_message, parameters)

    @staticmethod
    def deserialize_event_data(input: io.BytesIO):
        code = Protocol18Deserializer.deserialize_byte(input)
        parameters = Protocol18Deserializer.deserialize_parameter_table(input)
        return EventData(code, parameters)

    @staticmethod
    def deserialize_boolean(input: io.BytesIO):
        return Protocol18Deserializer.deserialize_byte(input) != 0

    @staticmethod
    def deserialize_byte(input: io.BytesIO):
        return Protocol18Deserializer.read_exactly(input, 1)[0]

    @staticmethod
    def deserialize_short(input: io.BytesIO):
        return struct.unpack("<h", Protocol18Deserializer.read_exactly(input, 2))[0]

    @staticmethod
    def deserialize_float(input: io.BytesIO):
        return struct.unpack("<f", Protocol18Deserializer.read_exactly(input, 4))[0]

    @staticmethod
    def deserialize_double(input: io.BytesIO):
        return struct.unpack("<d", Protocol18Deserializer.read_exactly(input, 8))[0]

    @staticmethod
    def deserialize_string(input: io.BytesIO):
        string_length = Protocol18Deserializer.read_compressed_uint32(input)
        if string_length == 0:
            return ""

        return Protocol18Deserializer.read_exactly(input, string_length).decode("utf-8")

    @staticmethod
    def deserialize_byte_array(input: io.BytesIO):
        array_length = Protocol18Deserializer.read_compressed_uint32(input)
        return Protocol18Deserializer.read_exactly(input, array_length)

    @staticmethod
    def deserialize_short_array(input: io.BytesIO):
        array_length = Protocol18Deserializer.read_compressed_uint32(input)
        if array_length == 0:
            return []

        buffer = Protocol18Deserializer.read_exactly(input, array_length * 2)
        return list(struct.unpack(f"<{array_length}h", buffer))

    @staticmethod
    def deserialize_float_array(input: io.BytesIO):
        array_length = Protocol18Deserializer.read_compressed_uint32(input)
        if array_length == 0:
            return []

        buffer = Protocol18Deserializer.read_exactly(input, array_length * 4)
        return list(struct.unpack(f"<{array_length}f", buffer))

    @staticmethod
    def deserialize_double_array(input: io.BytesIO):
        array_length = Protocol18Deserializer.read_compressed_uint32(input)
        if array_length == 0:
            return []

        buffer = Protocol18Deserializer.read_exactly(input, array_length * 8)
        return list(struct.unpack(f"<{array_length}d", buffer))

    @staticmethod
    def deserialize_boolean_array(input: io.BytesIO):
        array_length = Protocol18Deserializer.read_compressed_uint32(input)
        output = []
        full_byte_count = array_length // 8

        for _ in range(full_byte_count):
            value = Protocol18Deserializer.deserialize_byte(input)
            for mask in BOOL_MASKS:
                output.append((value & mask) == mask)

        if len(output) < array_length:
            value = Protocol18Deserializer.deserialize_byte(input)
            for mask in BOOL_MASKS:
                if len(output) >= array_length:
                    break
                output.append((value & mask) == mask)

        return output

    @staticmethod
    def deserialize_string_array(input: io.BytesIO):
        array_length = Protocol18Deserializer.read_compressed_uint32(input)
        return [
            Protocol18Deserializer.deserialize_string(input)
            for _ in range(array_length)
        ]

    @staticmethod
    def deserialize_compressed_int_array(input: io.BytesIO):
        array_length = Protocol18Deserializer.read_compressed_uint32(input)
        return [
            Protocol18Deserializer.read_compressed_int32(input)
            for _ in range(array_length)
        ]

    @staticmethod
    def deserialize_compressed_long_array(input: io.BytesIO):
        array_length = Protocol18Deserializer.read_compressed_uint32(input)
        return [
            Protocol18Deserializer.read_compressed_int64(input)
            for _ in range(array_length)
        ]

    @staticmethod
    def deserialize_object_array(input: io.BytesIO):
        array_length = Protocol18Deserializer.read_compressed_uint32(input)
        return [Protocol18Deserializer.deserialize(input) for _ in range(array_length)]

    @staticmethod
    def deserialize_hash_table_array(input: io.BytesIO):
        array_length = Protocol18Deserializer.read_compressed_uint32(input)
        return [
            Protocol18Deserializer.deserialize_hash_table(input)
            for _ in range(array_length)
        ]

    @staticmethod
    def deserialize_dictionary_array(input: io.BytesIO):
        key_type_code, value_type_code = (
            Protocol18Deserializer.deserialize_dictionary_type_with_codes(input)
        )
        array_length = Protocol18Deserializer.read_compressed_uint32(input)
        return [
            Protocol18Deserializer.deserialize_dictionary_elements(
                input, key_type_code, value_type_code
            )
            for _ in range(array_length)
        ]

    @staticmethod
    def deserialize_array_in_array(input: io.BytesIO):
        array_length = Protocol18Deserializer.read_compressed_uint32(input)
        return [Protocol18Deserializer.deserialize(input) for _ in range(array_length)]

    @staticmethod
    def deserialize_hash_table(input: io.BytesIO):
        size = Protocol18Deserializer.read_compressed_uint32(input)
        output = {}

        for _ in range(size):
            key = Protocol18Deserializer.deserialize(input)
            value = Protocol18Deserializer.deserialize(input)
            if key is not None:
                output[key] = value

        return output

    @staticmethod
    def deserialize_dictionary(input: io.BytesIO):
        key_type_code, value_type_code = (
            Protocol18Deserializer.deserialize_dictionary_type_with_codes(input)
        )
        return Protocol18Deserializer.deserialize_dictionary_elements(
            input, key_type_code, value_type_code
        )

    @staticmethod
    def deserialize_dictionary_elements(
        input: io.BytesIO, key_type_code: int, value_type_code: int
    ):
        size = Protocol18Deserializer.read_compressed_uint32(input)
        output = {}

        for _ in range(size):
            key = (
                Protocol18Deserializer.deserialize(input)
                if key_type_code == Protocol18Type.UNKNOWN.value
                else Protocol18Deserializer.deserialize(input, key_type_code)
            )
            value = (
                Protocol18Deserializer.deserialize(input)
                if value_type_code == Protocol18Type.UNKNOWN.value
                else Protocol18Deserializer.deserialize(input, value_type_code)
            )

            if key is not None:
                output[key] = value

        return output

    @staticmethod
    def deserialize_dictionary_type_with_codes(input: io.BytesIO):
        key_type_code = Protocol18Deserializer.deserialize_byte(input)
        value_type_code = Protocol18Deserializer.deserialize_byte(input)

        if value_type_code == Protocol18Type.DICTIONARY.value:
            Protocol18Deserializer.deserialize_dictionary_type(input)
        elif value_type_code == Protocol18Type.ARRAY.value:
            Protocol18Deserializer.consume_dictionary_array_type(input)
            value_type_code = Protocol18Type.UNKNOWN.value

        return key_type_code, value_type_code

    @staticmethod
    def deserialize_dictionary_type(input: io.BytesIO):
        Protocol18Deserializer.deserialize_byte(input)
        value_type_code = Protocol18Deserializer.deserialize_byte(input)

        if value_type_code == Protocol18Type.DICTIONARY.value:
            Protocol18Deserializer.deserialize_dictionary_type(input)
        elif value_type_code == Protocol18Type.ARRAY.value:
            Protocol18Deserializer.consume_dictionary_array_type(input)

    @staticmethod
    def consume_dictionary_array_type(input: io.BytesIO):
        type_code = Protocol18Deserializer.deserialize_byte(input)

        while type_code == Protocol18Type.ARRAY.value:
            type_code = Protocol18Deserializer.deserialize_byte(input)

    @staticmethod
    def deserialize_parameter_table(input: io.BytesIO):
        size = Protocol18Deserializer.deserialize_byte(input)
        parameters = {}

        for _ in range(size):
            key = Protocol18Deserializer.deserialize_byte(input)
            value_type_code = Protocol18Deserializer.deserialize_byte(input)
            parameters[key] = Protocol18Deserializer.deserialize(input, value_type_code)

        return parameters

    @staticmethod
    def deserialize_custom_type(input: io.BytesIO, slim_type_code: int = 0):
        type_code = (
            Protocol18Deserializer.deserialize_byte(input)
            if slim_type_code == 0
            else slim_type_code - Protocol18Type.CUSTOM_TYPE_SLIM.value
        )
        length = Protocol18Deserializer.read_compressed_uint32(input)
        data = Protocol18Deserializer.read_exactly(input, length)
        return Protocol18CustomType(type_code, data)

    @staticmethod
    def deserialize_custom_type_array(input: io.BytesIO):
        array_length = Protocol18Deserializer.read_compressed_uint32(input)
        type_code = Protocol18Deserializer.deserialize_byte(input)
        output = []

        for _ in range(array_length):
            length = Protocol18Deserializer.read_compressed_uint32(input)
            data = Protocol18Deserializer.read_exactly(input, length)
            output.append(Protocol18CustomType(type_code, data))

        return output

    @staticmethod
    def read_int1(input: io.BytesIO, sign_negative: bool):
        value = Protocol18Deserializer.deserialize_byte(input)
        return -value if sign_negative else value

    @staticmethod
    def read_int2(input: io.BytesIO, sign_negative: bool):
        value = Protocol18Deserializer.read_ushort(input)
        return -value if sign_negative else value

    @staticmethod
    def read_long1(input: io.BytesIO, sign_negative: bool):
        value = Protocol18Deserializer.deserialize_byte(input)
        return -value if sign_negative else value

    @staticmethod
    def read_long2(input: io.BytesIO, sign_negative: bool):
        value = Protocol18Deserializer.read_ushort(input)
        return -value if sign_negative else value

    @staticmethod
    def read_compressed_int32(input: io.BytesIO):
        return Protocol18Deserializer.decode_zigzag32(
            Protocol18Deserializer.read_compressed_uint32(input)
        )

    @staticmethod
    def read_compressed_int64(input: io.BytesIO):
        return Protocol18Deserializer.decode_zigzag64(
            Protocol18Deserializer.read_compressed_uint64(input)
        )

    @staticmethod
    def read_compressed_uint32(input: io.BytesIO):
        value = 0
        shift = 0

        while shift != 35:
            current = Protocol18Deserializer.deserialize_byte(input)
            value |= (current & 0x7F) << shift
            shift += 7

            if (current & 0x80) == 0:
                return value

        return value

    @staticmethod
    def read_compressed_uint64(input: io.BytesIO):
        value = 0
        shift = 0

        while shift != 70:
            current = Protocol18Deserializer.deserialize_byte(input)
            value |= (current & 0x7F) << shift
            shift += 7

            if (current & 0x80) == 0:
                return value

        return value

    @staticmethod
    def read_ushort(input: io.BytesIO):
        return struct.unpack("<H", Protocol18Deserializer.read_exactly(input, 2))[0]

    @staticmethod
    def read_exactly(input: io.BytesIO, count: int):
        if count == 0:
            return b""

        buffer = input.read(count)
        if len(buffer) != count:
            raise EOFError(f"Failed to read {count} bytes from the Protocol18 payload.")

        return buffer

    @staticmethod
    def decode_zigzag32(value: int):
        return (value >> 1) ^ -(value & 1)

    @staticmethod
    def decode_zigzag64(value: int):
        return (value >> 1) ^ -(value & 1)
