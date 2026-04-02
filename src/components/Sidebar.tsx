import type { Thread } from "../types";

interface SidebarProps {
  threads: Thread[];
  activeThreadId: string | null;
  onSelect: (threadId: string) => void;
  onCreate: () => void;
  onDelete: (threadId: string) => void;
}

export function Sidebar({
  threads,
  activeThreadId,
  onSelect,
  onCreate,
  onDelete
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <div>
          <div className="sidebar__eyebrow">PROJECT</div>
          <h1 className="sidebar__title">MiniMax UI</h1>
        </div>
        <button className="ghost-button" type="button" onClick={onCreate}>
          New
        </button>
      </div>

      <div className="sidebar__list">
        {threads.map((thread) => (
          <div
            className={`thread-row ${
              thread.id === activeThreadId ? "thread-row--active" : ""
            }`}
            key={thread.id}
          >
            <button
              className="thread-row__button"
              type="button"
              onClick={() => onSelect(thread.id)}
            >
              <span className="thread-row__title">{thread.title}</span>
              <span className="thread-row__meta">
                {new Date(thread.updatedAt).toLocaleString()}
              </span>
            </button>
            {threads.length > 1 ? (
              <button
                className="thread-row__delete"
                type="button"
                onClick={() => onDelete(thread.id)}
                aria-label={`Delete ${thread.title}`}
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </aside>
  );
}
