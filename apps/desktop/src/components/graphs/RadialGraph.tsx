import { useState } from "react";
import { TYPE_COLORS, TYPE_ORDER } from "../../types";

interface DaySlice {
  label: string;
  entries: Record<string, number>;
}

interface Props {
  days: DaySlice[];
  size?: "mini" | "full";
}

function tot(e: Record<string, number>): number {
  return Object.values(e).reduce((a, c) => a + c, 0);
}

function dominant(e: Record<string, number>): string {
  let best = "log";
  let bestN = 0;
  for (const t of TYPE_ORDER) {
    if ((e[t] ?? 0) > bestN) {
      bestN = e[t] ?? 0;
      best = t;
    }
  }
  return best;
}

export function RadialGraph({ days, size = "mini" }: Props) {
  const [hov, setHov] = useState<number | null>(null);
  const dim = size === "mini" ? 100 : 180;
  const cx = dim / 2;
  const cy = dim / 2;
  const minR = size === "mini" ? 16 : 28;
  const maxR = size === "mini" ? 42 : 80;
  const n = days.length;
  const mx = Math.max(...days.map((d) => tot(d.entries)), 1);
  const total = days.reduce((a, d) => a + tot(d.entries), 0);

  return (
    <svg
      viewBox={`0 0 ${dim} ${dim}`}
      width={dim}
      height={dim}
      style={{ display: "block" }}
    >
      {days.map((d, i) => {
        const sA = (i / n) * 2 * Math.PI - Math.PI / 2;
        const eA = sA + (2 * Math.PI / n) * 0.82;
        const t = tot(d.entries);
        const r = t === 0 ? minR + 3 : minR + (t / mx) * (maxR - minR);
        const dom = dominant(d.entries);
        const mA = (sA + eA) / 2;

        const x1 = cx + minR * Math.cos(sA);
        const y1 = cy + minR * Math.sin(sA);
        const x2 = cx + r * Math.cos(sA);
        const y2 = cy + r * Math.sin(sA);
        const x3 = cx + r * Math.cos(eA);
        const y3 = cy + r * Math.sin(eA);
        const x4 = cx + minR * Math.cos(eA);
        const y4 = cy + minR * Math.sin(eA);

        const labelR = r + (size === "mini" ? 9 : 14);
        const fontSize = size === "mini" ? 6 : 9;

        return (
          <g
            key={i}
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
            style={{ cursor: "pointer" }}
          >
            <path
              d={`M ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${minR} ${minR} 0 0 0 ${x1} ${y1} Z`}
              fill={t === 0 ? "#374151" : (TYPE_COLORS as Record<string, string>)[dom]}
              opacity={
                hov === null
                  ? t === 0
                    ? 0.3
                    : 0.78
                  : hov === i
                  ? 1
                  : 0.18
              }
              style={{ transition: "opacity 0.12s" }}
            />
            <text
              x={cx + labelR * Math.cos(mA)}
              y={cy + labelR * Math.sin(mA)}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="monospace"
              fontSize={fontSize}
              fill={hov === i ? "#e5e7eb" : "#4b5563"}
              fontWeight={hov === i ? "700" : "400"}
            >
              {d.label}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={minR - 3} fill="#1f2937" />
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={size === "mini" ? 11 : 16}
        fill="#e5e7eb"
        fontWeight="700"
      >
        {hov !== null ? tot(days[hov].entries) : total}
      </text>
      <text
        x={cx}
        y={cy + (size === "mini" ? 7 : 10)}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={size === "mini" ? 6 : 7}
        fill="#6b7280"
      >
        {hov !== null ? days[hov].label : "total"}
      </text>
    </svg>
  );
}
