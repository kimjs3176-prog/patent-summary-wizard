import { DEFAULT_TRL_CONFIG, type TrlConfig } from "@/components/admin/ScoreTrlSettings";

interface TrlChartProps {
  estimatedTrl: number;
  trlConfig?: TrlConfig;
}

function getStageColor(level: number): { bg: string; text: string; glow: string } {
  if (level <= 3) return { 
    bg: "bg-red-500", 
    text: "text-red-600 dark:text-red-400",
    glow: "shadow-red-500/30"
  };
  if (level <= 6) return { 
    bg: "bg-amber-500", 
    text: "text-amber-600 dark:text-amber-400",
    glow: "shadow-amber-500/30"
  };
  return { 
    bg: "bg-emerald-500", 
    text: "text-emerald-600 dark:text-emerald-400",
    glow: "shadow-emerald-500/30"
  };
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
  const currentTrlInfo = levels.find((t) => t.level === estimatedTrl);
  const colors = getStageColor(estimatedTrl);
  const progress = (estimatedTrl / 9) * 100;

  return (
    <div className="space-y-5">
      {/* TRL Level Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg ${colors.bg} ${colors.glow}`}
          >
            {estimatedTrl}
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">
              TRL {estimatedTrl} - {currentTrlInfo?.label}
            </p>
            <p className="text-sm text-muted-foreground">
              {getTrlStage(estimatedTrl, stages)}
            </p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-muted-foreground">상용화까지</p>
          <p className={`text-lg font-bold ${colors.text}`}>
            {9 - estimatedTrl} 단계
          </p>
        </div>
      </div>

      {/* Continuous Progress Bar */}
      <div className="relative">
        <div className="h-3 rounded-full bg-muted/40 overflow-hidden backdrop-blur-sm">
          <div
            className={`h-full rounded-full ${colors.bg} transition-all duration-700 ease-out relative overflow-hidden`}
            style={{ width: `${progress}%` }}
          >
            {/* Glossy shine effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
          </div>
        </div>

        {/* Level markers */}
        <div className="relative mt-2 flex justify-between px-0">
          {levels.map((item) => {
            const isActive = item.level <= estimatedTrl;
            const isCurrent = item.level === estimatedTrl;
            return (
              <div key={item.level} className="flex flex-col items-center" style={{ width: `${100/9}%` }}>
                <div
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                    isCurrent
                      ? `${colors.bg} ring-2 ring-offset-1 ring-offset-background ring-current scale-150`
                      : isActive
                        ? `${colors.bg} opacity-60`
                        : "bg-muted-foreground/20"
                  }`}
                />
                <span
                  className={`text-[9px] mt-1 transition-all ${
                    isCurrent
                      ? `font-bold ${colors.text}`
                      : isActive
                        ? "text-muted-foreground font-medium"
                        : "text-muted-foreground/40"
                  }`}
                >
                  {item.level}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* TRL Stage Cards */}
      <div className="grid grid-cols-3 gap-2 text-center text-[10px] sm:text-xs">
        {[
          { idx: 0, check: estimatedTrl <= 3, activeBg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50", activeText: "text-red-700 dark:text-red-300" },
          { idx: 1, check: estimatedTrl >= 4 && estimatedTrl <= 6, activeBg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50", activeText: "text-amber-700 dark:text-amber-300" },
          { idx: 2, check: estimatedTrl >= 7, activeBg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50", activeText: "text-emerald-700 dark:text-emerald-300" },
        ].map(({ idx, check, activeBg, activeText }) => (
          <div
            key={idx}
            className={`p-2.5 rounded-xl border transition-all duration-300 ${
              check
                ? `${activeBg} ${activeText} shadow-sm`
                : "bg-muted/30 border-transparent text-muted-foreground/60"
            }`}
          >
            <p className="font-semibold">{stages[idx]?.name || ["기초연구", "개발/실증", "상용화"][idx]}</p>
            <p className="opacity-70">{stages[idx]?.range || ["TRL 1-3", "TRL 4-6", "TRL 7-9"][idx]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
