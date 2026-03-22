import { useState } from "react";
import { Heatmap } from "../components/stats/Heatmap";
import { MomentumGraph } from "../components/stats/MomentumGraph";
import { RadialGraph } from "../components/graphs/RadialGraph";
import { StreamGraph } from "../components/graphs/StreamGraph";
import { SwimLaneGraph } from "../components/graphs/SwimLaneGraph";
import { SkeletonBlock, SkeletonRow } from "../components/Skeleton";
import { useStats } from "../hooks/useStats";
import { useGoals } from "../hooks/useGoals";
import { useEntries } from "../hooks/useEntries";
import { useActivity } from "../hooks/useActivity";
import { useTimezone } from "../hooks/useTimezone";
import { localDateStr } from "../utils/date";
import { TYPE_COLORS } from "../types";
import type { ActivityPayload } from "../types";

type DrillPeriod = "week" | "month" | "year";

interface Props {
  activeOrg: string;
}

export function DashboardView({ activeOrg }: Props) {
  const org = activeOrg === "all" ? undefined : activeOrg;
  const { stats, loading: statsLoading } = useStats(org);
  const { goals, loading: goalsLoading } = useGoals("active", org);
  const { activity, loading: activityLoading } = useActivity(org);
  const { timezone } = useTimezone();

  const today = localDateStr(new Date(), timezone);
  const { entries: todayEntries, loading: entriesLoading } = useEntries(today, activeOrg);

  const [drill, setDrill] = useState<DrillPeriod | null>(null);

  if (drill !== null && activity) {
    return (
      <DrillView
        period={drill}
        activity={activity}
        onBack={() => setDrill(null)}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Streak + quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="streak"
          value={statsLoading ? null : `${stats?.streak ?? 0}d`}
        />
        <StatCard
          label="entries (90d)"
          value={statsLoading ? null : String(stats?.total_entries ?? 0)}
        />
        <StatCard
          label="active goals"
          value={goalsLoading ? null : String(goals.length)}
        />
      </div>

      {/* Heatmap */}
      <section>
        <h2 className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-3">
          Activity
        </h2>
        {statsLoading ? (
          <SkeletonBlock lines={1} />
        ) : (
          <Heatmap cells={stats?.heatmap ?? []} timezone={timezone} />
        )}
      </section>

      {/* Momentum graph */}
      <section>
        {activityLoading ? (
          <SkeletonBlock lines={2} />
        ) : activity && activity.weekly.length > 0 ? (
          <div style={{ border: "1px solid var(--c-border)", borderRadius: "10px", padding: "11px 13px", background: "var(--c-surface-2)" }}>
            <MomentumGraph weeks={activity.weekly} />
          </div>
        ) : null}
      </section>

      {/* Progress mini-graph cards */}
      {!activityLoading && activity && (
        <section>
          <div style={{ fontSize: "9px", color: "var(--c-text-muted)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
            progress · click to explore
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <MiniGraphCard
              title="weekly"
              sub={new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " week"}
              total={activity.week_days.reduce((s, w) => s + Object.values(w.entries).reduce((a, c) => a + c, 0), 0)}
              onClick={() => setDrill("week")}
            >
              <RadialGraph
                days={activity.week_days.map((w) => ({ label: w.label, entries: w.entries }))}
                size="mini"
              />
            </MiniGraphCard>

            <MiniGraphCard
              title="monthly"
              sub={new Date().toLocaleString("default", { month: "long", year: "numeric" })}
              total={activity.monthly.reduce((s, d) => s + Object.values(d.entries).reduce((a, c) => a + c, 0), 0)}
              onClick={() => setDrill("month")}
            >
              <StreamGraph days={activity.monthly} size="mini" />
            </MiniGraphCard>

            <MiniGraphCard
              title="yearly"
              sub={String(new Date().getFullYear())}
              total={activity.yearly.reduce((s, m) => s + Object.values(m.entries).reduce((a, c) => a + c, 0), 0)}
              onClick={() => setDrill("year")}
            >
              <SwimLaneGraph months={activity.yearly} size="mini" />
            </MiniGraphCard>
          </div>
        </section>
      )}

      {/* Entry type breakdown */}
      {stats && (
        <section>
          <h2 className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-3">
            Entry types (90d)
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.entries_by_type).map(([type, count]) => (
              <span
                key={type}
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  backgroundColor:
                    (TYPE_COLORS as Record<string, string>)[type] + "22",
                  color: (TYPE_COLORS as Record<string, string>)[type],
                }}
              >
                {type} · {count}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Today's entries */}
      <section>
        <h2 className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-3">
          Today
        </h2>
        {entriesLoading ? (
          <SkeletonBlock />
        ) : todayEntries.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-600">No entries yet today.</p>
        ) : (
          <div className="space-y-1">
            {todayEntries.map((e) => (
              <div key={e.id} className="text-sm text-gray-600 dark:text-gray-400">
                <span className="text-gray-400 dark:text-gray-600 tabular-nums mr-2">{e.time}</span>
                {e.body}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Goals snapshot */}
      <section>
        <h2 className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-3">
          Goals
        </h2>
        {goalsLoading ? (
          <SkeletonBlock />
        ) : goals.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-600">No active goals.</p>
        ) : (
          <div className="space-y-3">
            {goals.slice(0, 3).map((goal) => {
              const done = goal.steps.filter((s) => s.status === "done").length;
              const total = goal.steps.length;
              const pct = total === 0 ? 0 : (done / total) * 100;
              return (
                <div key={goal.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300">{goal.title}</span>
                    <span className="text-gray-500">
                      {done}/{total}
                    </span>
                  </div>
                  <div className="h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Mini graph card wrapper ────────────────────────────────────────────────

function MiniGraphCard({
  title,
  sub,
  total,
  onClick,
  children,
}: {
  title: string;
  sub: string;
  total: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        border: `1px solid ${hov ? "#534AB7" : "var(--c-border)"}`,
        borderRadius: "10px",
        padding: "12px",
        background: "var(--c-surface-2)",
        cursor: "pointer",
        transition: "border-color 0.15s",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
        <div>
          <div style={{ fontSize: "9px", color: "var(--c-text-muted)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "1px" }}>
            {title}
          </div>
          <div style={{ fontSize: "8px", color: "var(--c-text-muted)", fontFamily: "monospace", opacity: 0.7 }}>{sub}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--c-text-primary)", fontFamily: "monospace", lineHeight: 1 }}>
              {total}
            </div>
            <div style={{ fontSize: "7px", color: "var(--c-text-muted)" }}>entries</div>
          </div>
          <span style={{ color: hov ? "#534AB7" : "var(--c-text-muted)" }}>→</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", overflow: "hidden" }}>{children}</div>
    </div>
  );
}

// ── Drill view ─────────────────────────────────────────────────────────────

function DrillView({
  period,
  activity,
  onBack,
}: {
  period: DrillPeriod;
  activity: ActivityPayload;
  onBack: () => void;
}) {
  const cfg = {
    week: { title: "this week", sub: "Mon – Sun" },
    month: {
      title: "this month",
      sub: new Date().toLocaleString("default", { month: "long", year: "numeric" }),
    },
    year: { title: "this year", sub: String(new Date().getFullYear()) },
  }[period];

  const sum = (buckets: { entries: Record<string, number> }[], key?: string) =>
    buckets.reduce(
      (s, b) =>
        s +
        (key
          ? (b.entries[key] ?? 0)
          : Object.values(b.entries).reduce((a, c) => a + c, 0)),
      0
    );

  const buckets =
    period === "week"
      ? activity.weekly
      : period === "month"
      ? activity.monthly
      : activity.yearly;

  const statItems: [string, number][] = [
    ["entries", sum(buckets)],
    ["score", sum(buckets, "score")],
    ["decisions", sum(buckets, "decision")],
    ["solutions", sum(buckets, "solution")],
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3px",
            fontSize: "11px",
            color: "var(--c-text-muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "monospace",
            padding: 0,
          }}
        >
          ← dashboard
        </button>
        <span style={{ color: "var(--c-border)" }}>·</span>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--c-text-primary)", fontFamily: "monospace" }}>
          {cfg.title}
        </span>
        <span style={{ fontSize: "10px", color: "var(--c-text-muted)", fontFamily: "monospace" }}>{cfg.sub}</span>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
        {statItems.map(([label, val]) => (
          <div
            key={label}
            style={{
              border: "1px solid var(--c-border)",
              borderRadius: "8px",
              padding: "10px",
              background: "var(--c-surface-2)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--c-text-primary)", fontFamily: "monospace", lineHeight: 1 }}>
              {val}
            </div>
            <div style={{ fontSize: "9px", color: "var(--c-text-muted)", marginTop: "3px" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Full-size graph */}
      <div style={{ border: "1px solid var(--c-border)", borderRadius: "10px", padding: "14px 16px", background: "var(--c-surface-2)" }}>
        <div style={{ fontSize: "9px", color: "var(--c-text-muted)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
          {period === "week" ? "radial" : period === "month" ? "stream" : "swimlane"} · {cfg.sub}
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          {period === "week" && (
            <RadialGraph
              days={activity.week_days.map((w) => ({ label: w.label, entries: w.entries }))}
              size="full"
            />
          )}
          {period === "month" && <StreamGraph days={activity.monthly} size="full" />}
          {period === "year" && <SwimLaneGraph months={activity.yearly} size="full" />}
        </div>
      </div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {value === null ? (
        <SkeletonRow width="60%" />
      ) : (
        <p className="text-2xl font-semibold text-gray-800 dark:text-gray-200">{value}</p>
      )}
    </div>
  );
}
