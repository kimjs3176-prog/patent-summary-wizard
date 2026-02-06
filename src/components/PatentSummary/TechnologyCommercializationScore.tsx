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
  if (value >= 80) return "text-green-600";
  if (value >= 60) return "text-blue-600";
  if (value >= 40) return "text-amber-600";
  return "text-red-500";
}

function getScoreBgColor(value: number): string {
  if (value >= 80) return "bg-green-500";
  if (value >= 60) return "bg-blue-500";
  if (value >= 40) return "bg-amber-500";
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
      <div className="mb-4 p-6 rounded-xl bg-card border border-border/50">
        <div className="flex items-center justify-center gap-3 py-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-muted-foreground">AI가 기술사업화점수를 분석 중...</span>
        </div>
      </div>
    );
  }

  if (score === null || !details) {
    return null;
  }

  return (
    <div className="mb-4 p-5 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h4 className="font-semibold text-foreground text-sm">AI 기술사업화점수</h4>
          <p className="text-xs text-muted-foreground">Technology Commercialization Score</p>
        </div>
      </div>

      {/* Main Score */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-end gap-2">
          <span className={`text-5xl font-bold ${getScoreColor(score)}`}>
            {score}
          </span>
          <span className="text-muted-foreground text-lg mb-2">/ 100</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
            {getGradeLabel(score)}
          </span>
          <span className={`text-sm font-medium ${getScoreColor(score)}`}>
            {getScoreLabel(score)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-5">
        <div 
          className={`h-full ${getScoreBgColor(score)} transition-all duration-700 ease-out`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Sub-scores */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-background/50 border border-border/30">
          <p className="text-xs text-muted-foreground mb-1">기술성</p>
          <div className="flex items-end gap-1">
            <span className={`text-xl font-bold ${getScoreColor(details.technologyScore)}`}>
              {details.technologyScore}
            </span>
            <span className="text-xs text-muted-foreground mb-0.5">점</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
            <div 
              className={`h-full ${getScoreBgColor(details.technologyScore)}`}
              style={{ width: `${details.technologyScore}%` }}
            />
          </div>
        </div>
        
        <div className="p-3 rounded-lg bg-background/50 border border-border/30">
          <p className="text-xs text-muted-foreground mb-1">시장성</p>
          <div className="flex items-end gap-1">
            <span className={`text-xl font-bold ${getScoreColor(details.marketScore)}`}>
              {details.marketScore}
            </span>
            <span className="text-xs text-muted-foreground mb-0.5">점</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
            <div 
              className={`h-full ${getScoreBgColor(details.marketScore)}`}
              style={{ width: `${details.marketScore}%` }}
            />
          </div>
        </div>
        
        <div className="p-3 rounded-lg bg-background/50 border border-border/30">
          <p className="text-xs text-muted-foreground mb-1">사업성</p>
          <div className="flex items-end gap-1">
            <span className={`text-xl font-bold ${getScoreColor(details.businessScore)}`}>
              {details.businessScore}
            </span>
            <span className="text-xs text-muted-foreground mb-0.5">점</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
            <div 
              className={`h-full ${getScoreBgColor(details.businessScore)}`}
              style={{ width: `${details.businessScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Analysis */}
      {details.analysis && (
        <div className="p-3 rounded-lg bg-background/30 border border-border/20">
          <p className="text-xs text-muted-foreground mb-1">AI 분석 의견</p>
          <p className="text-sm text-foreground/80 leading-relaxed">{details.analysis}</p>
        </div>
      )}
    </div>
  );
}
