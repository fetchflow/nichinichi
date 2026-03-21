export * from "./entry";
export * from "./goal";

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

export type Section =
  | "dashboard"
  | "log"
  | "goals"
  | "playbooks"
  | "reports"
  | "settings";
