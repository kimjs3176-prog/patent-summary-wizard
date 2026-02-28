import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
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

      {/* TRL Area Chart */}
      <div className="h-32 sm:h-40 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="trlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="level"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(_value: number, _name: string, props: any) => {
                const item = levels[props.payload.level - 1];
                return [item?.description || "", `TRL ${props.payload.level}`];
              }}
              labelFormatter={(label) => {
                const item = levels[Number(label) - 1];
                return item?.label || "";
              }}
            />
            <ReferenceLine
              x={estimatedTrl}
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              strokeDasharray="5 5"
            />
            <Area
              type="stepAfter"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#trlGradient)"
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
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
