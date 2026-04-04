from laioneye.classes.event_handler.world_data_utils import WorldDataUtils
from laioneye.classes.location import Location
from laioneye.classes.utils import Utils
from laioneye.classes.world_data import WorldData
from laioneye.threads.websocket_server import send_event


def handle_operation_join(world_data: WorldData, parameters):
    # set my character
    world_data.me.username = parameters[2]
    world_data.me.uuid = Utils.convert_int_arr_to_uuid(parameters[1])
    world_data.me.guild = parameters[57] if 57 in parameters else ""
    world_data.me.alliance = parameters[78] if 78 in parameters else ""
    # update relative id if character has initialized before
    WorldDataUtils.convert_id_to_name(
        world_data,
        old_id=world_data.me.id,
        new_id=parameters[0],
        char=world_data.me,
    )

    if world_data.me.id in world_data.change_equipment_log:
        world_data.me.update_equipment(
            world_data.change_equipment_log[world_data.me.id]
        )

    # put self in characters list
    world_data.characters[world_data.me.username] = world_data.me
    world_data.char_uuid_to_username[world_data.me.uuid] = world_data.me.username

    # TODO: JOIN still does not initialize `current_map` reliably for every zone.
    # The old app forced a zone change after startup; keep that expectation for now.
    if 8 in parameters and parameters[8][0] == "@":
        area = parameters[8].split("@")
        if area[1] == "RANDOMDUNGEON":
            check_map = Location.get_location_from_code(area[1])
            WorldDataUtils.set_dungeon_status(world_data, check_map)

    ws_init_character(world_data)
    WorldDataUtils.ws_update_location(world_data)


def ws_init_character(world_data: WorldData):
    event = {
        "type": "init_character",
        "payload": {
            "username": world_data.me.username,
            "guild": world_data.me.guild,
            "alliance": world_data.me.alliance,
        },
    }
    send_event(event)
