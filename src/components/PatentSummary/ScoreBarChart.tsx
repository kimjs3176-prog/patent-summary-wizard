const BAR_COLORS = [
  { stroke: 'hsl(217 91% 60%)', bg: 'hsl(217 91% 60% / 0.06)', light: 'hsl(217 91% 95%)', icon: '🔬' },
  { stroke: 'hsl(160 84% 39%)', bg: 'hsl(160 84% 39% / 0.06)', light: 'hsl(160 84% 95%)', icon: '📈' },
  { stroke: 'hsl(25 90% 55%)', bg: 'hsl(25 90% 55% / 0.06)', light: 'hsl(25 90% 95%)', icon: '💼' },
];

interface ScoreBarChartProps {
  technologyScore: number;
  marketScore: number;
  businessScore: number;
  labels: { technology: string; market: string; business: string };
}

export function ScoreBarChart({ technologyScore, marketScore, businessScore, labels }: ScoreBarChartProps) {
  const items = [
    { label: labels.technology, score: technologyScore, ...BAR_COLORS[0] },
    { label: labels.market, score: marketScore, ...BAR_COLORS[1] },
    { label: labels.business, score: businessScore, ...BAR_COLORS[2] },
  ];

  return (
    <div className="w-full space-y-2.5 sm:space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          {/* Label row */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] sm:text-xs shrink-0">{item.icon}</span>
              <span className="text-[11px] sm:text-xs font-semibold text-foreground/70">{item.label}</span>
            </div>
            <span
              className="text-[11px] sm:text-xs font-bold tabular-nums"
              style={{ color: item.stroke }}
            >
              {item.score}
            </span>
          </div>
          {/* Bar */}
          <div className="w-full h-2 sm:h-2.5 rounded-full overflow-hidden" style={{ background: item.bg }}>
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.max(item.score, 5)}%`, background: item.stroke }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
