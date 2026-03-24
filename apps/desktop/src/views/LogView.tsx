import { EntryComposer } from "../components/feed/EntryComposer";
import { FeedCard } from "../components/feed/FeedCard";
import { SkeletonBlock } from "../components/Skeleton";
import { useEntries } from "../hooks/useEntries";
import type { Entry } from "../types";

interface Props {
  activeOrg: string;
  workspaces: string[];
}

function formatDateHeader(dateStr: string): string {
  // Parse as local date to avoid UTC offset shifting the day
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function LogView({ activeOrg, workspaces }: Props) {
  const { entries, loading, addEntry, deleteEntry, editEntry } = useEntries(undefined, activeOrg);

  const groups = entries.reduce<{ date: string; items: Entry[] }[]>((acc, e) => {
    if (acc.length === 0 || acc[acc.length - 1].date !== e.date)
      acc.push({ date: e.date, items: [] });
    acc[acc.length - 1].items.push(e);
    return acc;
  }, []);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <EntryComposer onSubmit={addEntry} workspaces={workspaces} />
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4">
            <SkeletonBlock lines={4} />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400 dark:text-gray-600">
              No entries yet. Log something above.
            </p>
          </div>
        ) : (
          groups.map(({ date, items }) => (
            <div key={date}>
              <div className="flex items-center gap-3 px-4 py-2 sticky top-0 z-10 bg-gray-50 dark:bg-gray-950/95 backdrop-blur-sm">
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                  {formatDateHeader(date)}
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
              </div>
              {items.map((entry) => (
                <FeedCard
                  key={entry.id}
                  entry={entry}
                  onDelete={deleteEntry}
                  onEdit={editEntry}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
