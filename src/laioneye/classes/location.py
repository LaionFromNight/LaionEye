import json
import os
from dataclasses import dataclass


mapsJsonPath = os.path.join(os.path.dirname(__file__), "../resources/maps.json")
with open(mapsJsonPath) as json_file:
    map_data = json.load(json_file)


@dataclass
class Location:
    id: str
    name: str
    type: str

    @classmethod
    def get_location_from_code(cls, code: str):
        location = map_data[code]

        return cls(id=location["id"], name=location["name"], type=location["type"])
