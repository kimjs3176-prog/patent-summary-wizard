import type { PatentSummaryProps as BasePatentSummaryProps } from "../types";

import type { GovtPatentData } from "../GovtPatentInfo";
import { formatPatentNumber } from "./helpers";
import { SectionTitle } from "./SectionTitle";
import { SoftCard } from "./SoftCard";
import { Row } from "./Row";
import { PatentTimeline } from "./PatentTimeline";
import { KeywordChip, type KeywordCategory, type extractKeywordsFromPatent } from "../_keywords";

interface Props {
  patentData: BasePatentSummaryProps["patentData"]; ownerChanged: boolean; finalOwner: string | null; keywords: ReturnType<typeof extractKeywordsFromPatent>; onKeywordClick?: (keyword: string) => void; govtPatent: GovtPatentData | null;
}

export function BasicInfoSection({ patentData, ownerChanged, finalOwner, keywords, onKeywordClick, govtPatent }: Props) {
  return (
    <>
          {patentData && (
            <section id="sec-basic" data-summary-section data-summary-label="기본 정보" className="report-section mb-8 scroll-mt-24">
              <SectionTitle index="01" kicker="특허 정보">한눈에 보는 기본 정보</SectionTitle>
              <SoftCard className="!p-2">
                <div className="rounded-[4px] px-4 sm:px-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {patentData.applicationNumber && <Row label="출원번호" value={formatPatentNumber(patentData.applicationNumber, 'application')} />}
                  {patentData.filingDate && <Row label="출원일자" value={patentData.filingDate} />}
                  {patentData.registrationNumber && <Row label="등록번호" value={formatPatentNumber(patentData.registrationNumber, 'registration')} />}
                  {patentData.registrationDate
                    ? <Row label="등록일자" value={patentData.registrationDate} />
                    : (patentData.publicationDate && <Row label="공개일자" value={patentData.publicationDate} />)}
                {ownerChanged && finalOwner
                  ? <Row label="최종권리자" value={finalOwner} />
                  : (patentData.assignee && <Row label="출원인" value={patentData.assignee} />)}
                  {patentData.inventors?.length ? (
                    <Row label="발명자" value={patentData.inventors.length >= 5 ? `${patentData.inventors.slice(0, 4).join(", ")} 등 ${patentData.inventors.length}명` : patentData.inventors.join(", ")} />
                  ) : null}
                  {patentData.classifications?.length ? (
                    <Row label="IPC 분류" value={patentData.classifications.slice(0, 3).join(", ")} />
                  ) : null}
                  {/* 관련 키워드 — IPC 우측 여백 활용 */}
                  {keywords.length > 0 && (
                    <div className="py-3 border-b border-[#F2F4F6] last:border-0">
                      <p className="text-[12px] text-[#8B95A1] font-semibold mb-2">관련 키워드</p>
                      {(() => {
                        const grouped = keywords.reduce<Record<KeywordCategory, string[]>>((acc, k) => {
                          (acc[k.cat] ||= []).push(k.word);
                          return acc;
                        }, { function: [], industry: [], material: [], product: [], tech: [], general: [] });
                        const order: KeywordCategory[] = ["function", "industry", "product", "tech"];
                        const flat = order.flatMap((c) => (grouped[c] || []).map((w) => ({ c, w })));
                        return (
                          <div className="flex flex-wrap gap-1.5">
                            {flat.map(({ c, w }) => (
                              <KeywordChip key={`${c}-${w}`} category={c} onClick={() => onKeywordClick?.(w)}>{w}</KeywordChip>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
                {(patentData.filingDate || patentData.publicationDate || patentData.registrationDate || patentData.registrationNumber) && (
                  <div className="mt-2 border-t border-dashed border-[#E5E8EB]">
                    <PatentTimeline
                      filingDate={patentData.filingDate}
                      publicationDate={patentData.publicationDate}
                      registrationDate={patentData.registrationDate}
                      hasRegistration={!!(patentData.registrationDate || patentData.registrationNumber)}
                      expiryDate={govtPatent?.durationUntil}
                    />
                  </div>
                )}
                
              </SoftCard>
            </section>
          )}
    </>
  );
}
