import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import type { AiMessage } from "../../hooks/useAi";

interface AiConversationSummary {
  id: string;
  date: string;
  query: string;
  org: string | null;
  file_path: string;
}

interface Props {
  messages: AiMessage[];
  streaming: boolean;
  activeOrg: string;
  onAsk: (query: string, model: string) => void;
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
  onLoad: (messages: AiMessage[]) => void;
}

export function AskPanel({ messages, streaming, activeOrg, onAsk, onSave, onClear, onClose, onLoad }: Props) {
  const [input, setInput] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [history, setHistory] = useState<AiConversationSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages]);

  useEffect(() => {
    invoke<string[]>("get_models")
      .then((list) => {
        setModels(list);
        if (list.length > 0 && !selectedModel) setSelectedModel(list[0]);
      })
      .catch(() => {}); // silently ignore if base_url not configured yet
  }, []);

  useEffect(() => {
    const org = activeOrg === "all" ? null : activeOrg;
    invoke<AiConversationSummary[]>("get_ai_conversations", { org })
      .then(setHistory)
      .catch(() => {});
  }, [activeOrg]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || streaming) return;
    setShowHistory(false);
    onAsk(q, selectedModel);
    setInput("");
  };

  const refreshHistory = () => {
    const org = activeOrg === "all" ? null : activeOrg;
    invoke<AiConversationSummary[]>("get_ai_conversations", { org })
      .then(setHistory)
      .catch(() => {});
  };

  const handleLoadConversation = async (conv: AiConversationSummary) => {
    try {
      const loaded = await invoke<AiMessage[]>("load_ai_conversation_cmd", {
        filePath: conv.file_path,
      });
      onLoad(loaded);
      setShowHistory(false);
    } catch {
      // ignore load errors
    }
  };

  const handleDelete = async (conv: AiConversationSummary) => {
    setMenuOpen(null);
    await invoke("delete_ai_conversation_cmd", { filePath: conv.file_path }).catch(() => {});
    refreshHistory();
  };

  const handleArchive = async (conv: AiConversationSummary) => {
    setMenuOpen(null);
    await invoke("archive_ai_conversation_cmd", { filePath: conv.file_path }).catch(() => {});
    refreshHistory();
  };

  const handleRenameStart = (conv: AiConversationSummary) => {
    setMenuOpen(null);
    setRenamingId(conv.id);
    setRenameInput(conv.query);
  };

  const handleRenameSubmit = async (conv: AiConversationSummary) => {
    const title = renameInput.trim();
    if (title && title !== conv.query) {
      await invoke("retitle_ai_conversation_cmd", { filePath: conv.file_path, title }).catch(() => {});
      refreshHistory();
    }
    setRenamingId(null);
  };

  return (
    <div className="flex flex-col h-full border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ask Nichinichi</span>
        <div className="flex items-center gap-2">
          {messages.length > 0 && !showHistory && (
            <button
              onClick={onSave}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              save
            </button>
          )}
          <button
            onClick={() => { onClear(); setShowHistory(false); inputRef.current?.focus(); }}
            title="New chat"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory((v) => !v)}
              title={showHistory ? "Back to chat" : "Past conversations"}
              className={`transition-colors ${
                showHistory
                  ? "text-amber-500"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-400"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </button>
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

      {/* History list */}
      {showHistory ? (
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-8 px-4">
              No saved conversations yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {history.map((conv) => (
                <li key={conv.id} className="relative group">
                  {renamingId === conv.id ? (
                    <div className="px-4 py-3">
                      <p className="text-xs text-gray-400 dark:text-gray-600 mb-1">{conv.date}</p>
                      <input
                        autoFocus
                        value={renameInput}
                        onChange={(e) => setRenameInput(e.target.value)}
                        onBlur={() => handleRenameSubmit(conv)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameSubmit(conv);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="w-full text-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200
                                   border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-start">
                      <button
                        onClick={() => handleLoadConversation(conv)}
                        className="flex-1 text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors min-w-0"
                      >
                        <p className="text-xs text-gray-400 dark:text-gray-600 mb-0.5">{conv.date}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 leading-snug">
                          {conv.query}
                        </p>
                      </button>
                      <div className="relative flex-shrink-0 pt-2.5 pr-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === conv.id ? null : conv.id); }}
                          className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400
                                     opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                          </svg>
                        </button>
                        {menuOpen === conv.id && (
                          <div
                            className="absolute right-0 top-8 z-10 w-32 bg-white dark:bg-gray-800 border border-gray-200
                                       dark:border-gray-700 rounded shadow-lg text-sm overflow-hidden"
                            onMouseLeave={() => setMenuOpen(null)}
                          >
                            <button
                              onClick={() => handleRenameStart(conv)}
                              className="w-full text-left px-3 py-2 text-gray-700 dark:text-gray-300
                                         hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              Rename
                            </button>
                            <button
                              onClick={() => handleArchive(conv)}
                              className="w-full text-left px-3 py-2 text-gray-700 dark:text-gray-300
                                         hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              Archive
                            </button>
                            <button
                              onClick={() => handleDelete(conv)}
                              className="w-full text-left px-3 py-2 text-red-500
                                         hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* Messages */
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
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-gray-800">
        <div className="flex gap-2">
          <input
            ref={inputRef}
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
