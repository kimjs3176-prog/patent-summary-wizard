import { Loader2 } from "lucide-react";
import { TrlChart } from "./TrlChart";
import { ScoreRadarChart } from "./ScoreRadarChart";
import { CircularGauge } from "./CircularGauge";
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
  showTrlOnly?: boolean;
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

function getScoreColor(value: number): string {
  if (value >= 80) return "text-emerald-500";
  if (value >= 60) return "text-blue-500";
  if (value >= 40) return "text-amber-500";
  return "text-red-500";
}

function getScoreBgColor(value: number): string {
  if (value >= 80) return "bg-emerald-500";
  if (value >= 60) return "bg-blue-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-red-500";
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

function SubScoreCard({ label, score, reason }: { label: string; score: number; reason?: string }) {
  return (
    <div className="p-4 sm:p-5 rounded-xl bg-secondary/40 border border-border/40">
      <p className="text-xs text-muted-foreground mb-2 font-medium">{label}</p>
      <div className="flex items-baseline gap-0.5 mb-3">
        <span className={`text-2xl sm:text-3xl font-bold ${getScoreColor(score)}`}>
          {score}
        </span>
        <span className="text-xs text-muted-foreground">점</span>
      </div>
      <div className="w-full h-1 bg-muted/60 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full ${getScoreBgColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      {reason && (
        <p className="text-xs text-foreground/70 leading-relaxed line-clamp-5">
          {reason}
        </p>
      )}
    </div>
  );
}

export function TechnologyCommercializationScore({ 
  score, 
  isLoading, 
  details,
  showTrlOnly = false
}: TechnologyCommercializationScoreProps) {
  const scoreConfig = useScoreConfig();
  const trlConfig = useTrlConfig();

  if (isLoading && !showTrlOnly) {
    return (
      <div className="mb-6 glass-effect rounded-3xl p-8">
        <div className="flex items-center justify-center gap-3 py-6">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-muted-foreground font-medium">AI가 기술사업화점수를 분석 중...</span>
        </div>
      </div>
    );
  }

  if (score === null || !details) {
    return null;
  }

  // Show only TRL section
  if (showTrlOnly) {
    if (!details.trl) return null;
    
    return (
      <div className="mt-6 glass-effect rounded-3xl p-6 md:p-8 animate-slide-in trl-print-section border-t-[3px]" style={{ animationDelay: '0.12s', borderTopColor: 'hsl(160 70% 40%)' }}>
        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-border/50">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, hsl(160 70% 45%), hsl(170 60% 35%))', color: 'white' }}>
            📊
          </div>
          <div>
            <h4 className="font-bold text-lg" style={{ color: 'hsl(160 60% 30%)' }}>{trlConfig.cardTitle}</h4>
            <p className="text-sm text-muted-foreground">{trlConfig.cardSubtitle}</p>
          </div>
        </div>
        
        <TrlChart estimatedTrl={details.trl} trlConfig={trlConfig} />
        
        {details.trlReason && (
          <div className="mt-4 p-4 rounded-xl bg-secondary/50 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1 font-medium">TRL 추정 근거</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{details.trlReason}</p>
          </div>
        )}
      </div>
    );
  }

  const subItems = [
    { label: scoreConfig.subLabels.technology, score: details.technologyScore, reason: details.technologyReason },
    { label: scoreConfig.subLabels.market, score: details.marketScore, reason: details.marketReason },
    { label: scoreConfig.subLabels.business, score: details.businessScore, reason: details.businessReason },
  ];

  // Show commercialization score section (without TRL)
  return (
    <div className="mb-6 glass-effect rounded-3xl p-4 sm:p-6 md:p-8 animate-slide-in border-t-[3px]" style={{ borderTopColor: 'hsl(25 90% 55%)' }}>
      <div className="flex items-center gap-3 mb-4 sm:mb-6 pb-4 sm:pb-5 border-b border-border/50">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-lg sm:text-xl" style={{ background: 'linear-gradient(135deg, hsl(25 90% 55%), hsl(35 85% 50%))', color: 'white' }}>
          ✨
        </div>
        <div>
          <h4 className="font-bold text-base sm:text-lg" style={{ color: 'hsl(25 70% 35%)' }}>{scoreConfig.cardTitle}</h4>
          <p className="text-xs sm:text-sm text-muted-foreground">{scoreConfig.cardSubtitle}</p>
        </div>
      </div>

      {/* Infographic: Gauge + Radar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 mb-6">
        <CircularGauge
          score={score}
          grade={getGradeLabel(score, scoreConfig.grades)}
          label={getScoreLabel(score, scoreConfig.grades)}
        />
        <div className="flex-1 w-full">
          <ScoreRadarChart
            technologyScore={details.technologyScore}
            marketScore={details.marketScore}
            businessScore={details.businessScore}
            labels={scoreConfig.subLabels}
          />
        </div>
      </div>

      {/* Sub-scores */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-5">
        {subItems.map((item) => (
          <SubScoreCard key={item.label} label={item.label} score={item.score} reason={item.reason} />
        ))}
      </div>

      {/* Analysis */}
      {details.analysis && (
        <div className="p-3 sm:p-4 rounded-2xl bg-secondary/30 border border-border/50">
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-1.5 sm:mb-2 font-medium">AI 분석 의견</p>
          <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">{details.analysis}</p>
        </div>
      )}
    </div>
  );
}
