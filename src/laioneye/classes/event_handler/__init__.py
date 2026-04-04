from laioneye.classes.event_handler.handle_event_character_equipment_changed import (
    handle_event_character_equipment_changed,
)
from laioneye.classes.event_handler.handle_event_new_character import (
    handle_event_new_character,
)
from laioneye.classes.event_handler.handle_operation_change_cluster import (
    handle_operation_change_cluster,
)
from laioneye.classes.event_handler.radar_event_harvestable_object import (
    radar_event_new_harvestable_object,
    radar_event_new_simple_harvestable_object,
    radar_event_harvest_change_state,
)
from laioneye.classes.event_handler.radar_event_dungeon_object import (
    radar_event_random_dungeon_position_info,
    radar_event_new_random_dungeon_exists
)

from laioneye.classes.event_handler.radar_event_chest_object import (
    radar_event_new_loot_chest,
    radar_event_new_treasure_chest,
    radar_event_new_match_loot_chest_object
)

from laioneye.classes.event_handler.radar_event_leave import (
    radar_event_leave
)

from laioneye.classes.event_handler.radar_event_mounted import (
    radar_event_mounted
)

from laioneye.classes.event_handler.radar_event_mobs_object import (
    radar_event_new_mob,
    radar_event_mob_change_state
)

from laioneye.classes.event_handler.radar_event_key_sync import (
    radar_event_key_sync
)


from laioneye.classes.event_handler.handle_operation_join import handle_operation_join
from laioneye.classes.event_handler.handle_operation_move import handle_operation_move
from laioneye.classes.world_data import WorldData
from laioneye.resources.EventCode import EventCode
from laioneye.resources.OperationCode import OperationCode

EVENT_TYPE_PARAMETER = 252
REQUEST_TYPE_PARAMETER = 253
RESPONSE_TYPE_PARAMETER = 253


class EventHandler:
    def __init__(self):
        self.request_handler = {}
        self.response_handler = {}
        self.event_handler = {}

        # Shared world state used by header/radar.
        self.event_handler[EventCode.NEW_CHARACTER.value] = handle_event_new_character
        self.event_handler[EventCode.CHARACTER_EQUIPMENT_CHANGED.value] = (
            handle_event_character_equipment_changed
        )

        # Radar Event Handler

        ## Resources
        self.event_handler[EventCode.NEW_HARVESTABLE_OBJECT.value] = (
            radar_event_new_harvestable_object
        )

        self.event_handler[EventCode.HARVESTABLE_CHANGE_STATE.value] = (
            radar_event_harvest_change_state
        )

        self.event_handler[EventCode.NEW_SIMPLE_HARVESTABLE_OBJECT.value] = (
            radar_event_new_simple_harvestable_object
        )

        self.event_handler[EventCode.NEW_SIMPLE_HARVESTABLE_OBJECT_LIST.value] = (
            radar_event_new_simple_harvestable_object
        )

        ## Dungeons
        self.event_handler[EventCode.RANDOM_DUNGEON_POSITION_INFO.value] = (
            radar_event_random_dungeon_position_info
        )

        self.event_handler[EventCode.NEW_RANDOM_DUNGEON_EXIT.value] = (
            radar_event_new_random_dungeon_exists
        )


        ## chest
        self.event_handler[EventCode.NEW_LOOT_CHEST.value] = (
            radar_event_new_loot_chest
        )

        self.event_handler[EventCode.NEW_MATCH_LOOT_CHEST_OBJECT.value] = (
            radar_event_new_match_loot_chest_object
        )

        self.event_handler[EventCode.NEW_TREASURE_CHEST.value] = (
            radar_event_new_treasure_chest
        )

        ## Mobs
        self.event_handler[EventCode.NEW_MOB.value] = radar_event_new_mob
        self.event_handler[EventCode.MOB_CHANGE_STATE.value] = radar_event_mob_change_state

        ## Players
        self.event_handler[EventCode.MOUNTED.value] = radar_event_mounted
        
        ## Sync
        self.event_handler[EventCode.KEY_SYNC.value] = radar_event_key_sync

        ## Handle Action
        self.event_handler[EventCode.LEAVE.value] = radar_event_leave

        # Request Handler
        self.request_handler[OperationCode.MOVE.value] = handle_operation_move

        # Response Handler
        self.response_handler[OperationCode.JOIN.value] = handle_operation_join
        self.response_handler[OperationCode.CHANGE_CLUSTER.value] = (
            handle_operation_change_cluster
        )

    def on_request(self, world_data: WorldData, parameters):
        if REQUEST_TYPE_PARAMETER not in parameters:
            return None

        if parameters[REQUEST_TYPE_PARAMETER] not in self.request_handler:
            return None

        handler = self.request_handler[parameters[REQUEST_TYPE_PARAMETER]]
        return handler(world_data, parameters)

    def on_response(self, world_data: WorldData, parameters):
        if RESPONSE_TYPE_PARAMETER not in parameters:
            return None

        if parameters[RESPONSE_TYPE_PARAMETER] not in self.response_handler:
            return None

        handler = self.response_handler[parameters[RESPONSE_TYPE_PARAMETER]]
        return handler(world_data, parameters)

    def on_event(self, world_data: WorldData, parameters):
        handle_event = False
        call_type = None
        
        if EVENT_TYPE_PARAMETER in parameters:
            if parameters[EVENT_TYPE_PARAMETER] in self.event_handler:
                handle_event = True
                call_type = parameters[EVENT_TYPE_PARAMETER]
        else:
            if len(parameters) == 2 and 1 in parameters and parameters[1][0] == EventCode.MOVE.value:
                handle_event = True
                call_type = EventCode.MOVE.value

        if handle_event:
            if call_type == EventCode.MOVE.value:
                id = parameters[0]
                world_data.radar.handle_event_move(id, parameters)
            else:
                handler = self.event_handler[call_type]
                return handler(world_data, parameters)
        else:
            # if EVENT_TYPE_PARAMETER in parameters:
            #     if str(parameters[EVENT_TYPE_PARAMETER]) in event_code_data:
            #         print(f"Not Handled Event {event_code_data[str(parameters[EVENT_TYPE_PARAMETER])]}: {parameters}")
            #         pass
            #     else:
            #         print(f"Unknown event: {parameters}")
            #         pass
            return None
