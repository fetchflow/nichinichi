import type { WeekBucket } from "../../types";

interface Props {
  weeks: WeekBucket[];
}

function totalEntries(b: WeekBucket): number {
  return Object.values(b.entries).reduce((a, c) => a + c, 0);
}

export function MomentumGraph({ weeks }: Props) {
  const W = 340;
  const H = 44;
  const totals = weeks.map(totalEntries);
  const mx = Math.max(...totals, 1);
  const step = totals.length > 1 ? W / (totals.length - 1) : W;

  const pts = totals.map((n, i) => ({
    x: totals.length === 1 ? W / 2 : i * step,
    y: H - (n / mx) * (H - 4),
  }));

  const poly = pts.map((p) => `${p.x},${p.y}`).join(" ");

  // Percent change: last 4 weeks vs prior 4 weeks
  const last4 = totals.slice(-4).reduce((a, b) => a + b, 0);
  const prior4 = totals.slice(-8, -4).reduce((a, b) => a + b, 0);
  const pctChange =
    prior4 === 0 ? null : Math.round(((last4 - prior4) / prior4) * 100);

  // Counts for the insight line
  const lastWeek = weeks[weeks.length - 1];
  const scoreCount = lastWeek?.entries["score"] ?? 0;
  const decisionCount = lastWeek?.entries["decision"] ?? 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <div style={{ fontSize: "9px", color: "var(--c-text-muted)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "1px" }}>
          momentum · last {weeks.length} weeks
        </div>
        {pctChange !== null && (
          <span style={{ fontSize: "9px", color: pctChange >= 0 ? "#1D9E75" : "#993C1D", fontFamily: "monospace" }}>
            {pctChange >= 0 ? "↑" : "↓"} {Math.abs(pctChange)}% vs prior 4 weeks
          </span>
        )}
      </div>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#534AB7" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#534AB7" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${H} ${poly} ${W},${H}`}
          fill="url(#mg)"
        />
        <polyline
          points={poly}
          fill="none"
          stroke="#534AB7"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.7"
        />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2.5"
            style={{ fill: "var(--c-surface-2)" }}
            stroke="#534AB7"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      {(scoreCount > 0 || decisionCount > 0) && (
        <div
          style={{
            padding: "7px 9px",
            background: "var(--c-surface-1)",
            borderRadius: "7px",
            borderLeft: "2px solid #534AB7",
            marginTop: "6px",
            fontSize: "10px",
            color: "var(--c-text-muted)",
            fontFamily: "monospace",
            lineHeight: "1.7",
          }}
        >
          {scoreCount > 0 && (
            <>
              {scoreCount} score {scoreCount === 1 ? "entry" : "entries"} this week
              {decisionCount > 0 ? ` · ` : "."}
            </>
          )}
          {decisionCount > 0 && (
            <>{decisionCount} {decisionCount === 1 ? "decision" : "decisions"} logged.</>
          )}
        </div>
      )}
    </div>
  );
}
