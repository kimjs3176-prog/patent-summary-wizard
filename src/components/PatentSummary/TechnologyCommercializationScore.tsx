import { Loader2 } from "lucide-react";
import { TrlChart } from "./TrlChart";
import { ScoreBarChart } from "./ScoreBarChart";
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
  { stroke: 'hsl(217 91% 60%)', bg: 'hsl(217 91% 60% / 0.08)', icon: '🔬' },
  { stroke: 'hsl(160 84% 39%)', bg: 'hsl(160 84% 39% / 0.08)', icon: '📈' },
  { stroke: 'hsl(25 90% 55%)', bg: 'hsl(25 90% 55% / 0.08)', icon: '💼' },
];

function MiniGauge({ score, color }: { score: number; color: string }) {
  const r = 18;
  const sw = 3.5;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
      <circle cx="24" cy="24" r={r} fill="none" stroke="hsl(220 14% 96%)" strokeWidth={sw} />
      <circle
        cx="24" cy="24" r={r} fill="none"
        stroke={color} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

function SubScoreCard({ label, score, reason, colorIndex }: { label: string; score: number; reason?: string; colorIndex: number }) {
  const c = SUB_COLORS[colorIndex] || SUB_COLORS[0];
  return (
    <div
      className="p-3 sm:p-4 rounded-xl border border-border/40 transition-shadow hover:shadow-sm"
      style={{ background: c.bg }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{c.icon}</span>
        <p className="text-xs text-muted-foreground font-semibold">{label}</p>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="relative">
          <MiniGauge score={score} color={c.stroke} />
          <span
            className="absolute inset-0 flex items-center justify-center text-[11px] font-bold rotate-0"
            style={{ color: c.stroke }}
          >
            {score}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
      {reason && (
        <p className="text-[11px] text-foreground/65 leading-relaxed line-clamp-4">
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

  // Show commercialization score section
  return (
    <div className="mb-6 glass-effect rounded-3xl p-4 sm:p-6 md:p-8 animate-slide-in border-t-[3px]" style={{ borderTopColor: 'hsl(25 90% 55%)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 sm:mb-6 pb-4 sm:pb-5 border-b border-border/50">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-lg sm:text-xl" style={{ background: 'linear-gradient(135deg, hsl(25 90% 55%), hsl(35 85% 50%))', color: 'white' }}>
          ✨
        </div>
        <div>
          <h4 className="font-bold text-base sm:text-lg" style={{ color: 'hsl(25 70% 35%)' }}>{scoreConfig.cardTitle}</h4>
          <p className="text-xs sm:text-sm text-muted-foreground">{scoreConfig.cardSubtitle}</p>
        </div>
      </div>

      {/* Infographic: Gauge + Radar side by side */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 mb-6 py-2">
        <CircularGauge
          score={score}
          grade={getGradeLabel(score, scoreConfig.grades)}
          label={getScoreLabel(score, scoreConfig.grades)}
        />
        <div className="hidden sm:block w-px h-40 bg-border/50" />
        <ScoreRadarChart
          technologyScore={details.technologyScore}
          marketScore={details.marketScore}
          businessScore={details.businessScore}
          labels={scoreConfig.subLabels}
        />
      </div>

      {/* Sub-scores with mini gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
        {subItems.map((item, idx) => (
          <SubScoreCard key={item.label} label={item.label} score={item.score} reason={item.reason} colorIndex={idx} />
        ))}
      </div>

      {/* Analysis */}
      {details.analysis && (
        <div className="p-3 sm:p-4 rounded-2xl bg-secondary/30 border border-border/50">
          <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
            <span className="text-xs">🤖</span>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">AI 분석 의견</p>
          </div>
          <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">{details.analysis}</p>
        </div>
      )}
    </div>
  );
}
