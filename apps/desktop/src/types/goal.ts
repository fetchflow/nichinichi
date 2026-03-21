export type GoalStatus = "active" | "paused" | "done" | "abandoned";
export type GoalType = "career" | "learning";
export type GoalStepStatus = "not_started" | "in_progress" | "done";
export type ProgressSignal =
  | "breakthrough"
  | "strong"
  | "steady"
  | "moderate"
  | "struggling"
  | "quiet";

export interface GoalStep {
  id: string;
  goal_id: string;
  title: string;
  status: GoalStepStatus;
  notes?: string;
  due_date?: string;
  position: number;
}

export interface GoalProgress {
  id: string;
  goal_id: string;
  period_start: string;
  period_end: string;
  signal: ProgressSignal;
  note?: string;
  created_at?: string;
}

export interface Goal {
  id: string;
  title: string;
  goal_type?: GoalType;
  horizon?: string;
  status: GoalStatus;
  why?: string;
  org?: string;
  file_path: string;
  created_at?: string;
  updated_at?: string;
  completion_date?: string;
  steps: GoalStep[];
  progress: GoalProgress[];
}

export const SIGNAL_COLORS: Record<ProgressSignal, string> = {
  breakthrough: "#f59e0b",
  strong: "#22c55e",
  steady: "#3b82f6",
  moderate: "#a855f7",
  struggling: "#ef4444",
  quiet: "#6b7280",
};
