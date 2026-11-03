import { sectionMeta, type MdSection } from "./helpers";
import { splitBold, splitItalic } from "@/lib/summaryMarkup";
import { parseMarketRows, splitTrustNotes, toReportParagraphs } from "@/lib/summaryReport";
import { TrustBadge } from "./TrustBadge";
import { renderBold } from "./RenderBold";


type Annotate = (text: string) => React.ReactNode;

/** 문단 한 조각: 각주 표시([^N]) → 근거 괄호(출처·AI 추정) 배지 → 볼드 → 학명 이탤릭 → 용어집 주석 */
function renderInline(p: string, key: string, annotate: Annotate): React.ReactNode[] {
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

/** 관련시장 동향 요약표: 시장 · 기준 규모 · 연평균 성장률 · 전망 · 근거 (읽는 법은 왼쪽 여백 주석에) */
export function MarketTable({ paragraphs }: { paragraphs: string[] }) {
  const rows = parseMarketRows(paragraphs);
  if (!rows.length) return null;
  return (
    <figure className="report-market">
      {/* 좁은 화면에서 가로로 넘기는 표: 키보드로도 들어가 넘길 수 있게 */}
      <div className="report-table-wrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" tabIndex={0} role="region" aria-label="시장 규모 표">
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
    </figure>
  );
}

/**
 * 요약서 본문 한 절 (데이터시트형 요약서의 오른쪽 본문 칸). 제목은 쉬운 질문 + 작은 분야 이름.
 * 생성 중에는 문장이 계속 붙으므로 원래 문단대로, 끝나면 요지(첫 문장) + 3문장 문단으로 정리한다.
 */
export function ProseSection({ sec, idx, settled, annotate }: { sec: MdSection; idx: number; settled: boolean; annotate: Annotate }) {
  const { kicker, heading } = sectionMeta(sec.title);
  const { lead, body } = settled ? toReportParagraphs(sec.paragraphs) : { lead: "", body: sec.paragraphs };
  return (
    <section id={`sec-ai-${idx}`} data-summary-section data-summary-label={heading} className="ds-text report-prose-section scroll-mt-24">
      <h2 className="ds-h">{heading}<span>{kicker}</span></h2>
      {settled && kicker === "시장 동향" && <MarketTable paragraphs={sec.paragraphs} />}
      {lead && <p className="ds-lead">{renderInline(lead, `l${idx}`, annotate)}</p>}
      {body.map((p, i) => (
        <p key={i}>{renderInline(p, `p${idx}-${i}`, annotate)}</p>
      ))}
      {sec.footnotes && sec.footnotes.length > 0 && (
        <ol className="ds-foot-notes">
          {sec.footnotes.map((fn) => (
            <li key={fn.num}><b>{fn.num}.</b> {renderBold(fn.text)}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
