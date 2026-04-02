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
      {/* [[<<CURRENT VERSION TAG: 1>>]] */}
      <div className="sidebar__header">
        <div className="sidebar__brand">
          MiniMax <span className="sidebar__version">v1</span>
        </div>
        <div className="sidebar__actions">
          <button
            className="icon-btn"
            type="button"
            onClick={onCreate}
            title="New thread"
            aria-label="New thread"
          >
            +
          </button>
        </div>
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
