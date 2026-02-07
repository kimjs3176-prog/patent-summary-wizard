import { Sparkles, Loader2 } from "lucide-react";

interface TechnologyCommercializationScoreProps {
  score: number | null;
  isLoading: boolean;
  details?: {
    technologyScore: number;
    marketScore: number;
    businessScore: number;
    analysis: string;
  } | null;
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

export function TechnologyCommercializationScore({ 
  score, 
  isLoading, 
  details 
}: TechnologyCommercializationScoreProps) {
  if (isLoading) {
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

      {/* Main Score */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-end gap-2">
          <span className={`text-6xl font-black ${getScoreColor(score)}`}>
            {score}
          </span>
          <span className="text-muted-foreground text-xl mb-2">/ 100</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className={`text-3xl font-black ${getScoreColor(score)}`}>
            {getGradeLabel(score)}
          </span>
          <span className={`text-base font-semibold ${getScoreColor(score)}`}>
            {getScoreLabel(score)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-4 bg-muted rounded-full overflow-hidden mb-6">
        <div 
          className={`h-full ${getScoreBgColor(score)} transition-all duration-700 ease-out`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Sub-scores */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/50">
          <p className="text-xs text-muted-foreground mb-2 font-medium">기술성</p>
          <div className="flex items-end gap-1">
            <span className={`text-2xl font-bold ${getScoreColor(details.technologyScore)}`}>
              {details.technologyScore}
            </span>
            <span className="text-xs text-muted-foreground mb-1">점</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
            <div 
              className={`h-full ${getScoreBgColor(details.technologyScore)}`}
              style={{ width: `${details.technologyScore}%` }}
            />
          </div>
        </div>
        
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/50">
          <p className="text-xs text-muted-foreground mb-2 font-medium">시장성</p>
          <div className="flex items-end gap-1">
            <span className={`text-2xl font-bold ${getScoreColor(details.marketScore)}`}>
              {details.marketScore}
            </span>
            <span className="text-xs text-muted-foreground mb-1">점</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
            <div 
              className={`h-full ${getScoreBgColor(details.marketScore)}`}
              style={{ width: `${details.marketScore}%` }}
            />
          </div>
        </div>
        
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/50">
          <p className="text-xs text-muted-foreground mb-2 font-medium">사업성</p>
          <div className="flex items-end gap-1">
            <span className={`text-2xl font-bold ${getScoreColor(details.businessScore)}`}>
              {details.businessScore}
            </span>
            <span className="text-xs text-muted-foreground mb-1">점</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
            <div 
              className={`h-full ${getScoreBgColor(details.businessScore)}`}
              style={{ width: `${details.businessScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Analysis */}
      {details.analysis && (
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/50">
          <p className="text-xs text-muted-foreground mb-2 font-medium">AI 분석 의견</p>
          <p className="text-sm text-foreground/80 leading-relaxed">{details.analysis}</p>
        </div>
      )}
    </div>
  );
}
