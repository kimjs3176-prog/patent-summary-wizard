import { sectionMeta, type MdSection } from "./helpers";
import { SectionTitle } from "./SectionTitle";
import { splitBold, splitItalic } from "@/lib/summaryMarkup";
import { parseMarketRows, splitTrustNotes, toReportParagraphs } from "@/lib/summaryReport";
import { TrustBadge } from "./TrustBadge";

import { Loader2 } from "lucide-react";

interface Props {
  isStreaming: boolean; sections: MdSection[]; annotate: (text: string) => React.ReactNode;
}

/** 문단 한 조각: 각주 표시([^N]) → 근거 괄호(출처·AI 추정) 배지 → 볼드 → 학명 이탤릭 → 용어집 주석 */
function renderInline(p: string, key: string, annotate: Props["annotate"]): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  p.split(/(\[\^\d+\])/g).forEach((part, j) => {
    const m = part.match(/^\[\^(\d+)\]$/);
    if (m) {
      out.push(<sup key={`${key}-fn-${j}`} className="ml-[1px] mr-[1px] text-[10px] font-bold align-super" style={{ color: "#10B981" }}>{m[1]}</sup>);
      return;
    }
    if (!part) return;
    splitTrustNotes(part).forEach((tp, t) => {
      if (!("text" in tp)) {
        out.push(<TrustBadge key={`${key}-tr-${j}-${t}`} trust={tp.trust} source={tp.trust === "official" ? tp.source : undefined} converted={tp.trust === "official" ? tp.converted : undefined} />);
        return;
      }
      // 볼드 안에 학명 이탤릭이 있어도(**신규 *Leuconostoc* 균주**) 한 볼드로 묶는다. 볼드 안은 용어집을 달지 않는다(노이즈 회피)
      splitBold(tp.text).forEach((bp, bi) => {
        if (bp.bold) {
          out.push(
            <strong key={`${key}-b-${j}-${t}-${bi}`} className="font-bold text-[#191F28]">
              {splitItalic(bp.text).map((ip, ii) => (ip.italic ? <em key={ii} className="italic">{ip.text}</em> : <span key={ii}>{ip.text}</span>))}
            </strong>,
          );
          return;
        }
        splitItalic(bp.text).forEach((ip, k) => {
          if (ip.italic) { out.push(<em key={`${key}-it-${j}-${t}-${bi}-${k}`} className="italic">{ip.text}</em>); return; }
          const annotated = annotate(ip.text);
          out.push(...((Array.isArray(annotated) ? annotated : [annotated]) as React.ReactNode[]));
        });
      });
    });
  });
  return out;
}

/** 관련시장 동향 요약표: 시장 · 기준 규모 · 연평균 성장률 · 전망 · 근거 */
function MarketTable({ paragraphs }: { paragraphs: string[] }) {
  const rows = parseMarketRows(paragraphs);
  if (!rows.length) return null;
  return (
    <figure className="report-market mb-5">
      <div className="report-table-wrap">
        <table className="report-market-table">
          <caption className="sr-only">관련 시장 규모 요약</caption>
          <thead>
            <tr><th scope="col">시장</th><th scope="col">기준 규모</th><th scope="col">연평균 성장률</th><th scope="col">전망</th><th scope="col">근거</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td className="tabular-nums">{r.baseAmount ? <>{r.baseAmount}<span className="yr">{r.baseYear}년</span></> : "-"}</td>
                <td className="tabular-nums">{r.cagr ?? "-"}</td>
                <td className="tabular-nums">{r.projAmount ? <>{r.projAmount}<span className="yr">{r.projYear}년</span></> : "-"}</td>
                <td><TrustBadge trust={r.trust} source={r.source} compact /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="report-market-note">
        <b>근거 읽는 법</b> 공식 통계는 KOSIS 등 국가통계나 검증된 자료의 값이며 출처를 함께 적었습니다. AI 추정은 출처를 확인하지 못한 값이라 참고용으로만 보세요. 전망은 기준 규모에 연평균 성장률을 적용해 환산했습니다.
      </figcaption>
    </figure>
  );
}

export function AiSummarySections({ isStreaming, sections, annotate }: Props) {
  if (isStreaming && sections.length === 0) {
    return (
      <section className="mb-10">
        <div className="flex items-center gap-2 text-[#6B7684]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[14px]">AI가 요약서를 생성 중입니다...</span>
        </div>
      </section>
    );
  }
  return (
    <>
      {sections.map((sec, idx) => {
        const { kicker, heading } = sectionMeta(sec.title);
        // 생성 중에는 문장이 계속 붙으므로 원래 문단대로 보여 주고, 끝나면 요지 + 3문장 문단으로 정리한다
        const settled = !isStreaming || idx < sections.length - 1;
        const { lead, body } = settled ? toReportParagraphs(sec.paragraphs) : { lead: "", body: sec.paragraphs };
        return (
          <section key={idx} id={`sec-ai-${idx}`} data-summary-section data-summary-label={heading} className="report-section report-prose-section mb-8 scroll-mt-24">
            <SectionTitle index={String(idx + 4).padStart(2, "0")} kicker={kicker}>{heading}</SectionTitle>
            {settled && kicker === "시장 동향" && <MarketTable paragraphs={sec.paragraphs} />}
            {lead && <p className="report-lead">{renderInline(lead, `l${idx}`, annotate)}</p>}
            <div className="report-body space-y-3.5">
              {body.map((p, i) => (
                <p key={i} className="text-[15.5px] leading-[1.8] text-[#333D4B]">{renderInline(p, `p${idx}-${i}`, annotate)}</p>
              ))}
            </div>
            {/* 출처 (각주) — 시장동향 등 출처가 있는 섹션 */}
            {sec.footnotes && sec.footnotes.length > 0 && (
              <div className="mt-5 pt-4 border-t border-[#E5E8EB]">
                <p className="text-[12px] font-bold text-[#6B7684] mb-2">출처</p>
                <ol className="space-y-1.5">
                  {sec.footnotes.map((fn) => (
                    <li key={fn.num} className="text-[12.5px] leading-[1.6] text-[#4E5968] flex gap-1.5">
                      <span className="font-bold tabular-nums shrink-0" style={{ color: "#10B981" }}>{fn.num}.</span>
                      <span>{fn.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
