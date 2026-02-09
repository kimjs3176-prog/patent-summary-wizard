import { useMemo } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface ScoreRadarChartProps {
  technologyScore: number;
  marketScore: number;
  businessScore: number;
}

export function ScoreRadarChart({
  technologyScore,
  marketScore,
  businessScore,
}: ScoreRadarChartProps) {
  const data = useMemo(() => [
    {
      subject: "기술성",
      value: technologyScore,
      fullMark: 100,
      icon: "🔬",
      description: "기술 혁신성 및 구현 가능성",
    },
    {
      subject: "시장성",
      value: marketScore,
      fullMark: 100,
      icon: "📈",
      description: "시장 수요 및 성장 잠재력",
    },
    {
      subject: "사업성",
      value: businessScore,
      fullMark: 100,
      icon: "💼",
      description: "수익화 및 사업화 가능성",
    },
  ], [technologyScore, marketScore, businessScore]);

  const average = Math.round((technologyScore + marketScore + businessScore) / 3);

  return (
    <div className="space-y-4">
      <div className="h-48 md:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <defs>
              <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <PolarGrid 
              stroke="hsl(var(--border))" 
              strokeOpacity={0.5}
            />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ 
                fill: "hsl(var(--foreground))", 
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ 
                fill: "hsl(var(--muted-foreground))", 
                fontSize: 10 
              }}
              tickCount={5}
              axisLine={false}
            />
            <Radar
              name="점수"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#radarGradient)"
              animationDuration={1000}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "12px",
                fontSize: "12px",
                padding: "8px 12px",
              }}
              formatter={(value: number, name: string, props: any) => {
                return [`${value}점`, props.payload.subject];
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Score Legend with Icons */}
      <div className="grid grid-cols-3 gap-3">
        {data.map((item) => (
          <div
            key={item.subject}
            className="text-center p-3 rounded-xl bg-gradient-to-br from-secondary/50 to-secondary/30 border border-border/50"
          >
            <div className="text-2xl mb-1">{item.icon}</div>
            <p className="text-xs text-muted-foreground font-medium">{item.subject}</p>
            <p className="text-lg font-bold text-foreground">{item.value}점</p>
          </div>
        ))}
      </div>

      {/* Average Score Badge */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
          <span className="text-sm text-muted-foreground">평균 점수</span>
          <span className="text-lg font-bold text-primary">{average}점</span>
        </div>
      </div>
    </div>
  );
}
