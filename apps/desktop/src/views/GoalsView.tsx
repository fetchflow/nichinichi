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
  const { goals, loading, error, toggleStep, archiveGoal, reactivateGoal, updateGoalMeta } = useGoals(
    undefined,   // no status filter — show all
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
          No goals yet. Use the CLI to add one:
          <code className="ml-2 text-gray-500">devlog goals add "title"</code>
        </p>
      </div>
    );
  }

  const active = goals.filter((g) => g.status === "active" || g.status === "paused");
  const archived = goals.filter((g) => g.status === "done" || g.status === "abandoned");

  const STATUS_LABELS: Record<string, string> = {
    active: "active",
    paused: "paused",
    done: "done",
    abandoned: "abandoned",
  };
  const STATUS_COLORS: Record<string, string> = {
    active: "text-green-500",
    paused: "text-yellow-500",
    done: "text-blue-400",
    abandoned: "text-gray-400",
  };

  const renderGoal = (goal: (typeof goals)[0]) => {
    const done = goal.steps.filter((s) => s.status === "done").length;
    const total = goal.steps.length;
    const latestProgress = goal.progress[0];
    const isArchived = goal.status === "done" || goal.status === "abandoned";

    return (
      <div
        key={goal.id}
        className={`rounded-lg p-5 border ${
          isArchived
            ? "bg-gray-50/40 dark:bg-gray-900/40 border-gray-200/30 dark:border-gray-800/30 opacity-70"
            : "bg-gray-100/40 dark:bg-gray-800/40 border-gray-200/50 dark:border-gray-700/50"
        }`}
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
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-medium text-gray-800 dark:text-gray-200">
                      {goal.title}
                    </h3>
                    <span className={`text-xs font-mono ${STATUS_COLORS[goal.status]}`}>
                      {STATUS_LABELS[goal.status]}
                    </span>
                  </div>
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
                  {total > 0 && (
                    <span className="text-xs text-gray-500">
                      {done}/{total}
                    </span>
                  )}
                  {!isArchived && (
                    <button
                      onClick={() => startEdit(goal)}
                      className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                    >
                      edit
                    </button>
                  )}
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

            {/* Status actions */}
            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
              {isArchived ? (
                <button
                  onClick={() => reactivateGoal(goal.id)}
                  className="text-xs text-violet-500 hover:text-violet-400 transition-colors"
                >
                  reactivate
                </button>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {active.map(renderGoal)}

      {archived.length > 0 && (
        <>
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
            <span className="text-xs text-gray-400 dark:text-gray-600 font-mono uppercase tracking-wider">
              archived
            </span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          </div>
          {archived.map(renderGoal)}
        </>
      )}
    </div>
  );
}
