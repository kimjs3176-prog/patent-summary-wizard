const BAR_COLORS = [
  { stroke: 'hsl(217 91% 60%)', bg: 'hsl(217 91% 60% / 0.08)', light: 'hsl(217 91% 95%)', icon: '🔬' },
  { stroke: 'hsl(160 84% 39%)', bg: 'hsl(160 84% 39% / 0.08)', light: 'hsl(160 84% 95%)', icon: '📈' },
  { stroke: 'hsl(25 90% 55%)', bg: 'hsl(25 90% 55% / 0.08)', light: 'hsl(25 90% 95%)', icon: '💼' },
];

const REFERENCE_LINES = [
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 75, label: '75' },
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
    <div className="relative w-full">
      {/* Reference lines (behind bars) */}
      <div className="absolute inset-0 flex" style={{ top: 0, bottom: 0 }}>
        {REFERENCE_LINES.map((ref) => (
          <div
            key={ref.value}
            className="absolute h-full border-l border-dashed border-border/40"
            style={{ left: `${ref.value}%` }}
          />
        ))}
      </div>

      {/* Reference labels at top */}
      <div className="relative flex mb-1.5 h-4">
        {REFERENCE_LINES.map((ref) => (
          <span
            key={ref.value}
            className="absolute text-[9px] text-muted-foreground/50 font-medium -translate-x-1/2"
            style={{ left: `${ref.value}%` }}
          >
            {ref.label}
          </span>
        ))}
      </div>

      {/* Bars */}
      <div className="relative flex flex-col gap-3 sm:gap-3.5 w-full">
        {items.map((item) => (
          <div key={item.label}>
            {/* Label with score */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm shrink-0">{item.icon}</span>
                <span className="text-[11px] sm:text-xs font-semibold text-foreground/80">{item.label}</span>
              </div>
              <span
                className="text-xs sm:text-sm font-bold tabular-nums px-2 py-0.5 rounded-md"
                style={{ color: item.stroke, background: item.light }}
              >
                {item.score}점
              </span>
            </div>
            {/* Bar track */}
            <div className="w-full h-5 sm:h-6 rounded-lg overflow-hidden relative" style={{ background: item.bg }}>
              {/* Score step lines inside track */}
              {[20, 40, 60, 80].map((v) => (
                <div
                  key={v}
                  className="absolute top-0 h-full w-px z-10"
                  style={{ left: `${v}%`, background: 'hsl(0 0% 50% / 0.2)' }}
                />
              ))}
              <div
                className="h-full rounded-lg transition-all duration-700 ease-out relative overflow-hidden z-20"
                style={{ width: `${Math.max(item.score, 8)}%`, background: item.stroke }}
              >
                {/* Glossy overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-transparent" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
