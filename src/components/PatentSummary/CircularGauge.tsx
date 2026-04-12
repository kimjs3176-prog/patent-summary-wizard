interface CircularGaugeProps {
  score: number;
  grade: string;
  label: string;
}

function getGaugeColors(value: number): { start: string; end: string; glow: string } {
  if (value >= 80) return { start: 'hsl(160 84% 39%)', end: 'hsl(140 70% 50%)', glow: 'hsl(160 84% 39% / 0.3)' };
  if (value >= 60) return { start: 'hsl(217 91% 60%)', end: 'hsl(200 80% 55%)', glow: 'hsl(217 91% 60% / 0.3)' };
  if (value >= 40) return { start: 'hsl(38 92% 50%)', end: 'hsl(25 90% 55%)', glow: 'hsl(38 92% 50% / 0.3)' };
  return { start: 'hsl(0 84% 60%)', end: 'hsl(15 80% 55%)', glow: 'hsl(0 84% 60% / 0.3)' };
}

export function CircularGauge({ score, grade, label }: CircularGaugeProps) {
  const radius = 50;
  const stroke = 8;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const colors = getGaugeColors(score);
  const gradientId = `gauge-gradient-${score}`;
  const glowId = `gauge-glow-${score}`;

  return (
    <div className="flex flex-col items-center select-none shrink-0">
      <div className="relative w-[110px] h-[110px] sm:w-[130px] sm:h-[130px] md:w-[150px] md:h-[150px]">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.start} />
              <stop offset="100%" stopColor={colors.end} />
            </linearGradient>
            <filter id={glowId}>
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feFlood floodColor={colors.glow} result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track */}
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="hsl(220 14% 94%)" strokeWidth={stroke} />

          {/* Progress */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            filter={`url(#${glowId})`}
            className="transition-all duration-1000 ease-out"
          />

          {/* End dot */}
          {score > 0 && (() => {
            const angle = ((score / 100) * 360 - 90) * (Math.PI / 180);
            return (
              <circle
                cx={cx + radius * Math.cos(angle)}
                cy={cy + radius * Math.sin(angle)}
                r={stroke / 2}
                fill="white"
                stroke={colors.end}
                strokeWidth={1.5}
              />
            );
          })()}
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight tabular-nums" style={{ color: colors.start }}>
            {score}
          </span>
          <span className="text-[8px] sm:text-[9px] text-muted-foreground/50 font-medium">/ 100</span>
        </div>
      </div>

      {/* Grade badge */}
      <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5">
        <div
          className="px-2 py-0.5 rounded-md text-white text-[10px] sm:text-xs font-bold"
          style={{ background: `linear-gradient(135deg, ${colors.start}, ${colors.end})` }}
        >
          {grade}
        </div>
        <span className="text-[11px] sm:text-xs font-semibold text-foreground/60">{label}</span>
      </div>
    </div>
  );
}
