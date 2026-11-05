import { TrendingDown, TrendingUp } from "lucide-react";

const pct = (n: number) => `${n > 0 ? "+" : ""}${n}%`;

/** Year-over-year change badge; null (base too small) renders a dash. */
export function Growth({ value, className = "" }: { value: number | null; className?: string }) {
  if (value === null) return <span className={`text-muted-foreground ${className}`}>—</span>;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${up ? "trend-up" : "trend-down"} ${className}`}>
      <Icon className="w-3.5 h-3.5" />{pct(value)}
    </span>
  );
}
