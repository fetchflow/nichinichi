import { useState } from "react";
import type { Entry, EntryType } from "../../types";
import { TYPE_COLORS } from "../../types";

interface Props {
  entry: Entry;
  onDelete: (id: string) => void;
  onEdit: (id: string, newBody: string, newDetail?: string) => Promise<void>;
}

const TYPE_LABELS: Record<EntryType, string> = {
  score: "score",
  solution: "fix",
  decision: "decision",
  ai: "ai",
  reflection: "reflection",
  log: "log",
};

export function FeedCard({ entry, onDelete, onEdit }: Props) {
  const color = TYPE_COLORS[entry.entry_type];
  const label = TYPE_LABELS[entry.entry_type];

  const [editing, setEditing] = useState(false);
  const [bodyDraft, setBodyDraft] = useState("");
  const [detailDraft, setDetailDraft] = useState(entry.detail ?? "");
  const [saving, setSaving] = useState(false);

  // Strip "HH:MM | " (or "~HH:MM | ") prefix from raw_line to get editable text
  // including @org and #type tags which are parsed out of entry.body.
  function rawBody() {
    return entry.raw_line.replace(/^~?\d+:\d+\s*\|\s*/, "");
  }

  function startEdit() {
    setBodyDraft(rawBody());
    setDetailDraft(entry.detail ?? "");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function saveEdit() {
    if (!bodyDraft.trim()) return;
    setSaving(true);
    try {
      await onEdit(entry.id, bodyDraft.trim(), detailDraft.trim() || undefined);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="px-4 py-3 border-b border-gray-200/50 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-800/30">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-16 pt-0.5">
            <span className="text-xs text-gray-500 tabular-nums">
              {entry.approximate ? "~" : ""}
              {entry.time}
            </span>
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <textarea
              className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 resize-none text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={2}
              value={bodyDraft}
              onChange={(e: { target: { value: string } }) => setBodyDraft(e.target.value)}
              autoFocus
              onKeyDown={(e: { key: string; metaKey: boolean; ctrlKey: boolean }) => {
                if (e.key === "Escape") cancelEdit();
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit();
              }}
            />
            <textarea
              className="w-full text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 resize-none text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={2}
              placeholder="Detail (optional)"
              value={detailDraft}
              onChange={(e: { target: { value: string } }) => setDetailDraft(e.target.value)}
              onKeyDown={(e: { key: string; metaKey: boolean; ctrlKey: boolean }) => {
                if (e.key === "Escape") cancelEdit();
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit();
              }}
            />
            <div className="flex gap-2">
              <button
                className="text-xs px-2.5 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                onClick={saveEdit}
                disabled={saving || !bodyDraft.trim()}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                className="text-xs px-2.5 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group px-4 py-3 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
      <div className="flex items-start gap-3">
        {/* Time + type indicator */}
        <div className="flex flex-col items-end shrink-0 w-16 pt-0.5">
          <span className="text-xs text-gray-500 tabular-nums">
            {entry.approximate ? "~" : ""}
            {entry.time}
          </span>
          <span
            className="text-xs font-medium mt-0.5"
            style={{ color }}
          >
            {label}
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{entry.body}</p>
          {entry.detail && (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed whitespace-pre-line">
              {entry.detail}
            </p>
          )}

          {/* Pills */}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {entry.org && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                @{entry.org}
              </span>
            )}
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded bg-gray-200/50 dark:bg-gray-700/50 text-gray-500"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Hover action buttons */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            title="Edit entry"
            onClick={startEdit}
            className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086zM11.189 6.25 9.75 4.81 3.23 11.33c-.03.03-.052.067-.063.107l-.652 2.278 2.278-.652a.196.196 0 0 0 .108-.063l6.518-6.518z"/>
            </svg>
          </button>
          <button
            title="Delete entry"
            onClick={() => onDelete(entry.id)}
            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.576l-.66-6.6a.75.75 0 1 1 1.492-.149ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
