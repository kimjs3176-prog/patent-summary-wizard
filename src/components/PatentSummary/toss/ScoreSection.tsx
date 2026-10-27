
import type { CommercializationDetails, useTrlConfig } from "../TechnologyCommercializationScore";

import { ACCENT_HEX } from "./helpers";
import { SectionTitle } from "./SectionTitle";
import { SoftCard } from "./SoftCard";
import { Loader2 } from "lucide-react";
import { MiniGauge } from "./MiniGauge";
import { ScoreRow } from "./ScoreRow";
import { renderBold } from "./RenderBold";

interface Props {
  scoreLoading: boolean; score: number | null; scoreSummary: string; details: CommercializationDetails | null; trlColor: string; trl: number | null; trlName: string | null; trlStage: string; trlConfig: ReturnType<typeof useTrlConfig>;
}

export function ScoreSection({ scoreLoading, score, scoreSummary, details, trlColor, trl, trlName, trlStage, trlConfig }: Props) {
  return (
    <>
          <section id="sec-score" data-summary-section data-summary-label="사업화 점수" className="report-section mb-8 scroll-mt-24">
            <SectionTitle index="02" kicker="AI 평가">사업화 점수 & 기술 성숙도</SectionTitle>
            <SoftCard>
              {/* 종합점수 헤더 */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#E5E8EB]">
                <div className="min-w-0">
                  <p className="text-[12px] text-[#8B95A1] font-semibold mb-1">종합 사업화 점수</p>
                  {scoreLoading || score == null ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: ACCENT_HEX }} />
                      <span className="text-[13px] text-[#8B95A1] font-semibold">분석 중...</span>
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#4E5968] font-medium">
                      상용화 잠재력 <span className="font-bold text-[#191F28]">{scoreSummary}</span>
                    </p>
                  )}
                </div>
                {score != null && (
                  <MiniGauge score={score} />
                )}
              </div>

              {/* 세부 점수 — 실제 요약서 화면에 반영되는 가로 하위 카드 */}
              {details && (
                <div className="flex flex-col gap-3 py-5 border-b border-[#E5E8EB]">
                  <ScoreRow label="기술성" value={details.technologyScore} color={ACCENT_HEX} reason={details.technologyReason} />
                  <ScoreRow label="시장성" value={details.marketScore} color="#3B82F6" reason={details.marketReason} />
                  <ScoreRow label="사업성" value={details.businessScore} color="#F59E0B" reason={details.businessReason} />
                </div>
              )}

              {/* TRL — 같은 카드 내 통합 */}
              {details && (
                <div className="pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] text-[#191F28] font-bold">기술 성숙도</span>
                      <span className="text-[11px] text-[#8B95A1] font-semibold">TRL</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[22px] font-black tabular-nums leading-none" style={{ color: trlColor }}>
                        {trl ?? "-"}
                      </span>
                      <span className="text-[#8B95A1] text-[11px] font-semibold">/ 9</span>
                      {trlName && (
                        <span className="text-[12px] font-bold leading-none" style={{ color: trlColor }}>
                          · {trlName}
                        </span>
                      )}
                      <span
                        className="pdf-shape-center ml-1 min-h-6 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
                        style={{ background: trlColor }}
                      >
                        {trlStage}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {Array.from({ length: 9 }).map((_, i) => {
                      const lvl = i + 1;
                      const active = trl != null && lvl <= trl;
                      const isCurrent = trl != null && lvl === trl;
                      const c = lvl <= 3 ? "#EF4444" : lvl <= 6 ? "#F59E0B" : ACCENT_HEX;
                      const lvlInfo = trlConfig.levels[i];
                      const lvlLabel = lvlInfo?.label;
                      return (
                        <div key={i} className="flex-1 min-w-0 flex flex-col items-center gap-1" title={`TRL ${lvl} — ${lvlLabel}\n${lvlInfo?.description}\n예: ${lvlInfo?.example ?? ""}`}>
                          <div
                            className="pdf-shape-center w-full h-7 rounded-[6px] flex items-center justify-center text-[11px] font-bold tabular-nums transition-all"
                            style={{
                              background: active ? c : "#F1F3F5",
                              color: active ? "#FFFFFF" : "#B0B8C1",
                              boxShadow: isCurrent ? `0 0 0 2px #FFFFFF, 0 0 0 3px ${c}` : "none",
                            }}
                          >
                            {lvl}
                          </div>
                          {lvlLabel && (
                            <span
                              className={`w-full min-h-8 text-center text-[9px] leading-4 break-keep ${isCurrent ? "font-bold text-foreground" : active ? "font-semibold text-muted-foreground" : "font-medium text-muted-foreground/60"}`}
                            >
                              {lvlLabel}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 text-[10.5px] text-[#8B95A1] font-semibold">
                    <span>1–3 · 기초 연구</span>
                    <span>4–6 · 개발/실증</span>
                    <span>7–9 · 상용화</span>
                  </div>
                  {details.trlReason && (
                    <p className="mt-4 text-[13px] leading-[1.75] text-[#4E5968] bg-[#F9FAFB] rounded-[12px] px-4 py-3">
                      {renderBold(details.trlReason)}
                    </p>
                  )}
                </div>
              )}
            </SoftCard>
          </section>
    </>
  );
}
