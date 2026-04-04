const SPECIAL_BINDING_CODES: Record<string, string> = {
  AltLeft: "alt",
  AltRight: "alt_r",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  Backspace: "backspace",
  ControlLeft: "ctrl",
  ControlRight: "ctrl_r",
  Delete: "delete",
  End: "end",
  Enter: "enter",
  Escape: "esc",
  Home: "home",
  MetaLeft: "cmd",
  MetaRight: "cmd_r",
  PageDown: "page_down",
  PageUp: "page_up",
  ShiftLeft: "shift",
  ShiftRight: "shift_r",
  Space: "space",
  Tab: "tab",
};

const SPECIAL_BINDING_KEYS: Record<string, string> = {
  alt: "alt",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  arrowup: "up",
  " ": "space",
  backspace: "backspace",
  control: "ctrl",
  delete: "delete",
  end: "end",
  enter: "enter",
  escape: "esc",
  home: "home",
  meta: "cmd",
  pagedown: "page_down",
  pageup: "page_up",
  shift: "shift",
  tab: "tab",
};

export const detectBindingFromKeyboardEvent = (
  event: KeyboardEvent
): string | null => {
  const bindingFromCode = SPECIAL_BINDING_CODES[event.code];
  if (bindingFromCode) return bindingFromCode;

  if (/^Key[A-Z]$/.test(event.code)) {
    return event.code.slice(3).toLowerCase();
  }

  if (/^Digit[0-9]$/.test(event.code)) {
    return event.code.slice(5);
  }

  if (/^Numpad[0-9]$/.test(event.code)) {
    return event.code.slice(6);
  }

  if (/^F\d{1,2}$/.test(event.code)) {
    return event.code.toLowerCase();
  }

  const normalizedKey = event.key.toLowerCase();
  if (normalizedKey in SPECIAL_BINDING_KEYS) {
    return SPECIAL_BINDING_KEYS[normalizedKey];
  }

  if (normalizedKey.length === 1) {
    return normalizedKey;
  }

  return null;
};
