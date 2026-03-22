import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AiMessage } from "../../hooks/useAi";

function EntryBlock({ text }: { text: string }) {
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(false);

  const handleAdd = async () => {
    try {
      await invoke("add_entry", { text: text.trim() });
      setAdded(true);
    } catch {
      setError(true);
    }
  };

  return (
    <div className="my-2 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 overflow-hidden">
      <div className="px-3 py-2 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
        {text.trim()}
      </div>
      <div className="px-3 py-2 border-t border-amber-200 dark:border-amber-800/50 flex items-center gap-2">
        <button
          onClick={handleAdd}
          disabled={added}
          className={`text-xs px-2.5 py-1 rounded text-white font-medium transition-colors
            ${added
              ? "bg-green-500 opacity-50 cursor-not-allowed"
              : "bg-amber-500 hover:bg-amber-600 cursor-pointer"
            }`}
        >
          {added ? "Added ✓" : "Add to journal"}
        </button>
        {error && <span className="text-xs text-red-500">Failed to add entry</span>}
      </div>
    </div>
  );
}

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
  onClear: () => void;
  onClose: () => void;
  onLoad: (messages: AiMessage[]) => void;
}

export function AskPanel({ messages, streaming, activeOrg, onAsk, onClear, onClose, onLoad }: Props) {
  const [input, setInput] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [history, setHistory] = useState<AiConversationSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadedConv, setLoadedConv] = useState<AiConversationSummary | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
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

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q || streaming) return;
    setShowHistory(false);
    onAsk(q, selectedModel);
    setInput("");
    // reset textarea height
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
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
      setLoadedConv(conv);
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
      // Keep the pinned title in sync if this is the active conversation
      if (loadedConv?.id === conv.id) setLoadedConv({ ...conv, query: title });
    }
    setRenamingId(null);
  };

  return (
    <div className="flex flex-col h-full border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <span className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase shrink-0">
            Nichinichi
          </span>
          {models.length > 0 && (
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={streaming}
              className="min-w-0 max-w-full bg-transparent text-xs text-gray-400 dark:text-gray-500 border-none focus:outline-none
                         disabled:opacity-50 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors truncate"
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { onClear(); setLoadedConv(null); setShowHistory(false); inputRef.current?.focus(); }}
            title="New chat"
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory((v) => !v)}
              title={showHistory ? "Back to chat" : "Past conversations"}
              className={`p-1 rounded transition-colors ${
                showHistory
                  ? "text-amber-500 bg-amber-50 dark:bg-amber-900/20"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
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
            title="Close"
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

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
                            <button onClick={() => handleRenameStart(conv)} className="w-full text-left px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Rename</button>
                            <button onClick={() => handleArchive(conv)} className="w-full text-left px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Archive</button>
                            <button onClick={() => handleDelete(conv)} className="w-full text-left px-3 py-2 text-red-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Delete</button>
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
        <>
          {/* Conversation title — pinned above scroll area */}
          {messages.length > 0 && (() => {
            const title = loadedConv?.query ?? messages.find((m) => m.role === "user")?.content ?? "";
            const canEdit = !!loadedConv;

            const commitTitle = async () => {
              const next = titleInput.trim();
              setEditingTitle(false);
              if (!next || next === title || !loadedConv) return;
              await invoke("retitle_ai_conversation_cmd", { filePath: loadedConv.file_path, title: next }).catch(() => {});
              setLoadedConv({ ...loadedConv, query: next });
              refreshHistory();
            };

            return (
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0 group">
                {editingTitle ? (
                  <input
                    autoFocus
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onBlur={commitTitle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitTitle();
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                    className="w-full text-sm font-medium bg-transparent text-gray-700 dark:text-gray-300
                               border-b border-amber-400 focus:outline-none leading-snug"
                  />
                ) : (
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 leading-snug line-clamp-2">
                      {title}
                    </p>
                    {canEdit && (
                      <button
                        onClick={() => { setTitleInput(title); setEditingTitle(true); }}
                        className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity
                                   text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Rename"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-12 px-4">
              Ask a question about your journal.
            </p>
          ) : (
            <>
              {messages.map((msg, i) => (
              <div
                key={i}
                className={`px-4 py-4 border-b border-gray-100 dark:border-gray-800/60 ${
                  msg.role === "user" ? "bg-gray-50 dark:bg-gray-800/40" : ""
                }`}
              >
                <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${
                  msg.role === "user"
                    ? "text-gray-400 dark:text-gray-500"
                    : "text-amber-600 dark:text-amber-500"
                }`}>
                  {msg.role === "user" ? "You" : "Nichinichi"}
                </p>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none
                                  prose-p:leading-relaxed prose-p:my-1.5
                                  prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:rounded prose-pre:text-xs
                                  prose-code:text-xs prose-code:bg-gray-100 dark:prose-code:bg-gray-800
                                  prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                                  prose-headings:font-semibold prose-headings:my-2
                                  prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5
                                  text-gray-800 dark:text-gray-200">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ className, children }) {
                          const lang = /language-(\w[\w-]*)/.exec(className ?? "")?.[1];
                          if (lang === "nichinichi-entry") {
                            return <EntryBlock text={String(children)} />;
                          }
                          return <code className={className}>{children}</code>;
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                    {streaming && i === messages.length - 1 && (
                      <span className="inline-block w-1.5 h-3.5 bg-amber-500 ml-0.5 animate-pulse align-middle" />
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                )}
              </div>
              ))}
            </>
          )}

          {/* Typing indicator */}
          {streaming && messages[messages.length - 1]?.role === "user" && (
            <div className="px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-3 text-amber-600 dark:text-amber-500">
                Nichinichi
              </p>
              <div className="flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        </>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800">
        <div className="relative rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800
                        focus-within:border-gray-400 dark:focus-within:border-gray-500 transition-colors">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Message… (Enter to send, Shift+Enter for newline)"
            disabled={streaming}
            className="w-full resize-none bg-transparent text-sm text-gray-800 dark:text-gray-200
                       placeholder-gray-400 dark:placeholder-gray-600 px-3 pt-2.5 pb-8
                       focus:outline-none disabled:opacity-50 leading-relaxed"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || streaming}
            className="absolute bottom-2 right-2 p-1 rounded bg-gray-200 dark:bg-gray-700
                       hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-30
                       text-gray-700 dark:text-gray-300 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
