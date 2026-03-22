import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SkeletonBlock } from "../components/Skeleton";
import { useGoals } from "../hooks/useGoals";
import type { Entry } from "../types";
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
  id: string;
  title: string;
  done: boolean;
  notes: string;
  due_date: string;
}

interface ProgressDraft {
  date: string;
  signal: string;
  note: string;
  refs: string[];
}

const SIGNALS = ["breakthrough", "strong", "steady", "moderate", "struggling", "quiet"] as const;

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

export function GoalsView({ activeOrg }: Props) {
  const { goals, loading, error, toggleStep, archiveGoal, reactivateGoal, updateGoalMeta, saveGoalContent } = useGoals(
    undefined,
    activeOrg
  );

  // Master-detail selection
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"steps" | "progress">("steps");

  // Auto-select first active goal when goals load
  useEffect(() => {
    if (goals.length > 0 && !selectedId) {
      const first = goals.find((g) => g.status === "active" || g.status === "paused") ?? goals[0];
      setSelectedId(first.id);
    }
  }, [goals, selectedId]);

  // Reset tab to steps when selection changes
  const selectGoal = (id: string) => {
    setSelectedId(id);
    setActiveTab("steps");
    setEditingMetaId(null);
    setEditingStepsId(null);
    setAddingProgressId(null);
  };

  // Meta edit state
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null);
  const [metaEdit, setMetaEdit] = useState<MetaEditState>({ title: "", goalType: "", horizon: "", why: "" });
  const [metaSaving, setMetaSaving] = useState(false);

  // Step edit state
  const [editingStepsId, setEditingStepsId] = useState<string | null>(null);
  const [stepDrafts, setStepDrafts] = useState<StepDraft[]>([]);
  const [stepsSaving, setStepsSaving] = useState(false);

  // Progress state
  const [addingProgressId, setAddingProgressId] = useState<string | null>(null);
  const [progressDraft, setProgressDraft] = useState<ProgressDraft>({
    date: new Date().toISOString().slice(0, 10),
    signal: "steady",
    note: "",
    refs: [],
  });
  const [progressSaving, setProgressSaving] = useState(false);
  const [refCache, setRefCache] = useState<Entry[]>([]);
  const [refCacheLoading, setRefCacheLoading] = useState(false);
  const [refSearch, setRefSearch] = useState("");

  // Ref body lookup map
  const [refEntries, setRefEntries] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const allRefs = goals.flatMap((g) => g.progress.flatMap((p) => p.refs ?? []));
    if (allRefs.length === 0) return;
    const uniqueDates = [...new Set(allRefs.map((r) => r.split(" ")[0]).filter(Boolean))];
    Promise.all(
      uniqueDates.map((date) => invoke<Entry[]>("get_entries", { date }).catch(() => [] as Entry[]))
    ).then((results) => {
      const map = new Map<string, string>();
      results.flat().forEach((e) => map.set(`${e.date} ${e.time}`, e.body));
      setRefEntries(map);
    });
  }, [goals]);

  // ── Meta edit ──────────────────────────────────────────────────────────────

  const startMetaEdit = (goal: (typeof goals)[0]) => {
    setEditingMetaId(goal.id);
    setMetaEdit({ title: goal.title, goalType: goal.goal_type ?? "", horizon: goal.horizon ?? "", why: goal.why ?? "" });
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
    setStepDrafts(goal.steps.map((s) => ({ id: s.id, title: s.title, done: s.status === "done", notes: s.notes ?? "", due_date: s.due_date ?? "" })));
  };

  const cancelStepEdit = () => setEditingStepsId(null);

  const saveStepEdit = async (goalId: string, goal: (typeof goals)[0]) => {
    setStepsSaving(true);
    try {
      await saveGoalContent(
        goalId,
        stepDrafts.map((s) => ({ title: s.title, done: s.done, notes: s.notes || undefined, due_date: s.due_date || undefined })),
        goal.progress.map((p) => ({ date: p.period_start, signal: p.signal, note: p.note ?? undefined, refs: p.refs }))
      );
      setEditingStepsId(null);
    } finally {
      setStepsSaving(false);
    }
  };

  const addStep = () => setStepDrafts((d) => [...d, { id: `new-${Date.now()}`, title: "", done: false, notes: "", due_date: "" }]);
  const removeStep = (idx: number) => setStepDrafts((d) => d.filter((_, i) => i !== idx));
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

  // Load ref cache: last 14 days of entries, fetched once when form opens
  useEffect(() => {
    if (!addingProgressId) return;
    setRefCacheLoading(true);
    const today = new Date();
    const dates = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      return d.toISOString().slice(0, 10);
    });
    Promise.all(dates.map((date) => invoke<Entry[]>("get_entries", { date }).catch(() => [] as Entry[])))
      .then((results) => setRefCache(results.flat()))
      .finally(() => setRefCacheLoading(false));
  }, [addingProgressId]);

  const openAddProgress = (goalId: string) => {
    setAddingProgressId(goalId);
    setProgressDraft({ date: new Date().toISOString().slice(0, 10), signal: "steady", note: "", refs: [] });
    setRefSearch("");
    setRefCache([]);
  };

  const cancelAddProgress = () => {
    setAddingProgressId(null);
    setRefSearch("");
    setRefCache([]);
  };

  const toggleRef = (ref: string) => {
    setProgressDraft((d) => ({ ...d, refs: d.refs.includes(ref) ? d.refs.filter((r) => r !== ref) : [...d.refs, ref] }));
  };

  const saveProgress = async (goal: (typeof goals)[0]) => {
    setProgressSaving(true);
    try {
      const newEntry = { date: progressDraft.date, signal: progressDraft.signal, note: progressDraft.note || undefined, refs: progressDraft.refs.length > 0 ? progressDraft.refs : undefined };
      await saveGoalContent(
        goal.id,
        goal.steps.map((s) => ({ title: s.title, done: s.status === "done", notes: s.notes ?? undefined, due_date: s.due_date ?? undefined })),
        [newEntry, ...goal.progress.map((p) => ({ date: p.period_start, signal: p.signal, note: p.note ?? undefined, refs: p.refs }))]
      );
      setAddingProgressId(null);
      setRefSearch("");
      setRefCache([]);
    } finally {
      setProgressSaving(false);
    }
  };

  const deleteProgress = async (goal: (typeof goals)[0], idx: number) => {
    await saveGoalContent(
      goal.id,
      goal.steps.map((s) => ({ title: s.title, done: s.status === "done", notes: s.notes ?? undefined, due_date: s.due_date ?? undefined })),
      goal.progress.filter((_, i) => i !== idx).map((p) => ({ date: p.period_start, signal: p.signal, note: p.note ?? undefined, refs: p.refs }))
    );
  };

  // ── Fuzzy search ───────────────────────────────────────────────────────────

  const fuzzyScore = (query: string, text: string): number => {
    if (!query) return 1;
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    let qi = 0, score = 0, lastMatch = -1;
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) {
        score += lastMatch === i - 1 ? 3 : 1; // bonus for consecutive chars
        lastMatch = i;
        qi++;
      }
    }
    return qi === q.length ? score : 0;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (error) return <div className="p-6"><p className="text-sm text-red-400 font-mono">Error: {error}</p></div>;
  if (loading) return <div className="p-6"><SkeletonBlock lines={5} /></div>;
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
  const goal = goals.find((g) => g.id === selectedId) ?? null;

  const inputCls = "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-xs rounded px-2 py-1 border border-gray-300 dark:border-gray-600 focus:outline-none";

  const renderListItem = (g: (typeof goals)[0]) => {
    const doneCount = g.steps.filter((s) => s.status === "done").length;
    const total = g.steps.length;
    const latest = g.progress[0];
    const isSelected = g.id === selectedId;
    const isArchived = g.status === "done" || g.status === "abandoned";

    return (
      <button
        key={g.id}
        onClick={() => selectGoal(g.id)}
        className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
          isSelected
            ? "bg-gray-200/70 dark:bg-gray-700/70"
            : "hover:bg-gray-100/60 dark:hover:bg-gray-800/60"
        } ${isArchived ? "opacity-50" : ""}`}
      >
        <p className={`text-sm font-medium truncate ${isArchived ? "text-gray-400 dark:text-gray-600" : "text-gray-800 dark:text-gray-200"}`}>
          {g.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs font-mono ${STATUS_COLORS[g.status]}`}>{STATUS_LABELS[g.status]}</span>
          {total > 0 && <span className="text-xs text-gray-400 dark:text-gray-600">{doneCount}/{total}</span>}
          {latest && (
            <span className="text-xs" style={{ color: SIGNAL_COLORS[latest.signal] }}>
              ● {latest.signal}
            </span>
          )}
        </div>
      </button>
    );
  };

  const renderStepsTab = (g: (typeof goals)[0]) => {
    const doneCount = g.steps.filter((s) => s.status === "done").length;
    const total = g.steps.length;
    const isArchived = g.status === "done" || g.status === "abandoned";
    const isEditingSteps = editingStepsId === g.id;

    return (
      <div className="space-y-3">
        {total > 0 && (
          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(doneCount / total) * 100}%` }} />
          </div>
        )}

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
                  <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="text-xs text-gray-400 disabled:opacity-30">↑</button>
                  <button onClick={() => moveStep(idx, 1)} disabled={idx === stepDrafts.length - 1} className="text-xs text-gray-400 disabled:opacity-30">↓</button>
                  <button onClick={() => removeStep(idx)} className="text-xs text-red-400 hover:text-red-300">×</button>
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
                    className={`w-28 ${inputCls}`}
                    placeholder="due date"
                  />
                </div>
              </div>
            ))}
            <button onClick={addStep} className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400">
              + add step
            </button>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => saveStepEdit(g.id, g)}
                disabled={stepsSaving}
                className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded transition-colors"
              >
                {stepsSaving ? "saving…" : "done editing"}
              </button>
              <button onClick={cancelStepEdit} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-400">cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {g.steps.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-600 italic">No steps yet.</p>}
            {g.steps.map((step) => (
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
            {!isArchived && (
              <button
                onClick={() => startStepEdit(g)}
                className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors mt-1"
              >
                edit steps
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderProgressTab = (g: (typeof goals)[0]) => {
    const isArchived = g.status === "done" || g.status === "abandoned";

    return (
      <div className="space-y-3">
        {addingProgressId === g.id && (
          <div className="rounded border border-gray-200/60 dark:border-gray-700/60 p-3 space-y-2 bg-white/30 dark:bg-gray-900/30">
            <div className="flex gap-2">
              <input
                type="date"
                value={progressDraft.date}
                onChange={(e) => setProgressDraft((d) => ({ ...d, date: e.target.value, refs: [] }))}
                className={inputCls}
              />
              <select
                value={progressDraft.signal}
                onChange={(e) => setProgressDraft((d) => ({ ...d, signal: e.target.value }))}
                className={inputCls}
              >
                {SIGNALS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <textarea
              value={progressDraft.note}
              onChange={(e) => setProgressDraft((d) => ({ ...d, note: e.target.value }))}
              rows={2}
              className={`w-full ${inputCls} resize-none`}
              placeholder="note…"
            />
            {/* Ref picker */}
            <div className="space-y-1.5">
              {progressDraft.refs.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {progressDraft.refs.map((ref) => {
                    const body = refCache.find((e) => `${e.date} ${e.time}` === ref)?.body ?? refEntries.get(ref);
                    return (
                      <span key={ref} className="inline-flex items-center gap-1 text-xs bg-gray-200/60 dark:bg-gray-700/60 text-gray-600 dark:text-gray-400 rounded px-1.5 py-0.5 max-w-[200px]">
                        <span className="font-mono shrink-0">{ref.split(" ")[1]}</span>
                        {body && <span className="truncate">{body}</span>}
                        <button onClick={() => toggleRef(ref)} className="shrink-0 text-gray-400 hover:text-red-400 ml-0.5">×</button>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="relative">
                <input
                  value={refSearch}
                  onChange={(e) => setRefSearch(e.target.value)}
                  className={`w-full ${inputCls}`}
                  placeholder={refCacheLoading ? "loading entries…" : "search entries to link…"}
                  disabled={refCacheLoading}
                />
              </div>
              {refSearch && (() => {
                const results = refCache
                  .map((e) => ({ entry: e, score: fuzzyScore(refSearch, `${e.date} ${e.time} ${e.body}`) }))
                  .filter(({ score }) => score > 0)
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 20);
                return results.length > 0 ? (
                  <div className="space-y-0.5 max-h-36 overflow-y-auto border border-gray-200/60 dark:border-gray-700/60 rounded p-1">
                    {results.map(({ entry }) => {
                      const ref = `${entry.date} ${entry.time}`;
                      const selected = progressDraft.refs.includes(ref);
                      return (
                        <label key={entry.id} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-gray-100/60 dark:hover:bg-gray-800/60">
                          <input type="checkbox" checked={selected} onChange={() => toggleRef(ref)} className="accent-green-500 shrink-0" />
                          <span className="text-xs text-gray-400 font-mono shrink-0">{entry.date} {entry.time}</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{entry.body}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-600 px-1">no matches</p>
                );
              })()}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => saveProgress(g)}
                disabled={progressSaving || !progressDraft.date}
                className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded transition-colors"
              >
                {progressSaving ? "saving…" : "save"}
              </button>
              <button onClick={cancelAddProgress} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-400">cancel</button>
            </div>
          </div>
        )}

        {g.progress.length === 0 && addingProgressId !== g.id && (
          <p className="text-xs text-gray-400 dark:text-gray-600 italic">No progress entries yet.</p>
        )}

        <div className="space-y-3">
          {g.progress.map((entry, idx) => (
            <div key={entry.id} className="group">
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-600 font-mono shrink-0 mt-0.5 w-20">{entry.period_start}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded shrink-0"
                  style={{ color: SIGNAL_COLORS[entry.signal], backgroundColor: SIGNAL_COLORS[entry.signal] + "22" }}
                >
                  {entry.signal}
                </span>
                {!isArchived && (
                  <button
                    onClick={() => deleteProgress(g, idx)}
                    className="text-xs text-gray-300 dark:text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-auto"
                    title="delete"
                  >
                    ×
                  </button>
                )}
              </div>
              {entry.note && (
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-1 ml-[5.5rem]">{entry.note}</p>
              )}
              {entry.refs && entry.refs.length > 0 && (
                <div className="ml-[5.5rem] mt-1.5 space-y-0.5">
                  {entry.refs.map((ref) => {
                    const time = ref.split(" ")[1] ?? ref;
                    const body = refEntries.get(ref);
                    return (
                      <p key={ref} className="text-xs text-gray-400 dark:text-gray-600">
                        <span className="font-mono">{time}</span>
                        {body && <span className="ml-2 text-gray-500">{body}</span>}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {!isArchived && addingProgressId !== g.id && (
          <button
            onClick={() => openAddProgress(g.id)}
            className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          >
            + add entry
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Left: goal list ── */}
      <div className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-800 overflow-y-auto p-2 space-y-0.5">
        {active.map(renderListItem)}
        {archived.length > 0 && (
          <>
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
              <span className="text-xs text-gray-400 dark:text-gray-600 font-mono">archived</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
            </div>
            {archived.map(renderListItem)}
          </>
        )}
      </div>

      {/* ── Right: goal detail ── */}
      {goal ? (
        <div className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          {editingMetaId === goal.id ? (
            <div className="space-y-2 mb-6">
              <input
                autoFocus
                value={metaEdit.title}
                onChange={(e) => setMetaEdit((s) => ({ ...s, title: e.target.value }))}
                className={`w-full ${inputCls} text-base font-medium`}
                placeholder="Goal title"
              />
              <div className="flex gap-2">
                <select value={metaEdit.goalType} onChange={(e) => setMetaEdit((s) => ({ ...s, goalType: e.target.value }))} className={inputCls}>
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
                <button onClick={cancelMetaEdit} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-400">cancel</button>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">{goal.title}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-mono ${STATUS_COLORS[goal.status]}`}>{STATUS_LABELS[goal.status]}</span>
                    {goal.goal_type && <span className="text-xs text-gray-400 dark:text-gray-600">{goal.goal_type}</span>}
                    {goal.horizon && <span className="text-xs text-gray-400 dark:text-gray-600">· {goal.horizon}</span>}
                  </div>
                  {goal.why && <p className="text-sm text-gray-500 dark:text-gray-500 mt-1.5 italic">{goal.why}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {goal.status !== "done" && goal.status !== "abandoned" && (
                    <>
                      <button
                        onClick={() => startMetaEdit(goal)}
                        className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                      >
                        edit
                      </button>
                      <button onClick={() => archiveGoal(goal.id, "done")} className="text-xs text-green-500 hover:text-green-400 transition-colors">
                        mark done
                      </button>
                      <button onClick={() => archiveGoal(goal.id, "abandoned")} className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-500 transition-colors">
                        abandon
                      </button>
                    </>
                  )}
                  {(goal.status === "done" || goal.status === "abandoned") && (
                    <button onClick={() => reactivateGoal(goal.id)} className="text-xs text-violet-500 hover:text-violet-400 transition-colors">
                      reactivate
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-0 mb-5 border-b border-gray-200 dark:border-gray-800">
            {(["steps", "progress"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-xs font-mono transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-gray-600 dark:border-gray-400 text-gray-700 dark:text-gray-300"
                    : "border-transparent text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "steps" ? renderStepsTab(goal) : renderProgressTab(goal)}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-400 dark:text-gray-600">Select a goal</p>
        </div>
      )}
    </div>
  );
}
