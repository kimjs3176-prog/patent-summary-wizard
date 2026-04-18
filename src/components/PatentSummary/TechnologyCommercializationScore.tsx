import { Loader2 } from "lucide-react";
import { TrlChart } from "./TrlChart";
import { ScoreBarChart } from "./ScoreBarChart";
import { CircularGauge } from "./CircularGauge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { DEFAULT_SCORE_CONFIG, DEFAULT_TRL_CONFIG, type ScoreConfig, type TrlConfig } from "@/components/admin/ScoreTrlSettings";
import { useMemo } from "react";

export interface CommercializationDetails {
  technologyScore: number;
  marketScore: number;
  businessScore: number;
  analysis: string;
  trl?: number;
  trlReason?: string;
  technologyReason?: string;
  marketReason?: string;
  businessReason?: string;
}

interface TechnologyCommercializationScoreProps {
  score: number | null;
  isLoading: boolean;
  details?: CommercializationDetails | null;
}

function useScoreConfig(): ScoreConfig {
  const { settings } = useSiteSettings();
  return useMemo(() => {
    if (settings.score_settings) {
      try { return { ...DEFAULT_SCORE_CONFIG, ...JSON.parse(settings.score_settings) }; } catch {}
    }
    return DEFAULT_SCORE_CONFIG;
  }, [settings.score_settings]);
}

function useTrlConfig(): TrlConfig {
  const { settings } = useSiteSettings();
  return useMemo(() => {
    if (settings.trl_settings) {
      try { return { ...DEFAULT_TRL_CONFIG, ...JSON.parse(settings.trl_settings) }; } catch {}
    }
    return DEFAULT_TRL_CONFIG;
  }, [settings.trl_settings]);
}

function getScoreLabel(value: number, grades: ScoreConfig["grades"]): string {
  const sorted = [...grades].sort((a, b) => b.min - a.min);
  for (const g of sorted) {
    if (value >= g.min) return g.label;
  }
  return sorted[sorted.length - 1]?.label || "";
}

function getGradeLabel(value: number, grades: ScoreConfig["grades"]): string {
  const sorted = [...grades].sort((a, b) => b.min - a.min);
  for (const g of sorted) {
    if (value >= g.min) return g.grade;
  }
  return sorted[sorted.length - 1]?.grade || "";
}

const SUB_COLORS = [
  { stroke: 'hsl(217 91% 60%)', bg: 'hsl(217 91% 97%)', border: 'hsl(217 91% 90%)', icon: '🔬' },
  { stroke: 'hsl(160 84% 39%)', bg: 'hsl(160 84% 97%)', border: 'hsl(160 84% 90%)', icon: '📈' },
  { stroke: 'hsl(25 90% 55%)', bg: 'hsl(25 90% 97%)', border: 'hsl(25 90% 90%)', icon: '💼' },
];

function renderBoldText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-foreground/85">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function SubScoreCard({ label, score, reason, colorIndex }: { label: string; score: number; reason?: string; colorIndex: number }) {
  const c = SUB_COLORS[colorIndex] || SUB_COLORS[0];
  if (!reason) return null;
  return (
    <div
      className="p-3 sm:p-3.5 rounded-xl"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{c.icon}</span>
          <p className="text-[11px] sm:text-xs font-bold text-foreground/75">{label}</p>
        </div>
        <span
          className="text-xs font-extrabold tabular-nums"
          style={{ color: c.stroke }}
        >
          {score}점
        </span>
      </div>
      <p className="text-[12px] sm:text-[13px] text-foreground/60 leading-[1.75]">
        {renderBoldText(reason)}
      </p>
    </div>
  );
}

export function TechnologyCommercializationScore({ 
  score, 
  isLoading, 
  details,
}: TechnologyCommercializationScoreProps) {
  const scoreConfig = useScoreConfig();
  const trlConfig = useTrlConfig();

  if (isLoading) {
    return (
      <div className="mb-5 rounded-2xl border border-border/30 bg-card p-6 md:p-8">
        <div className="flex items-center justify-center gap-3 py-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground font-medium">사업화 점수 분석 중...</span>
        </div>
      </div>
    );
  }

  if (score === null || !details) {
    return null;
  }

  const subItems = [
    { label: scoreConfig.subLabels.technology, score: details.technologyScore, reason: details.technologyReason },
    { label: scoreConfig.subLabels.market, score: details.marketScore, reason: details.marketReason },
    { label: scoreConfig.subLabels.business, score: details.businessScore, reason: details.businessReason },
  ];

  // TRL helpers
  const trl = details.trl;
  const trlStageColor = trl != null
    ? (trl <= 3 ? 'hsl(0 84% 55%)' : trl <= 6 ? 'hsl(38 92% 50%)' : 'hsl(160 70% 40%)')
    : 'hsl(var(--muted-foreground))';
  const trlStageLabel = trl != null
    ? (trl <= 3 ? '기초연구' : trl <= 6 ? '개발/실증' : '상용화')
    : '-';

  return (
    <div className="mb-5 rounded-2xl border border-border/30 bg-card overflow-hidden animate-slide-in trl-print-section" style={{ boxShadow: '0 1px 3px hsl(var(--foreground) / 0.03)' }}>
      {/* Top accent — dual color (score + TRL) */}
      <div className="h-0.5" style={{ background: 'linear-gradient(90deg, hsl(25 90% 55% / 0.65), hsl(25 90% 55% / 0.25) 45%, hsl(160 70% 45% / 0.25) 55%, hsl(160 70% 45% / 0.65))' }} />

      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 flex items-center gap-2.5">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg, hsl(25 90% 55% / 0.10), hsl(160 70% 45% / 0.10))', color: 'hsl(25 80% 45%)' }}>
            ✨
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm sm:text-base text-foreground tracking-tight">AI 기술분석 점수</h4>
          <p className="text-[10px] sm:text-xs text-muted-foreground">사업화 잠재력과 기술 성숙도를 한눈에</p>
        </div>
      </div>

      <div className="mx-4 sm:mx-6 h-px bg-border/30" />

      {/* Two equal columns: Score (left) | TRL (right) */}
      <div className="px-4 sm:px-6 py-4 sm:py-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-stretch">
          {/* LEFT: Score panel */}
          <section className="flex flex-col">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-[10px]">🎯</span>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground/80 font-bold uppercase tracking-wider">{scoreConfig.cardTitle}</p>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 flex-1">
              <CircularGauge
                score={score}
                grade={getGradeLabel(score, scoreConfig.grades)}
                label={getScoreLabel(score, scoreConfig.grades)}
              />
              <div className="w-px self-stretch bg-border/20 hidden sm:block" />
              <div className="flex-1 min-w-0">
                <ScoreBarChart
                  technologyScore={details.technologyScore}
                  marketScore={details.marketScore}
                  businessScore={details.businessScore}
                  labels={scoreConfig.subLabels}
                />
              </div>
            </div>
          </section>

          {/* Vertical divider */}
          <div aria-hidden className="hidden lg:block absolute" />

          {/* RIGHT: TRL panel */}
          <section className="flex flex-col lg:border-l lg:border-border/30 lg:pl-6">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-[10px]">📊</span>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground/80 font-bold uppercase tracking-wider">{trlConfig.cardTitle}</p>
            </div>

            {trl != null ? (
              <div className="flex flex-col flex-1">
                {/* Big TRL display */}
                <div className="flex items-end justify-between gap-3 mb-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl sm:text-5xl font-black tabular-nums tracking-tight leading-none" style={{ color: trlStageColor }}>
                      {trl}
                    </span>
                    <span className="text-sm text-muted-foreground/50 font-medium">/9</span>
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white shadow-sm"
                    style={{ background: trlStageColor }}
                  >
                    {trlStageLabel}
                  </span>
                </div>

                {/* 9-segment bar */}
                <div className="flex gap-1">
                  {Array.from({ length: 9 }, (_, i) => {
                    const level = i + 1;
                    const active = level <= trl;
                    const segColor = level <= 3 ? 'hsl(0 84% 55%)' : level <= 6 ? 'hsl(38 92% 50%)' : 'hsl(160 70% 40%)';
                    return (
                      <div
                        key={level}
                        className="flex-1 h-2 rounded-sm transition-all duration-500"
                        style={{
                          background: active ? segColor : 'hsl(var(--muted) / 0.6)',
                        }}
                        title={`TRL ${level}`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-muted-foreground/50 font-medium">
                  <span>1 · 기초</span>
                  <span>5 · 실증</span>
                  <span>9 · 상용</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">TRL 데이터 없음</p>
            )}
          </section>
        </div>
      </div>

      {/* Sub-score detail cards */}
      <div className="px-4 sm:px-6 pb-3 sm:pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {subItems.map((item, idx) => (
            <SubScoreCard key={item.label} label={item.label} score={item.score} reason={item.reason} colorIndex={idx} />
          ))}
        </div>
      </div>

      {/* TRL reason — always shown */}
      {trl != null && details.trlReason && (
        <div className="px-4 sm:px-6 pb-3 sm:pb-4">
          <div
            className="p-3 sm:p-3.5 rounded-xl"
            style={{ background: 'hsl(160 70% 45% / 0.05)', border: '1px solid hsl(160 70% 45% / 0.18)' }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px]">📊</span>
              <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: 'hsl(160 70% 35%)' }}>TRL {trl} 추정 근거</p>
            </div>
            <p className="text-[12px] sm:text-[13px] text-foreground/70 leading-[1.75]">{details.trlReason}</p>
          </div>
        </div>
      )}

      {/* AI Analysis */}
      {details.analysis && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-5">
          <div className="p-3 sm:p-3.5 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px]">🤖</span>
              <p className="text-[10px] text-muted-foreground font-semibold">AI 종합 분석 의견</p>
            </div>
            <p className="text-[12px] sm:text-[13px] text-foreground/65 leading-[1.75]">{details.analysis}</p>
          </div>
        </div>
      )}
    </div>
  );
}
