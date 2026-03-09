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
  const radius = 52;
  const stroke = 10;
  const cx = 64;
  const cy = 64;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const colors = getGaugeColors(score);
  const gradientId = `gauge-gradient-${score}`;
  const glowId = `gauge-glow-${score}`;

  // Generate tick marks
  const ticks = Array.from({ length: 40 }, (_, i) => {
    const angle = (i / 40) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    const isMajor = i % 10 === 0;
    const outerR = radius + stroke / 2 + 2;
    const innerR = outerR + (isMajor ? 6 : 3);
    return {
      x1: cx + outerR * Math.cos(rad),
      y1: cy + outerR * Math.sin(rad),
      x2: cx + innerR * Math.cos(rad),
      y2: cy + innerR * Math.sin(rad),
      isMajor,
    };
  });

  return (
    <div className="flex flex-col items-center select-none">
      <div className="relative w-[160px] h-[160px] sm:w-[180px] sm:h-[180px]">
        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.start} />
              <stop offset="100%" stopColor={colors.end} />
            </linearGradient>
            <filter id={glowId}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feFlood floodColor={colors.glow} result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Tick marks */}
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.isMajor ? 'hsl(220 9% 70%)' : 'hsl(220 13% 88%)'}
              strokeWidth={t.isMajor ? 1.2 : 0.6}
              strokeLinecap="round"
            />
          ))}

          {/* Background track */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke="hsl(220 14% 96%)"
            strokeWidth={stroke}
          />

          {/* Progress arc with gradient + glow */}
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
                r={stroke / 2 + 1}
                fill="white"
                stroke={colors.end}
                strokeWidth={2}
              />
            );
          })()}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl sm:text-5xl font-black tracking-tight" style={{ color: colors.start }}>
            {score}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium mt-0.5">/ 100점</span>
        </div>
      </div>

      {/* Grade badge */}
      <div className="mt-3 flex items-center gap-2">
        <div
          className="px-3 py-1 rounded-full text-white text-sm font-bold shadow-sm"
          style={{ background: `linear-gradient(135deg, ${colors.start}, ${colors.end})` }}
        >
          {grade}
        </div>
        <span className="text-sm font-semibold text-foreground/70">{label}</span>
      </div>
    </div>
  );
}
