import { Award, Layers, Building2, Calendar, TrendingUp } from "lucide-react";
import { PatentData } from "@/components/PatentSummary/types";
import { CommercializationDetails } from "@/components/PatentSummary/TechnologyCommercializationScore";
import { useCountUp } from "@/hooks/useCountUp";

interface QuickStatsBarProps {
  patentData: PatentData | null;
  score: number | null;
  details: CommercializationDetails | null;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "hsl(152 76% 36%)";
  if (score >= 65) return "hsl(45 93% 47%)";
  return "hsl(0 84% 60%)";
}

function getScoreGrade(score: number): string {
  if (score >= 85) return "S";
  if (score >= 75) return "A";
  if (score >= 65) return "B";
  return "C";
}

function getTrlLabel(trl: number): string {
  if (trl <= 3) return "기초연구";
  if (trl <= 6) return "개발/실증";
  return "상용화";
}

export function QuickStatsBar({ patentData, score, details }: QuickStatsBarProps) {
  const animatedScore = useCountUp(score ?? 0, 1100);
  const animatedTrl = useCountUp(details?.trl ?? 0, 900);
  if (!patentData) return null;

  return (
    <div className="w-full max-w-4xl mx-auto mb-5 animate-fade-up">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {/* Score Card */}
        <div className="group relative overflow-hidden rounded-2xl border border-border/30 bg-card p-3 md:p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-border/60 hover:shadow-[0_8px_24px_-12px_hsl(var(--foreground)/0.15)]" style={{ boxShadow: '0 1px 3px hsl(var(--foreground) / 0.03)' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] md:text-[11px] text-muted-foreground/70 font-medium mb-1">사업화 점수</p>
              {score != null ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl md:text-3xl font-black tabular-nums tracking-tight" style={{ color: getScoreColor(score) }}>
                    {Math.round(animatedScore)}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 font-medium">/100</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span className="text-xs text-muted-foreground">분석 중</span>
                </div>
              )}
            </div>
            {score != null && (
              <div
                className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-white"
                style={{ background: getScoreColor(score) }}
              >
                {getScoreGrade(score)}
              </div>
            )}
          </div>
          {/* Mini bar */}
          {score != null && (
            <div className="mt-2.5 h-1.5 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${score}%`, background: getScoreColor(score) }}
              />
            </div>
          )}
        </div>

        {/* TRL Card */}
        <div className="group relative overflow-hidden rounded-2xl border border-border/30 bg-card p-3 md:p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-border/60 hover:shadow-[0_8px_24px_-12px_hsl(var(--foreground)/0.15)]" style={{ boxShadow: '0 1px 3px hsl(var(--foreground) / 0.03)' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] md:text-[11px] text-muted-foreground/70 font-medium mb-1">기술 성숙도</p>
              {details?.trl != null ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl md:text-3xl font-black tabular-nums tracking-tight text-foreground">
                    {Math.round(animatedTrl)}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 font-medium">/9</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">-</span>
              )}
            </div>
            <Layers className="w-4 h-4 text-muted-foreground/30" />
          </div>
          {details?.trl != null && (
            <p className="text-[10px] md:text-[11px] text-muted-foreground mt-1.5 font-medium">
              TRL {details.trl} · {getTrlLabel(details.trl)}
            </p>
          )}
        </div>

        {/* Applicant Card */}
        <div className="group relative overflow-hidden rounded-2xl border border-border/30 bg-card p-3 md:p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-border/60 hover:shadow-[0_8px_24px_-12px_hsl(var(--foreground)/0.15)]" style={{ boxShadow: '0 1px 3px hsl(var(--foreground) / 0.03)' }}>
          <div>
            <p className="text-[10px] md:text-[11px] text-muted-foreground/70 font-medium mb-1">출원인</p>
            <p className="text-sm md:text-[15px] font-bold text-foreground truncate leading-snug">
              {patentData.assignee || "-"}
            </p>
          </div>
          {patentData.inventors && patentData.inventors.length > 0 && (
            <p className="text-[10px] md:text-[11px] text-muted-foreground mt-1.5 truncate">
              발명자 {patentData.inventors.length}명
            </p>
          )}
        </div>

        {/* Date Card */}
        <div className="group relative overflow-hidden rounded-2xl border border-border/30 bg-card p-3 md:p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-border/60 hover:shadow-[0_8px_24px_-12px_hsl(var(--foreground)/0.15)]" style={{ boxShadow: '0 1px 3px hsl(var(--foreground) / 0.03)' }}>
          <div>
            <p className="text-[10px] md:text-[11px] text-muted-foreground/70 font-medium mb-1">출원일</p>
            <p className="text-sm md:text-[15px] font-bold text-foreground leading-snug">
              {patentData.filingDate || "-"}
            </p>
          </div>
          {patentData.publicationDate && (
            <p className="text-[10px] md:text-[11px] text-muted-foreground mt-1.5">
              {patentData.registrationNumber ? '등록' : '공개'} {patentData.publicationDate}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
