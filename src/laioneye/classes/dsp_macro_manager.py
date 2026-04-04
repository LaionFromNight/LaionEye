from __future__ import annotations

import json
import os
import random
import re
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from laioneye.classes.logger import Logger
from laioneye.classes.pynput_runtime_utils import (
    prepare_pynput_runtime,
    start_pynput_listener,
)

logger = Logger(__name__, stdout=True, log_to_file=False)

MACRO_DIRECTORY = os.path.join(os.path.expanduser("~"), "LaionEye", "DSPMacros")
DEFAULT_DELAY_MIN_MS = 10
DEFAULT_DELAY_MAX_MS = 50
BINDING_ALIASES = {
    "alt_left": "alt",
    "alt_l": "alt",
    "command": "cmd",
    "command_left": "cmd",
    "command_l": "cmd",
    "command_right": "cmd_r",
    "command_r": "cmd_r",
    "control": "ctrl",
    "control_left": "ctrl",
    "control_l": "ctrl",
    "control_right": "ctrl_r",
    "control_r": "ctrl_r",
    "meta": "cmd",
    "meta_left": "cmd",
    "meta_l": "cmd",
    "meta_right": "cmd_r",
    "meta_r": "cmd_r",
    "option": "alt",
    "option_left": "alt",
    "option_l": "alt",
    "option_right": "alt_r",
    "option_r": "alt_r",
    "shift_left": "shift",
    "shift_l": "shift",
    "super": "cmd",
    "super_left": "cmd",
    "super_l": "cmd",
    "super_right": "cmd_r",
    "super_r": "cmd_r",
    "windows": "cmd",
    "win": "cmd",
}


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_binding_name(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    normalized = normalized.replace("keyboard.key.", "")
    normalized = normalized.replace("pynput.keyboard.key.", "")
    normalized = normalized.replace("key.", "")
    normalized = re.sub(r"[\s-]+", "_", normalized)
    return BINDING_ALIASES.get(normalized, normalized)


def slugify_file_name(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return slug or "macro"


@dataclass(slots=True)
class DSPMacroConfig:
    file_name: str
    name: str
    binding: str
    combinations: list[str]
    auto_repeat_delay_min_ms: int = DEFAULT_DELAY_MIN_MS
    auto_repeat_delay_max_ms: int = DEFAULT_DELAY_MAX_MS
    repeat_until_released: bool = True
    enabled: bool = False
    block_on_right_click: bool = True
    created_at: str | None = None
    updated_at: str | None = None

    @classmethod
    def from_payload(cls, payload: dict[str, Any], file_name: str) -> "DSPMacroConfig":
        combinations = [
            str(combination).strip()
            for combination in payload.get("combinations", [])
            if str(combination).strip()
        ]

        delay_min = max(int(payload.get("autoRepeatDelayMinMs", DEFAULT_DELAY_MIN_MS)), 0)
        delay_max = max(int(payload.get("autoRepeatDelayMaxMs", DEFAULT_DELAY_MAX_MS)), 0)

        if delay_max < delay_min:
            delay_min, delay_max = delay_max, delay_min

        return cls(
            file_name=file_name,
            name=str(payload.get("name", "")).strip(),
            binding=normalize_binding_name(str(payload.get("binding", ""))),
            combinations=combinations,
            auto_repeat_delay_min_ms=delay_min,
            auto_repeat_delay_max_ms=delay_max,
            repeat_until_released=bool(payload.get("repeatUntilReleased", True)),
            enabled=bool(payload.get("enabled", False)),
            block_on_right_click=bool(payload.get("blockOnRightClick", True)),
            created_at=payload.get("createdAt"),
            updated_at=payload.get("updatedAt"),
        )

    def to_file_payload(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "binding": self.binding,
            "combinations": self.combinations,
            "autoRepeatDelayMinMs": self.auto_repeat_delay_min_ms,
            "autoRepeatDelayMaxMs": self.auto_repeat_delay_max_ms,
            "repeatUntilReleased": self.repeat_until_released,
            "enabled": self.enabled,
            "blockOnRightClick": self.block_on_right_click,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }

    def to_runtime_payload(self, is_running: bool) -> dict[str, Any]:
        return {
            "fileName": self.file_name,
            "name": self.name,
            "binding": self.binding,
            "combinations": self.combinations,
            "autoRepeatDelayMinMs": self.auto_repeat_delay_min_ms,
            "autoRepeatDelayMaxMs": self.auto_repeat_delay_max_ms,
            "repeatUntilReleased": self.repeat_until_released,
            "enabled": self.enabled,
            "blockOnRightClick": self.block_on_right_click,
            "isRunning": is_running,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }


class DSPMacroManager:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.stop_event = threading.Event()
        self.configs: dict[str, DSPMacroConfig] = {}
        self.global_enabled = False
        self.runtime_available = False
        self.runtime_message = "Macro runtime not initialized yet."
        self.started = False
        self.pressed_bindings: set[str] = set()
        self.right_mouse_pressed = False
        self.worker_threads: dict[str, threading.Thread] = {}
        self.running_macros: set[str] = set()
        self.keyboard_listener = None
        self.mouse_listener = None
        self.keyboard_controller = None
        self.keyboard_module = None
        self.mouse_module = None

        os.makedirs(MACRO_DIRECTORY, exist_ok=True)
        self._ensure_default_configs()
        self._load_configs_from_disk()

    def start(self) -> None:
        with self.lock:
            if self.started:
                return
            self.started = True
            self.stop_event.clear()
            self._load_configs_from_disk()

        self._start_runtime()
        self.broadcast_state("DSP Macro manager ready.")

    def stop(self) -> None:
        with self.lock:
            self.stop_event.set()
            listeners = [self.keyboard_listener, self.mouse_listener]
            self.keyboard_listener = None
            self.mouse_listener = None
            self.pressed_bindings.clear()
            self.right_mouse_pressed = False

        for listener in listeners:
            if listener is None:
                continue
            try:
                listener.stop()
            except Exception:
                logger.exception("Failed to stop DSP Macro listener.")

    def get_state(self, message: str | None = None) -> dict[str, Any]:
        with self.lock:
            macros = [
                config.to_runtime_payload(is_running=config.file_name in self.running_macros)
                for config in sorted(self.configs.values(), key=lambda item: item.name.lower())
            ]
            return {
                "directory": MACRO_DIRECTORY,
                "globalEnabled": self.global_enabled,
                "runtimeAvailable": self.runtime_available,
                "runtimeMessage": self.runtime_message,
                "message": message or "",
                "macros": macros,
            }

    def broadcast_state(self, message: str | None = None) -> None:
        from laioneye.threads.websocket_server import send_event

        send_event({"type": "macro_state", "payload": self.get_state(message)})

    def reload_configs(self) -> None:
        with self.lock:
            self._load_configs_from_disk()
        self.broadcast_state("Macro configs reloaded from disk.")

    def set_global_enabled(self, enabled: bool) -> None:
        with self.lock:
            self.global_enabled = enabled

        self.broadcast_state(
            "DSP Macro globally enabled." if enabled else "DSP Macro globally disabled."
        )

    def set_macro_enabled(self, file_name: str, enabled: bool) -> None:
        with self.lock:
            config = self.configs.get(file_name)
            if config is None:
                self.broadcast_state("Selected macro does not exist anymore.")
                return

            config.enabled = enabled
            config.updated_at = utc_timestamp()
            self._write_config(config)

        self.broadcast_state(
            f"Macro {'enabled' if enabled else 'disabled'}: {config.name}"
        )

    def save_config(self, payload: dict[str, Any]) -> None:
        raw_file_name = str(payload.get("fileName", "")).strip()
        target_file_name = raw_file_name or self._build_available_file_name(
            str(payload.get("name", ""))
        )

        try:
            config = DSPMacroConfig.from_payload(payload, target_file_name)
        except Exception as exc:
            self.broadcast_state(f"Failed to read macro payload: {exc}")
            return

        if not config.name:
            self.broadcast_state("Macro name is required.")
            return

        if not config.binding:
            self.broadcast_state("Macro binding is required.")
            return

        if not config.combinations:
            self.broadcast_state("Add at least one combination before saving.")
            return

        with self.lock:
            previous = self.configs.get(target_file_name)
            config.created_at = previous.created_at if previous else utc_timestamp()
            config.updated_at = utc_timestamp()
            self.configs[target_file_name] = config
            self._write_config(config)

        self.broadcast_state(f"Macro saved: {config.name}")

    def delete_config(self, file_name: str) -> None:
        target_file_name = str(file_name).strip()
        if not target_file_name:
            self.broadcast_state("Macro file name is required for delete.")
            return

        with self.lock:
            config = self.configs.get(target_file_name)
            if config is None:
                self.broadcast_state("Selected macro does not exist anymore.")
                return

            file_path = os.path.join(MACRO_DIRECTORY, target_file_name)
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as exc:
                self.broadcast_state(f"Failed to delete macro: {exc}")
                return

            self.configs.pop(target_file_name, None)
            self.running_macros.discard(target_file_name)
            self.worker_threads.pop(target_file_name, None)

        self.broadcast_state(f"Macro deleted: {config.name}")

    def _start_runtime(self) -> None:
        try:
            from pynput import keyboard, mouse
        except Exception as exc:
            self.runtime_available = False
            self.runtime_message = (
                "pynput is not available. Install dependencies to run DSP Macro."
            )
            logger.info(self.runtime_message)
            logger.info(str(exc))
            return

        runtime_ready, runtime_message = prepare_pynput_runtime(logger)
        if not runtime_ready:
            self.runtime_available = False
            self.runtime_message = runtime_message or (
                "DSP Macro runtime could not initialize macOS input monitoring."
            )
            logger.info(self.runtime_message)
            return

        try:
            with self.lock:
                self.keyboard_module = keyboard
                self.mouse_module = mouse
                self.keyboard_controller = keyboard.Controller()

                self.keyboard_listener = keyboard.Listener(
                    on_press=self._on_press_key,
                    on_release=self._on_release_key,
                )
                self.mouse_listener = mouse.Listener(on_click=self._on_click)

                start_pynput_listener(self.keyboard_listener)
                start_pynput_listener(self.mouse_listener)
                self.runtime_available = True
                self.runtime_message = "DSP Macro runtime is listening for input."
        except Exception:
            logger.exception("Failed to start DSP Macro pynput listeners.")
            self.runtime_available = False
            self.runtime_message = (
                "DSP Macro runtime failed to start listeners. Check macOS Accessibility permissions and restart the app."
            )

    def _ensure_default_configs(self) -> None:
        existing_files = [
            name for name in os.listdir(MACRO_DIRECTORY) if name.endswith(".json")
        ]
        if existing_files:
            return

        defaults = [
            {
                "name": "Frost 1",
                "binding": "cmd_l",
                "combinations": ["wwwqqwwwqq"],
                "autoRepeatDelayMinMs": 10,
                "autoRepeatDelayMaxMs": 50,
                "repeatUntilReleased": True,
                "enabled": False,
                "blockOnRightClick": True,
            },
        ]

        for payload in defaults:
            file_name = self._build_available_file_name(payload["name"])
            config = DSPMacroConfig.from_payload(payload, file_name)
            config.created_at = utc_timestamp()
            config.updated_at = utc_timestamp()
            self._write_config(config)

    def _load_configs_from_disk(self) -> None:
        loaded_configs: dict[str, DSPMacroConfig] = {}

        for entry in sorted(os.listdir(MACRO_DIRECTORY)):
            if not entry.endswith(".json"):
                continue

            file_path = os.path.join(MACRO_DIRECTORY, entry)
            try:
                with open(file_path, "r", encoding="utf-8") as file:
                    payload = json.load(file)
            except Exception as exc:
                logger.info(f"Skipping invalid macro config {entry}: {exc}")
                continue

            try:
                config = DSPMacroConfig.from_payload(payload, entry)
            except Exception as exc:
                logger.info(f"Skipping unreadable macro config {entry}: {exc}")
                continue
            if not config.name:
                continue
            loaded_configs[entry] = config

        self.configs = loaded_configs

    def _write_config(self, config: DSPMacroConfig) -> None:
        file_path = os.path.join(MACRO_DIRECTORY, config.file_name)
        with open(file_path, "w", encoding="utf-8") as file:
            json.dump(config.to_file_payload(), file, indent=2, ensure_ascii=True)

    def _build_available_file_name(self, name: str) -> str:
        base_name = slugify_file_name(name)
        candidate = f"{base_name}.json"

        if candidate not in self.configs and not os.path.exists(
            os.path.join(MACRO_DIRECTORY, candidate)
        ):
            return candidate

        index = 2
        while True:
            candidate = f"{base_name}-{index}.json"
            if candidate not in self.configs and not os.path.exists(
                os.path.join(MACRO_DIRECTORY, candidate)
            ):
                return candidate
            index += 1

    def _normalize_runtime_key(self, key: Any) -> str:
        key_char = getattr(key, "char", None)
        if key_char:
            if key_char == " ":
                return "space"
            return key_char.lower()

        key_name = getattr(key, "name", None)
        if key_name:
            return normalize_binding_name(key_name)

        key_value = getattr(key, "value", None)
        value_char = getattr(key_value, "char", None)
        if value_char:
            if value_char == " ":
                return "space"
            return value_char.lower()

        normalized = str(key).lower()
        if normalized.startswith("key."):
            normalized = normalized.replace("key.", "", 1)
        return normalize_binding_name(normalized)

    def _tokenize_combination(self, combination: str) -> list[str]:
        stripped = combination.strip()
        if not stripped:
            return []
        if " " in stripped:
            return [token for token in stripped.split(" ") if token]
        return list(stripped)

    def _resolve_key_token(self, token: str) -> Any:
        normalized = normalize_binding_name(token)
        if not normalized:
            return None

        if len(normalized) == 1:
            return normalized

        if self.keyboard_module is None:
            return None

        return getattr(self.keyboard_module.Key, normalized, None)

    def _on_press_key(self, key: Any) -> None:
        normalized_key = self._normalize_runtime_key(key)

        with self.lock:
            was_pressed = normalized_key in self.pressed_bindings
            self.pressed_bindings.add(normalized_key)

            if was_pressed or not self.global_enabled:
                return

            matching_configs = [
                config
                for config in self.configs.values()
                if config.enabled and normalize_binding_name(config.binding) == normalized_key
            ]

        for config in matching_configs:
            self._ensure_worker(config.file_name)

    def _on_release_key(self, key: Any) -> None:
        normalized_key = self._normalize_runtime_key(key)
        with self.lock:
            self.pressed_bindings.discard(normalized_key)

    def _on_click(self, _x: int, _y: int, button: Any, pressed: bool) -> None:
        if self.mouse_module is None:
            return

        if button == self.mouse_module.Button.right:
            with self.lock:
                self.right_mouse_pressed = pressed

    def _ensure_worker(self, file_name: str) -> None:
        with self.lock:
            if self.stop_event.is_set() or not self.runtime_available:
                return

            existing_worker = self.worker_threads.get(file_name)
            if existing_worker and existing_worker.is_alive():
                return

            worker = threading.Thread(
                target=self._run_macro_worker,
                args=(file_name,),
                daemon=True,
            )
            self.worker_threads[file_name] = worker

        worker.start()

    def _run_macro_worker(self, file_name: str) -> None:
        self._set_macro_running(file_name, True)

        try:
            while not self.stop_event.is_set():
                with self.lock:
                    config = self.configs.get(file_name)
                    global_enabled = self.global_enabled

                if config is None or not global_enabled or not config.enabled:
                    return

                if config.repeat_until_released and not self._is_binding_pressed(
                    config.binding
                ):
                    return

                self._execute_macro_once(config)

                if not config.repeat_until_released:
                    return
        finally:
            self._set_macro_running(file_name, False)

    def _execute_macro_once(self, config: DSPMacroConfig) -> None:
        for combination in config.combinations:
            for token in self._tokenize_combination(combination):
                while self._should_pause_for_mouse_block(config):
                    time.sleep(0.01)

                if not self._should_continue(config):
                    return

                resolved_key = self._resolve_key_token(token)
                if resolved_key is None or self.keyboard_controller is None:
                    logger.info(f"Skipping unsupported token '{token}' in macro {config.name}")
                    continue

                self.keyboard_controller.press(resolved_key)
                self.keyboard_controller.release(resolved_key)
                time.sleep(self._randomized_delay_seconds(config))

    def _randomized_delay_seconds(self, config: DSPMacroConfig) -> float:
        return random.uniform(
            config.auto_repeat_delay_min_ms,
            config.auto_repeat_delay_max_ms,
        ) / 1000

    def _should_pause_for_mouse_block(self, config: DSPMacroConfig) -> bool:
        with self.lock:
            return (
                config.block_on_right_click
                and self.right_mouse_pressed
                and self.global_enabled
                and not self.stop_event.is_set()
            )

    def _should_continue(self, config: DSPMacroConfig) -> bool:
        with self.lock:
            current = self.configs.get(config.file_name)
            if current is None or not self.global_enabled or not current.enabled:
                return False

            if self.stop_event.is_set():
                return False

            if current.repeat_until_released and not self._is_binding_pressed(
                current.binding
            ):
                return False

            return True

    def _is_binding_pressed(self, binding: str) -> bool:
        normalized_binding = normalize_binding_name(binding)
        with self.lock:
            return normalized_binding in self.pressed_bindings

    def _set_macro_running(self, file_name: str, is_running: bool) -> None:
        with self.lock:
            if is_running:
                self.running_macros.add(file_name)
            else:
                self.running_macros.discard(file_name)

        self.broadcast_state()


macro_manager = DSPMacroManager()


def get_dsp_macro_manager() -> DSPMacroManager:
    return macro_manager
