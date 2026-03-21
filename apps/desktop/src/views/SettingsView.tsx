import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import type { Theme } from "../hooks/useTheme";

interface Props {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
}

export function SettingsView({ theme, onThemeChange }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  const handleSync = async () => {
    await invoke("sync_now");
  };

  const handleRebuild = async () => {
    await invoke("rebuild_db");
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
                {saved ? "Saved!" : saving ? "Saving..." : "Save"}
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
        <h2 className="text-sm font-medium text-gray-300 mb-4">Data</h2>
        <div className="space-y-2">
          <button
            onClick={handleSync}
            className="block w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700
                       text-sm text-gray-300 rounded transition-colors"
          >
            Sync now
          </button>
          <button
            onClick={handleRebuild}
            className="block w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700
                       text-sm text-gray-300 rounded transition-colors"
          >
            Rebuild database from markdown
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          The database is always reconstructable from your markdown files.
        </p>
      </section>
    </div>
  );
}
