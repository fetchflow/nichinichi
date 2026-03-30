export * from "./entry";
export * from "./goal";

export interface CloudStatus {
  signed_in: boolean;
  plan: string;
  plan_status: string;
  synced_files: number;
  storage_used_bytes: number;
  last_synced_at: number | null;
}

export interface CloudConflict {
  path: string;
  local_hash: string;
  remote_hash: string;
}

export interface CloudSyncResult {
  uploaded: number;
  downloaded: number;
  conflicts: CloudConflict[];
}

export interface Playbook {
  id: string;
  title: string;
  content?: string;
  tags: string[];
  org?: string;
  forked_from?: string;
  file_path: string;
  created_at?: string;
  updated_at?: string;
}

export interface HeatmapCell {
  date: string;
  count: number;
}

export interface StatsPayload {
  total_entries: number;
  entries_by_type: Record<string, number>;
  streak: number;
  heatmap: HeatmapCell[];
}

export interface WeekBucket {
  week_start: string;
  label: string;
  entries: Record<string, number>;
}

export interface DayBucket {
  date: string;
  entries: Record<string, number>;
}

export interface MonthBucket {
  month: string;
  label: string;
  entries: Record<string, number>;
}

export interface ActivityPayload {
  weekly: WeekBucket[];
  week_days: WeekBucket[];
  monthly: DayBucket[];
  yearly: MonthBucket[];
}

export const TYPE_ORDER = [
  "score",
  "solution",
  "decision",
  "ai",
  "reflection",
  "log",
] as const;

export type TypeKey = (typeof TYPE_ORDER)[number];

export type Section =
  | "dashboard"
  | "log"
  | "goals"
  | "playbooks"
  | "reports"
  | "settings";
