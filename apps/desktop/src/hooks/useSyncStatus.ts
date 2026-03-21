import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";

export interface SyncStatus {
  lastSyncAt: Date | null;
  syncing: boolean;
  syncNow: () => Promise<void>;
}

export function useSyncStatus(): SyncStatus {
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refresh = useCallback(() => {
    invoke<string>("get_last_sync").then((ts) => {
      if (ts && ts !== "never") setLastSyncAt(new Date(ts));
    });
  }, []);

  useEffect(() => {
    refresh();
    let unlisten: (() => void) | undefined;
    listen("sync-update", () => {
      syncingRef.current = false;
      setSyncing(false);
      refresh();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [refresh]);

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await invoke("sync_now");
      refresh();
    } catch (e) {
      console.error("sync failed:", e);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refresh]);

  return { lastSyncAt, syncing, syncNow };
}
