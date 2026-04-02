import { IMAGE_ASPECT_RATIOS, VIDEO_DURATIONS, VIDEO_RESOLUTIONS } from "../lib/minimax/catalog";
import type { AppMode, ImageReferenceType, Thread } from "../types";

interface AdvancedDrawerProps {
  open: boolean;
  mode: AppMode;
  thread: Thread;
  onClose: () => void;
  onUpdateText: <K extends keyof Thread["textConfig"]>(
    key: K,
    value: Thread["textConfig"][K]
  ) => void;
  onUpdateImage: <K extends keyof Thread["imageConfig"]>(
    key: K,
    value: Thread["imageConfig"][K]
  ) => void;
  onUpdateVideo: <K extends keyof Thread["videoConfig"]>(
    key: K,
    value: Thread["videoConfig"][K]
  ) => void;
  onUpdateImageReferenceType: (
    referenceId: string,
    type: ImageReferenceType
  ) => void;
}

export function AdvancedDrawer({
  open,
  mode,
  thread,
  onClose,
  onUpdateText,
  onUpdateImage,
  onUpdateVideo,
  onUpdateImageReferenceType
}: AdvancedDrawerProps) {
  return (
    <aside className={`advanced-drawer ${open ? "advanced-drawer--open" : ""}`}>
      <div className="advanced-drawer__header">
        <div>
          <div className="sidebar__eyebrow">ADVANCED</div>
          <div className="advanced-drawer__title">
            {mode === "text" ? "Text settings" : mode === "image" ? "Image settings" : "Video settings"}
          </div>
        </div>
        <button className="ghost-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      {mode === "text" ? (
        <div className="advanced-grid">
          <Field label="System prompt">
            <textarea
              rows={4}
              value={thread.textConfig.systemPrompt}
              onChange={(event) => onUpdateText("systemPrompt", event.target.value)}
            />
          </Field>
          <Field label="Temperature">
            <input
              max={1}
              min={0.01}
              step={0.01}
              type="number"
              value={thread.textConfig.temperature}
              onChange={(event) =>
                onUpdateText("temperature", Number(event.target.value))
              }
            />
          </Field>
          <Field label="Top P">
            <input
              max={1}
              min={0.01}
              step={0.01}
              type="number"
              value={thread.textConfig.topP}
              onChange={(event) => onUpdateText("topP", Number(event.target.value))}
            />
          </Field>
          <Field label="Max tokens">
            <input
              min={1}
              step={1}
              type="number"
              value={thread.textConfig.maxTokens}
              onChange={(event) =>
                onUpdateText("maxTokens", Number(event.target.value))
              }
            />
          </Field>
          <label className="switch switch--row">
            <span>Reasoning split</span>
            <input
              checked={thread.textConfig.reasoningSplit}
              type="checkbox"
              onChange={(event) =>
                onUpdateText("reasoningSplit", event.target.checked)
              }
            />
          </label>
          <Field label="Tool choice">
            <select
              value={thread.textConfig.toolChoice}
              onChange={(event) => onUpdateText("toolChoice", event.target.value)}
            >
              <option value="auto">auto</option>
              <option value="none">none</option>
              <option value="required">required</option>
            </select>
          </Field>
          <Field label="Tools JSON">
            <textarea
              rows={6}
              value={thread.textConfig.toolsJson}
              onChange={(event) => onUpdateText("toolsJson", event.target.value)}
            />
          </Field>
          <Field label="Extra body JSON">
            <textarea
              rows={6}
              value={thread.textConfig.extraBodyJson}
              onChange={(event) =>
                onUpdateText("extraBodyJson", event.target.value)
              }
            />
          </Field>
        </div>
      ) : null}

      {mode === "image" ? (
        <div className="advanced-grid">
          <Field label="Aspect ratio">
            <select
              value={thread.imageConfig.aspectRatio}
              onChange={(event) =>
                onUpdateImage("aspectRatio", event.target.value)
              }
            >
              {IMAGE_ASPECT_RATIOS.map((ratio) => (
                <option key={ratio} value={ratio}>
                  {ratio}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Width">
            <input
              min={512}
              placeholder="auto"
              step={8}
              type="number"
              value={thread.imageConfig.width}
              onChange={(event) =>
                onUpdateImage(
                  "width",
                  event.target.value === "" ? "" : Number(event.target.value)
                )
              }
            />
          </Field>
          <Field label="Height">
            <input
              min={512}
              placeholder="auto"
              step={8}
              type="number"
              value={thread.imageConfig.height}
              onChange={(event) =>
                onUpdateImage(
                  "height",
                  event.target.value === "" ? "" : Number(event.target.value)
                )
              }
            />
          </Field>
          <Field label="Response format">
            <select
              value={thread.imageConfig.responseFormat}
              onChange={(event) =>
                onUpdateImage("responseFormat", event.target.value as "base64" | "url")
              }
            >
              <option value="base64">base64</option>
              <option value="url">url</option>
            </select>
          </Field>
          <Field label="Seed">
            <input
              placeholder="auto"
              step={1}
              type="number"
              value={thread.imageConfig.seed}
              onChange={(event) =>
                onUpdateImage(
                  "seed",
                  event.target.value === "" ? "" : Number(event.target.value)
                )
              }
            />
          </Field>
          <Field label="Images per request">
            <input
              max={9}
              min={1}
              step={1}
              type="number"
              value={thread.imageConfig.n}
              onChange={(event) => onUpdateImage("n", Number(event.target.value))}
            />
          </Field>
          <label className="switch switch--row">
            <span>Prompt optimizer</span>
            <input
              checked={thread.imageConfig.promptOptimizer}
              type="checkbox"
              onChange={(event) =>
                onUpdateImage("promptOptimizer", event.target.checked)
              }
            />
          </label>
          {thread.imageConfig.subjectReferences.length ? (
            <div className="reference-list">
              {thread.imageConfig.subjectReferences.map((reference) => (
                <label className="field" key={reference.id}>
                  <span>{reference.name}</span>
                  <select
                    value={reference.type}
                    onChange={(event) =>
                      onUpdateImageReferenceType(
                        reference.id,
                        event.target.value as ImageReferenceType
                      )
                    }
                  >
                    <option value="character">character</option>
                    <option value="subject">subject</option>
                    <option value="style">style</option>
                  </select>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "video" ? (
        <div className="advanced-grid">
          <Field label="Duration">
            <select
              value={thread.videoConfig.duration}
              onChange={(event) =>
                onUpdateVideo("duration", Number(event.target.value))
              }
            >
              {VIDEO_DURATIONS.map((duration) => (
                <option key={duration} value={duration}>
                  {duration}s
                </option>
              ))}
            </select>
          </Field>
          <Field label="Resolution">
            <select
              value={thread.videoConfig.resolution}
              onChange={(event) =>
                onUpdateVideo("resolution", event.target.value)
              }
            >
              {VIDEO_RESOLUTIONS.map((resolution) => (
                <option key={resolution} value={resolution}>
                  {resolution}
                </option>
              ))}
            </select>
          </Field>
          <label className="switch switch--row">
            <span>Prompt optimizer</span>
            <input
              checked={thread.videoConfig.promptOptimizer}
              type="checkbox"
              onChange={(event) =>
                onUpdateVideo("promptOptimizer", event.target.checked)
              }
            />
          </label>
          <label className="switch switch--row">
            <span>Fast pretreatment</span>
            <input
              checked={thread.videoConfig.fastPretreatment}
              type="checkbox"
              onChange={(event) =>
                onUpdateVideo("fastPretreatment", event.target.checked)
              }
            />
          </label>
        </div>
      ) : null}
    </aside>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
