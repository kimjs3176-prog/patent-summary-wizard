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

function getTrlIcon(level: number): string {
  if (level <= 3) return "🔬";
  if (level <= 6) return "⚙️";
  return "🚀";
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
  const progressPercent = Math.round((estimatedTrl / 9) * 100);

  return (
    <div className="space-y-5">
      {/* TRL Level Display with Enhanced Visual */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-secondary/50 to-secondary/30 border border-border/50">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg"
            style={{ backgroundColor: getTrlColor(estimatedTrl) }}
          >
            {estimatedTrl}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getTrlIcon(estimatedTrl)}</span>
              <p className="text-xl font-bold text-foreground">
                TRL {estimatedTrl}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {currentTrlInfo?.label} · {getTrlStage(estimatedTrl)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 justify-end">
            <span className="text-3xl font-black text-primary">{progressPercent}</span>
            <span className="text-lg text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground">상용화 진행률</p>
        </div>
      </div>

      {/* TRL Progress Bar with Step Indicators */}
      <div className="relative pt-2">
        <div className="flex gap-1">
          {TRL_LABELS.map((item) => (
            <div
              key={item.level}
              className="relative flex-1 group"
            >
              <div
                className="h-4 rounded-full transition-all duration-500 cursor-pointer hover:scale-y-125"
                style={{
                  backgroundColor:
                    item.level <= estimatedTrl
                      ? getTrlColor(item.level)
                      : "hsl(var(--muted))",
                  opacity: item.level <= estimatedTrl ? 1 : 0.3,
                }}
              />
              {/* Level indicator */}
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground font-medium">
                {item.level}
              </div>
              {/* Tooltip on hover */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                <div className="bg-card border border-border px-3 py-2 rounded-lg shadow-lg text-xs whitespace-nowrap">
                  <p className="font-semibold text-foreground">{item.label}</p>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stage Labels */}
      <div className="flex justify-between text-xs text-muted-foreground pt-4">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-destructive"></span>
          기초연구 (1-3)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-accent"></span>
          개발/실증 (4-6)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary"></span>
          상용화 (7-9)
        </span>
      </div>

      {/* TRL Area Chart */}
      <div className="h-44 mt-2 p-4 rounded-2xl bg-secondary/20 border border-border/30">
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
                borderRadius: "12px",
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

      {/* Current Stage Description Card */}
      {currentTrlInfo && (
        <div className="flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
          <div className="text-3xl">{getTrlIcon(estimatedTrl)}</div>
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">
              현재 단계: {currentTrlInfo.label}
            </p>
            <p className="text-sm text-muted-foreground">
              {currentTrlInfo.description}
            </p>
            {estimatedTrl < 9 && (
              <p className="text-xs text-primary mt-2 font-medium">
                → 상용화까지 {9 - estimatedTrl}단계 남음
              </p>
            )}
          </div>
        </div>
      )}

      {/* TRL Stage Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div
          className={`p-4 rounded-xl text-center transition-all ${
            estimatedTrl <= 3
              ? "bg-destructive/20 border-2 border-destructive/50 shadow-lg shadow-destructive/20"
              : "bg-muted/30 border border-border/50"
          }`}
        >
          <div className="text-2xl mb-2">🔬</div>
          <p className={`font-bold text-sm ${estimatedTrl <= 3 ? "text-destructive" : "text-muted-foreground"}`}>
            기초연구
          </p>
          <p className="text-xs text-muted-foreground mt-1">TRL 1-3</p>
        </div>
        <div
          className={`p-4 rounded-xl text-center transition-all ${
            estimatedTrl >= 4 && estimatedTrl <= 6
              ? "bg-accent/20 border-2 border-accent/50 shadow-lg shadow-accent/20"
              : "bg-muted/30 border border-border/50"
          }`}
        >
          <div className="text-2xl mb-2">⚙️</div>
          <p className={`font-bold text-sm ${estimatedTrl >= 4 && estimatedTrl <= 6 ? "text-accent" : "text-muted-foreground"}`}>
            개발/실증
          </p>
          <p className="text-xs text-muted-foreground mt-1">TRL 4-6</p>
        </div>
        <div
          className={`p-4 rounded-xl text-center transition-all ${
            estimatedTrl >= 7
              ? "bg-primary/20 border-2 border-primary/50 shadow-lg shadow-primary/20"
              : "bg-muted/30 border border-border/50"
          }`}
        >
          <div className="text-2xl mb-2">🚀</div>
          <p className={`font-bold text-sm ${estimatedTrl >= 7 ? "text-primary" : "text-muted-foreground"}`}>
            상용화
          </p>
          <p className="text-xs text-muted-foreground mt-1">TRL 7-9</p>
        </div>
      </div>
    </div>
  );
}
