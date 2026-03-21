import { useState } from "react";
import { TYPE_COLORS, TYPE_ORDER } from "../../types";

interface MonthSlice {
  label: string;
  entries: Record<string, number>;
}

interface Props {
  months: MonthSlice[];
  size?: "mini" | "full";
}

export function SwimLaneGraph({ months, size = "mini" }: Props) {
  const [hovType, setHovType] = useState<string | null>(null);
  const W = size === "mini" ? 200 : 380;
  const lH = size === "mini" ? 12 : 20;
  const lG = size === "mini" ? 3 : 4;
  const lW = size === "mini" ? 48 : 60;
  const cW = W - lW;
  const n = months.length;
  const sX = n > 0 ? cW / n : cW;
  const maxR = size === "mini" ? 5 : 8;

  const mx = Math.max(
    ...TYPE_ORDER.map((t) =>
      Math.max(...months.map((d) => d.entries[t] ?? 0))
    ),
    1
  );

  const totalH = TYPE_ORDER.length * (lH + lG) + 14;

  // Label indices: first + a few evenly spaced
  const labelIndices = size === "mini"
    ? [0, 2, 5, 8, 11].filter((i) => i < n)
    : Array.from({ length: n }, (_, i) => i);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${totalH}`}
      style={{ display: "block" }}
    >
      {TYPE_ORDER.map((t, ti) => {
        const y = ti * (lH + lG);
        const isHov = hovType === t;
        const color = (TYPE_COLORS as Record<string, string>)[t];
        return (
          <g
            key={t}
            onMouseEnter={() => setHovType(t)}
            onMouseLeave={() => setHovType(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={lW}
              y={y}
              width={cW}
              height={lH}
              rx="2"
              fill={isHov ? color + "22" : "#1f2937"}
              style={{ transition: "fill 0.15s" }}
            />
            <text
              x={lW - 3}
              y={y + lH / 2}
              textAnchor="end"
              dominantBaseline="central"
              fontFamily="monospace"
              fontSize={size === "mini" ? 7 : 8}
              fill={isHov ? color : "#6b7280"}
              fontWeight={isHov ? "700" : "400"}
            >
              {t}
            </text>
            {months.map((d, di) => {
              const c = d.entries[t] ?? 0;
              if (!c) return null;
              const r = Math.max((c / mx) * maxR, 1.5);
              return (
                <circle
                  key={di}
                  cx={lW + di * sX + sX / 2}
                  cy={y + lH / 2}
                  r={r}
                  fill={color}
                  opacity={hovType && !isHov ? 0.1 : 0.82}
                  style={{ transition: "opacity 0.15s" }}
                />
              );
            })}
          </g>
        );
      })}
      {labelIndices.map((i) => (
        <text
          key={i}
          x={lW + i * sX + sX / 2}
          y={totalH - 3}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize={size === "mini" ? 6 : 8}
          fill={
            Object.values(months[i]?.entries ?? {}).reduce((a, c) => a + c, 0) > 0
              ? "#6b7280"
              : "#374151"
          }
        >
          {months[i]?.label ?? ""}
        </text>
      ))}
    </svg>
  );
}
