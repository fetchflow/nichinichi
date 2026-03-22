import { SkeletonBlock } from "../components/Skeleton";
import { useGoals } from "../hooks/useGoals";
import { SIGNAL_COLORS } from "../types";

interface Props {
  activeOrg: string;
}

export function GoalsView({ activeOrg }: Props) {
  const { goals, loading, error, toggleStep, archiveGoal } = useGoals(
    "active",
    activeOrg
  );

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-400 font-mono">Error: {error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <SkeletonBlock lines={5} />
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400 dark:text-gray-600">
          No active goals. Use the CLI to add one:
          <code className="ml-2 text-gray-500">devlog goals add "title"</code>
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {goals.map((goal) => {
        const done = goal.steps.filter((s) => s.status === "done").length;
        const total = goal.steps.length;
        const latestProgress = goal.progress[0];

        return (
          <div
            key={goal.id}
            className="bg-gray-100/40 dark:bg-gray-800/40 rounded-lg p-5 border border-gray-200/50 dark:border-gray-700/50"
          >
            {/* Goal header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-base font-medium text-gray-800 dark:text-gray-200">
                  {goal.title}
                </h3>
                {goal.horizon && (
                  <p className="text-xs text-gray-500 mt-0.5">{goal.horizon}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {latestProgress && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      color: SIGNAL_COLORS[latestProgress.signal],
                      backgroundColor:
                        SIGNAL_COLORS[latestProgress.signal] + "22",
                    }}
                  >
                    {latestProgress.signal}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {done}/{total}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            {total > 0 && (
              <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(done / total) * 100}%` }}
                />
              </div>
            )}

            {/* Steps */}
            <div className="space-y-2">
              {goal.steps.map((step) => (
                <label
                  key={step.id}
                  className="flex items-start gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={step.status === "done"}
                    onChange={(e) => toggleStep(step.id, e.target.checked)}
                    className="mt-0.5 accent-green-500"
                  />
                  <div>
                    <span
                      className={`text-sm ${
                        step.status === "done"
                          ? "text-gray-400 dark:text-gray-500 line-through"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {step.title}
                    </span>
                    {step.notes && (
                      <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                        {step.notes}
                      </p>
                    )}
                    {step.due_date && (
                      <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                        due: {step.due_date}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {/* Archive actions */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
              <button
                onClick={() => archiveGoal(goal.id, "done")}
                className="text-xs text-green-500 hover:text-green-400 transition-colors"
              >
                mark done
              </button>
              <button
                onClick={() => archiveGoal(goal.id, "abandoned")}
                className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-500 transition-colors"
              >
                abandon
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
