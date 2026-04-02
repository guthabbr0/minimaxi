import { useEffect, useRef } from "react";
import {
  API_BASE_PRESETS,
  DEFAULT_API_BASE_URL
} from "../lib/minimax/catalog";
import { trimBaseUrl } from "../lib/minimax/base";
import type { AppSettings, CatalogState } from "../types";

interface SettingsModalProps {
  open: boolean;
  settings: AppSettings;
  catalogState: CatalogState;
  onUpdate: (patch: Partial<AppSettings>) => void;
  onClose: () => void;
}

export function SettingsModal({
  open,
  settings,
  catalogState,
  onUpdate,
  onClose
}: SettingsModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isCustomHost = !API_BASE_PRESETS.includes(
    settings.apiBaseUrl as (typeof API_BASE_PRESETS)[number]
  );

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={(event) => {
        if (event.target === backdropRef.current) onClose();
      }}
    >
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">Settings</h2>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <label className="settings-field">
            <span className="settings-label">API Host</span>
            <select
              className="settings-select"
              value={isCustomHost ? "custom" : settings.apiBaseUrl}
              onChange={(event) => {
                const next = event.target.value;
                onUpdate({
                  apiBaseUrl:
                    next === "custom"
                      ? settings.apiBaseUrl
                      : trimBaseUrl(next)
                });
              }}
            >
              <option value={DEFAULT_API_BASE_URL}>
                {DEFAULT_API_BASE_URL}
              </option>
              <option value="https://api.minimax.io/v1">
                https://api.minimax.io/v1
              </option>
              <option value="custom">Custom</option>
            </select>
          </label>

          {isCustomHost ? (
            <label className="settings-field">
              <span className="settings-label">Custom URL</span>
              <input
                className="settings-input"
                placeholder="https://api.minimaxi.com/v1"
                value={settings.apiBaseUrl}
                onChange={(event) =>
                  onUpdate({ apiBaseUrl: trimBaseUrl(event.target.value) })
                }
              />
            </label>
          ) : null}

          <label className="settings-field">
            <span className="settings-label">API Key</span>
            <input
              className="settings-input"
              placeholder="Enter your MiniMax API key"
              type="password"
              value={settings.apiKey}
              onChange={(event) => onUpdate({ apiKey: event.target.value })}
            />
          </label>

          <label className="settings-field settings-field--row">
            <span className="settings-label">Show reasoning</span>
            <input
              checked={settings.showReasoning}
              type="checkbox"
              onChange={(event) =>
                onUpdate({ showReasoning: event.target.checked })
              }
            />
          </label>

          <div className="settings-field">
            <span className="settings-label">Catalog</span>
            <span className="settings-value">
              {catalogState.isDiscovering
                ? "Discovering models…"
                : catalogState.error ?? "Dynamic catalog"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
