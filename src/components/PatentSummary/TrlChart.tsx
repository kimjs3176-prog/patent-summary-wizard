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

interface TrlChartProps {
  estimatedTrl: number;
}

const TRL_LABELS = [
  { level: 1, label: "기초연구", description: "기본 원리 관찰 및 보고" },
  { level: 2, label: "기술개념", description: "기술 개념 및 응용 정립" },
  { level: 3, label: "개념검증", description: "핵심 기능의 분석적/실험적 증명" },
  { level: 4, label: "실험실검증", description: "실험실 환경에서 기술 검증" },
  { level: 5, label: "유사환경검증", description: "유사 환경에서 기술 검증" },
  { level: 6, label: "시제품개발", description: "시제품의 유사 환경 시연" },
  { level: 7, label: "운영환경시연", description: "실제 운영 환경에서 시연" },
  { level: 8, label: "시스템완성", description: "시스템 완성 및 검증" },
  { level: 9, label: "상용화", description: "실제 운영 환경에서 성공적 검증" },
];

function getTrlColor(level: number): string {
  if (level <= 3) return "hsl(var(--destructive))";
  if (level <= 6) return "hsl(var(--accent))";
  return "hsl(var(--primary))";
}

function getTrlStage(level: number): string {
  if (level <= 3) return "기초연구 단계";
  if (level <= 6) return "개발/실증 단계";
  return "상용화 준비 단계";
}

export function TrlChart({ estimatedTrl }: TrlChartProps) {
  const chartData = useMemo(() => {
    return TRL_LABELS.map((item) => ({
      ...item,
      value: item.level <= estimatedTrl ? item.level * 11.1 : 0,
      current: item.level === estimatedTrl,
    }));
  }, [estimatedTrl]);

  const currentTrlInfo = TRL_LABELS.find((t) => t.level === estimatedTrl);

  return (
    <div className="space-y-4">
      {/* TRL Level Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
            style={{ backgroundColor: getTrlColor(estimatedTrl) }}
          >
            {estimatedTrl}
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">
              TRL {estimatedTrl} - {currentTrlInfo?.label}
            </p>
            <p className="text-sm text-muted-foreground">
              {getTrlStage(estimatedTrl)}
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
          {TRL_LABELS.map((item) => (
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
      <div className="h-40 mt-4">
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
              formatter={(value: number, name: string, props: any) => {
                const item = TRL_LABELS[props.payload.level - 1];
                return [item?.description || "", `TRL ${props.payload.level}`];
              }}
              labelFormatter={(label) => {
                const item = TRL_LABELS[label - 1];
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
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div
          className={`p-2 rounded-lg ${
            estimatedTrl <= 3
              ? "bg-destructive/20 text-destructive"
              : "bg-muted/50 text-muted-foreground"
          }`}
        >
          <p className="font-semibold">기초연구</p>
          <p>TRL 1-3</p>
        </div>
        <div
          className={`p-2 rounded-lg ${
            estimatedTrl >= 4 && estimatedTrl <= 6
              ? "bg-accent/20 text-accent"
              : "bg-muted/50 text-muted-foreground"
          }`}
        >
          <p className="font-semibold">개발/실증</p>
          <p>TRL 4-6</p>
        </div>
        <div
          className={`p-2 rounded-lg ${
            estimatedTrl >= 7
              ? "bg-primary/20 text-primary"
              : "bg-muted/50 text-muted-foreground"
          }`}
        >
          <p className="font-semibold">상용화</p>
          <p>TRL 7-9</p>
        </div>
      </div>
    </div>
  );
}
