import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { SkeletonBlock } from "../components/Skeleton";
import type { Playbook } from "../types";

interface Props {
  activeOrg: string;
}

export function PlaybooksView({ activeOrg }: Props) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Playbook | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    invoke<Playbook[]>("get_playbooks", {
      org: activeOrg === "all" ? null : activeOrg,
    })
      .then(setPlaybooks)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [activeOrg]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = () => {
    if (!selected) return;
    setEditTitle(selected.title);
    setEditTags(selected.tags.join(", "));
    setEditContent(selected.content ?? "");
    setEditing(true);
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

  if (loading) {
    return (
      <div className="p-6">
        <SkeletonBlock />
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* List */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
        {playbooks.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-600 p-4">No playbooks yet.</p>
        ) : (
          playbooks.map((pb) => (
            <button
              key={pb.id}
              onClick={() => setSelected(pb)}
              className={`w-full text-left px-4 py-3 border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors ${
                selected?.id === pb.id ? "bg-gray-100 dark:bg-gray-800" : ""
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          editing ? (
            <div className="space-y-3 h-full flex flex-col">
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="flex-1 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm font-medium rounded px-2 py-1 border border-gray-300 dark:border-gray-600 focus:outline-none"
                  placeholder="Title"
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
                  className="text-xs px-3 py-1 text-gray-500 hover:text-gray-400 transition-colors"
                >
                  cancel
                </button>
              </div>
              <input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                className="bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-xs rounded px-2 py-1 border border-gray-300 dark:border-gray-600 focus:outline-none"
                placeholder="tags, comma-separated"
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm font-mono rounded px-3 py-2 border border-gray-300 dark:border-gray-600 focus:outline-none resize-none min-h-[300px]"
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                  {selected.title}
                </h2>
                <button
                  onClick={startEdit}
                  className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                >
                  edit
                </button>
              </div>
              <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed font-mono">
                {selected.content ?? "No content."}
              </pre>
            </>
          )
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-600">Select a playbook to view.</p>
        )}
      </div>
    </div>
  );
}
