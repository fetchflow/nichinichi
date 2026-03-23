import { useEffect, useRef, useState } from "react";
import { AskPanel } from "./components/ai/AskPanel";
import { useAi } from "./hooks/useAi";
import { useOrg } from "./hooks/useOrg";
import { useSyncStatus } from "./hooks/useSyncStatus";
import { useTheme } from "./hooks/useTheme";
import type { Section } from "./types";
import { DashboardView } from "./views/DashboardView";
import { GoalsView } from "./views/GoalsView";
import { LogView } from "./views/LogView";
import { PlaybooksView } from "./views/PlaybooksView";
import { ReportsView } from "./views/ReportsView";
import { SettingsView } from "./views/SettingsView";

const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "log", label: "Log" },
  { id: "goals", label: "Goals" },
  { id: "playbooks", label: "Playbooks" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Settings" },
];

function relativeTime(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 15) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const AI_PANEL_MIN = 240;
const AI_PANEL_MAX = 640;
const AI_PANEL_DEFAULT = 288; // w-72 = 18rem = 288px

export default function App() {
  const [section, setSection] = useState<Section>("dashboard");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiWidth, setAiWidth] = useState(AI_PANEL_DEFAULT);
  const isResizing = useRef(false);
  const { theme, setTheme } = useTheme();
  const { activeOrg, setActiveOrg, orgs, workspaces, setWorkspaces } = useOrg();
  const ai = useAi();
  const sync = useSyncStatus();

  // Tick every 30s to keep relative time display fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 select-none overflow-hidden">
      {/* Sidebar nav */}
      <aside className="w-48 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Nichinichi</span>
        </div>

        {/* Org switcher */}
        <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-800">
          <select
            value={activeOrg}
            onChange={(e) => setActiveOrg(e.target.value)}
            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded px-2 py-1.5
                       border border-gray-300 dark:border-gray-700 focus:outline-none"
          >
            <option value="all">All</option>
            <option value="personal">Personal</option>
            {orgs.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                section === id
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 min-w-0 overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Top bar */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
              {section}
            </span>

            <div className="flex items-center gap-3">
              {/* Sync indicator */}
              <button
                onClick={sync.syncNow}
                disabled={sync.syncing}
                title={sync.syncing ? "Syncing…" : "Click to sync now"}
                className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400
                           disabled:cursor-default transition-colors font-mono"
              >
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    sync.syncing
                      ? "bg-violet-500 animate-pulse"
                      : "bg-gray-300 dark:bg-gray-700"
                  }`}
                />
                {sync.syncing
                  ? "syncing…"
                  : sync.lastSyncAt
                  ? `synced ${relativeTime(sync.lastSyncAt)}`
                  : "never synced"}
              </button>

              {/* AI panel toggle */}
              <button
                onClick={() => setAiOpen((o) => !o)}
                title={aiOpen ? "Close AI panel" : "Ask Nichinichi"}
                className={`p-1.5 rounded transition-colors ${
                  aiOpen
                    ? "text-amber-500 bg-amber-50 dark:bg-amber-900/20"
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
                  <path d="M5 19.5l.75 2.25L8 23l-2.25.75L5 26l-.75-2.25L2 23l2.25-.75z" />
                  <path d="M19 2l.75 2.25L22 5l-2.25.75L19 8l-.75-2.25L16 5l2.25-.75z" />
                </svg>
              </button>
            </div>
          </header>

          {/* View */}
          <div className="flex flex-1 overflow-hidden">
            {section === "dashboard" && (
              <DashboardView activeOrg={activeOrg} />
            )}
            {section === "log" && <LogView activeOrg={activeOrg} workspaces={orgs} />}
            {section === "goals" && <GoalsView activeOrg={activeOrg} />}
            {section === "playbooks" && (
              <PlaybooksView activeOrg={activeOrg} />
            )}
            {section === "reports" && <ReportsView activeOrg={activeOrg} />}
            {section === "settings" && (
              <SettingsView
                theme={theme}
                onThemeChange={setTheme}
                syncNow={sync.syncNow}
                syncing={sync.syncing}
                workspaces={workspaces}
                onWorkspacesChange={setWorkspaces}
              />
            )}
          </div>
        </div>

        {/* AI panel — toggleable, resizable; kept mounted to preserve state */}
        <div
          className="flex-shrink-0 flex overflow-hidden relative bg-white dark:bg-gray-900"
          style={{ width: aiWidth, display: aiOpen ? undefined : "none" }}
        >
            {/* Drag handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-amber-400/40 transition-colors"
              onPointerDown={(e) => {
                e.preventDefault();
                isResizing.current = true;
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!isResizing.current) return;
                const newWidth = window.innerWidth - e.clientX;
                setAiWidth(Math.min(AI_PANEL_MAX, Math.max(AI_PANEL_MIN, newWidth)));
              }}
              onPointerUp={() => { isResizing.current = false; }}
            />
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <AskPanel
              messages={ai.messages}
              streaming={ai.streaming}
              activeOrg={activeOrg}
              onAsk={(q, model) => ai.ask(q, activeOrg === "all" ? undefined : activeOrg, model)}
              onClear={ai.clear}
              onClose={() => setAiOpen(false)}
              onLoad={ai.loadConversation}
            />
            </div>
          </div>
      </main>
    </div>
  );
}
