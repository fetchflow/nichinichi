import { useState } from "react";

interface Props {
  onSubmit: (text: string) => Promise<void>;
}

export function EntryComposer({ onSubmit }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    <form onSubmit={handleSubmit} className="p-3 border-b border-gray-800">
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What are you working on? @org #type"
          className="flex-1 bg-gray-800 text-gray-200 text-sm rounded px-3 py-2
                     placeholder-gray-600 border border-gray-700 focus:outline-none
                     focus:border-gray-500 transition-colors"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={!text.trim() || submitting}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40
                     text-gray-200 text-sm rounded transition-colors"
        >
          Log
        </button>
      </div>
      <p className="text-xs text-gray-600 mt-1.5 px-1">
        Enter to submit · Shift+Enter for newline
      </p>
    </form>
  );
}
