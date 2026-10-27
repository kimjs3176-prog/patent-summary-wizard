


import { sectionMeta, type MdSection } from "./helpers";
import { SectionTitle } from "./SectionTitle";

import { Loader2 } from "lucide-react";

interface Props {
  isStreaming: boolean; sections: MdSection[]; annotate: (text: string) => React.ReactNode;
}

export function AiSummarySections({ isStreaming, sections, annotate }: Props) {
  return (
    <>
          {isStreaming && sections.length === 0 ? (
            <section className="mb-10">
              <div className="flex items-center gap-2 text-[#8B95A1]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[14px]">AI가 요약서를 생성 중입니다...</span>
              </div>
            </section>
          ) : (
            sections.map((sec, idx) => {
              const { kicker, heading } = sectionMeta(sec.title);
              return (
                <section key={idx} id={`sec-ai-${idx}`} data-summary-section data-summary-label={heading} className="report-section report-prose-section mb-8 scroll-mt-24">
                  <SectionTitle index={String(idx + 4).padStart(2, "0")} kicker={kicker}>{heading}</SectionTitle>
                  <div className="space-y-4">
                    {sec.paragraphs.map((p, i) => {
                      // 1) [^N] 인라인 마커를 먼저 분리하여 superscript 노드로 변환
                      const refParts = p.split(/(\[\^\d+\])/g);
                      const processed: React.ReactNode[] = [];
                      refParts.forEach((part, j) => {
                        const m = part.match(/^\[\^(\d+)\]$/);
                        if (m) {
                          processed.push(
                            <sup
                              key={`fn-${i}-${j}`}
                              className="ml-[1px] mr-[1px] text-[10px] font-bold align-super"
                              style={{ color: "#10B981" }}
                            >
                              {m[1]}
                            </sup>,
                          );
                        } else if (part) {
                          // 2) 볼드(**...**) → 학명 이탤릭(*...*) 순서로 분리.
                          //    볼드 밖 텍스트는 용어집 주석까지 적용.
                          const boldParts = part.split(/(\*\*[^*\n]+?\*\*)/g);
                          boldParts.forEach((bp, bi) => {
                            if (!bp) return;
                            const bm = bp.match(/^\*\*([^*\n]+?)\*\*$/);
                            if (bm) {
                              // 볼드 내부: 이탤릭만 렌더링 (용어집은 성능/노이즈 회피)
                              const inner = bm[1];
                              const italicInside = inner.split(/(\*[A-Za-z][A-Za-z0-9 .\-]{1,60}\*)/g);
                              processed.push(
                                <strong
                                  key={`b-${i}-${j}-${bi}`}
                                  className="font-bold text-[#191F28]"
                                >
                                  {italicInside.map((ip, ii) => {
                                    const im = ip.match(/^\*([A-Za-z][A-Za-z0-9 .\-]{1,60})\*$/);
                                    if (im) return <em key={ii} className="italic">{im[1]}</em>;
                                    return <span key={ii}>{ip}</span>;
                                  })}
                                </strong>,
                              );
                              return;
                            }
                            // 볼드 바깥: 학명 이탤릭 → 나머지에 용어집 주석
                            const italicParts = bp.split(/(\*[A-Za-z][A-Za-z0-9 .\-]{1,60}\*)/g);
                            italicParts.forEach((ip, k) => {
                              if (!ip) return;
                              const im = ip.match(/^\*([A-Za-z][A-Za-z0-9 .\-]{1,60})\*$/);
                              if (im) {
                                processed.push(
                                  <em
                                    key={`it-${i}-${j}-${bi}-${k}`}
                                    className="italic"
                                    style={{ fontStyle: "italic" }}
                                  >
                                    {im[1]}
                                  </em>,
                                );
                              } else {
                                const annotated = annotate(ip);
                                const nodes = Array.isArray(annotated) ? annotated : [annotated];
                                processed.push(...(nodes as React.ReactNode[]));
                              }
                            });
                          });
                        }
                      });
                      return (
                        <p
                          key={i}
                          className={
                            i === 0
                              ? "text-[16px] leading-[1.8] text-[#191F28] font-medium"
                              : "text-[15.5px] leading-[1.8] text-[#333D4B]"
                          }
                        >
                          {processed}
                        </p>
                      );
                    })}
                  </div>
                  {/* 출처 (각주) — 시장동향 등 출처가 있는 섹션 */}
                  {sec.footnotes && sec.footnotes.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-[#E5E8EB]">
                      <p className="text-[12px] font-bold text-[#8B95A1] mb-2">출처</p>
                      <ol className="space-y-1.5">
                        {sec.footnotes.map((fn) => (
                          <li
                            key={fn.num}
                            className="text-[12.5px] leading-[1.6] text-[#4E5968] flex gap-1.5"
                          >
                            <span className="font-bold tabular-nums shrink-0" style={{ color: "#10B981" }}>
                              {fn.num}.
                            </span>
                            <span>{fn.text}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </section>
              );
            })
          )}
    </>
  );
}
