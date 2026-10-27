import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Save, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { ScoreTrlSettings, type ScoreConfig, type TrlConfig } from "@/components/admin/ScoreTrlSettings";
import type { Dispatch, SetStateAction } from "react";

interface AdminSummaryPanelProps {
  summaryTitles: Record<string, string>;
  setSummaryTitles: Dispatch<SetStateAction<Record<string, string>>>;
  summarySectionLengths: Record<string, number>;
  setSummarySectionLengths: Dispatch<SetStateAction<Record<string, number>>>;
  summaryDisclaimer: string;
  setSummaryDisclaimer: Dispatch<SetStateAction<string>>;
  summaryVisibleSections: Record<string, boolean>;
  setSummaryVisibleSections: Dispatch<SetStateAction<Record<string, boolean>>>;
  summaryAiPromptExtra: string;
  setSummaryAiPromptExtra: Dispatch<SetStateAction<string>>;
  summaryCardIcons: Record<string, string>;
  setSummaryCardIcons: Dispatch<SetStateAction<Record<string, string>>>;
  summaryInfoLabels: Record<string, string>;
  setSummaryInfoLabels: Dispatch<SetStateAction<Record<string, string>>>;
  isSavingSummarySettings: boolean;
  newSectionKey: string;
  setNewSectionKey: Dispatch<SetStateAction<string>>;
  summaryMaxTokens: number;
  setSummaryMaxTokens: Dispatch<SetStateAction<number>>;
  scoreConfig: ScoreConfig;
  setScoreConfig: Dispatch<SetStateAction<ScoreConfig>>;
  trlConfig: TrlConfig;
  setTrlConfig: Dispatch<SetStateAction<TrlConfig>>;
  handleSaveSummarySettings: () => Promise<void>;
}

export function AdminSummaryPanel({ summaryTitles, setSummaryTitles, summarySectionLengths, setSummarySectionLengths, summaryDisclaimer, setSummaryDisclaimer, summaryVisibleSections, setSummaryVisibleSections, summaryAiPromptExtra, setSummaryAiPromptExtra, summaryCardIcons, setSummaryCardIcons, summaryInfoLabels, setSummaryInfoLabels, isSavingSummarySettings, newSectionKey, setNewSectionKey, summaryMaxTokens, setSummaryMaxTokens, scoreConfig, setScoreConfig, trlConfig, setTrlConfig, handleSaveSummarySettings }: AdminSummaryPanelProps) {
  return (
          <TabsContent value="summary">
            <div className="space-y-6">
              <h2 className="font-semibold text-sm">요약서 레이아웃 · 텍스트 관리</h2>

              {/* Section Titles with Add/Delete */}
              <div>
                <h3 className="font-semibold text-sm mb-3">섹션 제목 수정 · 추가/삭제</h3>
                <p className="text-[10px] text-muted-foreground mb-3">AI 요약서의 각 섹션 제목을 변경하거나 새 섹션을 추가할 수 있습니다</p>
                <div className="space-y-2">
                  {Object.entries(summaryTitles).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-40 flex-shrink-0 truncate" title={key}>{key}</span>
                      <Input
                        value={val}
                        onChange={e => setSummaryTitles(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={key}
                        className="flex-1"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-destructive" onClick={() => {
                        setSummaryTitles(prev => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                          setSummarySectionLengths(prev => {
                            const next = { ...prev };
                            delete next[key];
                            return next;
                          });
                      }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="새 섹션 원본 제목 (예: 지식재산 전략)"
                    value={newSectionKey}
                    onChange={e => setNewSectionKey(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && newSectionKey.trim()) {
                        setSummaryTitles(prev => ({ ...prev, [newSectionKey.trim()]: newSectionKey.trim() }));
                        setSummarySectionLengths(prev => ({ ...prev, [newSectionKey.trim()]: 3 }));
                        setNewSectionKey("");
                      }
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={() => {
                    if (newSectionKey.trim()) {
                      setSummaryTitles(prev => ({ ...prev, [newSectionKey.trim()]: newSectionKey.trim() }));
                      setSummarySectionLengths(prev => ({ ...prev, [newSectionKey.trim()]: 3 }));
                      setNewSectionKey("");
                    }
                  }}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> 추가
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">왼쪽은 AI가 생성하는 원래 제목, 오른쪽은 표시할 제목입니다</p>
              </div>

              {/* Card Icons */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">카드 아이콘 (이모지)</h3>
                <div className="space-y-2">
                  {[
                    { key: "patentInfo", label: "특허 정보 카드" },
                    { key: "aiSummary", label: "AI 요약 카드" },
                    { key: "claims", label: "청구항 카드" },
                  ].map(item => (
                    <div key={item.key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-40 flex-shrink-0">{item.label}</span>
                      <Input
                        value={summaryCardIcons[item.key] || ""}
                        onChange={e => setSummaryCardIcons(prev => ({ ...prev, [item.key]: e.target.value }))}
                        placeholder="이모지 입력"
                        className="w-20"
                      />
                      <span className="text-2xl">{summaryCardIcons[item.key] || ""}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Patent Info Labels */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">특허 정보 라벨 수정</h3>
                <p className="text-[10px] text-muted-foreground mb-3">특허 정보 카드에 표시되는 라벨 텍스트를 변경합니다</p>
                <div className="space-y-2">
                  {[
                    { key: "registrationNumber", label: "등록번호" },
                    { key: "applicationNumber", label: "출원번호" },
                    { key: "assignee", label: "출원인" },
                    { key: "filingDate", label: "출원일" },
                    { key: "publicationDate", label: "등록일/공개일" },
                    { key: "ipc", label: "IPC" },
                  ].map(item => (
                    <div key={item.key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-40 flex-shrink-0">{item.label}</span>
                      <Input
                        value={summaryInfoLabels[item.key] || ""}
                        onChange={e => setSummaryInfoLabels(prev => ({ ...prev, [item.key]: e.target.value }))}
                        placeholder={item.label}
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">면책 조항 문구</h3>
                <Input
                  value={summaryDisclaimer}
                  onChange={e => setSummaryDisclaimer(e.target.value)}
                  placeholder="※ 본 분석은..."
                />
              </div>

              {/* Section Visibility */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">섹션 표시/숨김</h3>
                <div className="space-y-3">
                  {[
                    { key: "commercialization", label: "기술분석 점수", desc: "종합 점수 + TRL 통합 카드 (기술성·시장성·사업성)" },
                    { key: "claims", label: "청구항", desc: "특허 청구항 접기/펼치기 섹션" },
                    { key: "competitorComparison", label: "경쟁 특허 비교", desc: "유사 특허와의 비교 분석 표" },
                    { key: "familyTree", label: "패밀리 트리", desc: "동일 출원인의 관련 특허 네트워크" },
                  ].map(item => {
                    const isOn = summaryVisibleSections[item.key] !== false;
                    return (
                      <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30">
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                        </div>
                        <button onClick={() => setSummaryVisibleSections(prev => ({ ...prev, [item.key]: !isOn }))} className="flex-shrink-0">
                          {isOn ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary Length */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">요약 결과 분량 조절</h3>
                <p className="text-[10px] text-muted-foreground mb-3">AI 요약서의 결과 텍스트 분량을 조절합니다. 값이 클수록 더 상세한 요약이 생성됩니다.</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    {[
                      { label: "간략", value: 1500, desc: "핵심만 간략히" },
                      { label: "보통", value: 3000, desc: "기본 분량" },
                      { label: "상세", value: 5000, desc: "풍부한 분석" },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setSummaryMaxTokens(opt.value)}
                        className={`flex-1 p-3 rounded-lg border text-center transition-colors ${
                          summaryMaxTokens === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/50 bg-secondary/20 text-muted-foreground hover:bg-secondary/40"
                        }`}
                      >
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-[10px] mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <Slider
                      value={[summaryMaxTokens]}
                      onValueChange={([v]) => setSummaryMaxTokens(v)}
                      min={500}
                      max={8000}
                      step={100}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={summaryMaxTokens}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 500 && v <= 8000) setSummaryMaxTokens(v);
                      }}
                      className="w-24 text-center"
                      min={500}
                      max={8000}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">현재 설정: {summaryMaxTokens} tokens (500~8000) · ⚠️ 분량 변경 후 기존 AI 캐시를 삭제해야 새 설정이 적용됩니다</p>
                </div>
              </div>

              {/* Section Lengths */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">항목별 분량 조절</h3>
                <p className="text-[10px] text-muted-foreground mb-3">각 요약 항목의 권장 문장 수를 조절합니다. 전체 토큰 한도 안에서 우선 반영됩니다.</p>
                <div className="space-y-3">
                  {Object.entries(summaryTitles).map(([key, label]) => {
                    const value = summarySectionLengths[key] ?? 3;
                    return (
                      <div key={key} className="p-3 rounded-lg bg-secondary/20 border border-border/40">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{label || key}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{key}</p>
                          </div>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={value}
                            onChange={e => {
                              const next = parseInt(e.target.value, 10);
                              if (!isNaN(next)) setSummarySectionLengths(prev => ({ ...prev, [key]: Math.max(1, Math.min(10, next)) }));
                            }}
                            className="w-20 text-center shrink-0"
                          />
                        </div>
                        <Slider
                          value={[value]}
                          onValueChange={([next]) => setSummarySectionLengths(prev => ({ ...prev, [key]: next }))}
                          min={1}
                          max={10}
                          step={1}
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">⚠️ 항목별 분량 변경 후 기존 AI 캐시를 삭제해야 새 설정이 적용됩니다</p>
              </div>

              {/* AI 분석 모델은 가격/성능 균형이 가장 우수한 Gemini 3 Flash Preview로 고정 */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-2">AI 분석 모델</h3>
                <div className="p-3 rounded-lg border border-border/50 bg-secondary/20">
                  <p className="text-sm font-medium">Gemini 3 Flash Preview</p>
                  <p className="text-[10px] text-muted-foreground mt-1">현재 시점에서 분석 성능 대비 비용이 가장 우수한 모델로 고정 적용됩니다.</p>
                </div>
              </div>

              {/* Score & TRL Settings */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">기술사업화점수 · TRL 관리</h3>
                <ScoreTrlSettings
                  scoreConfig={scoreConfig}
                  trlConfig={trlConfig}
                  onScoreConfigChange={setScoreConfig}
                  onTrlConfigChange={setTrlConfig}
                />
              </div>

              {/* AI Prompt Extra */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">AI 요약 프롬프트 커스터마이징</h3>
                <p className="text-[10px] text-muted-foreground mb-2">기본 프롬프트에 추가할 지시사항을 입력하세요.</p>
                <Textarea
                  value={summaryAiPromptExtra}
                  onChange={e => setSummaryAiPromptExtra(e.target.value)}
                  placeholder="예: 바이오 분야 특허는 임상 단계를 포함하여 분석해 주세요."
                  rows={5}
                />
                <p className="text-[10px] text-muted-foreground mt-1.5">⚠️ 프롬프트 변경 후 기존 AI 캐시를 삭제해야 새 프롬프트가 적용됩니다</p>
              </div>

              <Button onClick={handleSaveSummarySettings} disabled={isSavingSummarySettings} className="w-full mt-4">
                {isSavingSummarySettings ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                요약서 설정 저장
              </Button>
            </div>
          </TabsContent>
  );
}
