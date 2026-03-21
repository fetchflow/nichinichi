import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ActivityPayload } from "../types";

export function useActivity(org?: string) {
  const [activity, setActivity] = useState<ActivityPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    invoke<ActivityPayload>("get_activity", { org: org || null })
      .then(setActivity)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const unlisten = listen("sync-update", load);
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [org]);

  return { activity, loading };
}
