import type { HeatmapCell } from "../../types";

interface Props {
  cells: HeatmapCell[];
  weeks?: number;
}

export function Heatmap({ cells, weeks = 26 }: Props) {
  const cellMap = new Map(cells.map((c) => [c.date, c.count]));
  const today = new Date();
  const days: { date: string; count: number }[] = [];

  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({ date: dateStr, count: cellMap.get(dateStr) ?? 0 });
  }

  const maxCount = Math.max(...cells.map((c) => c.count), 1);

  const colorFor = (count: number) => {
    if (count === 0) return "var(--c-surface-2)";
    const intensity = Math.min(count / maxCount, 1);
    if (intensity < 0.25) return "#14532d";
    if (intensity < 0.5) return "#166534";
    if (intensity < 0.75) return "#15803d";
    return "#22c55e";
  };

  // Group into columns (weeks)
  const columns: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) {
    columns.push(days.slice(i, i + 7));
  }

  return (
    <div className="flex gap-0.5 overflow-hidden">
      {columns.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-0.5">
          {col.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: ${day.count} entries`}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: colorFor(day.count) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
