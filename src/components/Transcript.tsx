import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TelemetryFooter } from "./TelemetryFooter";
import type { Thread, ThreadItem } from "../types";

interface TranscriptProps {
  thread: Thread | null;
  showReasoning: boolean;
  onRefreshVideo?: (itemId: string) => void;
}

export function Transcript({
  thread,
  showReasoning,
  onRefreshVideo
}: TranscriptProps) {
  if (!thread) {
    return <section className="transcript transcript--empty" />;
  }

  if (!thread.items.length) {
    return (
      <section className="transcript transcript--empty">
        <div className="empty-state">
          <div className="empty-state__title">Send a message to start testing.</div>
          <div className="empty-state__body">
            Text, image, and video results stay in one local thread.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="transcript">
      {thread.items.map((item) => (
        <article className="message-card" key={item.id}>
          <header className="message-card__header">
            <div>
              <span className="badge">{item.kind}</span>
              <span className={`status-pill status-pill--${item.status}`}>
                {item.status}
              </span>
            </div>
            <time className="message-card__time">
              {new Date(item.createdAt).toLocaleTimeString()}
            </time>
          </header>

          <div className="bubble bubble--user">
            <div className="bubble__label">Prompt</div>
            <div>{item.request.prompt}</div>
          </div>

          {item.kind === "text" ? renderTextItem(item, showReasoning) : null}
          {item.kind === "image" ? renderImageItem(item) : null}
          {item.kind === "video"
            ? renderVideoItem(item, onRefreshVideo)
            : null}

          {item.error ? (
            <details className="error-panel" open={item.status === "error"}>
              <summary>
                Error {item.error.status ? `(${item.error.status})` : ""}
              </summary>
              <div className="error-panel__message">{item.error.message}</div>
              {item.error.raw ? (
                <pre className="raw-json">
                  {JSON.stringify(item.error.raw, null, 2)}
                </pre>
              ) : null}
            </details>
          ) : null}

          {item.telemetry ? <TelemetryFooter item={item} /> : null}
        </article>
      ))}
    </section>
  );
}

function renderTextItem(item: ThreadItem, showReasoning: boolean) {
  if (!item.response || !("content" in item.response)) {
    return (
      <div className="bubble bubble--assistant bubble--placeholder">
        Waiting for response…
      </div>
    );
  }

  return (
    <>
      {showReasoning && item.response.reasoning ? (
        <details className="reasoning-panel">
          <summary>Thinking</summary>
          <pre className="reasoning-panel__content">{item.response.reasoning}</pre>
        </details>
      ) : null}
      <div className="bubble bubble--assistant">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {item.response.content || "_No text returned._"}
        </ReactMarkdown>
      </div>
      {item.response.toolCalls.length ? (
        <details className="tool-panel">
          <summary>Tool calls</summary>
          <pre className="raw-json">
            {JSON.stringify(item.response.toolCalls, null, 2)}
          </pre>
        </details>
      ) : null}
    </>
  );
}

function renderImageItem(item: ThreadItem) {
  if (!item.response || !("images" in item.response)) {
    return (
      <div className="bubble bubble--assistant bubble--placeholder">
        Waiting for image generation…
      </div>
    );
  }

  return (
    <div className="image-grid">
      {item.response.images.map((image, index) => (
        <a
          className="image-card"
          href={image.objectUrl ?? image.remoteUrl}
          key={`${item.id}-${index}`}
          target="_blank"
          rel="noreferrer"
        >
          {image.objectUrl || image.remoteUrl ? (
            <img
              alt={`Generated result ${index + 1}`}
              src={image.objectUrl ?? image.remoteUrl}
            />
          ) : (
            <div className="image-card__empty">No preview</div>
          )}
        </a>
      ))}
    </div>
  );
}

function renderVideoItem(
  item: ThreadItem,
  onRefreshVideo?: (itemId: string) => void
) {
  if (!item.response || !("taskId" in item.response)) {
    return (
      <div className="bubble bubble--assistant bubble--placeholder">
        Waiting for video task…
      </div>
    );
  }

  return (
    <div className="video-panel">
      <div className="video-panel__meta">
        Task {item.response.taskId}
        {item.response.fileId ? ` • File ${item.response.fileId}` : ""}
      </div>
      {item.response.downloadUrl ? (
        <video
          className="video-panel__player"
          controls
          preload="metadata"
          src={item.response.downloadUrl}
        />
      ) : (
        <div className="bubble bubble--assistant bubble--placeholder">
          {item.response.status === "failed"
            ? "Video generation failed."
            : "Video is still processing or needs a refreshed download URL."}
        </div>
      )}
      {item.response.fileId && onRefreshVideo ? (
        <button
          className="ghost-button ghost-button--small"
          type="button"
          onClick={() => onRefreshVideo(item.id)}
        >
          Refresh video URL
        </button>
      ) : null}
    </div>
  );
}
