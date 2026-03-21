export type EntryType =
  | "log"
  | "solution"
  | "decision"
  | "reflection"
  | "score"
  | "ai";

export interface Entry {
  id: string;
  date: string;
  time: string;
  body: string;
  detail?: string;
  entry_type: EntryType;
  tags: string[];
  project?: string;
  org?: string;
  approximate: boolean;
  raw_line: string;
}

export const TYPE_COLORS: Record<EntryType, string> = {
  score: "#22c55e",
  solution: "#3b82f6",
  decision: "#a855f7",
  ai: "#f59e0b",
  reflection: "#ec4899",
  log: "#6b7280",
};
