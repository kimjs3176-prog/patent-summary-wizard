import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

interface ScoreRadarChartProps {
  technologyScore: number;
  marketScore: number;
  businessScore: number;
  labels: {
    technology: string;
    market: string;
    business: string;
  };
}

export function ScoreRadarChart({ technologyScore, marketScore, businessScore, labels }: ScoreRadarChartProps) {
  const data = [
    { subject: labels.technology, value: technologyScore, fullMark: 100 },
    { subject: labels.market, value: marketScore, fullMark: 100 },
    { subject: labels.business, value: businessScore, fullMark: 100 },
  ];

  return (
    <div className="w-full flex justify-center">
      <div className="w-[220px] h-[180px] sm:w-[260px] sm:h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              strokeOpacity={0.5}
            />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              tickCount={5}
              axisLine={false}
            />
            <Radar
              name="점수"
              dataKey="value"
              stroke="hsl(25 90% 55%)"
              fill="hsl(25 90% 55%)"
              fillOpacity={0.2}
              strokeWidth={2}
              dot={{
                r: 4,
                fill: 'hsl(25 90% 55%)',
                stroke: 'white',
                strokeWidth: 2,
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
