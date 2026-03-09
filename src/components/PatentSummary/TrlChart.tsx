import { useState, useRef } from "react";
import { DEFAULT_TRL_CONFIG, type TrlConfig } from "@/components/admin/ScoreTrlSettings";
import { Beaker, Cog, Rocket } from "lucide-react";

interface TrlChartProps {
  estimatedTrl: number;
  trlConfig?: TrlConfig;
}

function getStageColor(level: number): { text: string; glow: string } {
  if (level <= 3) return { text: "text-red-600 dark:text-red-400", glow: "shadow-red-500/20" };
  if (level <= 6) return { text: "text-amber-600 dark:text-amber-400", glow: "shadow-amber-500/20" };
  return { text: "text-emerald-600 dark:text-emerald-400", glow: "shadow-emerald-500/20" };
}

function getTrlStage(level: number, stages: TrlConfig["stages"]): string {
  if (level <= 3) return `${stages[0]?.name || "기초연구"} 단계`;
  if (level <= 6) return `${stages[1]?.name || "개발/실증"} 단계`;
  return `${stages[2]?.name || "상용화"} 준비 단계`;
}

const stageIcons = [Beaker, Cog, Rocket];

export function TrlChart({ estimatedTrl, trlConfig }: TrlChartProps) {
  const config = trlConfig || DEFAULT_TRL_CONFIG;
  const levels = config.levels;
  const stages = config.stages;
  const currentTrlInfo = levels.find((t) => t.level === estimatedTrl);
  const colors = getStageColor(estimatedTrl);
  const progress = (estimatedTrl / 9) * 100;
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-6">
      {/* TRL Level Display - Enhanced with glossy effect */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Glossy TRL Badge */}
          <div className="relative">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-xl ${colors.glow}`}
              style={{
                background: `linear-gradient(135deg, hsl(${120 + (estimatedTrl - 1) * 5}, 65%, ${60 - estimatedTrl * 2}%), hsl(${130 + (estimatedTrl - 1) * 5}, 75%, ${50 - estimatedTrl * 2}%))`,
              }}
            >
              {/* Glossy overlay */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/40 via-white/10 to-transparent" />
              <span className="relative z-10">{estimatedTrl}</span>
            </div>
            {/* Ambient glow */}
            <div 
              className="absolute -inset-1 rounded-2xl opacity-40 blur-lg -z-10"
              style={{
                background: `linear-gradient(135deg, hsl(${120 + (estimatedTrl - 1) * 5}, 70%, 50%), hsl(${130 + (estimatedTrl - 1) * 5}, 80%, 45%))`,
              }}
            />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground tracking-tight">
              TRL {estimatedTrl}
            </p>
            <p className="text-sm font-medium text-foreground/80">
              {currentTrlInfo?.label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {getTrlStage(estimatedTrl, stages)}
            </p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="inline-flex flex-col items-end px-3 py-2 rounded-xl bg-secondary/50 backdrop-blur-sm">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">상용화까지</p>
            <p className={`text-xl font-black ${colors.text}`}>
              {9 - estimatedTrl}<span className="text-sm font-medium ml-0.5">단계</span>
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Gradient Progress Bar */}
      <div className="relative px-1">
        {/* Background track */}
        <div className="h-4 rounded-full bg-gradient-to-r from-muted/60 via-muted/40 to-muted/60 overflow-hidden shadow-inner">
          {/* Progress fill with glossy effect */}
          <div
            className="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #f87171 0%, #facc15 35%, #4ade80 65%, #10b981 100%)",
            }}
          >
            {/* Glossy shine */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-white/20 to-transparent" />
            {/* Animated shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
          </div>
        </div>

        {/* Level markers with cursor-following tooltip */}
        <div 
          ref={containerRef}
          className="relative mt-3 flex justify-between trl-level-markers"
          onMouseMove={(e) => {
            if (containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }
          }}
        >
          {levels.map((item) => {
            const isActive = item.level <= estimatedTrl;
            const isCurrent = item.level === estimatedTrl;
            const isHovered = hoveredLevel === item.level;

            return (
              <div
                key={item.level}
                className="relative flex flex-col items-center cursor-pointer group"
                style={{ width: `${100 / 9}%` }}
                onMouseEnter={() => setHoveredLevel(item.level)}
                onMouseLeave={() => setHoveredLevel(null)}
              >
                {/* Marker dot */}
                <div className="relative">
                  <div
                    className={`rounded-full transition-all duration-300 ${
                      isCurrent
                        ? "w-4 h-4 bg-gradient-to-br from-emerald-400 to-emerald-600 ring-[3px] ring-emerald-400/30 ring-offset-2 ring-offset-background shadow-lg shadow-emerald-500/30"
                        : isActive
                          ? `w-2.5 h-2.5 bg-foreground/50 ${isHovered ? 'scale-125' : ''}`
                          : `w-2 h-2 bg-muted-foreground/25 ${isHovered ? 'scale-125 bg-muted-foreground/40' : ''}`
                    }`}
                  />
                  {isCurrent && (
                    <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-30" />
                  )}
                </div>
                {/* Level number */}
                <span
                  className={`text-[10px] mt-2 transition-all duration-200 ${
                    isCurrent
                      ? `font-bold ${colors.text}`
                      : isActive
                        ? "text-muted-foreground font-semibold"
                        : "text-muted-foreground/40"
                  } ${isHovered && !isCurrent ? 'text-foreground scale-110' : ''}`}
                >
                  {item.level}
                </span>
              </div>
            );
          })}

          {/* Cursor-following tooltip */}
          {hoveredLevel !== null && containerRef.current && (
            <div
              className="fixed z-50 pointer-events-none"
              style={{
                left: containerRef.current.getBoundingClientRect().left + mousePos.x,
                top: containerRef.current.getBoundingClientRect().top + mousePos.y - 12,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className="bg-popover/95 backdrop-blur-md text-popover-foreground border border-border/50 shadow-xl rounded-xl px-3.5 py-2.5 text-[11px] whitespace-nowrap">
                <p className="font-bold text-sm">{levels.find(l => l.level === hoveredLevel)?.label}</p>
                <p className="text-muted-foreground mt-1 max-w-[200px] text-wrap">{levels.find(l => l.level === hoveredLevel)?.description}</p>
                {hoveredLevel === estimatedTrl && (
                  <p className="text-emerald-500 font-semibold mt-1.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    현재 단계
                  </p>
                )}
              </div>
              <div className="w-2.5 h-2.5 bg-popover/95 border-r border-b border-border/50 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1" />
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
