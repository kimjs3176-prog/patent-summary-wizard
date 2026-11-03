import type { PatentSummaryProps as BasePatentSummaryProps } from "../types";
import type { CommercializationDetails } from "../commercialization";
import type { GovtPatentData } from "../GovtPatentInfo";
import { GovtPatentBadges } from "../GovtPatentInfo";
import { RegulationAnalysis } from "../RegulationAnalysis";
import { RelatedPatentsCompact } from "../RelatedPatentsCompact";
import type { KwItem } from "../_keywords";
import { datasheetSlots } from "@/lib/datasheet";
import { formatPatentNumber, sectionMeta, type MdSection } from "./helpers";
import { PatentStatusBadge } from "./PatentStatusBadge";
import { ProseSection } from "./ProseSection";
import { FactsNote, MarketReadNote, ScoreNote } from "./DatasheetNotes";
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
 * 데이터시트형 요약서(C안). 화면에서는 왼쪽 여백 칸에 기본 정보·점수·규제·비슷한 특허를 주석처럼 두고
 * 오른쪽에 본문을 한 단으로 둔다. 인쇄·PDF에서는 .ds-sheet 두 장이 A4 두 쪽이 된다(lib/datasheet 의 fitDatasheet).
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
        <header className="ds-head">
          <div className="ds-doc">
            <b>AI 특허 기술 분석</b>
            <span>{kind === "application" ? "출원" : "등록"} {formatPatentNumber(p.patentNumber, kind)}</span>
            <PatentStatusBadge data={patentData} />
          </div>
          <div className="min-w-0">
            <h1 className="ds-title">{p.title}</h1>
            <GovtPatentBadges data={p.govtPatent} />
          </div>
        </header>
        <div className="ds-body">
          <div className="ds-row">
            <FactsNote patentData={patentData} owner={p.owner} keywords={p.keywords} onKeywordClick={p.onKeywordClick} />
            <div className="ds-main">
              {isStreaming && sections.length === 0
                ? <p className="ds-wait"><Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />AI가 요약서를 작성하고 있습니다…</p>
                : at("tech")}
            </div>
          </div>
          <div className="ds-row">
            <ScoreNote score={p.score} scoreSummary={p.scoreSummary} scoreLoading={p.scoreLoading} details={p.details} trl={p.trl} trlName={p.trlName} trlStage={p.trlStage} />
            <div className="ds-main">
              {fig && (
                <figure id="sec-figures" data-summary-section data-summary-label="특허 도면" className="ds-fig scroll-mt-24">
                  <button type="button" onClick={() => p.setLightboxIndex(0)} title="누르면 크게 봅니다">
                    <img src={fig.src} alt={`${fig.caption.replace(/[【】]/g, "")} 이미지`} decoding="async"
                      onError={(e) => { (e.currentTarget.closest("figure") as HTMLElement).style.display = "none"; }} />
                  </button>
                  <figcaption>{fig.caption.replace(/[【】]/g, "")}{p.figureItems.length > 1 ? ` · 도면 ${p.figureItems.length}장` : ""}</figcaption>
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
            </div>
          </div>
          {slots.use.length > 0 && (
            <div className="ds-row">
              <div aria-hidden="true" />
              <div className="ds-main">{at("use")}</div>
            </div>
          )}
        </div>
        <footer className="ds-pf"><span>Agri IP Summary · {formatPatentNumber(p.patentNumber, kind)}</span><span>기술</span><span>1 / 2</span></footer>
      </section>

      <section className="ds-sheet" data-sheet="2">
        <div className="ds-body">
          <div className="ds-row">
            <section id="sec-regulation" data-summary-section data-summary-label="예상 규제" className="ds-note scroll-mt-24">
              <MarketReadNote />
              {patentData && !isStreaming && <RegulationAnalysis patentNumber={p.patentNumber} patentData={patentData} isStreaming={isStreaming} variant="note" />}
            </section>
            <div className="ds-main">{at("market")}</div>
          </div>
          <div className="ds-row">
            <section id="sec-related" data-summary-section data-summary-label="관련 특허" className="ds-note ds-related scroll-mt-24">
              <b className="ds-note-t">기능이 비슷한 특허</b>
              {patentData && <RelatedPatentsCompact patentData={patentData} onPatentClick={p.onRelatedPatentClick} />}
            </section>
            <div className="ds-main">
              {at("biz")}
              {at("extra")}
              {p.details?.analysis && (
                <section id="sec-analysis" data-summary-section data-summary-label="AI 종합 의견" className="ds-verdict scroll-mt-24">
                  <h2>종합 의견</h2>
                  <p>{renderBold(p.details.analysis)}</p>
                </section>
              )}
            </div>
          </div>
        </div>
        <footer className="ds-pf"><span>Agri IP Summary · {formatPatentNumber(p.patentNumber, kind)}</span><span>시장·사업화</span><span>2 / 2</span></footer>
      </section>
    </div>
  );
}
