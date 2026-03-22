import type { Entry, EntryType } from "../../types";
import { TYPE_COLORS } from "../../types";

interface Props {
  entry: Entry;
}

const TYPE_LABELS: Record<EntryType, string> = {
  score: "score",
  solution: "fix",
  decision: "decision",
  ai: "ai",
  reflection: "reflection",
  log: "log",
};

export function FeedCard({ entry }: Props) {
  const color = TYPE_COLORS[entry.entry_type];
  const label = TYPE_LABELS[entry.entry_type];

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
      </div>
    </div>
  );
}
