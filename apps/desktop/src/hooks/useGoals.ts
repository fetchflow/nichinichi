import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import type { Goal } from "../types";

export function useGoals(status?: string, org?: string) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    invoke<Goal[]>("get_goals", {
      status: status ?? null,
      org: org === "all" ? null : org ?? null,
    })
      .then(setGoals)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [status, org]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleStep = useCallback(async (stepId: string, done: boolean) => {
    await invoke("update_goal_step", { stepId, done });
    load();
  }, [load]);

  const archiveGoal = useCallback(
    async (goalId: string, status: "done" | "abandoned") => {
      await invoke("archive_goal", { goalId, status });
      load();
    },
    [load]
  );

  const updateGoalMeta = useCallback(
    async (
      goalId: string,
      title: string,
      goalType: string | null,
      horizon: string | null,
      why: string | null
    ) => {
      await invoke("update_goal_meta", { goalId, title, goalType, horizon, why });
      load();
    },
    [load]
  );

  return { goals, loading, error, reload: load, toggleStep, archiveGoal, updateGoalMeta };
}
