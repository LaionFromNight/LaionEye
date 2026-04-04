import { useContext, useEffect, useMemo, useState } from "react";
import {
  Autorenew,
  DeleteOutline,
  FileDownload,
  Keyboard,
  North,
  PlaylistAdd,
  RadioButtonChecked,
  Save,
  SmartDisplay,
  South,
} from "@mui/icons-material";
import app from "../App.module.css";
import styles from "./Recorder.module.css";
import { WebsocketContext } from "../providers/WebsocketProvider";
import { detectBindingFromKeyboardEvent } from "../utils/keyBinding";

type RecorderSettings = {
  recordingBinding: string;
  recordingBindingEnabled: boolean;
  nextRecordingName: string;
};

type RecorderTemp = {
  fileName: string;
  baseName: string;
  name: string;
  actionCount: number;
  createdAt?: string;
  updatedAt?: string;
};

type TemplateSource = {
  fileName: string;
  name: string;
  actionCount: number | null;
  isMissing: boolean;
};

type RecorderTemplate = {
  fileName: string;
  name: string;
  playBinding: string;
  playBindingEnabled: boolean;
  repeatUntilStopped: boolean;
  enabled: boolean;
  actionCount: number;
  sources: TemplateSource[];
  isRunning: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type RecorderState = {
  directories: {
    root: string;
    temps: string;
    templates: string;
  };
  settings: RecorderSettings;
  runtimeAvailable: boolean;
  runtimeMessage: string;
  isRecording: boolean;
  currentRecordingName: string;
  message: string;
  temps: RecorderTemp[];
  templates: RecorderTemplate[];
};

type TemplateDraft = {
  fileName: string;
  name: string;
  sourceTemps: TemplateSource[];
  playBinding: string;
  playBindingEnabled: boolean;
  repeatUntilStopped: boolean;
  enabled: boolean;
};

const INITIAL_STATE: RecorderState = {
  directories: {
    root: "",
    temps: "",
    templates: "",
  },
  settings: {
    recordingBinding: "space",
    recordingBindingEnabled: true,
    nextRecordingName: "temp",
  },
  runtimeAvailable: false,
  runtimeMessage: "Waiting for backend...",
  isRecording: false,
  currentRecordingName: "",
  message: "",
  temps: [],
  templates: [],
};

const createEmptyTemplateDraft = (): TemplateDraft => ({
  fileName: "",
  name: "",
  sourceTemps: [],
  playBinding: "cmd",
  playBindingEnabled: true,
  repeatUntilStopped: true,
  enabled: false,
});

const draftFromTemplate = (template: RecorderTemplate): TemplateDraft => ({
  fileName: template.fileName,
  name: template.name,
  sourceTemps: template.sources,
  playBinding: template.playBinding,
  playBindingEnabled: template.playBindingEnabled,
  repeatUntilStopped: template.repeatUntilStopped,
  enabled: template.enabled,
});

const formatDate = (value?: string): string => {
  if (!value) return "Unknown";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleString();
};

const Recorder = () => {
  const { connectionStatus, lastMessage, sendMessage } = useContext(WebsocketContext);
  const [recorderState, setRecorderState] = useState<RecorderState>(INITIAL_STATE);
  const [settingsDraft, setSettingsDraft] = useState<RecorderSettings>(
    INITIAL_STATE.settings
  );
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(
    createEmptyTemplateDraft()
  );
  const [localMessage, setLocalMessage] = useState("");
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const [isCapturingRecordingBinding, setIsCapturingRecordingBinding] =
    useState(false);
  const [isCapturingTemplateBinding, setIsCapturingTemplateBinding] =
    useState(false);

  useEffect(() => {
    if (connectionStatus !== "Open") return;

    sendMessage({ type: "recorder_request_state", payload: {} });
  }, [connectionStatus, sendMessage]);

  useEffect(() => {
    if (lastMessage === null) return;

    const event = JSON.parse(lastMessage.data);
    if (event.type !== "recorder_state") return;

    const payload = event.payload as RecorderState;
    setRecorderState(payload);
    if (!settingsInitialized) {
      setSettingsDraft(payload.settings);
      setSettingsInitialized(true);
    }
    if (payload.message) {
      setLocalMessage(payload.message);
    }
  }, [lastMessage, settingsInitialized]);

  useEffect(() => {
    if (!templateDraft.fileName) return;

    const templateStillExists = recorderState.templates.some(
      (template) => template.fileName === templateDraft.fileName
    );
    if (!templateStillExists) {
      setTemplateDraft(createEmptyTemplateDraft());
    }
  }, [recorderState.templates, templateDraft.fileName]);

  useEffect(() => {
    setTemplateDraft((previous) => {
      if (previous.sourceTemps.length === 0) {
        return previous;
      }

      let hasChanges = false;
      const nextSources = previous.sourceTemps.map((source) => {
        const currentTemp = recorderState.temps.find(
          (temp) => temp.fileName === source.fileName
        );

        if (currentTemp) {
          const nextSource: TemplateSource = {
            fileName: currentTemp.fileName,
            name: currentTemp.name,
            actionCount: currentTemp.actionCount,
            isMissing: false,
          };

          if (
            nextSource.name !== source.name ||
            nextSource.actionCount !== source.actionCount ||
            nextSource.isMissing !== source.isMissing
          ) {
            hasChanges = true;
            return nextSource;
          }

          return source;
        }

        if (!source.isMissing) {
          hasChanges = true;
          return {
            ...source,
            actionCount: source.actionCount ?? null,
            isMissing: true,
          };
        }

        return source;
      });

      if (!hasChanges) {
        return previous;
      }

      return {
        ...previous,
        sourceTemps: nextSources,
      };
    });
  }, [recorderState.temps]);

  useEffect(() => {
    if (!isCapturingRecordingBinding) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const detectedBinding = detectBindingFromKeyboardEvent(event);
      if (!detectedBinding) return;

      event.preventDefault();
      event.stopPropagation();
      setSettingsDraft((previous) => ({
        ...previous,
        recordingBinding: detectedBinding,
      }));
      setLocalMessage(`Recording binding detected: ${detectedBinding}`);
      setIsCapturingRecordingBinding(false);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isCapturingRecordingBinding]);

  useEffect(() => {
    if (!isCapturingTemplateBinding) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const detectedBinding = detectBindingFromKeyboardEvent(event);
      if (!detectedBinding) return;

      event.preventDefault();
      event.stopPropagation();
      setTemplateDraft((previous) => ({
        ...previous,
        playBinding: detectedBinding,
      }));
      setLocalMessage(`Template binding detected: ${detectedBinding}`);
      setIsCapturingTemplateBinding(false);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isCapturingTemplateBinding]);

  const enabledTemplateCount = useMemo(
    () => recorderState.templates.filter((template) => template.enabled).length,
    [recorderState.templates]
  );

  const runningTemplateCount = useMemo(
    () => recorderState.templates.filter((template) => template.isRunning).length,
    [recorderState.templates]
  );

  const draftHasMissingSources = useMemo(
    () => templateDraft.sourceTemps.some((source) => source.isMissing),
    [templateDraft.sourceTemps]
  );

  const saveSettings = () => {
    if (!settingsDraft.nextRecordingName.trim()) {
      setLocalMessage("Temp recording name is required.");
      return;
    }

    if (
      settingsDraft.recordingBindingEnabled &&
      !settingsDraft.recordingBinding.trim()
    ) {
      setLocalMessage("Recording binding is required while hotkey is enabled.");
      return;
    }

    sendMessage({
      type: "recorder_save_settings",
      payload: {
        recordingBinding: settingsDraft.recordingBinding.trim(),
        recordingBindingEnabled: settingsDraft.recordingBindingEnabled,
        nextRecordingName: settingsDraft.nextRecordingName.trim(),
      },
    });
  };

  const toggleRecording = () => {
    if (!settingsDraft.nextRecordingName.trim()) {
      setLocalMessage("Temp recording name is required.");
      return;
    }

    if (
      settingsDraft.recordingBindingEnabled &&
      !settingsDraft.recordingBinding.trim()
    ) {
      setLocalMessage("Recording binding is required while hotkey is enabled.");
      return;
    }

    sendMessage({
      type: "recorder_save_settings",
      payload: {
        recordingBinding: settingsDraft.recordingBinding.trim(),
        recordingBindingEnabled: settingsDraft.recordingBindingEnabled,
        nextRecordingName: settingsDraft.nextRecordingName.trim(),
      },
    });
    sendMessage({ type: "recorder_toggle_recording", payload: {} });
  };

  const addTempToTemplate = (temp: RecorderTemp) => {
    setTemplateDraft((previous) => ({
      ...previous,
      name:
        previous.fileName || previous.name
          ? previous.name
          : `${temp.baseName} template`,
      sourceTemps: [
        ...previous.sourceTemps,
        {
          fileName: temp.fileName,
          name: temp.name,
          actionCount: temp.actionCount,
          isMissing: false,
        },
      ],
    }));
  };

  const moveTemplateSource = (index: number, direction: "up" | "down") => {
    setTemplateDraft((previous) => {
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= previous.sourceTemps.length) {
        return previous;
      }

      const nextSources = [...previous.sourceTemps];
      const [movedSource] = nextSources.splice(index, 1);
      nextSources.splice(nextIndex, 0, movedSource);
      return {
        ...previous,
        sourceTemps: nextSources,
      };
    });
  };

  const removeTemplateSource = (index: number) => {
    setTemplateDraft((previous) => ({
      ...previous,
      sourceTemps: previous.sourceTemps.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const selectTemplate = (template: RecorderTemplate) => {
    setTemplateDraft(draftFromTemplate(template));
  };

  const resetTemplateDraft = () => {
    setTemplateDraft(createEmptyTemplateDraft());
    setIsCapturingTemplateBinding(false);
  };

  const saveTemplate = () => {
    if (!templateDraft.name.trim()) {
      setLocalMessage("Template name is required.");
      return;
    }

    if (
      templateDraft.playBindingEnabled &&
      !templateDraft.playBinding.trim()
    ) {
      setLocalMessage("Template binding is required while hotkey is enabled.");
      return;
    }

    if (templateDraft.sourceTemps.length === 0) {
      setLocalMessage("Add at least one temp recording to the template.");
      return;
    }

    if (draftHasMissingSources) {
      setLocalMessage("Remove missing temp recordings before saving the template.");
      return;
    }

    sendMessage({
      type: "recorder_save_template",
      payload: {
        fileName: templateDraft.fileName,
        name: templateDraft.name.trim(),
        sourceTempFileNames: templateDraft.sourceTemps.map((source) => source.fileName),
        playBinding: templateDraft.playBinding.trim(),
        playBindingEnabled: templateDraft.playBindingEnabled,
        repeatUntilStopped: templateDraft.repeatUntilStopped,
        enabled: templateDraft.enabled,
      },
    });
  };

  const renameTemp = (temp: RecorderTemp) => {
    const nextBaseName = window.prompt("Rename temp", temp.baseName);
    if (nextBaseName === null) {
      return;
    }

    if (!nextBaseName.trim()) {
      setLocalMessage("Temp name is required.");
      return;
    }

    if (nextBaseName.trim() === temp.baseName) {
      return;
    }

    sendMessage({
      type: "recorder_rename_temp",
      payload: {
        fileName: temp.fileName,
        baseName: nextBaseName.trim(),
      },
    });
  };

  const deleteTemp = (temp: RecorderTemp) => {
    if (!window.confirm(`Delete temp recording "${temp.name}"?`)) {
      return;
    }

    setTemplateDraft((previous) => ({
      ...previous,
      sourceTemps: previous.sourceTemps.filter(
        (source) => source.fileName !== temp.fileName
      ),
    }));

    sendMessage({
      type: "recorder_delete_temp",
      payload: {
        fileName: temp.fileName,
      },
    });
  };

  const deleteTemplate = (template: RecorderTemplate) => {
    if (!window.confirm(`Delete template "${template.name}"?`)) {
      return;
    }

    if (templateDraft.fileName === template.fileName) {
      resetTemplateDraft();
    }

    sendMessage({
      type: "recorder_delete_template",
      payload: {
        fileName: template.fileName,
      },
    });
  };

  return (
    <div className={`${app.container} ${styles.page}`}>
      <section className={styles.heroPanel}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>Behavior capture</span>
          <h1 className={styles.heroTitle}>Recorder</h1>
          <p className={styles.heroSubtitle}>
            Nagrywaj tempy z własnym bindem, zmieniaj ich nazwy i buduj
            templateki z wielu segmentów w dowolnej kolejności.
          </p>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Recording</span>
            <span className={styles.statValue}>
              {recorderState.isRecording ? "Live" : "Idle"}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Temps</span>
            <span className={styles.statValue}>{recorderState.temps.length}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Templates</span>
            <span className={styles.statValue}>{recorderState.templates.length}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Running</span>
            <span className={styles.statValue}>
              {runningTemplateCount}/{enabledTemplateCount}
            </span>
          </div>
        </div>
      </section>

      <section className={styles.toolbarPanel}>
        <div className={styles.toolbarBlock}>
          <span className={styles.toolbarLabel}>Recorder root</span>
          <span className={styles.directoryValue}>
            {recorderState.directories.root || "..."}
          </span>
        </div>

        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => sendMessage({ type: "recorder_reload_configs", payload: {} })}
          >
            <FileDownload fontSize="small" />
            Reload folders
          </button>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={resetTemplateDraft}
          >
            <PlaylistAdd fontSize="small" />
            New template
          </button>

          <button
            type="button"
            className={
              recorderState.isRecording ? styles.dangerButton : styles.primaryButton
            }
            onClick={toggleRecording}
          >
            <RadioButtonChecked fontSize="small" />
            {recorderState.isRecording ? "Stop recording" : "Start recording"}
          </button>
        </div>
      </section>

      <section
        className={styles.statusPanel}
        data-runtime={recorderState.runtimeAvailable ? "ready" : "missing"}
      >
        <div>
          <span className={styles.statusLabel}>Runtime</span>
          <p className={styles.statusText}>{recorderState.runtimeMessage}</p>
        </div>
        <div>
          <span className={styles.statusLabel}>Last action</span>
          <p className={styles.statusText}>{localMessage || "No actions yet."}</p>
        </div>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.recordingPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Recording settings</span>
              <h2 className={styles.panelTitle}>Capture config</h2>
            </div>
            <button type="button" className={styles.primaryButton} onClick={saveSettings}>
              <Save fontSize="small" />
              Save settings
            </button>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Temp base name</span>
              <input
                value={settingsDraft.nextRecordingName}
                onChange={(event) =>
                  setSettingsDraft((previous) => ({
                    ...previous,
                    nextRecordingName: event.target.value,
                  }))
                }
                placeholder="temp"
              />
              <span className={styles.helpText}>
                Saved temps automatically get a timestamp appended to this name.
              </span>
            </label>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Recording hotkey</span>
              <div className={styles.bindingToggleCard}>
                <label className={styles.checkField}>
                  <input
                    type="checkbox"
                    checked={settingsDraft.recordingBindingEnabled}
                    onChange={(event) =>
                      setSettingsDraft((previous) => ({
                        ...previous,
                        recordingBindingEnabled: event.target.checked,
                      }))
                    }
                  />
                  Enable start/stop hotkey
                </label>

                <div className={styles.bindingRow}>
                  <input
                    value={settingsDraft.recordingBinding}
                    onChange={(event) =>
                      setSettingsDraft((previous) => ({
                        ...previous,
                        recordingBinding: event.target.value,
                      }))
                    }
                    placeholder="space, cmd, f8"
                    disabled={!settingsDraft.recordingBindingEnabled}
                  />
                  <button
                    type="button"
                    className={styles.captureButton}
                    data-active={isCapturingRecordingBinding ? "true" : "false"}
                    onClick={() =>
                      setIsCapturingRecordingBinding((previous) => !previous)
                    }
                    disabled={!settingsDraft.recordingBindingEnabled}
                  >
                    <Keyboard fontSize="small" />
                    {isCapturingRecordingBinding ? "Listening..." : "Detect key"}
                  </button>
                </div>
              </div>
              <span className={styles.helpText}>
                {settingsDraft.recordingBindingEnabled
                  ? isCapturingRecordingBinding
                    ? "Press the key that should start and stop recording."
                    : "Hotkey can start and stop recording outside the UI."
                  : "Hotkey is disabled. Recording can still be controlled from the UI button."}
              </span>
            </div>
          </div>

          <div className={styles.recordingHintCard}>
            <span className={styles.referenceLabel}>Current session</span>
            <p>
              {recorderState.isRecording
                ? `Recording is live: ${recorderState.currentRecordingName}`
                : settingsDraft.recordingBindingEnabled
                  ? `Recorder is idle. Use the UI button or hotkey ${settingsDraft.recordingBinding}.`
                  : "Recorder is idle. Hotkey is disabled, so use the UI button to start and stop."}
            </p>
          </div>

          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Temp recordings</span>
              <h2 className={styles.panelTitle}>Latest captures</h2>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => sendMessage({ type: "recorder_request_state", payload: {} })}
              title="Refresh state"
            >
              <Autorenew fontSize="small" />
            </button>
          </div>

          <div className={styles.listColumn}>
            {recorderState.temps.map((temp) => (
              <article
                className={styles.recordCard}
                data-selected={
                  templateDraft.sourceTemps.some(
                    (source) => source.fileName === temp.fileName
                  )
                    ? "true"
                    : "false"
                }
                key={temp.fileName}
              >
                <button
                  type="button"
                  className={styles.cardLoadButton}
                  onClick={() => addTempToTemplate(temp)}
                >
                  <div className={styles.cardTitleRow}>
                    <h3 className={styles.cardTitle}>{temp.name}</h3>
                    <span className={styles.stateBadge} data-tone="count">
                      {temp.actionCount} actions
                    </span>
                  </div>
                  <div className={styles.cardMeta}>
                    <span>Base: {temp.baseName}</span>
                    <span>Updated: {formatDate(temp.updatedAt || temp.createdAt)}</span>
                  </div>
                </button>

                <div className={styles.cardFooter}>
                  <button
                    type="button"
                    className={styles.smallButton}
                    onClick={() => addTempToTemplate(temp)}
                  >
                    <SmartDisplay fontSize="small" />
                    Add to template
                  </button>
                  <button
                    type="button"
                    className={styles.smallButton}
                    onClick={() => renameTemp(temp)}
                  >
                    <Save fontSize="small" />
                    Rename
                  </button>
                  <button
                    type="button"
                    className={styles.smallDangerButton}
                    onClick={() => deleteTemp(temp)}
                  >
                    <DeleteOutline fontSize="small" />
                    Delete
                  </button>
                </div>
              </article>
            ))}

            {recorderState.temps.length === 0 && (
              <div className={styles.emptyCard}>
                No temp recordings found yet. Start by capturing a new run.
              </div>
            )}
          </div>
        </aside>

        <div className={styles.templatesColumn}>
          <section className={styles.editorPanel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.eyebrow}>Template editor</span>
                <h2 className={styles.panelTitle}>
                  {templateDraft.fileName ? "Edit template" : "Create template"}
                </h2>
              </div>
              <div className={styles.editorActions}>
                {templateDraft.fileName && (
                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={() => {
                      const template = recorderState.templates.find(
                        (item) => item.fileName === templateDraft.fileName
                      );
                      if (template) {
                        deleteTemplate(template);
                      }
                    }}
                  >
                    <DeleteOutline fontSize="small" />
                    Delete template
                  </button>
                )}
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={saveTemplate}
                >
                  <Save fontSize="small" />
                  Save template
                </button>
              </div>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Template name</span>
                <input
                  value={templateDraft.name}
                  onChange={(event) =>
                    setTemplateDraft((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Zbierak loop"
                />
              </label>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Playback hotkey</span>
                <div className={styles.bindingToggleCard}>
                  <label className={styles.checkField}>
                    <input
                      type="checkbox"
                      checked={templateDraft.playBindingEnabled}
                      onChange={(event) =>
                        setTemplateDraft((previous) => ({
                          ...previous,
                          playBindingEnabled: event.target.checked,
                        }))
                      }
                    />
                    Enable playback hotkey
                  </label>

                  <div className={styles.bindingRow}>
                    <input
                      value={templateDraft.playBinding}
                      onChange={(event) =>
                        setTemplateDraft((previous) => ({
                          ...previous,
                          playBinding: event.target.value,
                        }))
                      }
                      placeholder="cmd, f8, q"
                      disabled={!templateDraft.playBindingEnabled}
                    />
                    <button
                      type="button"
                      className={styles.captureButton}
                      data-active={isCapturingTemplateBinding ? "true" : "false"}
                      onClick={() =>
                        setIsCapturingTemplateBinding((previous) => !previous)
                      }
                      disabled={!templateDraft.playBindingEnabled}
                    >
                      <Keyboard fontSize="small" />
                      {isCapturingTemplateBinding ? "Listening..." : "Detect key"}
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.fieldWide}>
                <span className={styles.fieldLabel}>Selected temps</span>
                <div className={styles.sourceList}>
                  {templateDraft.sourceTemps.map((source, index) => (
                    <div
                      className={styles.sourceListItem}
                      data-missing={source.isMissing ? "true" : "false"}
                      key={`${source.fileName}-${index}`}
                    >
                      <div className={styles.sourceInfo}>
                        <span className={styles.sourceTitle}>{source.name}</span>
                        <span className={styles.sourceMeta}>
                          {source.isMissing
                            ? "Missing temp recording"
                            : `${source.actionCount ?? 0} actions`}
                        </span>
                      </div>
                      <div className={styles.sourceActions}>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => moveTemplateSource(index, "up")}
                          title="Move up"
                          disabled={index === 0}
                        >
                          <North fontSize="small" />
                        </button>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => moveTemplateSource(index, "down")}
                          title="Move down"
                          disabled={index === templateDraft.sourceTemps.length - 1}
                        >
                          <South fontSize="small" />
                        </button>
                        <button
                          type="button"
                          className={styles.smallDangerButton}
                          onClick={() => removeTemplateSource(index)}
                        >
                          <DeleteOutline fontSize="small" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  {templateDraft.sourceTemps.length === 0 && (
                    <div className={styles.emptyCard}>
                      Add temp recordings from the left column to build template order.
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.fieldWide}>
                <span className={styles.fieldLabel}>Playback mode</span>
                <div className={styles.toggleRow}>
                  <button
                    type="button"
                    className={styles.modeButton}
                    data-active={templateDraft.repeatUntilStopped ? "false" : "true"}
                    onClick={() =>
                      setTemplateDraft((previous) => ({
                        ...previous,
                        repeatUntilStopped: false,
                      }))
                    }
                  >
                    Run once per press
                  </button>
                  <button
                    type="button"
                    className={styles.modeButton}
                    data-active={templateDraft.repeatUntilStopped ? "true" : "false"}
                    onClick={() =>
                      setTemplateDraft((previous) => ({
                        ...previous,
                        repeatUntilStopped: true,
                      }))
                    }
                  >
                    Repeat until stopped
                  </button>
                </div>
              </div>

              <div className={styles.fieldWide}>
                <span className={styles.fieldLabel}>Template state</span>
                <div className={styles.checkboxRow}>
                  <label className={styles.checkField}>
                    <input
                      type="checkbox"
                      checked={templateDraft.enabled}
                      onChange={(event) =>
                        setTemplateDraft((previous) => ({
                          ...previous,
                          enabled: event.target.checked,
                        }))
                      }
                    />
                    Save template as enabled
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.libraryPanel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.eyebrow}>Playback templates</span>
                <h2 className={styles.panelTitle}>Saved patterns</h2>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => sendMessage({ type: "recorder_request_state", payload: {} })}
                title="Refresh state"
              >
                <Autorenew fontSize="small" />
              </button>
            </div>

            <div className={styles.listColumn}>
              {recorderState.templates.map((template) => (
                <article
                  className={styles.recordCard}
                  data-selected={templateDraft.fileName === template.fileName ? "true" : "false"}
                  key={template.fileName}
                >
                  <button
                    type="button"
                    className={styles.cardLoadButton}
                    onClick={() => selectTemplate(template)}
                  >
                    <div className={styles.cardTitleRow}>
                      <h3 className={styles.cardTitle}>{template.name}</h3>
                      {template.isRunning && <span className={styles.runningDot} />}
                    </div>
                    <div className={styles.cardMeta}>
                      <span>
                        Binding:{" "}
                        {template.playBindingEnabled
                          ? template.playBinding || "not set"
                          : "disabled"}
                      </span>
                      <span>{template.actionCount} actions</span>
                      <span>{template.sources.length} temps</span>
                      <span>
                        Mode:{" "}
                        {template.repeatUntilStopped ? "Repeat until stopped" : "Run once"}
                      </span>
                    </div>
                  </button>

                  <div className={styles.cardFooter}>
                    <span
                      className={styles.stateBadge}
                      data-tone={template.enabled ? "enabled" : "disabled"}
                    >
                      {template.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <span
                      className={styles.stateBadge}
                      data-tone={template.playBindingEnabled ? "source" : "disabled"}
                    >
                      {template.playBindingEnabled ? "Hotkey on" : "Hotkey off"}
                    </span>
                    <span
                      className={styles.stateBadge}
                      data-tone={template.isRunning ? "running" : "idle"}
                    >
                      {template.isRunning ? "Running" : "Idle"}
                    </span>
                    <button
                      type="button"
                      className={styles.smallButton}
                      onClick={() =>
                        sendMessage({
                          type: "recorder_toggle_template",
                          payload: {
                            fileName: template.fileName,
                            enabled: !template.enabled,
                          },
                        })
                      }
                    >
                      <SmartDisplay fontSize="small" />
                      {template.enabled ? "Turn off" : "Turn on"}
                    </button>
                    <button
                      type="button"
                      className={styles.smallButton}
                      onClick={() =>
                        sendMessage({
                          type: "recorder_toggle_template_binding",
                          payload: {
                            fileName: template.fileName,
                            enabled: !template.playBindingEnabled,
                          },
                        })
                      }
                    >
                      <Keyboard fontSize="small" />
                      {template.playBindingEnabled ? "Disable hotkey" : "Enable hotkey"}
                    </button>
                    <button
                      type="button"
                      className={styles.smallDangerButton}
                      onClick={() => deleteTemplate(template)}
                    >
                      <DeleteOutline fontSize="small" />
                      Delete
                    </button>
                  </div>
                </article>
              ))}

              {recorderState.templates.length === 0 && (
                <div className={styles.emptyCard}>
                  No templates saved yet. Build one from one or more temp recordings.
                </div>
              )}
            </div>
          </section>

          <section className={styles.referencePanel}>
            <div className={styles.referenceCard}>
              <span className={styles.referenceLabel}>Recording flow</span>
              <p>
                Save the base name and optional hotkey first. New temps get a
                timestamp appended automatically when recording ends.
              </p>
            </div>
            <div className={styles.referenceCard}>
              <span className={styles.referenceLabel}>Template flow</span>
              <p>
                Add multiple temps from the left side, sort them with up and down,
                then save the final playback order into one template.
              </p>
            </div>
            <div className={styles.referenceCard}>
              <span className={styles.referenceLabel}>Current limits</span>
              <p>
                Recorder captures keyboard and mouse clicks. TODO: mouse move and
                scroll recording can be added later if you need full path replay.
              </p>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};

export default Recorder;
