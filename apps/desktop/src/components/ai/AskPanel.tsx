import { useState } from "react";
import type { AiMessage } from "../../hooks/useAi";

interface Props {
  messages: AiMessage[];
  streaming: boolean;
  onAsk: (query: string) => void;
  onSave: () => void;
  onClear: () => void;
}

export function AskPanel({ messages, streaming, onAsk, onSave, onClear }: Props) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || streaming) return;
    onAsk(q);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ask DevLog</span>
        <div className="flex gap-2">
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
        </div>
      </div>

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
