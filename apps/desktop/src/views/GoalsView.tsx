import { useState } from "react";
import { SkeletonBlock } from "../components/Skeleton";
import { useGoals } from "../hooks/useGoals";
import { SIGNAL_COLORS } from "../types";

interface Props {
  activeOrg: string;
}

interface MetaEditState {
  title: string;
  goalType: string;
  horizon: string;
  why: string;
}

interface StepDraft {
  id: string; // original step id or "new-{n}"
  title: string;
  done: boolean;
  notes: string;
  due_date: string;
}

interface ProgressDraft {
  date: string;
  signal: string;
  note: string;
}

const SIGNALS = ["breakthrough", "strong", "steady", "moderate", "struggling", "quiet"] as const;

export function GoalsView({ activeOrg }: Props) {
  const { goals, loading, error, toggleStep, archiveGoal, reactivateGoal, updateGoalMeta, saveGoalContent } = useGoals(
    undefined,
    activeOrg
  );

  // Meta edit state
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null);
  const [metaEdit, setMetaEdit] = useState<MetaEditState>({ title: "", goalType: "", horizon: "", why: "" });
  const [metaSaving, setMetaSaving] = useState(false);

  // Step edit state
  const [editingStepsId, setEditingStepsId] = useState<string | null>(null);
  const [stepDrafts, setStepDrafts] = useState<StepDraft[]>([]);
  const [stepsSaving, setStepsSaving] = useState(false);

  // Progress state — which goal has the add form open
  const [addingProgressId, setAddingProgressId] = useState<string | null>(null);
  const [progressDraft, setProgressDraft] = useState<ProgressDraft>({
    date: new Date().toISOString().slice(0, 10),
    signal: "steady",
    note: "",
  });
  const [progressSaving, setProgressSaving] = useState(false);

  // ── Meta edit ──────────────────────────────────────────────────────────────

  const startMetaEdit = (goal: (typeof goals)[0]) => {
    setEditingMetaId(goal.id);
    setMetaEdit({
      title: goal.title,
      goalType: goal.goal_type ?? "",
      horizon: goal.horizon ?? "",
      why: goal.why ?? "",
    });
  };

  const cancelMetaEdit = () => setEditingMetaId(null);

  const saveMetaEdit = async (goalId: string) => {
    setMetaSaving(true);
    try {
      await updateGoalMeta(goalId, metaEdit.title, metaEdit.goalType || null, metaEdit.horizon || null, metaEdit.why || null);
      setEditingMetaId(null);
    } finally {
      setMetaSaving(false);
    }
  };

  // ── Step edit ──────────────────────────────────────────────────────────────

  const startStepEdit = (goal: (typeof goals)[0]) => {
    setEditingStepsId(goal.id);
    setStepDrafts(
      goal.steps.map((s) => ({
        id: s.id,
        title: s.title,
        done: s.status === "done",
        notes: s.notes ?? "",
        due_date: s.due_date ?? "",
      }))
    );
  };

  const cancelStepEdit = () => setEditingStepsId(null);

  const saveStepEdit = async (goalId: string, goal: (typeof goals)[0]) => {
    setStepsSaving(true);
    try {
      await saveGoalContent(
        goalId,
        stepDrafts.map((s) => ({ title: s.title, done: s.done, notes: s.notes || undefined, due_date: s.due_date || undefined })),
        goal.progress.map((p) => ({ date: p.period_start, signal: p.signal, note: p.note ?? undefined }))
      );
      setEditingStepsId(null);
    } finally {
      setStepsSaving(false);
    }
  };

  const addStep = () => {
    setStepDrafts((d) => [...d, { id: `new-${Date.now()}`, title: "", done: false, notes: "", due_date: "" }]);
  };

  const removeStep = (idx: number) => {
    setStepDrafts((d) => d.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    setStepDrafts((d) => {
      const next = [...d];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return d;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  // ── Progress ───────────────────────────────────────────────────────────────

  const openAddProgress = (goalId: string) => {
    setAddingProgressId(goalId);
    setProgressDraft({ date: new Date().toISOString().slice(0, 10), signal: "steady", note: "" });
  };

  const cancelAddProgress = () => setAddingProgressId(null);

  const saveProgress = async (goal: (typeof goals)[0]) => {
    setProgressSaving(true);
    try {
      const newEntry = { date: progressDraft.date, signal: progressDraft.signal, note: progressDraft.note || undefined };
      // Prepend (newest first)
      const allProgress = [newEntry, ...goal.progress.map((p) => ({ date: p.period_start, signal: p.signal, note: p.note ?? undefined }))];
      await saveGoalContent(
        goal.id,
        goal.steps.map((s) => ({ title: s.title, done: s.status === "done", notes: s.notes ?? undefined, due_date: s.due_date ?? undefined })),
        allProgress
      );
      setAddingProgressId(null);
    } finally {
      setProgressSaving(false);
    }
  };

  const deleteProgress = async (goal: (typeof goals)[0], idx: number) => {
    const remaining = goal.progress.filter((_, i) => i !== idx).map((p) => ({
      date: p.period_start,
      signal: p.signal,
      note: p.note ?? undefined,
    }));
    await saveGoalContent(
      goal.id,
      goal.steps.map((s) => ({ title: s.title, done: s.status === "done", notes: s.notes ?? undefined, due_date: s.due_date ?? undefined })),
      remaining
    );
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

  const inputCls = "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-xs rounded px-2 py-1 border border-gray-300 dark:border-gray-600 focus:outline-none";

  const renderGoal = (goal: (typeof goals)[0]) => {
    const doneCount = goal.steps.filter((s) => s.status === "done").length;
    const total = goal.steps.length;
    const latestProgress = goal.progress[0];
    const isArchived = goal.status === "done" || goal.status === "abandoned";
    const isEditingMeta = editingMetaId === goal.id;
    const isEditingSteps = editingStepsId === goal.id;

    return (
      <div
        key={goal.id}
        className={`rounded-lg p-5 border ${
          isArchived
            ? "bg-gray-50/40 dark:bg-gray-900/40 border-gray-200/30 dark:border-gray-800/30 opacity-70"
            : "bg-gray-100/40 dark:bg-gray-800/40 border-gray-200/50 dark:border-gray-700/50"
        }`}
      >
        {/* ── Goal header / meta edit ── */}
        {isEditingMeta ? (
          <div className="mb-4 space-y-2">
            <input
              autoFocus
              value={metaEdit.title}
              onChange={(e) => setMetaEdit((s) => ({ ...s, title: e.target.value }))}
              className={`w-full ${inputCls} text-sm font-medium`}
              placeholder="Goal title"
            />
            <div className="flex gap-2">
              <select
                value={metaEdit.goalType}
                onChange={(e) => setMetaEdit((s) => ({ ...s, goalType: e.target.value }))}
                className={inputCls}
              >
                <option value="">type…</option>
                <option value="career">career</option>
                <option value="learning">learning</option>
              </select>
              <input
                value={metaEdit.horizon}
                onChange={(e) => setMetaEdit((s) => ({ ...s, horizon: e.target.value }))}
                className={`flex-1 ${inputCls}`}
                placeholder="horizon (e.g. end of 2027)"
              />
            </div>
            <textarea
              value={metaEdit.why}
              onChange={(e) => setMetaEdit((s) => ({ ...s, why: e.target.value }))}
              rows={2}
              className={`w-full ${inputCls} resize-none`}
              placeholder="why this goal matters…"
            />
            <div className="flex gap-2">
              <button
                onClick={() => saveMetaEdit(goal.id)}
                disabled={metaSaving || !metaEdit.title.trim()}
                className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded transition-colors"
              >
                {metaSaving ? "saving…" : "save"}
              </button>
              <button onClick={cancelMetaEdit} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-400 transition-colors">
                cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium text-gray-800 dark:text-gray-200">{goal.title}</h3>
                <span className={`text-xs font-mono ${STATUS_COLORS[goal.status]}`}>
                  {STATUS_LABELS[goal.status]}
                </span>
              </div>
              {goal.horizon && <p className="text-xs text-gray-500 mt-0.5">{goal.horizon}</p>}
              {goal.why && <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5 italic">{goal.why}</p>}
            </div>
            <div className="flex items-center gap-2">
              {latestProgress && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    color: SIGNAL_COLORS[latestProgress.signal],
                    backgroundColor: SIGNAL_COLORS[latestProgress.signal] + "22",
                  }}
                >
                  {latestProgress.signal}
                </span>
              )}
              {total > 0 && <span className="text-xs text-gray-500">{doneCount}/{total}</span>}
              {!isArchived && (
                <button
                  onClick={() => startMetaEdit(goal)}
                  className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                >
                  edit
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Progress bar ── */}
        {total > 0 && (
          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${(doneCount / total) * 100}%` }}
            />
          </div>
        )}

        {/* ── Steps section ── */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-gray-400 dark:text-gray-600 uppercase tracking-wider">steps</span>
            {!isArchived && !isEditingSteps && (
              <button
                onClick={() => startStepEdit(goal)}
                className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
              >
                edit steps
              </button>
            )}
          </div>

          {isEditingSteps ? (
            <div className="space-y-2">
              {stepDrafts.map((step, idx) => (
                <div key={step.id} className="rounded border border-gray-200/60 dark:border-gray-700/60 p-2 space-y-1.5 bg-white/30 dark:bg-gray-900/30">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={step.done}
                      onChange={(e) => setStepDrafts((d) => d.map((s, i) => i === idx ? { ...s, done: e.target.checked } : s))}
                      className="accent-green-500 shrink-0"
                    />
                    <input
                      value={step.title}
                      onChange={(e) => setStepDrafts((d) => d.map((s, i) => i === idx ? { ...s, title: e.target.value } : s))}
                      className={`flex-1 ${inputCls}`}
                      placeholder="step title"
                    />
                    <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="text-xs text-gray-400 disabled:opacity-30 hover:text-gray-600 dark:hover:text-gray-300">↑</button>
                    <button onClick={() => moveStep(idx, 1)} disabled={idx === stepDrafts.length - 1} className="text-xs text-gray-400 disabled:opacity-30 hover:text-gray-600 dark:hover:text-gray-300">↓</button>
                    <button onClick={() => removeStep(idx)} className="text-xs text-red-400 hover:text-red-300 transition-colors">×</button>
                  </div>
                  <div className="flex gap-2 pl-5">
                    <input
                      value={step.notes}
                      onChange={(e) => setStepDrafts((d) => d.map((s, i) => i === idx ? { ...s, notes: e.target.value } : s))}
                      className={`flex-1 ${inputCls}`}
                      placeholder="notes"
                    />
                    <input
                      value={step.due_date}
                      onChange={(e) => setStepDrafts((d) => d.map((s, i) => i === idx ? { ...s, due_date: e.target.value } : s))}
                      className={`w-32 ${inputCls}`}
                      placeholder="due date"
                    />
                  </div>
                </div>
              ))}
              <button onClick={addStep} className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
                + add step
              </button>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => saveStepEdit(goal.id, goal)}
                  disabled={stepsSaving}
                  className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded transition-colors"
                >
                  {stepsSaving ? "saving…" : "done editing"}
                </button>
                <button onClick={cancelStepEdit} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-400 transition-colors">
                  cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {goal.steps.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-600 italic">No steps yet.</p>
              )}
              {goal.steps.map((step) => (
                <label key={step.id} className="flex items-start gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={step.status === "done"}
                    onChange={(e) => toggleStep(step.id, e.target.checked)}
                    className="mt-0.5 accent-green-500"
                  />
                  <div>
                    <span className={`text-sm ${step.status === "done" ? "text-gray-400 dark:text-gray-500 line-through" : "text-gray-700 dark:text-gray-300"}`}>
                      {step.title}
                    </span>
                    {step.notes && <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{step.notes}</p>}
                    {step.due_date && <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">due: {step.due_date}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* ── Progress section ── */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-gray-400 dark:text-gray-600 uppercase tracking-wider">progress</span>
            {!isArchived && addingProgressId !== goal.id && (
              <button
                onClick={() => openAddProgress(goal.id)}
                className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
              >
                + add entry
              </button>
            )}
          </div>

          {addingProgressId === goal.id && (
            <div className="rounded border border-gray-200/60 dark:border-gray-700/60 p-3 space-y-2 bg-white/30 dark:bg-gray-900/30 mb-2">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={progressDraft.date}
                  onChange={(e) => setProgressDraft((d) => ({ ...d, date: e.target.value }))}
                  className={inputCls}
                />
                <select
                  value={progressDraft.signal}
                  onChange={(e) => setProgressDraft((d) => ({ ...d, signal: e.target.value }))}
                  className={inputCls}
                >
                  {SIGNALS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={progressDraft.note}
                onChange={(e) => setProgressDraft((d) => ({ ...d, note: e.target.value }))}
                rows={2}
                className={`w-full ${inputCls} resize-none`}
                placeholder="note…"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveProgress(goal)}
                  disabled={progressSaving || !progressDraft.date}
                  className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded transition-colors"
                >
                  {progressSaving ? "saving…" : "save"}
                </button>
                <button onClick={cancelAddProgress} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-400 transition-colors">
                  cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {goal.progress.length === 0 && addingProgressId !== goal.id && (
              <p className="text-xs text-gray-400 dark:text-gray-600 italic">No progress entries yet.</p>
            )}
            {goal.progress.map((entry, idx) => (
              <div key={entry.id} className="flex items-start gap-2 group">
                <span className="text-xs text-gray-400 dark:text-gray-600 font-mono shrink-0 mt-0.5">{entry.period_start}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    color: SIGNAL_COLORS[entry.signal],
                    backgroundColor: SIGNAL_COLORS[entry.signal] + "22",
                  }}
                >
                  {entry.signal}
                </span>
                {entry.note && (
                  <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 leading-relaxed">{entry.note}</span>
                )}
                {!isArchived && (
                  <button
                    onClick={() => deleteProgress(goal, idx)}
                    className="text-xs text-gray-300 dark:text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="delete entry"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Status actions ── */}
        <div className="flex gap-3 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
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
