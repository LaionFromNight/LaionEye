# import json
# import os

# USEIT DURING TESTING
# IGNORED_UNHANDLED_EVENT_NAMES = {
#     "GUILD_UPDATE",
#     "TIME_SYNC",
#     "TREASURE_CHEST_USING_START",
#     "GUILD_PLAYER_UPDATED",
# }

# event_code_json_path = os.path.join(
#     os.path.dirname(__file__), "../../resources/event_code.json"
# )
# with open(event_code_json_path) as json_file:
#     event_code_data = json.load(json_file)

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
from laioneye.classes.logger import Logger
from laioneye.classes.world_data import WorldData
from laioneye.resources.EventCode import EventCode
from laioneye.resources.OperationCode import OperationCode

EVENT_TYPE_PARAMETER = 252
REQUEST_TYPE_PARAMETER = 253
RESPONSE_TYPE_PARAMETER = 253

MOVE_OPERATION_CODES = {OperationCode.MOVE.value, 22}
CHANGE_CLUSTER_OPERATION_CODES = {OperationCode.CHANGE_CLUSTER.value, 41}
logger = Logger(__name__, stdout=True, log_to_file=False)



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
        # self.event_handler[EventCode.RANDOM_DUNGEON_POSITION_INFO.value] = (
        #     radar_event_random_dungeon_position_info
        # )

        # self.event_handler[EventCode.NEW_RANDOM_DUNGEON_EXIT.value] = (
        #     radar_event_new_random_dungeon_exists
        # )


        ## chest
        # self.event_handler[EventCode.NEW_LOOT_CHEST.value] = (
        #     radar_event_new_loot_chest
        # )

        # self.event_handler[EventCode.NEW_MATCH_LOOT_CHEST_OBJECT.value] = (
        #     radar_event_new_match_loot_chest_object
        # )

        # self.event_handler[EventCode.NEW_TREASURE_CHEST.value] = (
        #     radar_event_new_treasure_chest
        # )

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
        for move_operation_code in MOVE_OPERATION_CODES:
            self.request_handler[move_operation_code] = handle_operation_move

        # Response Handler
        self.response_handler[OperationCode.JOIN.value] = handle_operation_join
        for change_cluster_operation_code in CHANGE_CLUSTER_OPERATION_CODES:
            self.response_handler[change_cluster_operation_code] = (
                handle_operation_change_cluster
            )

    @staticmethod
    def _normalize_photon_code(parameters, parameter_key):
        if parameter_key not in parameters:
            return None

        try:
            return int(parameters[parameter_key])
        except (TypeError, ValueError):
            return None

    def on_request(self, world_data: WorldData, parameters):
        request_code = self._normalize_photon_code(parameters, REQUEST_TYPE_PARAMETER)
        if request_code is None:
            return None

        if request_code not in self.request_handler:
            return None

        # if request_code in MOVE_OPERATION_CODES:
        #     logger.info(f"Handled request MOVE ({request_code}) | parameters={parameters}")

        handler = self.request_handler[request_code]
        return handler(world_data, parameters)

    def on_response(self, world_data: WorldData, parameters):
        response_code = self._normalize_photon_code(parameters, RESPONSE_TYPE_PARAMETER)
        if response_code is None:
            return None

        if response_code not in self.response_handler:
            return None

        # if response_code in CHANGE_CLUSTER_OPERATION_CODES:
        #     logger.info(
        #         f"Handled response CHANGE_CLUSTER ({response_code}) | parameters={parameters}"
        #     )

        handler = self.response_handler[response_code]
        return handler(world_data, parameters)

    def on_event(self, world_data: WorldData, parameters):
        handle_event = False
        call_type = None
        
        event_code = self._normalize_photon_code(parameters, EVENT_TYPE_PARAMETER)
        if event_code is not None:
            if event_code in self.event_handler:
                handle_event = True
                call_type = event_code
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
            # if event_code is not None:
            #     event_name = event_code_data.get(str(event_code))
            #     if event_name:
            #         if event_name in IGNORED_UNHANDLED_EVENT_NAMES:
            #             return None
            #         logger.info(
            #             f"Not handled event {event_name} ({event_code}) | parameters={parameters}"
            #         )
            #     else:
            #         logger.info(
            #             f"Unknown event {event_code} | parameters={parameters}"
            #         )
            # else:
            #     logger.info(f"Unknown event without type parameter | parameters={parameters}")
            return None
