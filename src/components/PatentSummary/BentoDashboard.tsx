import { Layers, Building2, Calendar, Hash, FileText, Tag, Loader2 } from "lucide-react";
import { CircularGauge } from "./CircularGauge";
import { useCountUp } from "@/hooks/useCountUp";
import type { PatentData } from "./types";
import type { CommercializationDetails } from "./TechnologyCommercializationScore";

interface BentoDashboardProps {
  patentData: PatentData;
  score: number | null;
  details: CommercializationDetails | null;
  isAnalyzing: boolean;
  /** Optional: clickable keywords */
  keywords?: string[];
  onKeywordClick?: (keyword: string) => void;
}

function getGrade(value: number): string {
  if (value >= 85) return "S";
  if (value >= 75) return "A";
  if (value >= 65) return "B";
  return "C";
}

function getGradeLabel(value: number): string {
  if (value >= 85) return "최우수";
  if (value >= 75) return "우수";
  if (value >= 65) return "양호";
  return "보통";
}

function getTrlPhase(trl: number): { label: string; color: string } {
  if (trl <= 3) return { label: "기초연구", color: "hsl(0 70% 55%)" };
  if (trl <= 6) return { label: "개발·실증", color: "hsl(38 92% 50%)" };
  return { label: "상용화 단계", color: "hsl(160 70% 42%)" };
}

function SubScoreMini({ label, value, accent }: { label: string; value: number; accent: string }) {
  const animated = useCountUp(value, 900);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-muted-foreground/80 font-semibold tracking-wide">{label}</span>
        <span className="text-[13px] font-extrabold tabular-nums" style={{ color: accent }}>
          {Math.round(animated)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${animated}%`, background: accent }}
        />
      </div>
    </div>
  );
}

function BentoCard({
  className = "",
  children,
  delay = 0,
}: {
  className?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border/30 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-border/60 hover:shadow-[0_10px_30px_-12px_hsl(var(--foreground)/0.18)] animate-fade-up ${className}`}
      style={{
        boxShadow: "0 1px 3px hsl(var(--foreground) / 0.04)",
        animationDelay: `${delay}ms`,
        animationFillMode: "both",
      }}
    >
      {children}
    </div>
  );
}

export function BentoDashboard({
  patentData,
  score,
  details,
  isAnalyzing,
  keywords = [],
  onKeywordClick,
}: BentoDashboardProps) {
  const trl = details?.trl ?? null;
  const animatedTrl = useCountUp(trl ?? 0, 900);
  const trlPhase = trl != null ? getTrlPhase(trl) : null;

  return (
    <div className="mb-5">
      {/* Bento Grid: 6-col on lg, 4-col on md, 2-col on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 md:gap-3 auto-rows-[minmax(110px,auto)]">
        {/* SCORE — hero card (2x2 on lg) */}
        <BentoCard className="col-span-2 row-span-2 md:col-span-2 lg:col-span-2 lg:row-span-2" delay={0}>
          <div className="h-0.5" style={{ background: "linear-gradient(90deg, hsl(25 90% 55% / 0.6), hsl(25 90% 55% / 0.15), transparent)" }} />
          <div className="p-4 md:p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">✨</span>
                <span className="text-[11px] font-bold text-foreground/70 tracking-wide">사업화 점수</span>
              </div>
              {score != null && (
                <span className="text-[10px] text-muted-foreground/70 font-medium">
                  {getGradeLabel(score)}
                </span>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center min-h-[140px]">
              {isAnalyzing && score == null ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-[11px] font-medium">분석 중...</span>
                </div>
              ) : score != null ? (
                <CircularGauge score={score} grade={getGrade(score)} label={getGradeLabel(score)} />
              ) : (
                <span className="text-xs text-muted-foreground">-</span>
              )}
            </div>

            {/* Sub-scores mini */}
            {details && score != null && (
              <div className="grid grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-border/30">
                <SubScoreMini label="기술" value={details.technologyScore} accent="hsl(217 91% 60%)" />
                <SubScoreMini label="시장" value={details.marketScore} accent="hsl(160 84% 39%)" />
                <SubScoreMini label="사업" value={details.businessScore} accent="hsl(25 90% 55%)" />
              </div>
            )}
          </div>
        </BentoCard>

        {/* TRL — wide card (2x1) */}
        <BentoCard className="col-span-2 md:col-span-2 lg:col-span-2" delay={60}>
          <div className="h-0.5" style={{ background: "linear-gradient(90deg, hsl(160 70% 45% / 0.6), hsl(160 70% 45% / 0.15), transparent)" }} />
          <div className="p-4 md:p-5 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-bold text-foreground/70 tracking-wide">기술 성숙도 TRL</span>
              </div>
              {trl != null && trlPhase && (
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white"
                  style={{ background: trlPhase.color }}
                >
                  {trlPhase.label}
                </span>
              )}
            </div>

            {trl != null ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl md:text-4xl font-black tabular-nums tracking-tight text-foreground">
                    {Math.round(animatedTrl)}
                  </span>
                  <span className="text-xs text-muted-foreground/60 font-semibold">/ 9 단계</span>
                </div>
                {/* TRL stepper */}
                <div className="mt-3 flex gap-1">
                  {Array.from({ length: 9 }).map((_, i) => {
                    const filled = i < Math.round(animatedTrl);
                    const phaseColor = i < 3 ? "hsl(0 70% 55%)" : i < 6 ? "hsl(38 92% 50%)" : "hsl(160 70% 42%)";
                    return (
                      <div
                        key={i}
                        className="flex-1 h-1.5 rounded-full transition-all duration-700"
                        style={{
                          background: filled ? phaseColor : "hsl(var(--muted))",
                          opacity: filled ? 1 : 0.4,
                        }}
                      />
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-xs">-</span>}
              </div>
            )}
          </div>
        </BentoCard>

        {/* Applicant */}
        <BentoCard className="col-span-1 md:col-span-1 lg:col-span-2" delay={120}>
          <div className="p-4 h-full flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-2">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold text-foreground/60 tracking-wide uppercase">출원인</span>
            </div>
            <div>
              <p className="text-sm md:text-[15px] font-bold text-foreground leading-snug line-clamp-2">
                {patentData.assignee || "-"}
              </p>
              {patentData.inventors && patentData.inventors.length > 0 && (
                <p className="text-[10px] text-muted-foreground/80 mt-1.5 truncate">
                  발명자 {patentData.inventors.length}명
                </p>
              )}
            </div>
          </div>
        </BentoCard>

        {/* Filing Date */}
        <BentoCard className="col-span-1" delay={180}>
          <div className="p-4 h-full flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold text-foreground/60 tracking-wide uppercase">출원일</span>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {patentData.filingDate || "-"}
              </p>
              {patentData.publicationDate && (
                <p className="text-[10px] text-muted-foreground/80 mt-1">
                  {patentData.registrationNumber ? "등록" : "공개"} {patentData.publicationDate}
                </p>
              )}
            </div>
          </div>
        </BentoCard>

        {/* IPC */}
        <BentoCard className="col-span-1 md:col-span-2 lg:col-span-2" delay={240}>
          <div className="p-4 h-full flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-2">
              <Hash className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold text-foreground/60 tracking-wide uppercase">IPC 분류</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {patentData.classifications && patentData.classifications.length > 0 ? (
                patentData.classifications.slice(0, 4).map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary"
                  >
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">-</span>
              )}
              {patentData.classifications && patentData.classifications.length > 4 && (
                <span className="text-[10px] text-muted-foreground self-center">
                  +{patentData.classifications.length - 4}
                </span>
              )}
            </div>
          </div>
        </BentoCard>

        {/* Patent Number */}
        <BentoCard className="col-span-2 md:col-span-2 lg:col-span-3" delay={300}>
          <div className="p-4 h-full flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold text-foreground/60 tracking-wide uppercase">
                  {patentData.registrationNumber ? "등록번호" : "출원번호"}
                </span>
              </div>
              <p className="text-sm md:text-[15px] font-bold text-foreground tabular-nums truncate">
                {patentData.displayNumber || patentData.registrationNumber || patentData.applicationNumber || patentData.patentNumber}
              </p>
            </div>
          </div>
        </BentoCard>

        {/* Keywords (only when extracted) */}
        {keywords.length > 0 && (
          <BentoCard className="col-span-2 md:col-span-4 lg:col-span-3" delay={360}>
            <div className="p-4 h-full">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-bold text-foreground/60 tracking-wide uppercase">핵심 키워드</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {keywords.slice(0, 8).map((kw, i) => (
                  <button
                    key={i}
                    onClick={() => onKeywordClick?.(kw)}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted/60 text-foreground/80 hover:bg-primary/10 hover:text-primary transition-all hover:scale-105"
                    title={`"${kw}" 관련 특허 검색`}
                  >
                    #{kw}
                  </button>
                ))}
              </div>
            </div>
          </BentoCard>
        )}
      </div>
    </div>
  );
}
