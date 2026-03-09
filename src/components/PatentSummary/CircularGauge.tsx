interface CircularGaugeProps {
  score: number;
  grade: string;
  label: string;
}

function getGaugeColor(value: number): string {
  if (value >= 80) return "hsl(160 84% 39%)";
  if (value >= 60) return "hsl(217 91% 60%)";
  if (value >= 40) return "hsl(38 92% 50%)";
  return "hsl(0 84% 60%)";
}

export function CircularGauge({ score, grade, label }: CircularGaugeProps) {
  const radius = 54;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = getGaugeColor(score);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[140px] h-[140px] sm:w-[160px] sm:h-[160px]">
        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
          {/* Background track */}
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke="hsl(220 13% 91%)"
            strokeWidth={stroke}
          />
          {/* Progress arc */}
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl sm:text-4xl font-black" style={{ color }}>
            {score}
          </span>
          <span className="text-[10px] text-muted-foreground -mt-0.5">/ 100</span>
        </div>
      </div>
      {/* Grade badge */}
      <div className="mt-2 flex flex-col items-center gap-0.5">
        <span className="text-xl sm:text-2xl font-black" style={{ color }}>
          {grade}
        </span>
        <span className="text-xs font-semibold" style={{ color }}>
          {label}
        </span>
      </div>
    </div>
  );
}
