const BAR_COLORS = [
  { stroke: 'hsl(217 91% 60%)', bg: 'hsl(217 91% 60% / 0.12)', icon: '🔬' },
  { stroke: 'hsl(160 84% 39%)', bg: 'hsl(160 84% 39% / 0.12)', icon: '📈' },
  { stroke: 'hsl(25 90% 55%)', bg: 'hsl(25 90% 55% / 0.12)', icon: '💼' },
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
    <div className="flex flex-col gap-2.5 sm:gap-3 w-full">
      {items.map((item) => (
        <div key={item.label}>
          {/* Label row - stacked on mobile for space */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs sm:text-sm shrink-0">{item.icon}</span>
            <span className="text-[11px] sm:text-xs font-semibold text-foreground/80 truncate">{item.label}</span>
          </div>
          {/* Bar */}
          <div className="w-full h-6 sm:h-7 rounded-full overflow-hidden relative" style={{ background: item.bg }}>
            <div
              className="h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2"
              style={{ width: `${Math.max(item.score, 18)}%`, background: item.stroke }}
            >
              <span className="text-[10px] sm:text-[11px] font-bold text-white whitespace-nowrap">
                {item.score}점
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
