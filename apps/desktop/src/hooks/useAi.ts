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
  const [lastResponse, setLastResponse] = useState<string>("");
  const unlistenChunk = useRef<(() => void) | null>(null);
  const unlistenDone = useRef<(() => void) | null>(null);

  useEffect(() => {
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
      unlistenChunk.current = fn;
    });

    listen<string>("ai-done", (event) => {
      setStreaming(false);
      setLastResponse(event.payload);
    }).then((fn) => {
      unlistenDone.current = fn;
    });

    return () => {
      unlistenChunk.current?.();
      unlistenDone.current?.();
    };
  }, []);

  const ask = useCallback(async (query: string, org?: string) => {
    const history = messages; // capture prior turns before state update
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setStreaming(true);
    try {
      await invoke("ai_ask", { query, history, org: org ?? null });
    } catch (e) {
      setStreaming(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${String(e)}` },
      ]);
    }
  }, [messages]);

  const save = useCallback(
    async (org?: string) => {
      if (!messages.length) return;
      const query = messages.find((m) => m.role === "user")?.content ?? "";
      await invoke("save_ai_conversation_cmd", {
        query,
        response: lastResponse,
        org: org ?? null,
      });
    },
    [messages, lastResponse]
  );

  const clear = useCallback(() => {
    setMessages([]);
    setLastResponse("");
  }, []);

  return { messages, streaming, ask, save, clear };
}
