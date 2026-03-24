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

  const addEntry = useCallback(async (text: string) => {
    const entry = await invoke<Entry>("add_entry", { text });
    setEntries((prev) => [entry, ...prev]);
    return entry;
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    await invoke("delete_entry", { id });
    setEntries((prev: Entry[]) => prev.filter((e: Entry) => e.id !== id));
  }, []);

  const editEntry = useCallback(
    async (id: string, newBody: string, newDetail?: string) => {
      const updated = await invoke<Entry>("edit_entry", {
        id,
        newBody,
        newDetail: newDetail ?? null,
      });
      setEntries((prev: Entry[]) => prev.map((e: Entry) => (e.id === id ? updated : e)));
      return updated;
    },
    []
  );

  return { entries, loading, reload: load, addEntry, deleteEntry, editEntry };
}
