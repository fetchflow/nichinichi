import { useEffect, useRef, useState } from "react";
import { AskPanel } from "./components/ai/AskPanel";
import { useActiveModel } from "./hooks/useActiveModel";
import { useAiTabs } from "./hooks/useAiTabs";
import { useFontSize } from "./hooks/useFontSize";
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

const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "log",       label: "Log",       icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  { id: "goals",     label: "Goals",     icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" },
  { id: "playbooks", label: "Playbooks", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { id: "reports",   label: "Reports",   icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { id: "settings",  label: "Settings",  icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
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
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiWidth, setAiWidth] = useState(AI_PANEL_DEFAULT);
  const [aiLayout, setAiLayout] = useState<"panel" | "half" | "full">("panel");
  const isResizing = useRef(false);
  const { theme, setTheme } = useTheme();
  const { increase: fontIncrease, decrease: fontDecrease, reset: fontReset } = useFontSize();
  const { activeOrg, setActiveOrg, orgs, workspaces, setWorkspaces } = useOrg();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "=" || e.key === "+") { e.preventDefault(); fontIncrease(); }
      else if (e.key === "-") { e.preventDefault(); fontDecrease(); }
      else if (e.key === "0") { e.preventDefault(); fontReset(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fontIncrease, fontDecrease, fontReset]);
  const { activeModel, setActiveModel } = useActiveModel();
  const ai = useAiTabs();
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
      <aside
        className="flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-200"
        style={{ width: navCollapsed ? 52 : 192 }}
      >
        {/* Logo + collapse toggle */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-gray-200 dark:border-gray-800 min-h-[53px]">
          {!navCollapsed && (
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">Nichinichi</span>
          )}
          <button
            onClick={() => setNavCollapsed((c) => !c)}
            title={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {navCollapsed
                ? <><polyline points="9 18 15 12 9 6" /></>
                : <><polyline points="15 18 9 12 15 6" /></>}
            </svg>
          </button>
        </div>

        {/* Org switcher */}
        {!navCollapsed && (
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
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              title={navCollapsed ? label : undefined}
              className={`w-full flex items-center gap-3 py-2 text-sm transition-colors
                ${navCollapsed ? "justify-center px-0" : "px-4"}
                ${section === id
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                {icon.split(" M").map((d, i) => (
                  <path key={i} d={i === 0 ? d : "M" + d} />
                ))}
              </svg>
              {!navCollapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 min-w-0 overflow-hidden relative">
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden" style={{ display: aiOpen && aiLayout === "full" ? "none" : undefined }}>
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
              <DashboardView activeOrg={activeOrg} onNavigateToSettings={() => setSection("settings")} />
            )}
            {section === "log" && <LogView activeOrg={activeOrg} workspaces={orgs} />}
            {section === "goals" && <GoalsView activeOrg={activeOrg} />}
            {section === "playbooks" && (
              <PlaybooksView activeOrg={activeOrg} />
            )}
            {section === "reports" && <ReportsView activeOrg={activeOrg} />}
          </div>
        </div>

        {/* AI panel — toggleable, resizable; kept mounted to preserve state */}
        <div
          className="flex-shrink-0 flex overflow-hidden relative bg-white dark:bg-gray-900"
          style={{
            display: aiOpen ? undefined : "none",
            width: !aiOpen ? aiWidth
              : aiLayout === "full" ? "100%"
              : aiLayout === "half" ? "50%"
              : aiWidth,
          }}
        >
            {/* Drag handle — hidden in snap modes */}
            {aiLayout === "panel" && (
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
            )}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <AskPanel
              messages={ai.activeTab.messages}
              streaming={ai.activeTab.streaming}
              activeOrg={activeOrg}
              availableOrgs={orgs}
              layout={aiLayout}
              onAsk={(q) => ai.ask(q, activeOrg === "all" ? undefined : activeOrg, activeModel || undefined)}
              onClose={() => { setAiOpen(false); setAiLayout("panel"); }}
              onLoad={ai.loadConversation}
              onLayoutChange={setAiLayout}
              activeModel={activeModel}
              onModelChange={setActiveModel}
              tabs={ai.tabs}
              activeTabId={ai.activeTabId}
              onTabChange={ai.setActiveTabId}
              onNewTab={ai.newTab}
              onCloseTab={ai.closeTab}
              onReorderTabs={ai.reorderTabs}
              loadedConv={ai.activeTab.loadedConv}
              onSetLoadedConv={ai.setLoadedConv}
            />
            </div>
          </div>

        {/* Settings overlay — floats over the full main area including AI panel */}
        {section === "settings" && (
          <div className="absolute inset-0 z-20 bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
            <SettingsView
              theme={theme}
              onThemeChange={setTheme}
              syncNow={sync.syncNow}
              syncing={sync.syncing}
              workspaces={workspaces}
              onWorkspacesChange={setWorkspaces}
              activeModel={activeModel}
              onModelChange={setActiveModel}
            />
          </div>
        )}
      </main>
    </div>
  );
}
