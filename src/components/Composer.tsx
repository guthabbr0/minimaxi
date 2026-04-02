import type {
  AppMode,
  CatalogState,
  ImageReference,
  Thread,
  UploadAsset
} from "../types";

interface ComposerProps {
  thread: Thread;
  mode: AppMode;
  modelOptions: string[];
  catalogState: CatalogState;
  isBusy: boolean;
  streamText: boolean;
  summaryChips: string[];
  onModeChange: (mode: AppMode) => void;
  onModelChange: (model: string) => void;
  onPromptChange: (mode: AppMode, value: string) => void;
  onTextStreamChange: (value: boolean) => void;
  onImageVariantChange: (value: "t2i" | "i2i") => void;
  onVideoVariantChange: (value: "t2v" | "i2v") => void;
  onAddImageReferences: (files: FileList | null) => void;
  onRemoveImageReference: (referenceId: string) => void;
  onAddFirstFrame: (files: FileList | null) => void;
  onRemoveFirstFrame: () => void;
  onVideoFirstFrameUrlChange: (value: string) => void;
  onOpenAdvanced: () => void;
  onSubmit: () => void;
}

export function Composer({
  thread,
  mode,
  modelOptions,
  catalogState,
  isBusy,
  streamText,
  summaryChips,
  onModeChange,
  onModelChange,
  onPromptChange,
  onTextStreamChange,
  onImageVariantChange,
  onVideoVariantChange,
  onAddImageReferences,
  onRemoveImageReference,
  onAddFirstFrame,
  onRemoveFirstFrame,
  onVideoFirstFrameUrlChange,
  onOpenAdvanced,
  onSubmit
}: ComposerProps) {
  const prompt =
    mode === "text"
      ? thread.drafts.textPrompt
      : mode === "image"
        ? thread.drafts.imagePrompt
        : thread.drafts.videoPrompt;

  const selectedModel =
    mode === "text"
      ? thread.textConfig.model
      : mode === "image"
        ? thread.imageConfig.model
        : thread.videoConfig.model;

  return (
    <div className="composer-shell">
      <div className="composer__toolbar">
        <div className="segment">
          <SegmentButton
            active={mode === "text"}
            label="Text"
            onClick={() => onModeChange("text")}
          />
          <SegmentButton
            active={mode === "image"}
            label="Image"
            onClick={() => onModeChange("image")}
          />
          <SegmentButton
            active={mode === "video"}
            label="Video"
            onClick={() => onModeChange("video")}
          />
        </div>

        {mode === "image" ? (
          <div className="segment">
            <SegmentButton
              active={thread.imageConfig.variant === "t2i"}
              label="T2I"
              onClick={() => onImageVariantChange("t2i")}
            />
            <SegmentButton
              active={thread.imageConfig.variant === "i2i"}
              label="I2I"
              onClick={() => onImageVariantChange("i2i")}
            />
          </div>
        ) : null}

        {mode === "video" ? (
          <div className="segment">
            <SegmentButton
              active={thread.videoConfig.variant === "t2v"}
              label="T2V"
              onClick={() => onVideoVariantChange("t2v")}
            />
            <SegmentButton
              active={thread.videoConfig.variant === "i2v"}
              label="I2V"
              onClick={() => onVideoVariantChange("i2v")}
            />
          </div>
        ) : null}

        <label className="field field--inline">
          <span>Model</span>
          <select
            value={selectedModel}
            onChange={(event) => onModelChange(event.target.value)}
          >
            {modelOptions.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>

        {mode === "text" ? (
          <div className="catalog-badge">
            {thread.textConfig.backend === "native" ? "Native API" : "OpenAI API"}
          </div>
        ) : null}

        {mode === "text" ? (
          <label className="switch switch--real">
            <span>Stream</span>
            <input
              checked={streamText}
              onChange={(event) => onTextStreamChange(event.target.checked)}
              type="checkbox"
            />
          </label>
        ) : null}

        <div className="catalog-badge">
          {catalogState.catalog.source === "dynamic"
            ? "Dynamic catalog"
            : "Static catalog"}
        </div>

        <button className="ghost-button" type="button" onClick={onOpenAdvanced}>
          Advanced
        </button>
      </div>

      <textarea
        className="composer__input"
        disabled={isBusy}
        placeholder={getPlaceholder(mode, thread)}
        rows={5}
        value={prompt}
        onChange={(event) => onPromptChange(mode, event.target.value)}
      />

      {mode === "image" && thread.imageConfig.variant === "i2i" ? (
        <UploadStrip
          actionLabel="Add references"
          assets={thread.imageConfig.subjectReferences}
          helper="Upload one or more reference images. They are stored locally in IndexedDB."
          onAdd={onAddImageReferences}
          onRemove={onRemoveImageReference}
        />
      ) : null}

      {mode === "video" && thread.videoConfig.variant === "i2v" ? (
        <div className="upload-shell">
          <UploadStrip
            actionLabel="Add first frame"
            assets={thread.videoConfig.firstFrameImage ? [thread.videoConfig.firstFrameImage] : []}
            helper="Upload a first frame image or use a public URL."
            onAdd={onAddFirstFrame}
            onRemove={() => onRemoveFirstFrame()}
            single
          />
          <input
            className="text-input"
            placeholder="Optional public image URL"
            value={thread.videoConfig.firstFrameUrl}
            onChange={(event) => onVideoFirstFrameUrlChange(event.target.value)}
          />
        </div>
      ) : null}

      {summaryChips.length ? (
        <div className="chip-row">
          {summaryChips.map((chip) => (
            <span className="chip" key={chip}>
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      <div className="composer__actions">
        <button
          className="primary-button"
          disabled={isBusy}
          type="button"
          onClick={onSubmit}
        >
          {isBusy ? "Working..." : mode === "text" ? "Send" : "Generate"}
        </button>
      </div>
    </div>
  );
}

function SegmentButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`segment__button ${active ? "segment__button--active" : ""}`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function UploadStrip({
  actionLabel,
  assets,
  helper,
  onAdd,
  onRemove,
  single
}: {
  actionLabel: string;
  assets: Array<ImageReference | UploadAsset>;
  helper: string;
  onAdd: (files: FileList | null) => void;
  onRemove: (assetId: string) => void;
  single?: boolean;
}) {
  return (
    <div className="upload-shell">
      <div className="upload-shell__top">
        <div className="upload-shell__helper">{helper}</div>
        <label className="ghost-button ghost-button--file">
          {actionLabel}
          <input
            hidden
            accept="image/png,image/jpeg,image/webp"
            multiple={!single}
            type="file"
            onChange={(event) => onAdd(event.target.files)}
          />
        </label>
      </div>
      {assets.length ? (
        <div className="asset-row">
          {assets.map((asset) => (
            <div className="asset-chip" key={asset.id}>
              {asset.previewUrl ? (
                <img alt={asset.name} src={asset.previewUrl} />
              ) : (
                <div className="asset-chip__empty" />
              )}
              <span>{asset.name}</span>
              <button type="button" onClick={() => onRemove(asset.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getPlaceholder(mode: AppMode, thread: Thread): string {
  if (mode === "text") {
    return "Ask MiniMax something…";
  }
  if (mode === "image") {
    return thread.imageConfig.variant === "i2i"
      ? "Describe how the uploaded reference should change…"
      : "Describe the image you want to generate…";
  }
  return thread.videoConfig.variant === "i2v"
    ? "Describe the motion and camera behavior for the first frame…"
    : "Describe the video you want to generate…";
}
