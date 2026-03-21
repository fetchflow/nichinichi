import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import type { StatsPayload } from "../types";

export function useStats(org?: string, days = 90) {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    invoke<StatsPayload>("get_stats", {
      org: org === "all" ? null : org ?? null,
      days,
    })
      .then(setStats)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const unlisten = listen("sync-update", load);
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [org, days]);

  return { stats, loading };
}
