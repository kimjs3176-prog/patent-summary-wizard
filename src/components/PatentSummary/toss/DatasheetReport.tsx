import type { PatentSummaryProps as BasePatentSummaryProps } from "../types";
import type { CommercializationDetails } from "../commercialization";
import type { GovtPatentData } from "../GovtPatentInfo";
import { RegulationAnalysis } from "../RegulationAnalysis";
import { RelatedPatentsCompact } from "../RelatedPatentsCompact";
import type { KwItem } from "../_keywords";
import { datasheetSlots } from "@/lib/datasheet";
import { formatPatentNumber, sectionMeta, type MdSection } from "./helpers";
import { ProseSection } from "./ProseSection";
import { MarketReadNote, ReportHead, ScoreStrip } from "./DatasheetNotes";
import { renderBold } from "./RenderBold";
import { Loader2 } from "lucide-react";

type PatentData = BasePatentSummaryProps["patentData"];

interface Props {
  patentData: PatentData; patentNumber: string; title: string; govtPatent: GovtPatentData | null; owner: string | null;
  keywords: KwItem[]; onKeywordClick?: (k: string) => void;
  score: number | null; scoreSummary: string; scoreLoading: boolean; details: CommercializationDetails | null;
  trl: number | null; trlName: string | null | undefined; trlStage: string;
  figureItems: { src: string; caption: string }[]; setLightboxIndex: (i: number | null) => void;
  sections: MdSection[]; isStreaming: boolean; annotate: (text: string) => React.ReactNode;
  onRelatedPatentClick: BasePatentSummaryProps["onRelatedPatentClick"];
}

/**
 * 요약서(1열 구성). 위에서 아래로 한 줄로 읽는다.
 *   1쪽: 머리(명칭·특허 기본정보·키워드) → 사업화 점수·TRL 띠 → 기술 분야 → 대표 도면 → 발명 요약 → 농산업 활용
 *   2쪽: 시장 동향(표·읽는 법) → 상용화 전망 → 예상 규제 → 비슷한 특허 → 종합 의견
 * 인쇄·PDF에서는 .ds-sheet 두 장이 A4 두 쪽이 된다(lib/datasheet 의 fitDatasheet, CI의 smoke 점검).
 */
export function DatasheetReport(p: Props) {
  const { patentData, sections, isStreaming, annotate } = p;
  const slots = datasheetSlots(sections.map((s) => sectionMeta(s.title).kicker));
  const prose = (i: number) => <ProseSection key={i} sec={sections[i]} idx={i} settled={!isStreaming || i < sections.length - 1} annotate={annotate} />;
  const at = (k: keyof typeof slots) => slots[k].map(prose);
  const kind = patentData?.searchType === "application" ? "application" : "registration";
  const fig = p.figureItems[0];

  return (
    <div className="ds">
      <section className="ds-sheet" data-sheet="1">
        <ReportHead patentData={patentData} title={p.title} govt={p.govtPatent} owner={p.owner} keywords={p.keywords} onKeywordClick={p.onKeywordClick} />
        <div className="ds-body">
          <ScoreStrip score={p.score} scoreSummary={p.scoreSummary} scoreLoading={p.scoreLoading} details={p.details} trl={p.trl} trlName={p.trlName} trlStage={p.trlStage} />
          {isStreaming && sections.length === 0
            ? <p className="ds-wait"><Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />AI가 요약서를 작성하고 있습니다…</p>
            : at("tech")}
          {fig && (
            <figure id="sec-figures" data-summary-section data-summary-label="특허 도면" className="ds-fig scroll-mt-24">
              <button type="button" onClick={() => p.setLightboxIndex(0)} title="누르면 크게 봅니다">
                <img src={fig.src} alt={`${fig.caption.replace(/[【】]/g, "")} 이미지`} decoding="async"
                  onError={(e) => { (e.currentTarget.closest("figure") as HTMLElement).style.display = "none"; }} />
              </button>
              <figcaption>{fig.caption.replace(/[【】]/g, "")}{p.figureItems.length > 1 ? ` (도면 ${p.figureItems.length}장)` : ""}</figcaption>
              {p.figureItems.length > 1 && (
                <div className="ds-thumbs print:hidden">
                  {p.figureItems.slice(1).map((f, i) => (
                    <button key={f.src} type="button" onClick={() => p.setLightboxIndex(i + 1)} title={f.caption}>
                      <img src={f.src} alt={f.caption} loading="lazy" decoding="async" />
                    </button>
                  ))}
                </div>
              )}
            </figure>
          )}
          {at("invention")}
          {at("use")}
        </div>
        <footer className="ds-pf"><span>Agri IP Summary · {formatPatentNumber(p.patentNumber, kind)}</span><span>기술</span><span>1 / 2</span></footer>
      </section>

      <section className="ds-sheet" data-sheet="2">
        <div className="ds-body">
          {at("market")}
          {slots.market.length > 0 && <MarketReadNote />}
          {at("biz")}
          {at("extra")}
          {patentData && !isStreaming && (
            <section id="sec-regulation" data-summary-section data-summary-label="예상 규제" className="ds-block scroll-mt-24">
              <h2 className="ds-h">예상 규제<span>관련 법령</span></h2>
              <RegulationAnalysis patentNumber={p.patentNumber} patentData={patentData} isStreaming={isStreaming} variant="note" />
            </section>
          )}
          {patentData && (
            <section id="sec-related" data-summary-section data-summary-label="관련 특허" className="ds-block ds-related scroll-mt-24">
              <h2 className="ds-h">기능이 비슷한 특허<span>참고</span></h2>
              <RelatedPatentsCompact patentData={patentData} onPatentClick={p.onRelatedPatentClick} />
            </section>
          )}
          {p.details?.analysis && (
            <section id="sec-analysis" data-summary-section data-summary-label="AI 종합 의견" className="ds-verdict scroll-mt-24">
              <h2>종합 의견</h2>
              <p>{renderBold(p.details.analysis)}</p>
            </section>
          )}
        </div>
        <footer className="ds-pf"><span>Agri IP Summary · {formatPatentNumber(p.patentNumber, kind)}</span><span>시장·사업화</span><span>2 / 2</span></footer>
      </section>
    </div>
  );
}
