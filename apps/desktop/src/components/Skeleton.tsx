export function SkeletonRow({ width = "100%" }: { width?: string }) {
  return (
    <div
      className="h-4 rounded bg-gray-700 animate-pulse"
      style={{ width }}
    />
  );
}

export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonRow key={i} width={i === lines - 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}
