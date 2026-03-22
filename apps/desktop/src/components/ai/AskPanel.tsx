import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { AiMessage } from "../../hooks/useAi";

interface Props {
  messages: AiMessage[];
  streaming: boolean;
  onAsk: (query: string, model: string) => void;
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
}

export function AskPanel({ messages, streaming, onAsk, onSave, onClear, onClose }: Props) {
  const [input, setInput] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");

  useEffect(() => {
    invoke<string[]>("get_models")
      .then((list) => {
        setModels(list);
        if (list.length > 0 && !selectedModel) setSelectedModel(list[0]);
      })
      .catch(() => {}); // silently ignore if base_url not configured yet
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || streaming) return;
    onAsk(q, selectedModel);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ask Nichinichi</span>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <>
              <button
                onClick={onSave}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                save
              </button>
              <button
                onClick={onClear}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                clear
              </button>
            </>
          )}
          <button
            onClick={onClose}
            title="Close AI panel"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Model selector */}
      {models.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={streaming}
            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded px-2 py-1.5
                       border border-gray-300 dark:border-gray-700 focus:outline-none disabled:opacity-50"
          >
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-8">
            Ask a question about your journal.
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block text-sm px-3 py-2 rounded-lg max-w-[90%] text-left whitespace-pre-wrap leading-relaxed ${
                msg.role === "user"
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
            >
              {msg.content}
              {streaming && i === messages.length - 1 && msg.role === "assistant" && (
                <span className="inline-block w-1 h-3.5 bg-gray-400 ml-0.5 animate-pulse" />
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator — shown while waiting for the first chunk */}
        {streaming && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-1 px-1 py-1">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-gray-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your work history..."
            disabled={streaming}
            className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-3 py-2
                       placeholder-gray-400 dark:placeholder-gray-600 border border-gray-300 dark:border-gray-700 focus:outline-none
                       focus:border-gray-400 dark:focus:border-gray-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40
                       text-gray-800 dark:text-gray-200 text-sm rounded transition-colors"
          >
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}
