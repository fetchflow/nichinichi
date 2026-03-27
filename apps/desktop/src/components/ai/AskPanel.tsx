import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AiMessage } from "../../hooks/useAi";

function EntryBlock({ text, added, onAdded }: { text: string; added: boolean; onAdded: (key: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleAdd = async () => {
    if (added || loading) return;
    setLoading(true);
    try {
      await invoke("add_entry", { text: text.trim() });
      onAdded(text.trim());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-2 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 overflow-hidden">
      <div className="px-3 py-2 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
        {text.trim()}
      </div>
      <div className="px-3 py-2 border-t border-amber-200 dark:border-amber-800/50 flex items-center gap-2">
        <button
          onClick={handleAdd}
          disabled={added || loading}
          className={`text-xs px-2.5 py-1 rounded text-white font-medium transition-colors
            ${added
              ? "bg-green-500 opacity-50 cursor-not-allowed"
              : loading
              ? "bg-amber-400 opacity-50 cursor-not-allowed"
              : "bg-amber-500 hover:bg-amber-600 cursor-pointer"
            }`}
        >
          {added ? "Added ✓" : loading ? "Adding…" : "Add to journal"}
        </button>
        {error && <span className="text-xs text-red-500">Failed to add entry</span>}
      </div>
    </div>
  );
}

// ── Shared block parsing ────────────────────────────────────────────────────

function parseBlockMeta(raw: string): { meta: Record<string, string>; body: string } {
  const lines = raw.trim().split("\n");
  const meta: Record<string, string> = {};
  let i = 0;
  while (i < lines.length && lines[i].includes(":") && !lines[i].startsWith(" ") && !lines[i].startsWith("\t")) {
    const colonIdx = lines[i].indexOf(":");
    const k = lines[i].slice(0, colonIdx).trim();
    const v = lines[i].slice(colonIdx + 1).trim();
    if (k) meta[k] = v;
    i++;
  }
  // skip blank separator line
  if (i < lines.length && lines[i].trim() === "") i++;
  const body = lines.slice(i).join("\n").trim();
  return { meta, body };
}

// ── GoalBlock ────────────────────────────────────────────────────────────────

function GoalBlock({ text, added, onAdded, orgs }: { text: string; added: boolean; onAdded: (key: string) => void; orgs: string[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const { meta, body } = parseBlockMeta(text);
  const stepsBody = body.includes("steps:") ? body.split("steps:").slice(1).join("steps:") : body;
  const initialSteps = stepsBody
    .split("\n")
    .filter((l) => l.trim().startsWith("- "))
    .map((l) => l.trim().replace(/^-\s+/, "").trim())
    .filter(Boolean);

  const [title, setTitle] = useState(meta["title"] ?? "");
  const [goalType, setGoalType] = useState(meta["type"] ?? "career");
  const [org, setOrg] = useState(meta["org"] && meta["org"] !== "null" ? meta["org"] : "");
  const [horizon, setHorizon] = useState(meta["horizon"] && meta["horizon"] !== "null" ? meta["horizon"] : "");
  const [why, setWhy] = useState(meta["why"] && meta["why"] !== "null" ? meta["why"] : "");
  const [steps, setSteps] = useState<string[]>(initialSteps.length > 0 ? initialSteps : [""]);

  const inputCls = "w-full text-xs px-2 py-1 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-400";

  const handleAdd = async () => {
    if (added || loading || !title.trim()) return;
    setLoading(true);
    try {
      await invoke("create_goal_from_ai", {
        title: title.trim(),
        goalType,
        org: org.trim() || null,
        horizon: horizon.trim() || null,
        why: why.trim() || null,
        steps: steps.map((s) => s.trim()).filter(Boolean),
      });
      onAdded(text.trim());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-2 rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-900/10 overflow-hidden">
      <div className="px-3 pt-2 pb-1 text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide">Goal</div>
      <div className="px-3 pb-2 space-y-1.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" disabled={added} className={inputCls} />
        <div className="flex gap-1.5">
          <select value={goalType} onChange={(e) => setGoalType(e.target.value)} disabled={added} className={`${inputCls} w-auto`}>
            <option value="career">career</option>
            <option value="learning">learning</option>
          </select>
          <select value={org} onChange={(e) => setOrg(e.target.value)} disabled={added} className={inputCls}>
            <option value="">no org</option>
            {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <input value={horizon} onChange={(e) => setHorizon(e.target.value)} placeholder="horizon" disabled={added} className={inputCls} />
        </div>
        <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why (motivation)" disabled={added} className={inputCls} />
        <div className="space-y-1">
          <div className="text-xs text-indigo-500 dark:text-indigo-400">Steps</div>
          {steps.map((s, i) => (
            <div key={i} className="flex gap-1">
              <input
                value={s}
                onChange={(e) => setSteps(steps.map((v, j) => j === i ? e.target.value : v))}
                placeholder={`Step ${i + 1}`}
                disabled={added}
                className={inputCls}
              />
              {!added && steps.length > 1 && (
                <button onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="text-xs text-indigo-400 hover:text-indigo-600 px-1">✕</button>
              )}
            </div>
          ))}
          {!added && (
            <button onClick={() => setSteps([...steps, ""])} className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400">+ Add step</button>
          )}
        </div>
      </div>
      <div className="px-3 py-2 border-t border-indigo-200 dark:border-indigo-800/50 flex items-center gap-2">
        <button
          onClick={handleAdd}
          disabled={added || loading || !title.trim()}
          className={`text-xs px-2.5 py-1 rounded text-white font-medium transition-colors
            ${added ? "bg-green-500 opacity-50 cursor-not-allowed"
              : loading ? "bg-indigo-400 opacity-50 cursor-not-allowed"
              : !title.trim() ? "bg-indigo-300 cursor-not-allowed"
              : "bg-indigo-500 hover:bg-indigo-600 cursor-pointer"}`}
        >
          {added ? "Added ✓" : loading ? "Adding…" : "Add goal"}
        </button>
        {error && <span className="text-xs text-red-500">Failed to add goal</span>}
      </div>
    </div>
  );
}

// ── PlaybookBlock ────────────────────────────────────────────────────────────

function PlaybookBlock({ text, added, onAdded, orgs }: { text: string; added: boolean; onAdded: (key: string) => void; orgs: string[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const { meta, body } = parseBlockMeta(text);

  const [title, setTitle] = useState(meta["title"] ?? "");
  const [tagsInput, setTagsInput] = useState((meta["tags"] ?? "").split(",").map((t) => t.trim()).filter(Boolean).join(", "));
  const [org, setOrg] = useState(meta["org"] && meta["org"] !== "null" ? meta["org"] : "");
  const [content, setContent] = useState(body);

  const inputCls = "w-full text-xs px-2 py-1 rounded border border-violet-200 dark:border-violet-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400";

  const handleAdd = async () => {
    if (added || loading || !title.trim()) return;
    setLoading(true);
    try {
      await invoke("create_playbook_from_ai", {
        title: title.trim(),
        tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
        org: org.trim() || null,
        content: content.trim(),
      });
      onAdded(text.trim());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-2 rounded-lg border border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-900/10 overflow-hidden">
      <div className="px-3 pt-2 pb-1 text-xs font-semibold text-violet-500 dark:text-violet-400 uppercase tracking-wide">Playbook</div>
      <div className="px-3 pb-2 space-y-1.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" disabled={added} className={inputCls} />
        <div className="flex gap-1.5">
          <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="tags, comma-separated" disabled={added} className={inputCls} />
          <select value={org} onChange={(e) => setOrg(e.target.value)} disabled={added} className={`${inputCls} w-28`}>
            <option value="">no org</option>
            {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          disabled={added}
          placeholder="Steps / content"
          className={`${inputCls} font-mono resize-y`}
        />
      </div>
      <div className="px-3 py-2 border-t border-violet-200 dark:border-violet-800/50 flex items-center gap-2">
        <button
          onClick={handleAdd}
          disabled={added || loading || !title.trim()}
          className={`text-xs px-2.5 py-1 rounded text-white font-medium transition-colors
            ${added ? "bg-green-500 opacity-50 cursor-not-allowed"
              : loading ? "bg-violet-400 opacity-50 cursor-not-allowed"
              : !title.trim() ? "bg-violet-300 cursor-not-allowed"
              : "bg-violet-500 hover:bg-violet-600 cursor-pointer"}`}
        >
          {added ? "Added ✓" : loading ? "Adding…" : "Add playbook"}
        </button>
        {error && <span className="text-xs text-red-500">Failed to add playbook</span>}
      </div>
    </div>
  );
}

// ── DigestBlock ──────────────────────────────────────────────────────────────

function DigestBlock({ text, added, onAdded, orgs }: { text: string; added: boolean; onAdded: (key: string) => void; orgs: string[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const { meta, body } = parseBlockMeta(text);

  const [digestType, setDigestType] = useState(meta["type"] ?? "weekly");
  const [periodStart, setPeriodStart] = useState(meta["period_start"] ?? "");
  const [periodEnd, setPeriodEnd] = useState(meta["period_end"] ?? "");
  const [org, setOrg] = useState(meta["org"] && meta["org"] !== "null" ? meta["org"] : "");
  const [content, setContent] = useState(body);

  const inputCls = "w-full text-xs px-2 py-1 rounded border border-teal-200 dark:border-teal-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400";

  const handleAdd = async () => {
    if (added || loading) return;
    setLoading(true);
    try {
      await invoke("save_digest_from_ai", {
        digestType,
        periodStart: periodStart.trim(),
        periodEnd: periodEnd.trim(),
        org: org.trim() || null,
        content: content.trim(),
      });
      onAdded(text.trim());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-2 rounded-lg border border-teal-200 dark:border-teal-800/50 bg-teal-50 dark:bg-teal-900/10 overflow-hidden">
      <div className="px-3 pt-2 pb-1 text-xs font-semibold text-teal-500 dark:text-teal-400 uppercase tracking-wide">Report</div>
      <div className="px-3 pb-2 space-y-1.5">
        <div className="flex gap-1.5">
          <select value={digestType} onChange={(e) => setDigestType(e.target.value)} disabled={added} className={`${inputCls} w-auto`}>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
            <option value="review">review</option>
          </select>
          <select value={org} onChange={(e) => setOrg(e.target.value)} disabled={added} className={`${inputCls} w-28`}>
            <option value="">no org</option>
            {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex gap-1.5">
          <input value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} placeholder="period_start (YYYY-MM-DD)" disabled={added} className={inputCls} />
          <input value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} placeholder="period_end (YYYY-MM-DD)" disabled={added} className={inputCls} />
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          disabled={added}
          placeholder="Report content"
          className={`${inputCls} resize-y`}
        />
      </div>
      <div className="px-3 py-2 border-t border-teal-200 dark:border-teal-800/50 flex items-center gap-2">
        <button
          onClick={handleAdd}
          disabled={added || loading}
          className={`text-xs px-2.5 py-1 rounded text-white font-medium transition-colors
            ${added
              ? "bg-green-500 opacity-50 cursor-not-allowed"
              : loading
              ? "bg-teal-400 opacity-50 cursor-not-allowed"
              : "bg-teal-500 hover:bg-teal-600 cursor-pointer"
            }`}
        >
          {added ? "Saved ✓" : loading ? "Saving…" : "Save report"}
        </button>
        {error && <span className="text-xs text-red-500">Failed to save report</span>}
      </div>
    </div>
  );
}

interface AiConversationSummary {
  id: string;
  date: string;
  query: string;
  org: string | null;
  file_path: string;
}

interface Props {
  messages: AiMessage[];
  streaming: boolean;
  activeOrg: string;
  availableOrgs: string[];
  layout: "panel" | "half" | "full";
  onAsk: (query: string) => void;
  onClear: () => void;
  onClose: () => void;
  onLoad: (messages: AiMessage[]) => void;
  onLayoutChange: (layout: "panel" | "half" | "full") => void;
  activeModel: string;
  onModelChange: (model: string) => void;
}

export function AskPanel({ messages, streaming, activeOrg, availableOrgs, layout, onAsk, onClear, onClose, onLoad, onLayoutChange, activeModel, onModelChange }: Props) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<AiConversationSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadedConv, setLoadedConv] = useState<AiConversationSummary | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [addedEntries, setAddedEntries] = useState<Set<string>>(new Set());
  const [models, setModels] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    invoke<string[]>("get_models")
      .then((list) => {
        setModels(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages]);

  useEffect(() => {
    const org = activeOrg === "all" ? null : activeOrg;
    invoke<AiConversationSummary[]>("get_ai_conversations", { org })
      .then(setHistory)
      .catch(() => {});
  }, [activeOrg]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q || streaming) return;
    setShowHistory(false);
    onAsk(q);
    setInput("");
    // reset textarea height
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const refreshHistory = () => {
    const org = activeOrg === "all" ? null : activeOrg;
    invoke<AiConversationSummary[]>("get_ai_conversations", { org })
      .then(setHistory)
      .catch(() => {});
  };

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("ai-saved", () => refreshHistory()).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [activeOrg]);

  const handleLoadConversation = async (conv: AiConversationSummary) => {
    try {
      const loaded = await invoke<AiMessage[]>("load_ai_conversation_cmd", {
        filePath: conv.file_path,
      });
      onLoad(loaded);
      setLoadedConv(conv);
      setShowHistory(false);
    } catch {
      // ignore load errors
    }
  };

  const handleDelete = async (conv: AiConversationSummary) => {
    setMenuOpen(null);
    await invoke("delete_ai_conversation_cmd", { filePath: conv.file_path }).catch(() => {});
    refreshHistory();
  };

  const handleArchive = async (conv: AiConversationSummary) => {
    setMenuOpen(null);
    await invoke("archive_ai_conversation_cmd", { filePath: conv.file_path }).catch(() => {});
    refreshHistory();
  };

  const handleRenameStart = (conv: AiConversationSummary) => {
    setMenuOpen(null);
    setRenamingId(conv.id);
    setRenameInput(conv.query);
  };

  const handleRenameSubmit = async (conv: AiConversationSummary) => {
    const title = renameInput.trim();
    if (title && title !== conv.query) {
      await invoke("retitle_ai_conversation_cmd", { filePath: conv.file_path, title }).catch(() => {});
      refreshHistory();
      // Keep the pinned title in sync if this is the active conversation
      if (loadedConv?.id === conv.id) setLoadedConv({ ...conv, query: title });
    }
    setRenamingId(null);
  };

  return (
    <div className="flex flex-col h-full border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <span className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase shrink-0">
            Nichinichi
          </span>
          <select
            value={activeModel}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={models.length === 0}
            title={activeModel || "no model selected"}
            className="text-xs bg-transparent text-gray-400 dark:text-gray-500 border-none outline-none cursor-pointer max-w-[120px] truncate disabled:opacity-40"
          >
            {(models.length === 0 ? (activeModel ? [activeModel] : []) : models).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
            {models.length > 0 && !models.includes(activeModel) && activeModel && (
              <option value={activeModel}>{activeModel}</option>
            )}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { onClear(); setLoadedConv(null); setShowHistory(false); inputRef.current?.focus(); }}
            title="New chat"
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory((v) => !v)}
              title={showHistory ? "Back to chat" : "Past conversations"}
              className={`p-1 rounded transition-colors ${
                showHistory
                  ? "text-amber-500 bg-amber-50 dark:bg-amber-900/20"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onLayoutChange(layout === "half" ? "panel" : "half")}
            title={layout === "half" ? "Restore panel" : "Half screen"}
            className={`p-1 rounded transition-colors ${
              layout === "half"
                ? "text-amber-500 bg-amber-50 dark:bg-amber-900/20"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="1" />
              <line x1="12" y1="3" x2="12" y2="21" />
            </svg>
          </button>
          <button
            onClick={() => onLayoutChange(layout === "full" ? "panel" : "full")}
            title={layout === "full" ? "Restore panel" : "Full screen"}
            className={`p-1 rounded transition-colors ${
              layout === "full"
                ? "text-amber-500 bg-amber-50 dark:bg-amber-900/20"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="1" />
            </svg>
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* History list */}
      {showHistory ? (
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-8 px-4">
              No saved conversations yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {history.map((conv) => (
                <li key={conv.id} className="relative group">
                  {renamingId === conv.id ? (
                    <div className="px-4 py-3">
                      <p className="text-xs text-gray-400 dark:text-gray-600 mb-1">{conv.date}</p>
                      <input
                        autoFocus
                        value={renameInput}
                        onChange={(e) => setRenameInput(e.target.value)}
                        onBlur={() => handleRenameSubmit(conv)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameSubmit(conv);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="w-full text-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200
                                   border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-start">
                      <button
                        onClick={() => handleLoadConversation(conv)}
                        className="flex-1 text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors min-w-0"
                      >
                        <p className="text-xs text-gray-400 dark:text-gray-600 mb-0.5">{conv.date}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 leading-snug">
                          {conv.query}
                        </p>
                      </button>
                      <div className="relative flex-shrink-0 pt-2.5 pr-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === conv.id ? null : conv.id); }}
                          className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400
                                     opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                          </svg>
                        </button>
                        {menuOpen === conv.id && (
                          <div
                            className="absolute right-0 top-8 z-10 w-32 bg-white dark:bg-gray-800 border border-gray-200
                                       dark:border-gray-700 rounded shadow-lg text-sm overflow-hidden"
                            onMouseLeave={() => setMenuOpen(null)}
                          >
                            <button onClick={() => handleRenameStart(conv)} className="w-full text-left px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Rename</button>
                            <button onClick={() => handleArchive(conv)} className="w-full text-left px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Archive</button>
                            <button onClick={() => handleDelete(conv)} className="w-full text-left px-3 py-2 text-red-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* Messages */
        <>
          {/* Conversation title — pinned above scroll area */}
          {messages.length > 0 && (() => {
            const title = loadedConv?.query ?? messages.find((m) => m.role === "user")?.content ?? "";
            const canEdit = !!loadedConv;

            const commitTitle = async () => {
              const next = titleInput.trim();
              setEditingTitle(false);
              if (!next || next === title || !loadedConv) return;
              await invoke("retitle_ai_conversation_cmd", { filePath: loadedConv.file_path, title: next }).catch(() => {});
              setLoadedConv({ ...loadedConv, query: next });
              refreshHistory();
            };

            return (
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0 group">
                {editingTitle ? (
                  <input
                    autoFocus
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onBlur={commitTitle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitTitle();
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                    className="w-full text-sm font-medium bg-transparent text-gray-700 dark:text-gray-300
                               border-b border-amber-400 focus:outline-none leading-snug"
                  />
                ) : (
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 leading-snug line-clamp-2">
                      {title}
                    </p>
                    {canEdit && (
                      <button
                        onClick={() => { setTitleInput(title); setEditingTitle(true); }}
                        className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity
                                   text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Rename"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          <div className="flex-1 overflow-y-auto select-text">
          {messages.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-12 px-4">
              Ask a question about your journal.
            </p>
          ) : (
            <>
              {messages.map((msg, i) => (
              <div
                key={i}
                className={`px-4 py-4 border-b border-gray-100 dark:border-gray-800/60 ${
                  msg.role === "user" ? "bg-gray-50 dark:bg-gray-800/40" : ""
                }`}
              >
                <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${
                  msg.role === "user"
                    ? "text-gray-400 dark:text-gray-500"
                    : "text-amber-600 dark:text-amber-500"
                }`}>
                  {msg.role === "user" ? "You" : "Nichinichi"}
                </p>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none
                                  prose-p:leading-relaxed prose-p:my-1.5
                                  prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:rounded prose-pre:text-xs
                                  prose-code:text-xs prose-code:bg-gray-100 dark:prose-code:bg-gray-800
                                  prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                                  prose-headings:font-semibold prose-headings:my-2
                                  prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5
                                  text-gray-800 dark:text-gray-200">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ className, children }) {
                          const lang = /language-(\w[\w-]*)/.exec(className ?? "")?.[1];
                          const key = String(children).trim();
                          const added = addedEntries.has(key);
                          const onAdded = (k: string) => setAddedEntries((prev) => new Set(prev).add(k));
                          if (lang === "nichinichi-entry")    return <EntryBlock    text={key} added={added} onAdded={onAdded} />;
                          if (lang === "nichinichi-goal")     return <GoalBlock     text={key} added={added} onAdded={onAdded} orgs={availableOrgs} />;
                          if (lang === "nichinichi-playbook") return <PlaybookBlock text={key} added={added} onAdded={onAdded} orgs={availableOrgs} />;
                          if (lang === "nichinichi-digest")   return <DigestBlock   text={key} added={added} onAdded={onAdded} orgs={availableOrgs} />;
                          return <code className={className}>{children}</code>;
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                    {streaming && i === messages.length - 1 && (
                      <span className="inline-block w-1.5 h-3.5 bg-amber-500 ml-0.5 animate-pulse align-middle" />
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                )}
              </div>
              ))}
            </>
          )}

          {/* Typing indicator */}
          {streaming && messages[messages.length - 1]?.role === "user" && (
            <div className="px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-3 text-amber-600 dark:text-amber-500">
                Nichinichi
              </p>
              <div className="flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        </>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800">
        <div className="relative rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800
                        focus-within:border-gray-400 dark:focus-within:border-gray-500 transition-colors">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Message… (Enter to send, Shift+Enter for newline)"
            disabled={streaming}
            className="w-full resize-none bg-transparent text-sm text-gray-800 dark:text-gray-200
                       placeholder-gray-400 dark:placeholder-gray-600 px-3 pt-2.5 pb-8
                       focus:outline-none disabled:opacity-50 leading-relaxed"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || streaming}
            className="absolute bottom-2 right-2 p-1 rounded bg-gray-200 dark:bg-gray-700
                       hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-30
                       text-gray-700 dark:text-gray-300 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
