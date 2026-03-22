import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export function useAi() {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const unlistenChunk = useRef<(() => void) | null>(null);
  const unlistenDone = useRef<(() => void) | null>(null);
  // Refs so the stable event listeners can always read current values
  const messagesRef = useRef<AiMessage[]>([]);
  const currentOrgRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    // `cancelled` guards against React 18 strict-mode double-invoke:
    // if cleanup runs before the listen() promise resolves, we immediately
    // call the unlisten fn so we never end up with two active listeners.
    let cancelled = false;

    listen<string>("ai-chunk", (event) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            { role: "assistant", content: last.content + event.payload },
          ];
        }
        return [...prev, { role: "assistant", content: event.payload }];
      });
    }).then((fn) => {
      if (cancelled) fn();
      else unlistenChunk.current = fn;
    });

    listen<string>("ai-done", (event) => {
      setStreaming(false);
      // Auto-save: build the definitive message list using the complete response
      // from event.payload rather than messagesRef, which may lag by one render
      // (the last ai-chunk setState hasn't flushed yet when ai-done fires).
      const prev = messagesRef.current;
      const lastIsAssistant = prev[prev.length - 1]?.role === "assistant";
      const allMessages: AiMessage[] = lastIsAssistant
        ? [...prev.slice(0, -1), { role: "assistant" as const, content: event.payload }]
        : [...prev, { role: "assistant" as const, content: event.payload }];
      if (allMessages.length > 0) {
        invoke("save_ai_conversation_cmd", {
          messages: allMessages,
          org: currentOrgRef.current ?? null,
        }).catch(() => {});
      }
    }).then((fn) => {
      if (cancelled) fn();
      else unlistenDone.current = fn;
    });

    return () => {
      cancelled = true;
      unlistenChunk.current?.();
      unlistenDone.current?.();
    };
  }, []);

  const ask = useCallback(async (query: string, org?: string, model?: string) => {
    const history = messages; // capture prior turns before state update
    currentOrgRef.current = org;
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setStreaming(true);
    try {
      await invoke("ai_ask", { query, history, org: org ?? null, model: model ?? null });
    } catch (e) {
      setStreaming(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${String(e)}` },
      ]);
    }
  }, [messages]);

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  const loadConversation = useCallback((loaded: AiMessage[]) => {
    setMessages(loaded);
  }, []);

  return { messages, streaming, ask, clear, loadConversation };
}
