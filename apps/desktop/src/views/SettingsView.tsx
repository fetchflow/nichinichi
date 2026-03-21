import { invoke } from "@tauri-apps/api/core";
import { useRef, useState } from "react";
import type { Theme } from "../hooks/useTheme";

interface Props {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  syncNow: () => Promise<void>;
  syncing: boolean;
}

export function SettingsView({ theme, onThemeChange, syncNow, syncing }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      await invoke("save_ai_key", { apiKey: apiKey.trim() });
      setSaved(true);
      setApiKey("");
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-lg space-y-8">
      {/* AI Settings */}
      <section>
        <h2 className="text-sm font-medium text-gray-300 mb-4">AI Settings</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Anthropic API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="flex-1 bg-gray-800 text-gray-200 text-sm rounded px-3 py-2
                           border border-gray-700 focus:outline-none focus:border-gray-500"
              />
              <button
                onClick={handleSaveKey}
                disabled={!apiKey.trim() || saving}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40
                           text-gray-200 text-sm rounded transition-colors"
              >
                {saved ? "Saved!" : saving ? "Saving…" : "Save"}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Saved to ~/.devlog.yml · never sent anywhere else
            </p>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section>
        <h2 className="text-sm font-medium text-gray-300 mb-4">Appearance</h2>
        <div className="flex gap-2">
          {(["dark", "light"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => onThemeChange(t)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                theme === t
                  ? "bg-gray-600 text-gray-200"
                  : "bg-gray-800 text-gray-500 hover:bg-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* Data */}
      <section>
        {/* Clicking the heading 5× reveals the admin/danger zone */}
        <h2
          className="text-sm font-medium text-gray-300 mb-4 cursor-default select-none"
          onClick={handleDataHeadingClick}
        >
          Data
        </h2>
        <div className="space-y-2">
          <button
            onClick={syncNow}
            disabled={syncing}
            className="block w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700
                       disabled:opacity-50 text-sm text-gray-300 rounded transition-colors"
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-2">
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
                  : "bg-gray-800 hover:bg-red-900/30 text-red-400 border border-gray-700 hover:border-red-800"
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
    </div>
  );
}
