import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

export function useOrg() {
  const [activeOrg, setActiveOrgState] = useState<string>("all");
  const [orgs, setOrgs] = useState<string[]>([]);

  useEffect(() => {
    invoke<Record<string, string>>("get_settings").then((settings) => {
      setActiveOrgState(settings["active_org"] ?? "all");
    });
    invoke<string[]>("get_orgs").then(setOrgs);
  }, []);

  const setActiveOrg = useCallback((org: string) => {
    setActiveOrgState(org);
    invoke("set_setting", { key: "active_org", value: org });
  }, []);

  return { activeOrg, setActiveOrg, orgs };
}
