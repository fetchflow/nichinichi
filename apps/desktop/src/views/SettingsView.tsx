import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Theme } from "../hooks/useTheme";
import { useTimezone, systemTimezone } from "../hooks/useTimezone";

interface Props {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  syncNow: () => Promise<void>;
  syncing: boolean;
  workspaces: string[];
  onWorkspacesChange: (ws: string[]) => void;
}

export function SettingsView({ theme, onThemeChange, syncNow, syncing, workspaces, onWorkspacesChange }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    invoke<{ base_url: string; model: string }>("get_ai_config")
      .then(({ base_url, model }) => {
        if (base_url) setBaseUrl(base_url);
        if (model) setModel(model);
      })
      .catch(() => {});
  }, []);

  const { timezone, setTimezone, resetToSystem } = useTimezone();
  const systemTz = systemTimezone();
  const isCustomTz = timezone !== systemTz;
  const allTimezones: string[] = (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];

  // Repo path
  const [repoPath, setRepoPath] = useState("");
  const [savingRepo, setSavingRepo] = useState(false);
  const [savedRepo, setSavedRepo] = useState(false);
  const [restartNeeded, setRestartNeeded] = useState(false);

  useEffect(() => {
    invoke<string>("get_config_repo").then(setRepoPath).catch(() => {});
  }, []);

  const handleBrowse = async () => {
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (typeof selected === "string") setRepoPath(selected);
    } catch (e) {
      console.error("browse failed:", e);
    }
  };

  const handleSaveRepo = async () => {
    if (!repoPath.trim()) return;
    setSavingRepo(true);
    try {
      await invoke("save_config_repo", { path: repoPath.trim() });
      setSavedRepo(true);
      setRestartNeeded(true);
      setTimeout(() => setSavedRepo(false), 2000);
    } finally {
      setSavingRepo(false);
    }
  };

  // Tags & workspaces
  type CustomTag = { name: string; color: string };
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);
  const [newTag, setNewTag] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [newWorkspace, setNewWorkspace] = useState("");
  const [editingTag, setEditingTag] = useState<number | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<number | null>(null);
  const [editTagVal, setEditTagVal] = useState("");
  const [editTagColor, setEditTagColor] = useState("");
  const [editWorkspaceVal, setEditWorkspaceVal] = useState("");

  useEffect(() => {
    invoke<Record<string, string>>("get_settings").then((s) => {
      try { setCustomTags(JSON.parse(s["custom_tags"] ?? "[]")); } catch { /* noop */ }
    }).catch(() => {});
  }, []);

  const saveTags = (tags: CustomTag[]) => {
    setCustomTags(tags);
    invoke("set_setting", { key: "custom_tags", value: JSON.stringify(tags) });
  };

  const addTag = (e: FormEvent) => {
    e.preventDefault();
    const name = newTag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name || customTags.some((t) => t.name === name)) return;
    saveTags([...customTags, { name, color: newTagColor }]);
    setNewTag("");
    setNewTagColor("#6366f1");
  };
  const addWorkspace = (e: FormEvent) => {
    e.preventDefault();
    const w = newWorkspace.trim().toLowerCase().replace(/\s+/g, "-");
    if (!w || workspaces.includes(w)) return;
    onWorkspacesChange([...workspaces, w]);
    setNewWorkspace("");
  };

  const commitTagEdit = (i: number) => {
    const name = editTagVal.trim().toLowerCase().replace(/\s+/g, "-");
    if (name) {
      const next = [...customTags];
      next[i] = { name, color: editTagColor };
      saveTags(next);
    }
    setEditingTag(null);
  };
  const commitWorkspaceEdit = (i: number) => {
    const w = editWorkspaceVal.trim().toLowerCase().replace(/\s+/g, "-");
    if (w && w !== workspaces[i]) {
      const next = [...workspaces];
      next[i] = w;
      onWorkspacesChange(next);
    }
    setEditingWorkspace(null);
  };

  // Admin gate — click "Data" heading 5× rapidly to reveal danger zone
  const [adminVisible, setAdminVisible] = useState(false);
  const clicksRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDataHeadingClick = () => {
    clicksRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      clicksRef.current = 0;
    }, 1500);
    if (clicksRef.current >= 5) {
      setAdminVisible((v) => !v);
      clicksRef.current = 0;
    }
  };

  // Rebuild — full wipe + re-walk from markdown
  const [rebuilding, setRebuilding] = useState(false);
  const [confirmRebuild, setConfirmRebuild] = useState(false);

  const handleRebuild = async () => {
    if (!confirmRebuild) {
      setConfirmRebuild(true);
      setTimeout(() => setConfirmRebuild(false), 4000);
      return;
    }
    setRebuilding(true);
    setConfirmRebuild(false);
    try {
      await invoke("rebuild_db");
    } finally {
      setRebuilding(false);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      await invoke("save_ai_config", {
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || "http://localhost:11434",
        model: model.trim() || "llama3.2",
      });
      setSaved(true);
      setApiKey(""); // clear key field only — base_url and model remain visible
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-lg space-y-8">
      {/* AI Settings */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">AI Settings</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-3 py-2
                         border border-gray-300 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
            />
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
              Ollama or any OpenAI-compatible API — requests go to {"{base_url}"}/v1/chat/completions
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="llama3.2"
              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-3 py-2
                         border border-gray-300 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-3 py-2
                           border border-gray-300 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
              />
              <button
                onClick={handleSaveKey}
                disabled={!apiKey.trim() || saving}
                className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40
                           text-gray-800 dark:text-gray-200 text-sm rounded transition-colors"
              >
                {saved ? "Saved!" : saving ? "Saving…" : "Save"}
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
              Saved to ~/.nichinichi.yml · never sent anywhere else
            </p>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Appearance</h2>
        <div className="flex gap-2">
          {(["dark", "light"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => onThemeChange(t)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                theme === t
                  ? "bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* Timezone */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Timezone</h2>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Display timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-3 py-2
                         border border-gray-300 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
            >
              {allTimezones.length > 0
                ? allTimezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))
                : <option value={timezone}>{timezone}</option>}
            </select>
          </div>
          {isCustomTz && (
            <button
              onClick={resetToSystem}
              className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
            >
              Reset to system timezone ({systemTz})
            </button>
          )}
          {!isCustomTz && (
            <p className="text-xs text-gray-400 dark:text-gray-600">
              Using system timezone: {systemTz}
            </p>
          )}
        </div>
      </section>

      {/* Data */}
      <section>
        {/* Clicking the heading 5× reveals the admin/danger zone */}
        <h2
          className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 cursor-default select-none"
          onClick={handleDataHeadingClick}
        >
          Data
        </h2>
        <div className="space-y-3">
          {/* Repo path */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Devlog folder</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                placeholder="~/nichinichi"
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-3 py-2
                           border border-gray-300 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 font-mono"
              />
              <button
                onClick={handleBrowse}
                className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600
                           text-gray-800 dark:text-gray-200 text-sm rounded transition-colors"
              >
                Browse
              </button>
              <button
                onClick={handleSaveRepo}
                disabled={!repoPath.trim() || savingRepo}
                className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40
                           text-gray-800 dark:text-gray-200 text-sm rounded transition-colors"
              >
                {savedRepo ? "Saved!" : savingRepo ? "Saving…" : "Save"}
              </button>
            </div>
            {restartNeeded && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Restart Nichinichi to load the new folder.
              </p>
            )}
          </div>

          <button
            onClick={syncNow}
            disabled={syncing}
            className="block w-full text-left px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
                       disabled:opacity-50 text-sm text-gray-700 dark:text-gray-300 rounded transition-colors"
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
          The database is always reconstructable from your markdown files.
        </p>

        {/* Danger zone — admin only */}
        {adminVisible && (
          <div className="mt-6 border border-red-900/50 rounded-lg p-4 space-y-3">
            <p className="text-xs text-red-500 font-mono uppercase tracking-wider">
              danger zone
            </p>
            <p className="text-xs text-gray-500">
              Drops all indexed data and rebuilds from markdown. Use if the
              database is corrupted or out of sync.
            </p>
            <button
              onClick={handleRebuild}
              disabled={rebuilding}
              className={`block w-full text-left px-3 py-2 rounded text-sm
                          transition-colors disabled:opacity-50 font-mono ${
                confirmRebuild
                  ? "bg-red-900/60 text-red-300 border border-red-700"
                  : "bg-gray-100 dark:bg-gray-800 hover:bg-red-900/30 text-red-400 border border-gray-300 dark:border-gray-700 hover:border-red-800"
              }`}
            >
              {rebuilding
                ? "rebuilding…"
                : confirmRebuild
                ? "click again to confirm"
                : "rebuild database from markdown"}
            </button>
          </div>
        )}
      </section>
      {/* Tags & Project Spaces */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Tags &amp; Workspaces</h2>

        {/* Tags */}
        <div className="mb-5">
          <p className="text-xs text-gray-500 mb-2">Tags</p>
          <div className="space-y-1 mb-2">
            {customTags.map((tag, i) => (
              <div key={i} className="flex items-center gap-2">
                {editingTag === i ? (
                  <>
                    <input
                      type="color"
                      value={editTagColor}
                      onChange={(e) => setEditTagColor(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
                      title="Pick a color"
                    />
                    <input
                      autoFocus
                      value={editTagVal}
                      onChange={(e) => setEditTagVal(e.target.value)}
                      onBlur={() => commitTagEdit(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); commitTagEdit(i); }
                        if (e.key === "Escape") setEditingTag(null);
                      }}
                      className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-2 py-1
                                 border border-gray-300 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 font-mono"
                    />
                  </>
                ) : (
                  <>
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span
                      className="flex-1 text-sm font-mono cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ color: tag.color }}
                      onClick={() => { setEditingTag(i); setEditTagVal(tag.name); setEditTagColor(tag.color); }}
                    >
                      #{tag.name}
                    </span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => saveTags(customTags.filter((_, j) => j !== i))}
                  className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                >
                  remove
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={addTag} className="flex gap-2">
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-gray-300 dark:border-gray-700 bg-transparent p-0.5"
              title="Pick a color"
            />
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="new-tag"
              className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-2 py-1
                         border border-gray-300 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 font-mono"
            />
            <button
              type="submit"
              disabled={!newTag.trim()}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40
                         text-gray-800 dark:text-gray-200 text-sm rounded transition-colors"
            >
              Add
            </button>
          </form>
        </div>

        {/* Workspaces */}
        <div>
          <p className="text-xs text-gray-500 mb-2">Workspaces</p>
          <div className="space-y-1 mb-2">
            {workspaces.map((ws, i) => (
              <div key={i} className="flex items-center gap-2">
                {editingWorkspace === i ? (
                  <input
                    autoFocus
                    value={editWorkspaceVal}
                    onChange={(e) => setEditWorkspaceVal(e.target.value)}
                    onBlur={() => commitWorkspaceEdit(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); commitWorkspaceEdit(i); }
                      if (e.key === "Escape") setEditingWorkspace(null);
                    }}
                    className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-2 py-1
                               border border-gray-300 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 font-mono"
                  />
                ) : (
                  <span
                    className="flex-1 text-sm font-mono text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-gray-100"
                    onClick={() => { setEditingWorkspace(i); setEditWorkspaceVal(ws); }}
                  >
                    @{ws}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onWorkspacesChange(workspaces.filter((_, j) => j !== i))}
                  className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                >
                  remove
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={addWorkspace} className="flex gap-2">
            <input
              value={newWorkspace}
              onChange={(e) => setNewWorkspace(e.target.value)}
              placeholder="workspace-name"
              className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-2 py-1
                         border border-gray-300 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 font-mono"
            />
            <button
              type="submit"
              disabled={!newWorkspace.trim()}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40
                         text-gray-800 dark:text-gray-200 text-sm rounded transition-colors"
            >
              Add
            </button>
          </form>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
            Workspace names appear as @org chips in the log composer.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
            Built-in tags (score, solution, decision, ai, reflection, log) are always available.
          </p>
        </div>
      </section>
    </div>
  );
}
