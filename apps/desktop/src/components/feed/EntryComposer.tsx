import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { TYPE_COLORS, TYPE_ORDER } from "../../types";

interface Props {
  onSubmit: (text: string) => Promise<unknown>;
  workspaces: string[];
}

export function EntryComposer({ onSubmit, workspaces }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  type CustomTag = { name: string; color: string };
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);

  useEffect(() => {
    invoke<Record<string, string>>("get_settings")
      .then((s) => {
        try { setCustomTags(JSON.parse(s["custom_tags"] ?? "[]")); } catch { /* noop */ }
      })
      .catch(() => {});
  }, []);

  const insertToken = (token: string) => {
    const prefix = text && !text.endsWith(" ") ? " " : "";
    setText((t) => t + prefix + token);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setText("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border-b border-gray-200 dark:border-gray-800">
      {/* Input row */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What are you working on? @org #type"
          className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded px-3 py-2
                     placeholder-gray-400 dark:placeholder-gray-600 border border-gray-300 dark:border-gray-700 focus:outline-none
                     focus:border-gray-400 dark:focus:border-gray-500 transition-colors"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={!text.trim() || submitting}
          className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40
                     text-gray-800 dark:text-gray-200 text-sm rounded transition-colors"
        >
          Log
        </button>
      </div>

      {/* Chip toolbar */}
      <div className="mt-2 space-y-1.5">
        {/* Tags (built-in types + custom tags) */}
        <ChipRow label="tags">
          {TYPE_ORDER.map((t) => (
            <Chip
              key={t}
              label={t}
              onClick={() => insertToken(`#${t}`)}
              color={TYPE_COLORS[t]}
            />
          ))}
          {customTags.map((tag) => (
            <Chip key={tag.name} label={tag.name} onClick={() => insertToken(`#${tag.name}`)} color={tag.color} />
          ))}
        </ChipRow>

        {/* Workspaces */}
        {workspaces.length > 0 && (
          <ChipRow label="org">
            {workspaces.map((ws) => (
              <Chip key={ws} label={ws} onClick={() => insertToken(`@${ws}`)} prefix="@" />
            ))}
          </ChipRow>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-600 mt-1.5 px-1">
        Enter to submit · Shift+Enter for newline
      </p>
    </form>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-gray-400 dark:text-gray-600 font-mono uppercase tracking-wider w-7 shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  label,
  onClick,
  color,
  prefix = "#",
}: {
  label: string;
  onClick: () => void;
  color?: string;
  prefix?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-0.5 rounded text-[11px] transition-opacity hover:opacity-80 active:opacity-60 font-mono"
      style={
        color
          ? { backgroundColor: color + "22", color }
          : {
              backgroundColor: "var(--c-surface-2, rgba(128,128,128,0.15))",
              color: "var(--c-text-muted, #6b7280)",
            }
      }
    >
      {prefix}{label}
    </button>
  );
}
