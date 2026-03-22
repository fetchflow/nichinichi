import { useState } from "react";
import { SkeletonBlock } from "../components/Skeleton";
import { useGoals } from "../hooks/useGoals";
import { SIGNAL_COLORS } from "../types";

interface Props {
  activeOrg: string;
}

interface EditState {
  title: string;
  goalType: string;
  horizon: string;
  why: string;
}

export function GoalsView({ activeOrg }: Props) {
  const { goals, loading, error, toggleStep, archiveGoal, updateGoalMeta } = useGoals(
    "active",
    activeOrg
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ title: "", goalType: "", horizon: "", why: "" });
  const [saving, setSaving] = useState(false);

  const startEdit = (goal: (typeof goals)[0]) => {
    setEditingId(goal.id);
    setEditState({
      title: goal.title,
      goalType: goal.goal_type ?? "",
      horizon: goal.horizon ?? "",
      why: goal.why ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (goalId: string) => {
    setSaving(true);
    try {
      await updateGoalMeta(
        goalId,
        editState.title,
        editState.goalType || null,
        editState.horizon || null,
        editState.why || null
      );
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

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
            {editingId === goal.id ? (
              <div className="mb-4 space-y-2">
                <input
                  autoFocus
                  value={editState.title}
                  onChange={(e) => setEditState((s) => ({ ...s, title: e.target.value }))}
                  className="w-full bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm font-medium rounded px-2 py-1 border border-gray-300 dark:border-gray-600 focus:outline-none"
                  placeholder="Goal title"
                />
                <div className="flex gap-2">
                  <select
                    value={editState.goalType}
                    onChange={(e) => setEditState((s) => ({ ...s, goalType: e.target.value }))}
                    className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-xs rounded px-2 py-1 border border-gray-300 dark:border-gray-600 focus:outline-none"
                  >
                    <option value="">type…</option>
                    <option value="career">career</option>
                    <option value="learning">learning</option>
                  </select>
                  <input
                    value={editState.horizon}
                    onChange={(e) => setEditState((s) => ({ ...s, horizon: e.target.value }))}
                    className="flex-1 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-xs rounded px-2 py-1 border border-gray-300 dark:border-gray-600 focus:outline-none"
                    placeholder="horizon (e.g. end of 2027)"
                  />
                </div>
                <textarea
                  value={editState.why}
                  onChange={(e) => setEditState((s) => ({ ...s, why: e.target.value }))}
                  rows={2}
                  className="w-full bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-xs rounded px-2 py-1 border border-gray-300 dark:border-gray-600 focus:outline-none resize-none"
                  placeholder="why this goal matters…"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(goal.id)}
                    disabled={saving || !editState.title.trim()}
                    className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded transition-colors"
                  >
                    {saving ? "saving…" : "save"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="text-xs px-2 py-1 text-gray-500 hover:text-gray-400 transition-colors"
                  >
                    cancel
                  </button>
                </div>
              </div>
            ) : (
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
                  <button
                    onClick={() => startEdit(goal)}
                    className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                    title="Edit goal"
                  >
                    edit
                  </button>
                </div>
              </div>
            )}

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
