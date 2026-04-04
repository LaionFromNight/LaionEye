from uuid import UUID

from laioneye.classes.character import Character
from laioneye.classes.coords import Coords
from laioneye.classes.location import Location
from laioneye.classes.radar import Radar


class WorldData:

    def __init__(self) -> None:
        self.me: Character = Character(
            id=None,
            uuid=None,
            username="not initialized",
            guild="not initialized",
            alliance="not initialized",
            coords=Coords(0, 0),
        )
        self.current_map: Location = None
        self.is_in_dungeon: bool = False
        self.radar: Radar = Radar()
        self.characters: dict[str, Character] = {}
        self.char_id_to_username: dict[int, str] = {self.me.id: self.me.username}
        self.char_uuid_to_username: dict[UUID, str] = {self.me.uuid: self.me.username}
        self.change_equipment_log: dict[int, list] = {}


world_data = WorldData()


def get_world_data():
    return world_data
