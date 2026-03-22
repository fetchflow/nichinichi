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

  useEffect(() => {
    setLoading(true);
    invoke<Playbook[]>("get_playbooks", {
      org: activeOrg === "all" ? null : activeOrg,
    })
      .then(setPlaybooks)
      .finally(() => setLoading(false));
  }, [activeOrg]);

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
          <>
            <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
              {selected.title}
            </h2>
            <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed font-mono">
              {selected.content ?? "No content."}
            </pre>
          </>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-600">Select a playbook to view.</p>
        )}
      </div>
    </div>
  );
}
