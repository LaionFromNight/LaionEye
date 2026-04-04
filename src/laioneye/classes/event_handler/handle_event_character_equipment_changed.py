from laioneye.classes.world_data import WorldData


def handle_event_character_equipment_changed(world_data: WorldData, parameters):
    if 2 not in parameters:
        return

    if parameters[0] in world_data.char_id_to_username:
        username = world_data.char_id_to_username[parameters[0]]
        if username != "not initialized":
            char = world_data.characters[username]
            char.update_equipment(parameters[2])
    else:
        world_data.change_equipment_log[parameters[0]] = parameters[2]

    # TODO: `change_equipment_log` still depends on transient in-game ids.
    # If Albion starts reusing ids more aggressively, move this cache to UUIDs.
    world_data.radar.update_player_equipment(parameters[0], parameters[2])
