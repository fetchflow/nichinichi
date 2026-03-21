import { useState } from "react";
import { AskPanel } from "./components/ai/AskPanel";
import { useAi } from "./hooks/useAi";
import { useOrg } from "./hooks/useOrg";
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

export default function App() {
  const [section, setSection] = useState<Section>("dashboard");
  const { theme, setTheme } = useTheme();
  const { activeOrg, setActiveOrg, orgs } = useOrg();
  const ai = useAi();

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 select-none overflow-hidden">
      {/* Sidebar nav */}
      <aside className="w-48 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-800">
          <span className="text-sm font-semibold text-gray-200">DevLog</span>
        </div>

        {/* Org switcher */}
        <div className="px-3 py-3 border-b border-gray-800">
          <select
            value={activeOrg}
            onChange={(e) => setActiveOrg(e.target.value)}
            className="w-full bg-gray-800 text-gray-300 text-xs rounded px-2 py-1.5
                       border border-gray-700 focus:outline-none"
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
                  ? "bg-gray-800 text-gray-200"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
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
          <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
            <span className="text-sm font-medium text-gray-300 capitalize">
              {section}
            </span>
          </header>

          {/* View */}
          <div className="flex flex-1 overflow-hidden">
            {section === "dashboard" && (
              <DashboardView activeOrg={activeOrg} />
            )}
            {section === "log" && <LogView activeOrg={activeOrg} />}
            {section === "goals" && <GoalsView activeOrg={activeOrg} />}
            {section === "playbooks" && (
              <PlaybooksView activeOrg={activeOrg} />
            )}
            {section === "reports" && <ReportsView activeOrg={activeOrg} />}
            {section === "settings" && (
              <SettingsView theme={theme} onThemeChange={setTheme} />
            )}
          </div>
        </div>

        {/* AI panel — always visible, 280px */}
        <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden">
          <AskPanel
            messages={ai.messages}
            streaming={ai.streaming}
            onAsk={(q) => ai.ask(q, activeOrg === "all" ? undefined : activeOrg)}
            onSave={() => ai.save(activeOrg === "all" ? undefined : activeOrg)}
            onClear={ai.clear}
          />
        </div>
      </main>
    </div>
  );
}
