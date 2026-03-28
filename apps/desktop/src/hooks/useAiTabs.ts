import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiConversationSummary {
  id: string;
  date: string;
  query: string;
  org: string | null;
  file_path: string;
}

export interface AiTab {
  id: string;
  messages: AiMessage[];
  streaming: boolean;
  loadedConv: AiConversationSummary | null;
  org: string | null;
  unread: boolean;
}

function makeTab(): AiTab {
  return {
    id: crypto.randomUUID(),
    messages: [],
    streaming: false,
    loadedConv: null,
    org: null,
    unread: false,
  };
}

function tabTitle(tab: AiTab): string {
  if (tab.loadedConv?.query) return tab.loadedConv.query;
  const first = tab.messages.find((m) => m.role === "user")?.content;
  return first ?? "New chat";
}

export { tabTitle };

export function useAiTabs() {
  const initialTab = makeTab();
  const [tabs, setTabs] = useState<AiTab[]>([initialTab]);
  const [activeTabId, setActiveTabIdState] = useState<string>(initialTab.id);

  // Refs so SSE listeners and ask() always read the latest values without stale closures
  const activeTabIdRef = useRef(activeTabId);
  const tabsRef = useRef(tabs);
  // Tracks which tab initiated the current stream — NOT updated on tab switch,
  // so chunks always land in the originating tab regardless of which tab is active.
  const streamingTabIdRef = useRef<string | null>(null);
  useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);

  // SSE listeners — registered once, route to the tab that started the stream
  useEffect(() => {
    let cancelled = false;
    let unlistenChunk: (() => void) | null = null;
    let unlistenDone: (() => void) | null = null;

    listen<string>("ai-chunk", (event) => {
      const id = streamingTabIdRef.current;
      if (!id) return;
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const last = t.messages[t.messages.length - 1];
          const messages =
            last?.role === "assistant"
              ? [
                  ...t.messages.slice(0, -1),
                  { role: "assistant" as const, content: last.content + event.payload },
                ]
              : [...t.messages, { role: "assistant" as const, content: event.payload }];
          return { ...t, messages };
        })
      );
    }).then((fn) => {
      if (cancelled) fn();
      else unlistenChunk = fn;
    });

    listen<string>("ai-done", (event) => {
      const id = streamingTabIdRef.current;
      streamingTabIdRef.current = null;
      if (!id) return;
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const lastIsAssistant = t.messages[t.messages.length - 1]?.role === "assistant";
          const allMessages: AiMessage[] = lastIsAssistant
            ? [...t.messages.slice(0, -1), { role: "assistant" as const, content: event.payload }]
            : [...t.messages, { role: "assistant" as const, content: event.payload }];
          if (allMessages.length > 0) {
            invoke("save_ai_conversation_cmd", {
              messages: allMessages,
              org: t.org ?? null,
            }).catch(() => {});
          }
          const isBackground = id !== activeTabIdRef.current;
          return { ...t, messages: allMessages, streaming: false, unread: isBackground };
        })
      );
    }).then((fn) => {
      if (cancelled) fn();
      else unlistenDone = fn;
    });

    return () => {
      cancelled = true;
      unlistenChunk?.();
      unlistenDone?.();
    };
  }, []);

  const setActiveTabId = useCallback((id: string) => {
    setActiveTabIdState(id);
    activeTabIdRef.current = id;
    setTabs((prev) => prev.map((t) => t.id === id ? { ...t, unread: false } : t));
  }, []);

  const newTab = useCallback(() => {
    const tab = makeTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, [setActiveTabId]);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length === 1) return prev; // always keep at least one tab
        const next = prev.filter((t) => t.id !== id);
        // If closing the active tab, activate the nearest neighbour
        if (activeTabIdRef.current === id) {
          const idx = prev.findIndex((t) => t.id === id);
          const newActive = next[Math.min(idx, next.length - 1)];
          setActiveTabId(newActive.id);
        }
        return next;
      });
    },
    [setActiveTabId]
  );

  const ask = useCallback(
    async (query: string, org?: string, model?: string) => {
      const id = activeTabIdRef.current;
      const tab = tabsRef.current.find((t) => t.id === id);
      const history = tab?.messages ?? [];

      // Pin the streaming target — SSE events will route here even if the user
      // switches to a different tab before the response completes.
      streamingTabIdRef.current = id;

      setTabs((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, messages: [...t.messages, { role: "user" as const, content: query }], streaming: true, org: org ?? null }
            : t
        )
      );

      try {
        await invoke("ai_ask", {
          query,
          history,
          org: org ?? null,
          model: model ?? null,
        });
      } catch (e) {
        streamingTabIdRef.current = null;
        setTabs((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  streaming: false,
                  messages: [
                    ...t.messages,
                    { role: "assistant" as const, content: `Error: ${String(e)}` },
                  ],
                }
              : t
          )
        );
      }
    },
    [] // intentionally empty — uses refs to avoid stale captures
  );

  const clear = useCallback(() => {
    const id = activeTabIdRef.current;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, messages: [], streaming: false, loadedConv: null } : t
      )
    );
  }, []);

  const loadConversation = useCallback(
    (messages: AiMessage[], conv: AiConversationSummary) => {
      const id = activeTabIdRef.current;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, messages, loadedConv: conv } : t
        )
      );
    },
    []
  );

  const reorderTabs = useCallback((fromId: string, toId: string) => {
    setTabs((prev) => {
      const fromIdx = prev.findIndex((t) => t.id === fromId);
      const toIdx = prev.findIndex((t) => t.id === toId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const setLoadedConv = useCallback((conv: AiConversationSummary | null) => {
    const id = activeTabIdRef.current;
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, loadedConv: conv } : t))
    );
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  return {
    tabs,
    activeTabId,
    activeTab,
    setActiveTabId,
    newTab,
    closeTab,
    reorderTabs,
    ask,
    clear,
    loadConversation,
    setLoadedConv,
  };
}
