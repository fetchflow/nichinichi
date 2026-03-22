import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

export function useOrg() {
  const [activeOrg, setActiveOrgState] = useState<string>("all");
  const [orgs, setOrgs] = useState<string[]>([]);
  const [workspaces, setWorkspacesState] = useState<string[]>([]);

  useEffect(() => {
    invoke<Record<string, string>>("get_settings").then((settings) => {
      setActiveOrgState(settings["active_org"] ?? "all");
      try { setWorkspacesState(JSON.parse(settings["workspaces"] ?? "[]")); } catch { /* noop */ }
    });
    invoke<string[]>("get_orgs").then(setOrgs);
  }, []);

  const setActiveOrg = useCallback((org: string) => {
    setActiveOrgState(org);
    invoke("set_setting", { key: "active_org", value: org });
  }, []);

  const setWorkspaces = useCallback((ws: string[]) => {
    setWorkspacesState(ws);
    invoke("set_setting", { key: "workspaces", value: JSON.stringify(ws) });
  }, []);

  // Merge discovered orgs with explicitly created workspaces for the switcher
  const allOrgs = [...new Set([...workspaces, ...orgs])].sort();

  return { activeOrg, setActiveOrg, orgs: allOrgs, workspaces, setWorkspaces };
}
