import { useContext, useEffect, useMemo, useState } from "react";
import {
  Autorenew,
  Bolt,
  DeleteOutline,
  FileDownload,
  Keyboard,
  PlaylistAdd,
  Save,
  SettingsPower,
} from "@mui/icons-material";
import app from "../App.module.css";
import styles from "./DSPMacro.module.css";
import { WebsocketContext } from "../providers/WebsocketProvider";
import { detectBindingFromKeyboardEvent } from "../utils/keyBinding";

type MacroConfig = {
  fileName: string;
  name: string;
  binding: string;
  combinations: string[];
  autoRepeatDelayMinMs: number;
  autoRepeatDelayMaxMs: number;
  repeatUntilReleased: boolean;
  enabled: boolean;
  blockOnRightClick: boolean;
  isRunning: boolean;
};

type MacroState = {
  directory: string;
  globalEnabled: boolean;
  runtimeAvailable: boolean;
  runtimeMessage: string;
  message: string;
  macros: MacroConfig[];
};

type MacroDraft = {
  fileName: string;
  name: string;
  binding: string;
  combinationsText: string;
  autoRepeatDelayMinMs: string;
  autoRepeatDelayMaxMs: string;
  repeatUntilReleased: boolean;
  enabled: boolean;
  blockOnRightClick: boolean;
};

const createEmptyDraft = (): MacroDraft => ({
  fileName: "",
  name: "",
  binding: "space",
  combinationsText: "",
  autoRepeatDelayMinMs: "10",
  autoRepeatDelayMaxMs: "50",
  repeatUntilReleased: true,
  enabled: false,
  blockOnRightClick: true,
});

const draftFromMacro = (macro: MacroConfig): MacroDraft => ({
  fileName: macro.fileName,
  name: macro.name,
  binding: macro.binding,
  combinationsText: macro.combinations.join("\n"),
  autoRepeatDelayMinMs: String(macro.autoRepeatDelayMinMs),
  autoRepeatDelayMaxMs: String(macro.autoRepeatDelayMaxMs),
  repeatUntilReleased: macro.repeatUntilReleased,
  enabled: macro.enabled,
  blockOnRightClick: macro.blockOnRightClick,
});

const INITIAL_STATE: MacroState = {
  directory: "",
  globalEnabled: false,
  runtimeAvailable: false,
  runtimeMessage: "Waiting for backend...",
  message: "",
  macros: [],
};

const DSPMacro = () => {
  const { connectionStatus, lastMessage, sendMessage } = useContext(WebsocketContext);
  const [macroState, setMacroState] = useState<MacroState>(INITIAL_STATE);
  const [draft, setDraft] = useState<MacroDraft>(createEmptyDraft());
  const [selectedFileName, setSelectedFileName] = useState("");
  const [localMessage, setLocalMessage] = useState("");
  const [isCapturingBinding, setIsCapturingBinding] = useState(false);

  useEffect(() => {
    if (connectionStatus !== "Open") return;

    sendMessage({ type: "macro_request_state", payload: {} });
  }, [connectionStatus, sendMessage]);

  useEffect(() => {
    if (lastMessage === null) return;

    const event = JSON.parse(lastMessage.data);
    if (event.type !== "macro_state") return;

    const payload = event.payload as MacroState;
    setMacroState(payload);
    if (payload.message) {
      setLocalMessage(payload.message);
    }
  }, [lastMessage]);

  useEffect(() => {
    if (!selectedFileName) return;

    const selectedMacroStillExists = macroState.macros.some(
      (macro) => macro.fileName === selectedFileName
    );
    if (!selectedMacroStillExists) {
      setSelectedFileName("");
      setDraft(createEmptyDraft());
      setIsCapturingBinding(false);
    }
  }, [macroState.macros, selectedFileName]);

  useEffect(() => {
    if (!isCapturingBinding) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const detectedBinding = detectBindingFromKeyboardEvent(event);
      if (!detectedBinding) return;

      event.preventDefault();
      event.stopPropagation();
      setDraft((previous) => ({ ...previous, binding: detectedBinding }));
      setLocalMessage(`Binding detected: ${detectedBinding}`);
      setIsCapturingBinding(false);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isCapturingBinding]);

  const enabledCount = useMemo(
    () => macroState.macros.filter((macro) => macro.enabled).length,
    [macroState.macros]
  );

  const runningCount = useMemo(
    () => macroState.macros.filter((macro) => macro.isRunning).length,
    [macroState.macros]
  );

  const comboCount = useMemo(
    () =>
      draft.combinationsText
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean).length,
    [draft.combinationsText]
  );

  const selectMacro = (macro: MacroConfig) => {
    setSelectedFileName(macro.fileName);
    setDraft(draftFromMacro(macro));
    setIsCapturingBinding(false);
  };

  const resetDraft = () => {
    setSelectedFileName("");
    setDraft(createEmptyDraft());
    setIsCapturingBinding(false);
  };

  const saveDraft = () => {
    const combinations = draft.combinationsText
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!draft.name.trim()) {
      setLocalMessage("Macro name is required.");
      return;
    }

    if (!draft.binding.trim()) {
      setLocalMessage("Binding is required.");
      return;
    }

    if (combinations.length === 0) {
      setLocalMessage("Add at least one combination.");
      return;
    }

    sendMessage({
      type: "macro_save_config",
      payload: {
        fileName: selectedFileName,
        name: draft.name.trim(),
        binding: draft.binding.trim(),
        combinations,
        autoRepeatDelayMinMs: Number(draft.autoRepeatDelayMinMs) || 0,
        autoRepeatDelayMaxMs: Number(draft.autoRepeatDelayMaxMs) || 0,
        repeatUntilReleased: draft.repeatUntilReleased,
        enabled: draft.enabled,
        blockOnRightClick: draft.blockOnRightClick,
      },
    });
  };

  const deleteMacro = (macro: Pick<MacroConfig, "fileName" | "name">) => {
    if (!window.confirm(`Delete macro "${macro.name}"?`)) {
      return;
    }

    if (selectedFileName === macro.fileName) {
      resetDraft();
    }

    sendMessage({
      type: "macro_delete_config",
      payload: {
        fileName: macro.fileName,
      },
    });
  };

  return (
    <div className={`${app.container} ${styles.page}`}>
      <section className={styles.heroPanel}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>Automation workspace</span>
          <h1 className={styles.heroTitle}>DSP Macro</h1>
          <p className={styles.heroSubtitle}>
            Twórz własne makra, zapisuj je do JSON-ów i uruchamiaj wiele presetów
            równolegle z jednego panelu.
          </p>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Global</span>
            <span className={styles.statValue}>
              {macroState.globalEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Loaded</span>
            <span className={styles.statValue}>{macroState.macros.length}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Enabled</span>
            <span className={styles.statValue}>{enabledCount}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Running</span>
            <span className={styles.statValue}>{runningCount}</span>
          </div>
        </div>
      </section>

      <section className={styles.toolbarPanel}>
        <div className={styles.toolbarBlock}>
          <span className={styles.toolbarLabel}>Config directory</span>
          <span className={styles.directoryValue}>{macroState.directory || "..."}</span>
        </div>

        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => sendMessage({ type: "macro_reload_configs", payload: {} })}
          >
            <FileDownload fontSize="small" />
            Reload folder
          </button>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={resetDraft}
          >
            <PlaylistAdd fontSize="small" />
            New macro
          </button>

          <button
            type="button"
            className={
              macroState.globalEnabled ? styles.dangerButton : styles.primaryButton
            }
            onClick={() =>
              sendMessage({
                type: "macro_toggle_global",
                payload: { enabled: !macroState.globalEnabled },
              })
            }
          >
            <SettingsPower fontSize="small" />
            {macroState.globalEnabled ? "Disable all" : "Enable all"}
          </button>
        </div>
      </section>

      <section
        className={styles.statusPanel}
        data-runtime={macroState.runtimeAvailable ? "ready" : "missing"}
      >
        <div>
          <span className={styles.statusLabel}>Runtime</span>
          <p className={styles.statusText}>{macroState.runtimeMessage}</p>
        </div>
        <div>
          <span className={styles.statusLabel}>Last action</span>
          <p className={styles.statusText}>{localMessage || "No actions yet."}</p>
        </div>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.libraryPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Available presets</span>
              <h2 className={styles.panelTitle}>Saved macros</h2>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => sendMessage({ type: "macro_request_state", payload: {} })}
              title="Refresh state"
            >
              <Autorenew fontSize="small" />
            </button>
          </div>

          <div className={styles.macroList}>
            {macroState.macros.map((macro) => (
              <article
                className={styles.macroCard}
                data-selected={selectedFileName === macro.fileName ? "true" : "false"}
                key={macro.fileName}
              >
                <button
                  type="button"
                  className={styles.cardLoadButton}
                  onClick={() => selectMacro(macro)}
                >
                  <div className={styles.cardTitleRow}>
                    <h3 className={styles.cardTitle}>{macro.name}</h3>
                    {macro.isRunning && <span className={styles.runningDot} />}
                  </div>
                  <div className={styles.cardMeta}>
                    <span>Binding: {macro.binding}</span>
                    <span>{macro.combinations.length} combo lines</span>
                  </div>
                </button>

                <div className={styles.cardFooter}>
                  <span
                    className={styles.stateBadge}
                    data-tone={macro.enabled ? "enabled" : "disabled"}
                  >
                    {macro.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <span
                    className={styles.stateBadge}
                    data-tone={macro.isRunning ? "running" : "idle"}
                  >
                    {macro.isRunning ? "Running" : "Idle"}
                  </span>
                  <button
                    type="button"
                    className={styles.smallButton}
                    onClick={() =>
                      sendMessage({
                        type: "macro_toggle_config",
                        payload: {
                          fileName: macro.fileName,
                          enabled: !macro.enabled,
                        },
                      })
                    }
                  >
                    <Bolt fontSize="small" />
                    {macro.enabled ? "Turn off" : "Turn on"}
                  </button>
                  <button
                    type="button"
                    className={styles.smallDangerButton}
                    onClick={() =>
                      deleteMacro({
                        fileName: macro.fileName,
                        name: macro.name,
                      })
                    }
                  >
                    <DeleteOutline fontSize="small" />
                    Delete
                  </button>
                </div>
              </article>
            ))}

            {macroState.macros.length === 0 && (
              <div className={styles.emptyCard}>
                No macro configs found in the selected folder yet.
              </div>
            )}
          </div>
        </aside>

        <div className={styles.editorPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Editor</span>
              <h2 className={styles.panelTitle}>
                {selectedFileName ? "Edit macro" : "Create macro"}
              </h2>
            </div>
            <div className={styles.editorActions}>
              {selectedFileName && (
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={() =>
                    deleteMacro({
                      fileName: selectedFileName,
                      name: draft.name || "selected macro",
                    })
                  }
                >
                  <DeleteOutline fontSize="small" />
                  Delete JSON
                </button>
              )}
              <button type="button" className={styles.primaryButton} onClick={saveDraft}>
                <Save fontSize="small" />
                Save JSON
              </button>
            </div>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Name</span>
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft((previous) => ({ ...previous, name: event.target.value }))
                }
                placeholder="Frost 1"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Binding</span>
              <div className={styles.bindingRow}>
                <input
                  value={draft.binding}
                  onChange={(event) =>
                    setDraft((previous) => ({ ...previous, binding: event.target.value }))
                  }
                  placeholder="space, cmd, cmd_r, f8, q"
                />
                <button
                  type="button"
                  className={styles.captureButton}
                  data-active={isCapturingBinding ? "true" : "false"}
                  onClick={() => setIsCapturingBinding((previous) => !previous)}
                >
                  <Keyboard fontSize="small" />
                  {isCapturingBinding ? "Listening..." : "Detect key"}
                </button>
              </div>
              <span className={styles.helpText}>
                {isCapturingBinding
                  ? "Press the key you want to bind. Left command is saved as `cmd` on macOS."
                  : "You can type the binding manually or detect it directly from the keyboard."}
              </span>
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Delay min (ms)</span>
              <input
                type="number"
                min={0}
                value={draft.autoRepeatDelayMinMs}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    autoRepeatDelayMinMs: event.target.value,
                  }))
                }
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Delay max (ms)</span>
              <input
                type="number"
                min={0}
                value={draft.autoRepeatDelayMaxMs}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    autoRepeatDelayMaxMs: event.target.value,
                  }))
                }
              />
            </label>

            <div className={styles.fieldWide}>
              <span className={styles.fieldLabel}>Mode</span>
              <div className={styles.toggleRow}>
                <button
                  type="button"
                  className={styles.modeButton}
                  data-active={draft.repeatUntilReleased ? "true" : "false"}
                  onClick={() =>
                    setDraft((previous) => ({
                      ...previous,
                      repeatUntilReleased: true,
                    }))
                  }
                >
                  Repeat until release
                </button>
                <button
                  type="button"
                  className={styles.modeButton}
                  data-active={draft.repeatUntilReleased ? "false" : "true"}
                  onClick={() =>
                    setDraft((previous) => ({
                      ...previous,
                      repeatUntilReleased: false,
                    }))
                  }
                >
                  One-shot combo
                </button>
              </div>
            </div>

            <div className={styles.fieldWide}>
              <span className={styles.fieldLabel}>Advanced</span>
              <div className={styles.checkboxRow}>
                <label className={styles.checkField}>
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        enabled: event.target.checked,
                      }))
                    }
                  />
                  Save as enabled
                </label>
                <label className={styles.checkField}>
                  <input
                    type="checkbox"
                    checked={draft.blockOnRightClick}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        blockOnRightClick: event.target.checked,
                      }))
                    }
                  />
                  Block while right mouse is pressed
                </label>
              </div>
            </div>

            <label className={styles.fieldWide}>
              <span className={styles.fieldLabel}>Combinations</span>
              <textarea
                value={draft.combinationsText}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    combinationsText: event.target.value,
                  }))
                }
                placeholder={"wwwqqwwwqq\neqqqwdqqwqqwqqqwqq"}
                rows={8}
              />
              <span className={styles.helpText}>
                One combination per line. {comboCount} line{comboCount === 1 ? "" : "s"} ready.
              </span>
            </label>
          </div>

          <div className={styles.referencePanel}>
            <div className={styles.referenceCard}>
              <span className={styles.referenceLabel}>Bindings</span>
              <p>Examples: `space`, `cmd_l`, `ctrl_l`, `shift`, `q`, `f8`.</p>
            </div>
            <div className={styles.referenceCard}>
              <span className={styles.referenceLabel}>Combinations</span>
              <p>
                For single keys use compact strings like `fred`. For special keys
                you can also write tokens separated by spaces.
              </p>
            </div>
            <div className={styles.referenceCard}>
              <span className={styles.referenceLabel}>Runtime</span>
              <p>
                Multiple enabled macros can run together. Global switch controls
                all of them at once.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DSPMacro;
