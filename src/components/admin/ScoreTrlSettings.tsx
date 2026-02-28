import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

export interface ScoreConfig {
  cardTitle: string;
  cardSubtitle: string;
  subLabels: { technology: string; market: string; business: string };
  weights: { technology: number; market: number; business: number };
  grades: { min: number; grade: string; label: string }[];
}

export interface TrlConfig {
  cardTitle: string;
  cardSubtitle: string;
  levels: { level: number; label: string; description: string }[];
  stages: { name: string; range: string }[];
}

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  cardTitle: "AI 기술사업화점수",
  cardSubtitle: "Technology Commercialization Score",
  subLabels: { technology: "기술성", market: "시장성", business: "사업성" },
  weights: { technology: 35, market: 35, business: 30 },
  grades: [
    { min: 90, grade: "S", label: "매우 우수" },
    { min: 80, grade: "A", label: "우수" },
    { min: 70, grade: "B", label: "양호" },
    { min: 60, grade: "C", label: "보통" },
    { min: 50, grade: "D", label: "미흡" },
    { min: 0, grade: "F", label: "개선 필요" },
  ],
};

export const DEFAULT_TRL_CONFIG: TrlConfig = {
  cardTitle: "기술성숙도 (TRL)",
  cardSubtitle: "Technology Readiness Level",
  levels: [
    { level: 1, label: "기초연구", description: "기본 원리 관찰 및 보고" },
    { level: 2, label: "기술개념", description: "기술 개념 및 응용 정립" },
    { level: 3, label: "개념검증", description: "핵심 기능의 분석적/실험적 증명" },
    { level: 4, label: "실험실검증", description: "실험실 환경에서 기술 검증" },
    { level: 5, label: "유사환경검증", description: "유사 환경에서 기술 검증" },
    { level: 6, label: "시제품개발", description: "시제품의 유사 환경 시연" },
    { level: 7, label: "운영환경시연", description: "실제 운영 환경에서 시연" },
    { level: 8, label: "시스템완성", description: "시스템 완성 및 검증" },
    { level: 9, label: "상용화", description: "실제 운영 환경에서 성공적 검증" },
  ],
  stages: [
    { name: "기초연구", range: "TRL 1-3" },
    { name: "개발/실증", range: "TRL 4-6" },
    { name: "상용화", range: "TRL 7-9" },
  ],
};

interface ScoreTrlSettingsProps {
  scoreConfig: ScoreConfig;
  trlConfig: TrlConfig;
  onScoreConfigChange: (config: ScoreConfig) => void;
  onTrlConfigChange: (config: TrlConfig) => void;
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 bg-secondary/20 hover:bg-secondary/40 transition-colors text-left"
      >
        <span className="font-semibold text-sm">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

export function ScoreTrlSettings({ scoreConfig, trlConfig, onScoreConfigChange, onTrlConfigChange }: ScoreTrlSettingsProps) {
  const totalWeight = scoreConfig.weights.technology + scoreConfig.weights.market + scoreConfig.weights.business;

  return (
    <div className="space-y-4">
      {/* ===== Score Settings ===== */}
      <CollapsibleSection title="📊 기술사업화점수 설정">
        {/* Card Title */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">카드 제목</label>
          <Input
            value={scoreConfig.cardTitle}
            onChange={e => onScoreConfigChange({ ...scoreConfig, cardTitle: e.target.value })}
            placeholder="AI 기술사업화점수"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">카드 부제목</label>
          <Input
            value={scoreConfig.cardSubtitle}
            onChange={e => onScoreConfigChange({ ...scoreConfig, cardSubtitle: e.target.value })}
            placeholder="Technology Commercialization Score"
          />
        </div>

        {/* Sub Labels */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">항목명 수정</label>
          <div className="grid grid-cols-3 gap-2">
            {(["technology", "market", "business"] as const).map(key => (
              <div key={key}>
                <Input
                  value={scoreConfig.subLabels[key]}
                  onChange={e => onScoreConfigChange({
                    ...scoreConfig,
                    subLabels: { ...scoreConfig.subLabels, [key]: e.target.value }
                  })}
                  className="text-center"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Weights */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-muted-foreground">항목 비중 (%)</label>
            <span className={`text-xs font-mono ${totalWeight === 100 ? "text-emerald-500" : "text-destructive"}`}>
              합계: {totalWeight}%
            </span>
          </div>
          {(["technology", "market", "business"] as const).map(key => (
            <div key={key} className="flex items-center gap-3 mb-2">
              <span className="text-xs w-16 flex-shrink-0">{scoreConfig.subLabels[key]}</span>
              <Slider
                value={[scoreConfig.weights[key]]}
                onValueChange={([v]) => onScoreConfigChange({
                  ...scoreConfig,
                  weights: { ...scoreConfig.weights, [key]: v }
                })}
                min={0}
                max={100}
                step={5}
                className="flex-1"
              />
              <span className="text-xs font-mono w-10 text-right">{scoreConfig.weights[key]}%</span>
            </div>
          ))}
          {totalWeight !== 100 && (
            <p className="text-[10px] text-destructive mt-1">⚠️ 비중 합계가 100%가 되어야 합니다</p>
          )}
        </div>

        {/* Grades */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">등급 기준</label>
          <div className="space-y-2">
            {scoreConfig.grades.map((g, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="number"
                  value={g.min}
                  onChange={e => {
                    const next = [...scoreConfig.grades];
                    next[idx] = { ...next[idx], min: parseInt(e.target.value) || 0 };
                    onScoreConfigChange({ ...scoreConfig, grades: next });
                  }}
                  className="w-16 text-center"
                  min={0}
                  max={100}
                />
                <span className="text-[10px] text-muted-foreground">점 이상</span>
                <Input
                  value={g.grade}
                  onChange={e => {
                    const next = [...scoreConfig.grades];
                    next[idx] = { ...next[idx], grade: e.target.value };
                    onScoreConfigChange({ ...scoreConfig, grades: next });
                  }}
                  className="w-16 text-center font-bold"
                />
                <Input
                  value={g.label}
                  onChange={e => {
                    const next = [...scoreConfig.grades];
                    next[idx] = { ...next[idx], label: e.target.value };
                    onScoreConfigChange({ ...scoreConfig, grades: next });
                  }}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onScoreConfigChange(DEFAULT_SCORE_CONFIG)}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> 기본값 복원
          </Button>
        </div>
      </CollapsibleSection>

      {/* ===== TRL Settings ===== */}
      <CollapsibleSection title="📈 기술성숙도(TRL) 설정">
        {/* Card Title */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">카드 제목</label>
          <Input
            value={trlConfig.cardTitle}
            onChange={e => onTrlConfigChange({ ...trlConfig, cardTitle: e.target.value })}
            placeholder="기술성숙도 (TRL)"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">카드 부제목</label>
          <Input
            value={trlConfig.cardSubtitle}
            onChange={e => onTrlConfigChange({ ...trlConfig, cardSubtitle: e.target.value })}
            placeholder="Technology Readiness Level"
          />
        </div>

        {/* TRL Level Labels */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">TRL 단계별 라벨 · 설명</label>
          <div className="space-y-2">
            {trlConfig.levels.map((lvl, idx) => (
              <div key={lvl.level} className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground w-10 flex-shrink-0 text-center">
                  TRL{lvl.level}
                </span>
                <Input
                  value={lvl.label}
                  onChange={e => {
                    const next = [...trlConfig.levels];
                    next[idx] = { ...next[idx], label: e.target.value };
                    onTrlConfigChange({ ...trlConfig, levels: next });
                  }}
                  className="w-24"
                  placeholder="라벨"
                />
                <Input
                  value={lvl.description}
                  onChange={e => {
                    const next = [...trlConfig.levels];
                    next[idx] = { ...next[idx], description: e.target.value };
                    onTrlConfigChange({ ...trlConfig, levels: next });
                  }}
                  className="flex-1"
                  placeholder="설명"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Stage Group Names */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">단계 그룹명</label>
          <div className="grid grid-cols-3 gap-2">
            {trlConfig.stages.map((stage, idx) => (
              <div key={idx} className="text-center">
                <Input
                  value={stage.name}
                  onChange={e => {
                    const next = [...trlConfig.stages];
                    next[idx] = { ...next[idx], name: e.target.value };
                    onTrlConfigChange({ ...trlConfig, stages: next });
                  }}
                  className="text-center mb-1"
                />
                <span className="text-[10px] text-muted-foreground">{stage.range}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onTrlConfigChange(DEFAULT_TRL_CONFIG)}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> 기본값 복원
          </Button>
        </div>
      </CollapsibleSection>

      <p className="text-[10px] text-muted-foreground">
        ⚠️ 비중/등급 변경 후 기존 점수 캐시를 삭제해야 새 설정으로 재계산됩니다
      </p>
    </div>
  );
}
