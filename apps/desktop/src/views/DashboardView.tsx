import { Heatmap } from "../components/stats/Heatmap";
import { SkeletonBlock, SkeletonRow } from "../components/Skeleton";
import { useStats } from "../hooks/useStats";
import { useGoals } from "../hooks/useGoals";
import { useEntries } from "../hooks/useEntries";
import { TYPE_COLORS } from "../types";

interface Props {
  activeOrg: string;
}

export function DashboardView({ activeOrg }: Props) {
  const org = activeOrg === "all" ? undefined : activeOrg;
  const { stats, loading: statsLoading } = useStats(org);
  const { goals, loading: goalsLoading } = useGoals("active", org);

  const today = new Date().toISOString().split("T")[0];
  const { entries: todayEntries, loading: entriesLoading } = useEntries(today, activeOrg);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Streak + quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="streak"
          value={statsLoading ? null : `${stats?.streak ?? 0}d`}
        />
        <StatCard
          label="entries (90d)"
          value={statsLoading ? null : String(stats?.total_entries ?? 0)}
        />
        <StatCard
          label="active goals"
          value={goalsLoading ? null : String(goals.length)}
        />
      </div>

      {/* Heatmap */}
      <section>
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          Activity
        </h2>
        {statsLoading ? (
          <SkeletonBlock lines={1} />
        ) : (
          <Heatmap cells={stats?.heatmap ?? []} />
        )}
      </section>

      {/* Entry type breakdown */}
      {stats && (
        <section>
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Entry types (90d)
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.entries_by_type).map(([type, count]) => (
              <span
                key={type}
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  backgroundColor:
                    (TYPE_COLORS as Record<string, string>)[type] + "22",
                  color: (TYPE_COLORS as Record<string, string>)[type],
                }}
              >
                {type} · {count}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Today's entries */}
      <section>
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          Today
        </h2>
        {entriesLoading ? (
          <SkeletonBlock />
        ) : todayEntries.length === 0 ? (
          <p className="text-sm text-gray-600">No entries yet today.</p>
        ) : (
          <div className="space-y-1">
            {todayEntries.map((e) => (
              <div key={e.id} className="text-sm text-gray-400">
                <span className="text-gray-600 tabular-nums mr-2">{e.time}</span>
                {e.body}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Goals snapshot */}
      <section>
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          Goals
        </h2>
        {goalsLoading ? (
          <SkeletonBlock />
        ) : goals.length === 0 ? (
          <p className="text-sm text-gray-600">No active goals.</p>
        ) : (
          <div className="space-y-3">
            {goals.slice(0, 3).map((goal) => {
              const done = goal.steps.filter((s) => s.status === "done").length;
              const total = goal.steps.length;
              const pct = total === 0 ? 0 : (done / total) * 100;
              return (
                <div key={goal.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{goal.title}</span>
                    <span className="text-gray-500">
                      {done}/{total}
                    </span>
                  </div>
                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {value === null ? (
        <SkeletonRow width="60%" />
      ) : (
        <p className="text-2xl font-semibold text-gray-200">{value}</p>
      )}
    </div>
  );
}
