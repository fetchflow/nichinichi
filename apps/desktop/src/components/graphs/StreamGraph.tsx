import { useState } from "react";
import { TYPE_COLORS, TYPE_ORDER } from "../../types";

interface DaySlice {
  entries: Record<string, number>;
}

interface Props {
  days: DaySlice[];
  size?: "mini" | "full";
}

function tot(e: Record<string, number>): number {
  return Object.values(e).reduce((a, c) => a + c, 0);
}

export function StreamGraph({ days, size = "mini" }: Props) {
  const [hovType, setHovType] = useState<string | null>(null);
  const W = size === "mini" ? 200 : 380;
  const H = size === "mini" ? 52 : 80;
  const n = days.length;
  const sX = n > 0 ? W / n : W;
  const mx = Math.max(...days.map((d) => tot(d.entries)), 1);

  function bands(e: Record<string, number>) {
    let y = 0;
    return TYPE_ORDER.map((t) => {
      const h = ((e[t] ?? 0) / mx) * H;
      const b = { y, h, t };
      y += h;
      return b;
    });
  }

  function buildPath(tk: string): string | null {
    const pts = days.map((d, i) => {
      const bs = bands(d.entries);
      const b = bs.find((b2) => b2.t === tk);
      return { x: i * sX + sX / 2, yT: b ? b.y : 0, yB: b ? b.y + b.h : 0 };
    });
    if (pts.every((p) => p.yT === p.yB)) return null;

    let d = `M ${pts[0].x} ${pts[0].yT}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` C ${pts[i - 1].x + sX / 2} ${pts[i - 1].yT} ${pts[i].x - sX / 2} ${pts[i].yT} ${pts[i].x} ${pts[i].yT}`;
    }
    d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].yB}`;
    for (let i = pts.length - 2; i >= 0; i--) {
      d += ` C ${pts[i + 1].x - sX / 2} ${pts[i + 1].yB} ${pts[i].x + sX / 2} ${pts[i].yB} ${pts[i].x} ${pts[i].yB}`;
    }
    return d + " Z";
  }

  // X-axis labels
  const labelIndices =
    size === "mini"
      ? [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1]
      : Array.from({ length: n }, (_, i) => i).filter((i) => i === 0 || (i + 1) % 5 === 0);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H + 14}`}
      style={{ display: "block" }}
    >
      {TYPE_ORDER.map((t) => {
        const p = buildPath(t);
        if (!p) return null;
        return (
          <path
            key={t}
            d={p}
            fill={(TYPE_COLORS as Record<string, string>)[t]}
            opacity={
              hovType === null ? 0.82 : hovType === t ? 1 : 0.1
            }
            style={{ transition: "opacity 0.15s", cursor: "pointer" }}
            onMouseEnter={() => setHovType(t)}
            onMouseLeave={() => setHovType(null)}
          />
        );
      })}
      {labelIndices.map((i) => (
        <text
          key={i}
          x={i * sX + sX / 2}
          y={H + 11}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize="7"
          fill="#ccc"
        >
          {i + 1}
        </text>
      ))}
    </svg>
  );
}
