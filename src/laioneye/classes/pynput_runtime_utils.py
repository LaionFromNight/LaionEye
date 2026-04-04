from __future__ import annotations

import sys
import threading
import time
from typing import Any

_darwin_accessibility_lock = threading.Lock()
_darwin_accessibility_prepared = False
_listener_start_lock = threading.Lock()


def prepare_pynput_runtime(logger: Any) -> tuple[bool, str | None]:
    global _darwin_accessibility_prepared

    if sys.platform != "darwin":
        return True, None

    with _darwin_accessibility_lock:
        if _darwin_accessibility_prepared:
            return True, None

        try:
            import HIServices

            trusted_callback = getattr(HIServices, "AXIsProcessTrusted", None)
            if trusted_callback is None:
                return (
                    False,
                    "macOS Accessibility API could not be resolved. Restart the app and, if needed, reinstall pyobjc/pynput.",
                )

            is_trusted = bool(trusted_callback())
        except Exception as exc:
            logger.exception("Failed to prepare macOS Accessibility API for pynput.")
            return (
                False,
                "macOS Accessibility initialization failed for pynput. Restart Terminal and verify Accessibility permissions.",
            )

        if not is_trusted:
            return (
                False,
                "This process is not trusted by macOS Accessibility. Re-enable Terminal/Python in Privacy & Security > Accessibility.",
            )

        _darwin_accessibility_prepared = True
        return True, None


def start_pynput_listener(listener: Any) -> None:
    with _listener_start_lock:
        listener.start()
        # Give pynput time to resolve macOS APIs before the next listener starts.
        time.sleep(0.1)
