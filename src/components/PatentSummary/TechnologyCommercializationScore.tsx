import { Loader2 } from "lucide-react";
import { TrlChart } from "./TrlChart";
import { ScoreRadarChart } from "./ScoreRadarChart";

export interface CommercializationDetails {
  technologyScore: number;
  marketScore: number;
  businessScore: number;
  analysis: string;
  trl?: number;
  trlReason?: string;
}

interface TechnologyCommercializationScoreProps {
  score: number | null;
  isLoading: boolean;
  details?: CommercializationDetails | null;
  showTrlOnly?: boolean;
}

function getScoreColor(value: number): string {
  if (value >= 80) return "text-accent";
  if (value >= 60) return "text-blue-400";
  if (value >= 40) return "text-amber-400";
  return "text-red-400";
}

function getScoreBgColor(value: number): string {
  if (value >= 80) return "bg-accent";
  if (value >= 60) return "bg-blue-400";
  if (value >= 40) return "bg-amber-400";
  return "bg-red-400";
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

function getGradeIcon(value: number): string {
  if (value >= 90) return "🏆";
  if (value >= 80) return "🥇";
  if (value >= 70) return "🥈";
  if (value >= 60) return "🥉";
  if (value >= 50) return "📊";
  return "⚠️";
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
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="absolute inset-0 animate-ping">
              <Loader2 className="w-12 h-12 text-primary/30" />
            </div>
          </div>
          <div className="text-center">
            <span className="text-foreground font-medium block">AI가 기술사업화점수를 분석 중...</span>
            <span className="text-sm text-muted-foreground">기술성, 시장성, 사업성을 평가하고 있습니다</span>
          </div>
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
      <div className="mt-6 glass-effect rounded-3xl p-6 md:p-8 animate-slide-in" style={{ animationDelay: '0.12s' }}>
        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-border/50">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center text-xl">
            📊
          </div>
          <div>
            <h4 className="font-bold text-lg text-foreground">기술성숙도 (TRL)</h4>
            <p className="text-sm text-muted-foreground">Technology Readiness Level</p>
          </div>
        </div>
        
        <TrlChart estimatedTrl={details.trl} />
        
        {details.trlReason && (
          <div className="mt-5 p-4 rounded-xl bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20">
            <div className="flex items-start gap-3">
              <div className="text-xl">💡</div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">TRL 추정 근거</p>
                <p className="text-sm text-foreground/80 leading-relaxed">{details.trlReason}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show commercialization score section (without TRL)
  return (
    <div className="mb-6 glass-effect rounded-3xl p-6 md:p-8 animate-slide-in">
      <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border/50">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl">
          ✨
        </div>
        <div>
          <h4 className="font-bold text-lg text-foreground">AI 기술사업화점수</h4>
          <p className="text-sm text-muted-foreground">Technology Commercialization Score</p>
        </div>
      </div>

      {/* Score Display with Grade Badge */}
      <div className="flex flex-col md:flex-row items-center gap-6 mb-6">
        {/* Main Score Circle */}
        <div className="relative">
          <div className="w-32 h-32 rounded-full border-8 border-secondary flex items-center justify-center relative overflow-hidden">
            <div 
              className={`absolute inset-0 ${getScoreBgColor(score)} opacity-20`}
              style={{
                clipPath: `polygon(0 ${100 - score}%, 100% ${100 - score}%, 100% 100%, 0 100%)`
              }}
            />
            <div className="text-center z-10">
              <span className={`text-4xl font-black ${getScoreColor(score)}`}>
                {score}
              </span>
              <span className="text-muted-foreground text-sm block">/ 100</span>
            </div>
          </div>
          {/* Grade Badge */}
          <div 
            className={`absolute -top-2 -right-2 w-12 h-12 rounded-full ${getScoreBgColor(score)} flex items-center justify-center shadow-lg`}
          >
            <span className="text-xl">{getGradeIcon(score)}</span>
          </div>
        </div>

        {/* Grade Info */}
        <div className="flex flex-col items-center md:items-start gap-2">
          <div className="flex items-center gap-3">
            <span className={`text-5xl font-black ${getScoreColor(score)}`}>
              {getGradeLabel(score)}
            </span>
            <span className={`text-xl font-semibold ${getScoreColor(score)}`}>
              등급
            </span>
          </div>
          <span className={`text-lg font-medium ${getScoreColor(score)}`}>
            {getScoreLabel(score)}
          </span>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            AI 종합 평가 결과
          </div>
        </div>
      </div>

      {/* Progress Bar with Markers */}
      <div className="relative mb-8">
        <div className="w-full h-5 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full ${getScoreBgColor(score)} transition-all duration-700 ease-out relative`}
            style={{ width: `${score}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </div>
        </div>
        {/* Score Markers */}
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>0</span>
          <span className="text-red-400">40</span>
          <span className="text-amber-400">60</span>
          <span className="text-blue-400">80</span>
          <span className="text-accent">100</span>
        </div>
      </div>

      {/* Radar Chart for Sub-scores */}
      <div className="mb-6">
        <h5 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <span>📈</span> 세부 점수 분석
        </h5>
        <ScoreRadarChart
          technologyScore={details.technologyScore}
          marketScore={details.marketScore}
          businessScore={details.businessScore}
        />
      </div>

      {/* Analysis */}
      {details.analysis && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-secondary/50 to-secondary/30 border border-border/50">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🤖</div>
            <div>
              <p className="text-sm text-muted-foreground mb-2 font-medium">AI 분석 의견</p>
              <p className="text-foreground/80 leading-relaxed">{details.analysis}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
