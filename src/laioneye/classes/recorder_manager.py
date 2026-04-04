from __future__ import annotations

import copy
import json
import os
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

RECORDER_ROOT_DIRECTORY = os.path.join(os.path.expanduser("~"), "LaionEye", "Recorder")
RECORDER_TEMP_DIRECTORY = os.path.join(RECORDER_ROOT_DIRECTORY, "temps")
RECORDER_TEMPLATE_DIRECTORY = os.path.join(RECORDER_ROOT_DIRECTORY, "templates")
RECORDER_SETTINGS_FILE = os.path.join(RECORDER_ROOT_DIRECTORY, "settings.json")
DEFAULT_RECORDING_BINDING = "space"
DEFAULT_RECORDING_NAME = "temp"
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
MOUSE_BUTTON_ALIASES = {
    "button.left": "left",
    "button.middle": "middle",
    "button.right": "right",
}


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def format_name_timestamp(value: str | None) -> str:
    if not value:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return parsed.astimezone().strftime("%Y-%m-%d %H:%M:%S")


def build_temp_display_name(base_name: str, timestamp: str | None) -> str:
    normalized_base_name = base_name.strip() or DEFAULT_RECORDING_NAME
    return f"{normalized_base_name} {format_name_timestamp(timestamp)}"


def normalize_binding_name(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    normalized = normalized.replace("keyboard.key.", "")
    normalized = normalized.replace("pynput.keyboard.key.", "")
    normalized = normalized.replace("key.", "")
    normalized = re.sub(r"[\s-]+", "_", normalized)
    return BINDING_ALIASES.get(normalized, normalized)


def slugify_file_name(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return slug or "record"


@dataclass(slots=True)
class RecorderSettings:
    recording_binding: str = DEFAULT_RECORDING_BINDING
    recording_binding_enabled: bool = True
    next_recording_name: str = DEFAULT_RECORDING_NAME

    @classmethod
    def from_payload(cls, payload: dict[str, Any] | None) -> "RecorderSettings":
        source = payload or {}
        binding = normalize_binding_name(str(source.get("recordingBinding", "")))
        name = str(source.get("nextRecordingName", "")).strip() or DEFAULT_RECORDING_NAME
        return cls(
            recording_binding=binding or DEFAULT_RECORDING_BINDING,
            recording_binding_enabled=bool(source.get("recordingBindingEnabled", True)),
            next_recording_name=name,
        )

    def to_file_payload(self) -> dict[str, Any]:
        return {
            "recordingBinding": self.recording_binding,
            "recordingBindingEnabled": self.recording_binding_enabled,
            "nextRecordingName": self.next_recording_name,
        }

    def to_runtime_payload(self) -> dict[str, Any]:
        return self.to_file_payload()


@dataclass(slots=True)
class RecordedAction:
    type: str
    key: str
    pressed: bool
    delay_ms: float
    x: int | None = None
    y: int | None = None

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "RecordedAction":
        return cls(
            type=str(payload.get("type", "")).strip(),
            key=str(payload.get("key", "")).strip(),
            pressed=bool(payload.get("pressed", False)),
            delay_ms=max(float(payload.get("delay", 0)), 0.0),
            x=int(payload["x"]) if payload.get("x") is not None else None,
            y=int(payload["y"]) if payload.get("y") is not None else None,
        )

    def to_file_payload(self) -> dict[str, Any]:
        payload = {
            "type": self.type,
            "key": self.key,
            "pressed": self.pressed,
            "delay": round(self.delay_ms, 3),
        }
        if self.x is not None:
            payload["x"] = self.x
        if self.y is not None:
            payload["y"] = self.y
        return payload


@dataclass(slots=True)
class TempRecording:
    file_name: str
    base_name: str
    name: str
    actions: list[RecordedAction]
    created_at: str | None = None
    updated_at: str | None = None

    @classmethod
    def from_payload(cls, payload: dict[str, Any], file_name: str) -> "TempRecording":
        created_at = payload.get("createdAt")
        raw_name = str(payload.get("name", "")).strip()
        base_name = str(payload.get("baseName", "")).strip() or raw_name or DEFAULT_RECORDING_NAME
        actions = [
            RecordedAction.from_payload(action_payload)
            for action_payload in payload.get("actions", [])
            if isinstance(action_payload, dict)
        ]
        return cls(
            file_name=file_name,
            base_name=base_name,
            name=raw_name or build_temp_display_name(base_name, created_at),
            actions=actions,
            created_at=created_at,
            updated_at=payload.get("updatedAt"),
        )

    def to_file_payload(self) -> dict[str, Any]:
        return {
            "baseName": self.base_name,
            "name": self.name,
            "actions": [action.to_file_payload() for action in self.actions],
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }

    def to_runtime_payload(self) -> dict[str, Any]:
        return {
            "fileName": self.file_name,
            "baseName": self.base_name,
            "name": self.name,
            "actionCount": len(self.actions),
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }


@dataclass(slots=True)
class RecorderTemplate:
    file_name: str
    name: str
    play_binding: str
    play_binding_enabled: bool
    repeat_until_stopped: bool
    enabled: bool
    actions: list[RecordedAction]
    source_temp_file_names: list[str]
    source_temp_names: list[str]
    created_at: str | None = None
    updated_at: str | None = None

    @classmethod
    def from_payload(cls, payload: dict[str, Any], file_name: str) -> "RecorderTemplate":
        source_temp_file_names = [
            str(item).strip()
            for item in payload.get("sourceTempFileNames", [])
            if str(item).strip()
        ]
        if not source_temp_file_names and payload.get("sourceTempFileName"):
            source_temp_file_names = [str(payload.get("sourceTempFileName")).strip()]

        source_temp_names = [
            str(item).strip()
            for item in payload.get("sourceTempNames", [])
            if str(item).strip()
        ]
        if not source_temp_names and payload.get("sourceTempName"):
            source_temp_names = [str(payload.get("sourceTempName")).strip()]

        actions = [
            RecordedAction.from_payload(action_payload)
            for action_payload in payload.get("actions", [])
            if isinstance(action_payload, dict)
        ]
        return cls(
            file_name=file_name,
            name=str(payload.get("name", "")).strip(),
            play_binding=normalize_binding_name(str(payload.get("playBinding", ""))),
            play_binding_enabled=bool(payload.get("playBindingEnabled", True)),
            repeat_until_stopped=bool(payload.get("repeatUntilStopped", True)),
            enabled=bool(payload.get("enabled", False)),
            actions=actions,
            source_temp_file_names=source_temp_file_names,
            source_temp_names=source_temp_names,
            created_at=payload.get("createdAt"),
            updated_at=payload.get("updatedAt"),
        )

    def to_file_payload(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "playBinding": self.play_binding,
            "playBindingEnabled": self.play_binding_enabled,
            "repeatUntilStopped": self.repeat_until_stopped,
            "enabled": self.enabled,
            "actions": [action.to_file_payload() for action in self.actions],
            "sourceTempFileNames": self.source_temp_file_names,
            "sourceTempNames": self.source_temp_names,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }

    def to_runtime_payload(
        self,
        is_running: bool,
        current_temps: dict[str, TempRecording],
    ) -> dict[str, Any]:
        sources = []
        for index, file_name in enumerate(self.source_temp_file_names):
            current_temp = current_temps.get(file_name)
            fallback_name = (
                self.source_temp_names[index]
                if index < len(self.source_temp_names)
                else file_name
            )
            sources.append(
                {
                    "fileName": file_name,
                    "name": current_temp.name if current_temp is not None else fallback_name,
                    "actionCount": len(current_temp.actions) if current_temp is not None else None,
                    "isMissing": current_temp is None,
                }
            )

        return {
            "fileName": self.file_name,
            "name": self.name,
            "playBinding": self.play_binding,
            "playBindingEnabled": self.play_binding_enabled,
            "repeatUntilStopped": self.repeat_until_stopped,
            "enabled": self.enabled,
            "actionCount": len(self.actions),
            "sources": sources,
            "isRunning": is_running,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }


class RecorderManager:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.stop_event = threading.Event()
        self.started = False
        self.runtime_available = False
        self.runtime_message = "Recorder runtime not initialized yet."
        self.settings = RecorderSettings()
        self.recording = False
        self.current_recording_name = DEFAULT_RECORDING_NAME
        self.current_recording_actions: list[RecordedAction] = []
        self.current_recording_timestamp: float | None = None
        self.temp_recordings: dict[str, TempRecording] = {}
        self.templates: dict[str, RecorderTemplate] = {}
        self.pressed_bindings: set[str] = set()
        self.running_templates: set[str] = set()
        self.template_workers: dict[str, threading.Thread] = {}
        self.template_stop_events: dict[str, threading.Event] = {}
        self.keyboard_listener = None
        self.mouse_listener = None
        self.keyboard_controller = None
        self.mouse_controller = None
        self.keyboard_module = None
        self.mouse_module = None

        os.makedirs(RECORDER_ROOT_DIRECTORY, exist_ok=True)
        os.makedirs(RECORDER_TEMP_DIRECTORY, exist_ok=True)
        os.makedirs(RECORDER_TEMPLATE_DIRECTORY, exist_ok=True)
        self._load_settings()
        self._load_temp_recordings_from_disk()
        self._load_templates_from_disk()

    def start(self) -> None:
        with self.lock:
            if self.started:
                return
            self.started = True
            self.stop_event.clear()
            self._load_settings()
            self._load_temp_recordings_from_disk()
            self._load_templates_from_disk()

        self._start_runtime()
        self.broadcast_state("Recorder manager ready.")

    def stop(self) -> None:
        with self.lock:
            self.stop_event.set()
            listeners = [self.keyboard_listener, self.mouse_listener]
            self.keyboard_listener = None
            self.mouse_listener = None
            template_stop_events = list(self.template_stop_events.values())
            self.template_stop_events.clear()
            self.pressed_bindings.clear()

        for stop_flag in template_stop_events:
            stop_flag.set()

        for listener in listeners:
            if listener is None:
                continue
            try:
                listener.stop()
            except Exception:
                logger.exception("Failed to stop Recorder listener.")

    def get_state(self, message: str | None = None) -> dict[str, Any]:
        with self.lock:
            return {
                "directories": {
                    "root": RECORDER_ROOT_DIRECTORY,
                    "temps": RECORDER_TEMP_DIRECTORY,
                    "templates": RECORDER_TEMPLATE_DIRECTORY,
                },
                "settings": self.settings.to_runtime_payload(),
                "runtimeAvailable": self.runtime_available,
                "runtimeMessage": self.runtime_message,
                "isRecording": self.recording,
                "currentRecordingName": self.current_recording_name if self.recording else "",
                "message": message or "",
                "temps": [
                    recording.to_runtime_payload()
                    for recording in sorted(
                        self.temp_recordings.values(),
                        key=lambda item: item.updated_at or "",
                        reverse=True,
                    )
                ],
                "templates": [
                    template.to_runtime_payload(
                        is_running=template.file_name in self.running_templates,
                        current_temps=self.temp_recordings,
                    )
                    for template in sorted(
                        self.templates.values(), key=lambda item: item.name.lower()
                    )
                ],
            }

    def broadcast_state(self, message: str | None = None) -> None:
        from laioneye.threads.websocket_server import send_event

        send_event({"type": "recorder_state", "payload": self.get_state(message)})

    def reload_configs(self) -> None:
        with self.lock:
            self._load_settings()
            self._load_temp_recordings_from_disk()
            self._load_templates_from_disk()
        self.broadcast_state("Recorder configs reloaded from disk.")

    def save_settings(self, payload: dict[str, Any]) -> None:
        settings = RecorderSettings.from_payload(payload)
        with self.lock:
            self.settings = settings
            self._write_settings()
        self.broadcast_state("Recorder settings saved.")

    def toggle_recording(self) -> None:
        with self.lock:
            if not self.runtime_available:
                message = "Recorder runtime is not available."
            elif self.recording:
                message = self._stop_recording_locked()
            else:
                message = self._start_recording_locked()

        self.broadcast_state(message)

    def save_template(self, payload: dict[str, Any]) -> None:
        raw_file_name = str(payload.get("fileName", "")).strip()
        template_name = str(payload.get("name", "")).strip()
        play_binding = normalize_binding_name(str(payload.get("playBinding", "")))
        source_temp_file_names = [
            str(item).strip()
            for item in payload.get("sourceTempFileNames", [])
            if str(item).strip()
        ]
        if not source_temp_file_names and payload.get("sourceTempFileName"):
            source_temp_file_names = [str(payload.get("sourceTempFileName")).strip()]

        if not template_name:
            self.broadcast_state("Template name is required.")
            return

        play_binding_enabled = bool(payload.get("playBindingEnabled", True))
        if play_binding_enabled and not play_binding:
            self.broadcast_state("Template playback binding is required.")
            return

        if not source_temp_file_names:
            self.broadcast_state("Add at least one temp recording to the template.")
            return

        with self.lock:
            target_file_name = raw_file_name or self._build_available_file_name(
                template_name,
                RECORDER_TEMPLATE_DIRECTORY,
                self.templates,
            )
            previous = self.templates.get(target_file_name)
            actions: list[RecordedAction] = []
            source_temp_names: list[str] = []
            for source_file_name in source_temp_file_names:
                source_recording = self.temp_recordings.get(source_file_name)
                if source_recording is None:
                    self.broadcast_state(
                        "One of the selected temp recordings does not exist anymore."
                    )
                    return
                actions.extend(copy.deepcopy(source_recording.actions))
                source_temp_names.append(source_recording.name)

            if not actions:
                self.broadcast_state("Selected temp recordings have no actions.")
                return

            template = RecorderTemplate(
                file_name=target_file_name,
                name=template_name,
                play_binding=play_binding,
                play_binding_enabled=play_binding_enabled,
                repeat_until_stopped=bool(payload.get("repeatUntilStopped", True)),
                enabled=bool(payload.get("enabled", False)),
                actions=actions,
                source_temp_file_names=source_temp_file_names,
                source_temp_names=source_temp_names,
                created_at=previous.created_at if previous is not None else utc_timestamp(),
                updated_at=utc_timestamp(),
            )
            self.templates[target_file_name] = template
            self._write_template(template)

        self.broadcast_state(f"Template saved: {template.name}")

    def delete_temp_recording(self, file_name: str) -> None:
        target_file_name = str(file_name).strip()
        if not target_file_name:
            self.broadcast_state("Temp file name is required for delete.")
            return

        with self.lock:
            recording = self.temp_recordings.get(target_file_name)
            if recording is None:
                self.broadcast_state("Selected temp recording does not exist anymore.")
                return

            file_path = os.path.join(RECORDER_TEMP_DIRECTORY, target_file_name)
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as exc:
                self.broadcast_state(f"Failed to delete temp recording: {exc}")
                return

            self.temp_recordings.pop(target_file_name, None)

        self.broadcast_state(f"Temp deleted: {recording.name}")

    def rename_temp_recording(self, file_name: str, base_name: str) -> None:
        target_file_name = str(file_name).strip()
        normalized_base_name = str(base_name).strip()
        if not target_file_name:
            self.broadcast_state("Temp file name is required for rename.")
            return

        if not normalized_base_name:
            self.broadcast_state("Temp name is required.")
            return

        with self.lock:
            recording = self.temp_recordings.get(target_file_name)
            if recording is None:
                self.broadcast_state("Selected temp recording does not exist anymore.")
                return

            recording.base_name = normalized_base_name
            recording.name = build_temp_display_name(
                normalized_base_name,
                recording.created_at or recording.updated_at or utc_timestamp(),
            )
            recording.updated_at = utc_timestamp()
            self._write_temp_recording(recording)

        self.broadcast_state(f"Temp renamed: {recording.name}")

    def delete_template(self, file_name: str) -> None:
        target_file_name = str(file_name).strip()
        if not target_file_name:
            self.broadcast_state("Template file name is required for delete.")
            return

        with self.lock:
            template = self.templates.get(target_file_name)
            if template is None:
                self.broadcast_state("Selected template does not exist anymore.")
                return

            stop_flag = self.template_stop_events.get(target_file_name)
            if stop_flag is not None:
                stop_flag.set()

            file_path = os.path.join(RECORDER_TEMPLATE_DIRECTORY, target_file_name)
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as exc:
                self.broadcast_state(f"Failed to delete template: {exc}")
                return

            self.templates.pop(target_file_name, None)
            self.running_templates.discard(target_file_name)
            self.template_stop_events.pop(target_file_name, None)
            self.template_workers.pop(target_file_name, None)

        self.broadcast_state(f"Template deleted: {template.name}")

    def set_template_enabled(self, file_name: str, enabled: bool) -> None:
        with self.lock:
            template = self.templates.get(file_name)
            if template is None:
                self.broadcast_state("Selected template does not exist anymore.")
                return

            template.enabled = enabled
            template.updated_at = utc_timestamp()
            self._write_template(template)

            stop_flag = self.template_stop_events.get(file_name)
            if stop_flag is not None and not enabled:
                stop_flag.set()

        self.broadcast_state(
            f"Template {'enabled' if enabled else 'disabled'}: {template.name}"
        )

    def set_template_binding_enabled(self, file_name: str, enabled: bool) -> None:
        with self.lock:
            template = self.templates.get(file_name)
            if template is None:
                self.broadcast_state("Selected template does not exist anymore.")
                return

            template.play_binding_enabled = enabled
            template.updated_at = utc_timestamp()
            self._write_template(template)

        self.broadcast_state(
            f"Template binding {'enabled' if enabled else 'disabled'}: {template.name}"
        )

    def _start_runtime(self) -> None:
        try:
            from pynput import keyboard, mouse
        except Exception as exc:
            self.runtime_available = False
            self.runtime_message = "pynput is not available. Install dependencies to run Recorder."
            logger.info(self.runtime_message)
            logger.info(str(exc))
            return

        runtime_ready, runtime_message = prepare_pynput_runtime(logger)
        if not runtime_ready:
            self.runtime_available = False
            self.runtime_message = runtime_message or (
                "Recorder runtime could not initialize macOS input monitoring."
            )
            logger.info(self.runtime_message)
            return

        try:
            with self.lock:
                self.keyboard_module = keyboard
                self.mouse_module = mouse
                self.keyboard_controller = keyboard.Controller()
                self.mouse_controller = mouse.Controller()
                self.keyboard_listener = keyboard.Listener(
                    on_press=self._on_press_key,
                    on_release=self._on_release_key,
                )
                self.mouse_listener = mouse.Listener(on_click=self._on_click)
                start_pynput_listener(self.keyboard_listener)
                start_pynput_listener(self.mouse_listener)
                self.runtime_available = True
                self.runtime_message = "Recorder runtime is listening for input."
        except Exception:
            logger.exception("Failed to start Recorder pynput listeners.")
            self.runtime_available = False
            self.runtime_message = (
                "Recorder runtime failed to start listeners. Check macOS Accessibility permissions and restart the app."
            )

    def _load_settings(self) -> None:
        if not os.path.exists(RECORDER_SETTINGS_FILE):
            self.settings = RecorderSettings()
            self._write_settings()
            return

        try:
            with open(RECORDER_SETTINGS_FILE, "r", encoding="utf-8") as file:
                payload = json.load(file)
        except Exception as exc:
            logger.info(f"Failed to load recorder settings: {exc}")
            self.settings = RecorderSettings()
            self._write_settings()
            return

        self.settings = RecorderSettings.from_payload(payload)

    def _write_settings(self) -> None:
        with open(RECORDER_SETTINGS_FILE, "w", encoding="utf-8") as file:
            json.dump(self.settings.to_file_payload(), file, indent=2, ensure_ascii=True)

    def _load_temp_recordings_from_disk(self) -> None:
        loaded_recordings: dict[str, TempRecording] = {}

        for entry in sorted(os.listdir(RECORDER_TEMP_DIRECTORY)):
            if not entry.endswith(".json"):
                continue

            file_path = os.path.join(RECORDER_TEMP_DIRECTORY, entry)
            try:
                with open(file_path, "r", encoding="utf-8") as file:
                    payload = json.load(file)
            except Exception as exc:
                logger.info(f"Skipping invalid recorder temp {entry}: {exc}")
                continue

            try:
                recording = TempRecording.from_payload(payload, entry)
            except Exception as exc:
                logger.info(f"Skipping unreadable recorder temp {entry}: {exc}")
                continue

            if not recording.name:
                continue
            loaded_recordings[entry] = recording

        self.temp_recordings = loaded_recordings

    def _load_templates_from_disk(self) -> None:
        loaded_templates: dict[str, RecorderTemplate] = {}

        for entry in sorted(os.listdir(RECORDER_TEMPLATE_DIRECTORY)):
            if not entry.endswith(".json"):
                continue

            file_path = os.path.join(RECORDER_TEMPLATE_DIRECTORY, entry)
            try:
                with open(file_path, "r", encoding="utf-8") as file:
                    payload = json.load(file)
            except Exception as exc:
                logger.info(f"Skipping invalid recorder template {entry}: {exc}")
                continue

            try:
                template = RecorderTemplate.from_payload(payload, entry)
            except Exception as exc:
                logger.info(f"Skipping unreadable recorder template {entry}: {exc}")
                continue

            if not template.name:
                continue
            loaded_templates[entry] = template

        self.templates = loaded_templates

    def _write_temp_recording(self, recording: TempRecording) -> None:
        file_path = os.path.join(RECORDER_TEMP_DIRECTORY, recording.file_name)
        with open(file_path, "w", encoding="utf-8") as file:
            json.dump(recording.to_file_payload(), file, indent=2, ensure_ascii=True)

    def _write_template(self, template: RecorderTemplate) -> None:
        file_path = os.path.join(RECORDER_TEMPLATE_DIRECTORY, template.file_name)
        with open(file_path, "w", encoding="utf-8") as file:
            json.dump(template.to_file_payload(), file, indent=2, ensure_ascii=True)

    def _build_available_file_name(
        self,
        name: str,
        directory: str,
        registry: dict[str, Any],
    ) -> str:
        base_name = slugify_file_name(name)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        candidate = f"{base_name}-{timestamp}.json"
        if candidate not in registry and not os.path.exists(os.path.join(directory, candidate)):
            return candidate

        index = 2
        while True:
            candidate = f"{base_name}-{timestamp}-{index}.json"
            if candidate not in registry and not os.path.exists(
                os.path.join(directory, candidate)
            ):
                return candidate
            index += 1

    def _start_recording_locked(self) -> str:
        self.recording = True
        self.current_recording_name = self.settings.next_recording_name or DEFAULT_RECORDING_NAME
        self.current_recording_actions = []
        self.current_recording_timestamp = time.time()
        return f"Recording started: {self.current_recording_name}"

    def _stop_recording_locked(self) -> str:
        self.recording = False
        self.current_recording_timestamp = None

        if not self.current_recording_actions:
            self.current_recording_actions = []
            name = self.current_recording_name
            self.current_recording_name = self.settings.next_recording_name
            return f"Recording stopped without actions: {name}"

        file_name = self._build_available_file_name(
            self.current_recording_name,
            RECORDER_TEMP_DIRECTORY,
            self.temp_recordings,
        )
        created_at = utc_timestamp()
        recording = TempRecording(
            file_name=file_name,
            base_name=self.current_recording_name,
            name=build_temp_display_name(self.current_recording_name, created_at),
            actions=copy.deepcopy(self.current_recording_actions),
            created_at=created_at,
            updated_at=created_at,
        )
        self.temp_recordings[file_name] = recording
        self._write_temp_recording(recording)
        self.current_recording_actions = []
        self.current_recording_name = self.settings.next_recording_name
        return f"Recording saved: {recording.name}"

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

    def _normalize_mouse_button(self, button: Any) -> str:
        name = getattr(button, "name", None)
        if name:
            return str(name).lower()

        normalized = str(button).lower()
        return MOUSE_BUTTON_ALIASES.get(normalized, normalized.replace("button.", ""))

    def _record_action(
        self,
        action_type: str,
        key: str,
        pressed: bool,
        x: int | None = None,
        y: int | None = None,
    ) -> None:
        with self.lock:
            if not self.recording or self.current_recording_timestamp is None:
                return

            current_timestamp = time.time()
            delay_ms = (current_timestamp - self.current_recording_timestamp) * 1000
            self.current_recording_actions.append(
                RecordedAction(
                    type=action_type,
                    key=key,
                    pressed=pressed,
                    delay_ms=max(delay_ms, 0.0),
                    x=x,
                    y=y,
                )
            )
            self.current_recording_timestamp = current_timestamp

    def _on_press_key(self, key: Any) -> None:
        normalized_key = self._normalize_runtime_key(key)

        with self.lock:
            was_pressed = normalized_key in self.pressed_bindings
            self.pressed_bindings.add(normalized_key)
            recording_binding = normalize_binding_name(self.settings.recording_binding)
            recording_binding_enabled = self.settings.recording_binding_enabled
            should_toggle_recording = (
                recording_binding_enabled
                and normalized_key == recording_binding
                and not was_pressed
            )
            is_recording = self.recording

        if should_toggle_recording:
            self.toggle_recording()
            return

        if is_recording:
            if not was_pressed:
                self._record_action("keyboard", normalized_key, True)
            return

        if was_pressed:
            return

        self._trigger_templates_for_binding(normalized_key)

    def _on_release_key(self, key: Any) -> None:
        normalized_key = self._normalize_runtime_key(key)

        with self.lock:
            self.pressed_bindings.discard(normalized_key)
            is_recording = self.recording
            recording_binding_enabled = self.settings.recording_binding_enabled
            recording_binding = normalize_binding_name(self.settings.recording_binding)

        if (
            is_recording
            and (
                not recording_binding_enabled
                or normalized_key != recording_binding
            )
        ):
            self._record_action("keyboard", normalized_key, False)

    def _on_click(self, x: int, y: int, button: Any, pressed: bool) -> None:
        with self.lock:
            is_recording = self.recording

        if not is_recording:
            return

        self._record_action(
            "mouse",
            self._normalize_mouse_button(button),
            pressed,
            x=x,
            y=y,
        )

    def _trigger_templates_for_binding(self, binding: str) -> None:
        with self.lock:
            matching_templates = [
                template
                for template in self.templates.values()
                if (
                    template.enabled
                    and template.play_binding_enabled
                    and template.play_binding == binding
                )
            ]

        for template in matching_templates:
            if template.repeat_until_stopped:
                self._toggle_repeating_template(template.file_name)
            else:
                self._ensure_template_worker(template.file_name)

    def _toggle_repeating_template(self, file_name: str) -> None:
        with self.lock:
            if file_name in self.running_templates:
                stop_flag = self.template_stop_events.get(file_name)
                if stop_flag is not None:
                    stop_flag.set()
                return

        self._ensure_template_worker(file_name)

    def _ensure_template_worker(self, file_name: str) -> None:
        with self.lock:
            if self.stop_event.is_set() or not self.runtime_available:
                return

            template = self.templates.get(file_name)
            if template is None or not template.enabled:
                return

            existing_worker = self.template_workers.get(file_name)
            if existing_worker is not None and existing_worker.is_alive():
                return

            worker_stop_event = threading.Event()
            worker = threading.Thread(
                target=self._run_template_worker,
                args=(file_name, worker_stop_event),
                daemon=True,
            )
            self.template_stop_events[file_name] = worker_stop_event
            self.template_workers[file_name] = worker

        worker.start()

    def _run_template_worker(self, file_name: str, worker_stop_event: threading.Event) -> None:
        self._set_template_running(file_name, True)

        try:
            while not self.stop_event.is_set() and not worker_stop_event.is_set():
                with self.lock:
                    template = self.templates.get(file_name)

                if template is None or not template.enabled:
                    return

                self._execute_template_once(template, worker_stop_event)

                if not template.repeat_until_stopped:
                    return
        finally:
            self._set_template_running(file_name, False)
            with self.lock:
                self.template_stop_events.pop(file_name, None)
                self.template_workers.pop(file_name, None)

    def _execute_template_once(
        self,
        template: RecorderTemplate,
        worker_stop_event: threading.Event,
    ) -> None:
        for action in template.actions:
            if not self._sleep_with_stop(action.delay_ms, worker_stop_event):
                return

            if not self._template_should_continue(template.file_name, worker_stop_event):
                return

            if action.type == "keyboard":
                resolved_key = self._resolve_key_token(action.key)
                if resolved_key is None or self.keyboard_controller is None:
                    logger.info(
                        f"Skipping unsupported recorder key token '{action.key}' in {template.name}"
                    )
                    continue

                if action.pressed:
                    self.keyboard_controller.press(resolved_key)
                else:
                    self.keyboard_controller.release(resolved_key)
                continue

            if action.type == "mouse":
                resolved_button = self._resolve_mouse_button(action.key)
                if resolved_button is None or self.mouse_controller is None:
                    logger.info(
                        f"Skipping unsupported recorder mouse token '{action.key}' in {template.name}"
                    )
                    continue

                if action.x is not None and action.y is not None:
                    self.mouse_controller.position = (action.x, action.y)

                if action.pressed:
                    self.mouse_controller.press(resolved_button)
                else:
                    self.mouse_controller.release(resolved_button)

    def _sleep_with_stop(self, delay_ms: float, worker_stop_event: threading.Event) -> bool:
        remaining = max(delay_ms, 0.0) / 1000
        while remaining > 0:
            if self.stop_event.is_set() or worker_stop_event.is_set():
                return False

            chunk = min(remaining, 0.02)
            time.sleep(chunk)
            remaining -= chunk
        return True

    def _template_should_continue(
        self,
        file_name: str,
        worker_stop_event: threading.Event,
    ) -> bool:
        with self.lock:
            template = self.templates.get(file_name)
            return (
                template is not None
                and template.enabled
                and not self.stop_event.is_set()
                and not worker_stop_event.is_set()
            )

    def _resolve_key_token(self, token: str) -> Any:
        normalized = normalize_binding_name(token)
        if not normalized:
            return None

        if normalized == "space":
            return " "

        if len(normalized) == 1:
            return normalized

        if self.keyboard_module is None:
            return None

        return getattr(self.keyboard_module.Key, normalized, None)

    def _resolve_mouse_button(self, token: str) -> Any:
        normalized = str(token or "").strip().lower()
        if not normalized or self.mouse_module is None:
            return None

        return getattr(self.mouse_module.Button, normalized, None)

    def _set_template_running(self, file_name: str, is_running: bool) -> None:
        with self.lock:
            if is_running:
                self.running_templates.add(file_name)
            else:
                self.running_templates.discard(file_name)

        self.broadcast_state()


recorder_manager = RecorderManager()


def get_recorder_manager() -> RecorderManager:
    return recorder_manager
