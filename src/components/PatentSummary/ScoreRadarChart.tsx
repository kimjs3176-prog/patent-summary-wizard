import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

interface ScoreRadarChartProps {
  technologyScore: number;
  marketScore: number;
  businessScore: number;
  labels: { technology: string; market: string; business: string };
}

const COLORS = {
  technology: { stroke: 'hsl(217 91% 60%)', fill: 'hsl(217 91% 60%)' },
  market: { stroke: 'hsl(160 84% 39%)', fill: 'hsl(160 84% 39%)' },
  business: { stroke: 'hsl(25 90% 55%)', fill: 'hsl(25 90% 55%)' },
};

function CustomTick({ payload, x, y, textAnchor }: any) {
  const key = payload.value;
  const colorMap: Record<string, string> = {};
  // Use foreground color for all labels
  return (
    <text
      x={x} y={y}
      textAnchor={textAnchor}
      fontSize={12}
      fontWeight={600}
      fill="hsl(222 47% 11%)"
      dominantBaseline="central"
    >
      {key}
    </text>
  );
}

export function ScoreRadarChart({ technologyScore, marketScore, businessScore, labels }: ScoreRadarChartProps) {
  const data = [
    { subject: labels.technology, value: technologyScore, fullMark: 100, color: COLORS.technology.stroke },
    { subject: labels.market, value: marketScore, fullMark: 100, color: COLORS.market.stroke },
    { subject: labels.business, value: businessScore, fullMark: 100, color: COLORS.business.stroke },
  ];

  return (
    <div className="w-full aspect-square max-w-[240px] mx-auto relative">
      {/* Score labels around chart */}
      <div className="absolute inset-0 flex items-start justify-center z-10 pointer-events-none">
        <div className="mt-1 flex flex-col items-center">
          <span className="text-lg font-bold" style={{ color: COLORS.technology.stroke }}>{technologyScore}</span>
        </div>
      </div>
      <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
        <span className="text-lg font-bold" style={{ color: COLORS.business.stroke }}>{businessScore}</span>
      </div>
      <div className="absolute bottom-2 right-2 z-10 pointer-events-none">
        <span className="text-lg font-bold" style={{ color: COLORS.market.stroke }}>{marketScore}</span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
          <defs>
            <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(25 90% 55%)" stopOpacity={0.25} />
              <stop offset="50%" stopColor="hsl(217 91% 60%)" stopOpacity={0.15} />
              <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <PolarGrid
            stroke="hsl(220 13% 91%)"
            strokeWidth={0.8}
            gridType="polygon"
          />
          <PolarAngleAxis
            dataKey="subject"
            tick={<CustomTick />}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="점수"
            dataKey="value"
            stroke="hsl(25 85% 50%)"
            fill="url(#radarFill)"
            strokeWidth={2.5}
            dot={(props: any) => {
              const { cx, cy, index } = props;
              const dotColors = [COLORS.technology.stroke, COLORS.market.stroke, COLORS.business.stroke];
              return (
                <g key={index}>
                  <circle cx={cx} cy={cy} r={6} fill="white" stroke={dotColors[index]} strokeWidth={2.5} />
                  <circle cx={cx} cy={cy} r={2.5} fill={dotColors[index]} />
                </g>
              );
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
