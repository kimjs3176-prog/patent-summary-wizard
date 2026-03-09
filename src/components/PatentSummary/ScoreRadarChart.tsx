import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";

interface ScoreRadarChartProps {
  technologyScore: number;
  marketScore: number;
  businessScore: number;
  labels: { technology: string; market: string; business: string };
}

export function ScoreRadarChart({ technologyScore, marketScore, businessScore, labels }: ScoreRadarChartProps) {
  const data = [
    { subject: labels.technology, value: technologyScore, fullMark: 100 },
    { subject: labels.market, value: marketScore, fullMark: 100 },
    { subject: labels.business, value: businessScore, fullMark: 100 },
  ];

  return (
    <div className="w-full aspect-square max-w-[220px] mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid
            stroke="hsl(220 13% 91%)"
            strokeDasharray="3 3"
          />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: 'hsl(220 9% 46%)', fontWeight: 500 }}
          />
          <Radar
            name="점수"
            dataKey="value"
            stroke="hsl(25 90% 55%)"
            fill="hsl(25 90% 55%)"
            fillOpacity={0.15}
            strokeWidth={2}
            dot={{ r: 4, fill: 'hsl(25 90% 55%)', strokeWidth: 0 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
