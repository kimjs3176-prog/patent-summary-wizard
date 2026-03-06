import { useMemo } from "react";
import { DEFAULT_TRL_CONFIG, type TrlConfig } from "@/components/admin/ScoreTrlSettings";

interface TrlChartProps {
  estimatedTrl: number;
  trlConfig?: TrlConfig;
}

function getTrlColor(level: number): string {
  if (level <= 3) return "hsl(var(--destructive))";
  if (level <= 6) return "hsl(var(--accent))";
  return "hsl(var(--primary))";
}

function getTrlStage(level: number, stages: TrlConfig["stages"]): string {
  if (level <= 3) return `${stages[0]?.name || "기초연구"} 단계`;
  if (level <= 6) return `${stages[1]?.name || "개발/실증"} 단계`;
  return `${stages[2]?.name || "상용화"} 준비 단계`;
}

export function TrlChart({ estimatedTrl, trlConfig }: TrlChartProps) {
  const config = trlConfig || DEFAULT_TRL_CONFIG;
  const levels = config.levels;
  const stages = config.stages;

  const chartData = useMemo(() => {
    return levels.map((item) => ({
      ...item,
      value: item.level <= estimatedTrl ? item.level * 11.1 : 0,
      current: item.level === estimatedTrl,
    }));
  }, [estimatedTrl, levels]);

  const currentTrlInfo = levels.find((t) => t.level === estimatedTrl);

  return (
    <div className="space-y-4">
      {/* TRL Level Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black"
            style={{ backgroundColor: getTrlColor(estimatedTrl), color: '#1a1a1a' }}
          >
            {estimatedTrl}
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">
              TRL {estimatedTrl} - {currentTrlInfo?.label}
            </p>
            <p className="text-sm text-foreground/60">
              {getTrlStage(estimatedTrl, stages)}
            </p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-muted-foreground">상용화까지</p>
          <p className="text-lg font-bold text-foreground">
            {9 - estimatedTrl} 단계
          </p>
        </div>
      </div>

      {/* TRL Progress Bar */}
      <div className="relative">
        <div className="flex gap-1">
          {levels.map((item) => (
            <div
              key={item.level}
              className="flex-1 h-3 rounded-full transition-all duration-500"
              style={{
                backgroundColor:
                  item.level <= estimatedTrl
                    ? getTrlColor(item.level)
                    : "hsl(var(--muted))",
                opacity: item.level <= estimatedTrl ? 1 : 0.3,
              }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
          <span>TRL 1</span>
          <span>TRL 5</span>
          <span>TRL 9</span>
        </div>
      </div>

      {/* TRL Stage Description */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center text-[10px] sm:text-xs">
        <div
          className={`p-2 rounded-lg ${
            estimatedTrl <= 3
              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-semibold"
              : "bg-muted/50 text-foreground/60"
          }`}
        >
          <p className="font-semibold">{stages[0]?.name || "기초연구"}</p>
          <p>{stages[0]?.range || "TRL 1-3"}</p>
        </div>
        <div
          className={`p-2 rounded-lg ${
            estimatedTrl >= 4 && estimatedTrl <= 6
              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-semibold"
              : "bg-muted/50 text-foreground/60"
          }`}
        >
          <p className="font-semibold">{stages[1]?.name || "개발/실증"}</p>
          <p>{stages[1]?.range || "TRL 4-6"}</p>
        </div>
        <div
          className={`p-2 rounded-lg ${
            estimatedTrl >= 7
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold"
              : "bg-muted/50 text-foreground/60"
          }`}
        >
          <p className="font-semibold">{stages[2]?.name || "상용화"}</p>
          <p>{stages[2]?.range || "TRL 7-9"}</p>
        </div>
      </div>
    </div>
  );
}
