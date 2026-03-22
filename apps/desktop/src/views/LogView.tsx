import { EntryComposer } from "../components/feed/EntryComposer";
import { FeedCard } from "../components/feed/FeedCard";
import { SkeletonBlock } from "../components/Skeleton";
import { useEntries } from "../hooks/useEntries";

interface Props {
  activeOrg: string;
}

export function LogView({ activeOrg }: Props) {
  const { entries, loading, addEntry } = useEntries(undefined, activeOrg);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <EntryComposer onSubmit={addEntry} />
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
          entries.map((entry) => <FeedCard key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
