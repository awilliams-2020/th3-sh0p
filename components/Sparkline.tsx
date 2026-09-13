type Point = { date: string } & Record<string, number | string>;

export function Sparkline({
  data,
  metric,
  width = 240,
  height = 48,
}: {
  data: Point[];
  metric: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="text-xs text-ink-400 flex items-center"
      >
        —
      </div>
    );
  }
  const values = data.map((d) => Number(d[metric]) || 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / (max - min || 1)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
