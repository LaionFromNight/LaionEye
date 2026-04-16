import io
import struct


class NumberSerializer:
    @staticmethod
    def deserialize_int(source: io.BytesIO):
        buffer = source.read(4)
        if len(buffer) != 4:
            raise EOFError("Failed to read 4 bytes.")
        return struct.unpack(">i", buffer)[0]

    @staticmethod
    def deserialize_short(source: io.BytesIO):
        buffer = source.read(2)
        if len(buffer) != 2:
            raise EOFError("Failed to read 2 bytes.")
        return struct.unpack(">h", buffer)[0]

    @staticmethod
    def serialize_int(value, target: io.BytesIO):
        target.write(struct.pack(">i", value))
        return target
