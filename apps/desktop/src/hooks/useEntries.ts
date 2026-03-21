import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import type { Entry } from "../types";

export function useEntries(date?: string, org?: string) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    invoke<Entry[]>("get_entries", {
      date: date ?? null,
      org: org === "all" ? null : org ?? null,
    })
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [date, org]);

  useEffect(() => {
    load();
    // Reload when file watcher fires
    const unlisten = listen("sync-update", load);
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [load]);

  const addEntry = useCallback(
    async (text: string) => {
      const entry = await invoke<Entry>("add_entry", { text });
      setEntries((prev) => [entry, ...prev]);
      return entry;
    },
    []
  );

  return { entries, loading, reload: load, addEntry };
}
