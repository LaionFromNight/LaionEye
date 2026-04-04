from laioneye.classes.character import Character
from laioneye.classes.location import Location
from laioneye.classes.world_data import WorldData
from laioneye.threads.websocket_server import send_event


class WorldDataUtils:
    DUNGEON_TYPE_MARKERS = {"DUNGEON", "EXPEDITION", "HELLGATE"}

    @staticmethod
    def convert_id_to_name(world_data: WorldData, old_id, new_id, char: Character):
        if old_id in world_data.char_id_to_username:
            world_data.char_id_to_username.pop(old_id)  # delete old relative id
        char.id = new_id
        world_data.char_id_to_username[char.id] = char.username  # add new relative id

    @staticmethod
    def set_dungeon_status(world_data: WorldData, location: Location):
        map_type_splitted = set(location.type.split(" "))
        world_data.is_in_dungeon = bool(
            WorldDataUtils.DUNGEON_TYPE_MARKERS.intersection(map_type_splitted)
        )

    def ws_update_location(world_data: WorldData):
        event = {
            "type": "update_location",
            "payload": {
                "map": (
                    world_data.current_map.name if world_data.current_map else "None"
                ),
                # Header uses a boolean, so legacy dungeon history/name tracking is gone.
                "isInDungeon": world_data.is_in_dungeon,
            },
        }
        send_event(event)
