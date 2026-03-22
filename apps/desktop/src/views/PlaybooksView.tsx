import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SkeletonBlock } from "../components/Skeleton";
import type { Playbook } from "../types";

interface Props {
  activeOrg: string;
}

export function PlaybooksView({ activeOrg }: Props) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Playbook | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  // New playbook form
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    invoke<Playbook[]>("get_playbooks", {
      org: activeOrg === "all" ? null : activeOrg,
    })
      .then((pbs) => {
        setPlaybooks(pbs);
        // Keep selected in sync after reload
        setSelected((prev) => {
          if (!prev) return null;
          return pbs.find((p) => p.id === prev.id) ?? null;
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [activeOrg]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (pb: Playbook) => {
    setSelected(pb);
    setEditing(false);
    setConfirmDelete(false);
  };

  // ── Edit ──────────────────────────────────────────────────────────────────

  const startEdit = () => {
    if (!selected) return;
    setEditTitle(selected.title);
    setEditTags(selected.tags.join(", "));
    setEditContent(selected.content ?? "");
    setEditing(true);
    setConfirmDelete(false);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const tags = editTags.split(",").map((t) => t.trim()).filter(Boolean);
      const updated = await invoke<Playbook>("save_playbook", {
        id: selected.id,
        title: editTitle,
        tags,
        content: editContent,
      });
      setSelected(updated);
      setEditing(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  // ── Create ────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setCreating(true);
    setNewTitle("");
  };

  const cancelCreate = () => {
    setCreating(false);
    setNewTitle("");
  };

  const submitCreate = async () => {
    if (!newTitle.trim()) return;
    setCreateSaving(true);
    try {
      const org = activeOrg === "all" ? null : activeOrg;
      const pb = await invoke<Playbook>("create_playbook", { title: newTitle.trim(), org });
      setPlaybooks((prev) => [pb, ...prev]);
      setSelected(pb);
      setEditing(false);
      // Open edit mode so the user can fill in content right away
      setEditTitle(pb.title);
      setEditTags("");
      setEditContent(pb.content ?? "");
      setEditing(true);
      setCreating(false);
      setNewTitle("");
    } finally {
      setCreateSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const confirmAndDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await invoke("delete_playbook", { id: selected.id });
      setPlaybooks((prev) => prev.filter((p) => p.id !== selected.id));
      setSelected(null);
      setEditing(false);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-6"><SkeletonBlock /></div>;
  }

  const inputCls =
    "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm rounded px-2 py-1 border border-gray-300 dark:border-gray-600 focus:outline-none";

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Left: playbook list ── */}
      <div className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
        {/* New playbook */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-800">
          {creating ? (
            <div className="flex gap-1">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitCreate();
                  if (e.key === "Escape") cancelCreate();
                }}
                className={`flex-1 text-xs ${inputCls}`}
                placeholder="playbook title…"
              />
              <button
                onClick={submitCreate}
                disabled={createSaving || !newTitle.trim()}
                className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded transition-colors"
              >
                {createSaving ? "…" : "add"}
              </button>
              <button onClick={cancelCreate} className="text-xs text-gray-400 hover:text-gray-600 px-1">×</button>
            </div>
          ) : (
            <button
              onClick={openCreate}
              className="w-full text-left text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors px-1 py-0.5"
            >
              + new playbook
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {playbooks.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-600 p-2 italic">No playbooks yet.</p>
          ) : (
            playbooks.map((pb) => (
              <button
                key={pb.id}
                onClick={() => select(pb)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  selected?.id === pb.id
                    ? "bg-gray-200/70 dark:bg-gray-700/70"
                    : "hover:bg-gray-100/60 dark:hover:bg-gray-800/60"
                }`}
              >
                <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{pb.title}</p>
                {pb.tags.length > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5 truncate">
                    {pb.tags.join(", ")}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right: content area ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {selected ? (
          editing ? (
            /* ── Split-view editor ── */
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-800 shrink-0">
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={`flex-1 font-medium ${inputCls}`}
                  placeholder="Title"
                />
                <input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className={`w-40 text-xs ${inputCls}`}
                  placeholder="tags, comma-separated"
                />
                <button
                  onClick={saveEdit}
                  disabled={saving || !editTitle.trim()}
                  className="text-xs px-3 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded transition-colors"
                >
                  {saving ? "saving…" : "save"}
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                >
                  cancel
                </button>
              </div>

              {/* Editor + Preview side by side */}
              <div className="flex flex-1 overflow-hidden divide-x divide-gray-200 dark:divide-gray-800">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 bg-transparent text-gray-700 dark:text-gray-300 text-sm font-mono px-4 py-4 focus:outline-none resize-none overflow-y-auto"
                  placeholder="Write markdown here…"
                  spellCheck={false}
                />
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <article className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-gray-100 dark:prose-pre:bg-gray-900 prose-code:text-gray-700 dark:prose-code:text-gray-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {editContent || "*nothing yet*"}
                    </ReactMarkdown>
                  </article>
                </div>
              </div>
            </div>
          ) : (
            /* ── Read view ── */
            <div className="flex-1 overflow-y-auto p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">{selected.title}</h2>
                  {selected.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {selected.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={startEdit}
                    className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                  >
                    edit
                  </button>
                  {confirmDelete ? (
                    <span className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400 dark:text-gray-600">delete?</span>
                      <button
                        onClick={confirmAndDelete}
                        disabled={deleting}
                        className="text-red-500 hover:text-red-400 disabled:opacity-40"
                      >
                        {deleting ? "deleting…" : "yes"}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        no
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="text-xs text-gray-300 dark:text-gray-700 hover:text-red-400 transition-colors"
                    >
                      delete
                    </button>
                  )}
                </div>
              </div>

              {/* Rendered markdown */}
              <article className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-gray-100 dark:prose-pre:bg-gray-900 prose-code:text-gray-700 dark:prose-code:text-gray-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selected.content ?? ""}
                </ReactMarkdown>
              </article>
            </div>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-400 dark:text-gray-600">Select a playbook to view.</p>
          </div>
        )}
      </div>
    </div>
  );
}
