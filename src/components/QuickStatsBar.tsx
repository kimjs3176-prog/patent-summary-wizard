import { Award, Layers, Building2, Calendar } from "lucide-react";
import { PatentData } from "@/components/PatentSummary/types";
import { CommercializationDetails } from "@/components/PatentSummary/TechnologyCommercializationScore";

interface QuickStatsBarProps {
  patentData: PatentData | null;
  score: number | null;
  details: CommercializationDetails | null;
}

export function QuickStatsBar({ patentData, score, details }: QuickStatsBarProps) {
  if (!patentData) return null;

  const stats = [
    {
      icon: Award,
      label: "사업화 점수",
      value: score != null ? `${score}점` : "분석 중...",
      color: score != null
        ? score >= 80 ? "hsl(152 76% 36%)" : score >= 65 ? "hsl(45 93% 47%)" : "hsl(0 84% 60%)"
        : "hsl(var(--muted-foreground))",
    },
    {
      icon: Layers,
      label: "TRL",
      value: details?.trl != null ? `Lv.${details.trl}` : "-",
      color: "hsl(210 100% 50%)",
    },
    {
      icon: Building2,
      label: "출원인",
      value: patentData.assignee || "-",
      color: "hsl(var(--foreground))",
      truncate: true,
    },
    {
      icon: Calendar,
      label: "출원일",
      value: patentData.filingDate || "-",
      color: "hsl(var(--foreground))",
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto mb-6 animate-fade-up">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/30 bg-card/60 backdrop-blur-sm"
            style={{ boxShadow: 'var(--shadow-glossy)' }}
          >
            <stat.icon className="w-4 h-4 shrink-0" style={{ color: stat.color }} />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-medium">{stat.label}</p>
              <p className={`text-sm font-bold ${stat.truncate ? 'truncate' : ''}`} style={{ color: stat.color }}>
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
