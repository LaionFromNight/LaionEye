from dataclasses import dataclass, field


@dataclass
class SegmentedPacket:
    total_length: int
    received_bytes_count: int = 0
    total_payload: bytearray = field(init=False)
    received_bytes: bytearray = field(init=False)

    def __post_init__(self):
        self.total_payload = bytearray(self.total_length)
        self.received_bytes = bytearray(self.total_length)
