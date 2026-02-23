import { useState } from "react";
import { Loader2 } from "lucide-react";
import { TrlChart } from "./TrlChart";

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

function getScoreLabel(value: number): string {
  if (value >= 90) return "매우 우수";
  if (value >= 80) return "우수";
  if (value >= 70) return "양호";
  if (value >= 60) return "보통";
  if (value >= 50) return "미흡";
  return "개선 필요";
}

function getGradeLabel(value: number): string {
  if (value >= 90) return "S";
  if (value >= 80) return "A";
  if (value >= 70) return "B";
  if (value >= 60) return "C";
  if (value >= 50) return "D";
  return "F";
}

function SubScoreCard({ label, score, reason }: { label: string; score: number; reason?: string }) {
  const [showReason, setShowReason] = useState(false);

  return (
    <div
      className="relative p-3 sm:p-4 rounded-2xl bg-secondary/30 border border-border/50 cursor-pointer transition-all hover:bg-secondary/50"
      onMouseEnter={() => setShowReason(true)}
      onMouseLeave={() => setShowReason(false)}
      onTouchStart={() => setShowReason((v) => !v)}
    >
      <p className="text-[10px] sm:text-xs text-muted-foreground mb-1.5 sm:mb-2 font-medium">{label}</p>
      <div className="flex items-end gap-1">
        <span className={`text-xl sm:text-2xl font-bold ${getScoreColor(score)}`}>
          {score}
        </span>
        <span className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">점</span>
      </div>
      <div className="w-full h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden mt-1.5 sm:mt-2">
        <div
          className={`h-full ${getScoreBgColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      {reason && (
        <div className={`mt-2 text-[11px] sm:text-xs text-foreground/70 leading-relaxed transition-all ${showReason ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 overflow-hidden sm:max-h-0 sm:opacity-0'}`}>
          {reason}
        </div>
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
      <div className="mt-6 glass-effect rounded-3xl p-6 md:p-8 animate-slide-in trl-print-section" style={{ animationDelay: '0.12s' }}>
        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-border/50">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-primary flex items-center justify-center text-xl">
            📊
          </div>
          <div>
            <h4 className="font-bold text-lg text-foreground">기술성숙도 (TRL)</h4>
            <p className="text-sm text-muted-foreground">Technology Readiness Level</p>
          </div>
        </div>
        
        <TrlChart estimatedTrl={details.trl} />
        
        {details.trlReason && (
          <div className="mt-4 p-4 rounded-xl bg-secondary/50 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1 font-medium">TRL 추정 근거</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{details.trlReason}</p>
          </div>
        )}
      </div>
    );
  }

  // Show commercialization score section (without TRL)
  return (
    <div className="mb-6 glass-effect rounded-3xl p-4 sm:p-6 md:p-8 animate-slide-in">
      <div className="flex items-center gap-3 mb-4 sm:mb-6 pb-4 sm:pb-5 border-b border-border/50">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-lg sm:text-xl">
          ✨
        </div>
        <div>
          <h4 className="font-bold text-base sm:text-lg text-foreground">AI 기술사업화점수</h4>
          <p className="text-xs sm:text-sm text-muted-foreground">Technology Commercialization Score</p>
        </div>
      </div>

      {/* Main Score */}
      <div className="flex items-center gap-4 sm:gap-6 mb-4 sm:mb-6">
        <div className="flex items-end gap-1.5 sm:gap-2">
          <span className={`text-4xl sm:text-6xl font-black ${getScoreColor(score)}`}>
            {score}
          </span>
          <span className="text-muted-foreground text-base sm:text-xl mb-1 sm:mb-2">/ 100</span>
        </div>
        <div className="flex flex-col gap-0.5 sm:gap-1">
          <span className={`text-2xl sm:text-3xl font-black ${getScoreColor(score)}`}>
            {getGradeLabel(score)}
          </span>
          <span className={`text-sm sm:text-base font-semibold ${getScoreColor(score)}`}>
            {getScoreLabel(score)}
          </span>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-5">
        {[
          { label: "기술성", score: details.technologyScore, reason: details.technologyReason },
          { label: "시장성", score: details.marketScore, reason: details.marketReason },
          { label: "사업성", score: details.businessScore, reason: details.businessReason },
        ].map((item) => (
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
