import asyncio
import json
import queue
import threading

import websockets

from laioneye.classes.logger import Logger

logger = Logger(__name__, stdout=True, log_to_file=False)


class WebsocketServer(threading.Thread):
    def __init__(self, name, in_queue) -> None:
        super().__init__()
        self.name = name
        self.in_queue = in_queue
        self.stop_event = threading.Event()
        self.connections = set()

    async def handler(self, websocket):
        from laioneye.classes.dsp_macro_manager import get_dsp_macro_manager
        from laioneye.classes.recorder_manager import get_recorder_manager
        from laioneye.classes.world_data import get_world_data

        self.connections.add(websocket)
        try:
            world_data = get_world_data()
            macro_manager = get_dsp_macro_manager()
            recorder_manager = get_recorder_manager()
            me = world_data.me
            event_init_world = {
                "type": "init_world",
                "payload": {
                    "me": {
                        "username": me.username,
                        "guild": me.guild,
                        "alliance": me.alliance,
                    },
                    "world": {
                        "map": (
                            world_data.current_map.name
                            if world_data.current_map
                            else "zone in to other map to initialize"
                        ),
                        "isInDungeon": world_data.is_in_dungeon,
                    },
                },
            }
            await websocket.send(json.dumps(event_init_world))
            await websocket.send(
                json.dumps(
                    {
                        "type": "macro_state",
                        "payload": macro_manager.get_state(),
                    }
                )
            )
            await websocket.send(
                json.dumps(
                    {
                        "type": "recorder_state",
                        "payload": recorder_manager.get_state(),
                    }
                )
            )
            async for raw_message in websocket:
                try:
                    message = json.loads(raw_message)
                except json.JSONDecodeError:
                    continue

                message_type = message.get("type")
                payload = message.get("payload", {})

                if message_type == "macro_request_state":
                    await websocket.send(
                        json.dumps(
                            {
                                "type": "macro_state",
                                "payload": macro_manager.get_state(),
                            }
                        )
                    )
                elif message_type == "macro_toggle_global":
                    macro_manager.set_global_enabled(bool(payload.get("enabled", False)))
                elif message_type == "macro_toggle_config":
                    macro_manager.set_macro_enabled(
                        str(payload.get("fileName", "")),
                        bool(payload.get("enabled", False)),
                    )
                elif message_type == "macro_save_config":
                    macro_manager.save_config(payload)
                elif message_type == "macro_reload_configs":
                    macro_manager.reload_configs()
                elif message_type == "macro_delete_config":
                    macro_manager.delete_config(str(payload.get("fileName", "")))
                elif message_type == "recorder_request_state":
                    await websocket.send(
                        json.dumps(
                            {
                                "type": "recorder_state",
                                "payload": recorder_manager.get_state(),
                            }
                        )
                    )
                elif message_type == "recorder_save_settings":
                    recorder_manager.save_settings(payload)
                elif message_type == "recorder_toggle_recording":
                    recorder_manager.toggle_recording()
                elif message_type == "recorder_reload_configs":
                    recorder_manager.reload_configs()
                elif message_type == "recorder_rename_temp":
                    recorder_manager.rename_temp_recording(
                        str(payload.get("fileName", "")),
                        str(payload.get("baseName", "")),
                    )
                elif message_type == "recorder_save_template":
                    recorder_manager.save_template(payload)
                elif message_type == "recorder_toggle_template":
                    recorder_manager.set_template_enabled(
                        str(payload.get("fileName", "")),
                        bool(payload.get("enabled", False)),
                    )
                elif message_type == "recorder_toggle_template_binding":
                    recorder_manager.set_template_binding_enabled(
                        str(payload.get("fileName", "")),
                        bool(payload.get("enabled", False)),
                    )
                elif message_type == "recorder_delete_temp":
                    recorder_manager.delete_temp_recording(
                        str(payload.get("fileName", ""))
                    )
                elif message_type == "recorder_delete_template":
                    recorder_manager.delete_template(str(payload.get("fileName", "")))
        finally:
            self.connections.remove(websocket)

    async def main(self):
        async with websockets.serve(self.handler, "", 8081):
            while True:
                if self.stop_event.is_set():
                    return

                while not self.in_queue.empty():
                    if self.stop_event.is_set():
                        return

                    event = self.in_queue.get()
                    if len(self.connections) > 0:
                        # logger.info(f"broadcast {event}")
                        websockets.broadcast(self.connections, json.dumps(event))
                        await asyncio.sleep(0)

                await asyncio.sleep(0)

    def run(self):
        logger.info(f"Thread {self.name} started")

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(self.main())

    def stop(self):
        logger.info(f"Thread {self.name} stopped")
        self.stop_event.set()


event_queue = queue.Queue()
ws_server = WebsocketServer(name="ws_server", in_queue=event_queue)


def send_event(event):
    event_queue.put(event)


def get_ws_server():
    return ws_server
