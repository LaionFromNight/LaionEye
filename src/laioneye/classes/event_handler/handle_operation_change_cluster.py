from laioneye.classes.event_handler.world_data_utils import WorldDataUtils
from laioneye.classes.location import Location
from laioneye.classes.world_data import WorldData


def handle_operation_change_cluster(world_data: WorldData, parameters):
    world_data.change_equipment_log = {}
    world_data.radar.change_location("handle_operation_change_cluster")

    if 1 in parameters:
        world_data.current_map = Location.get_location_from_code(parameters[1])
        map_type_splitted = set(world_data.current_map.type.split(" "))

        if "ISLAND" in map_type_splitted or "HIDEOUT" in map_type_splitted:
            owner = parameters[2] if 2 in parameters else "Unknown"
            world_data.current_map.name = f"{owner}'s {world_data.current_map.name}"
    elif 0 in parameters:
        world_data.current_map = Location.get_location_from_code(parameters[0])

    if world_data.current_map:
        WorldDataUtils.set_dungeon_status(world_data, world_data.current_map)

    WorldDataUtils.ws_update_location(world_data)
