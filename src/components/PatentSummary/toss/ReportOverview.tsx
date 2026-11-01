import { useMemo } from "react";
import type { MdSection } from "./helpers";
import { sectionMeta } from "./helpers";
import { parseMarketRows, splitSentences, toReportParagraphs } from "@/lib/summaryReport";
import { TrustBadge } from "./TrustBadge";

export interface TocItem { id: string; label: string }

interface Props {
  score: number | null;
  scoreSummary: string;
  scoreLoading: boolean;
  trl: number | null;
  trlName: string | null | undefined;
  trlStage: string;
  analysis?: string;
  sections: MdSection[];
  toc: TocItem[];
  isStreaming: boolean;
}

const clean = (s: string) => s.replace(/\*\*/g, "").replace(/\[\^\d+\]/g, "").replace(/\s*\((?:출처:[^()]*|AI\s*추정치)\)/g, "").trim();

/** 보고서 첫머리: 핵심 요약(점수·TRL·대표 시장·결론)과 목차. 숫자는 아래 본문과 같은 값을 그대로 옮긴다. */
export function ReportOverview({ score, scoreSummary, scoreLoading, trl, trlName, trlStage, analysis, sections, toc, isStreaming }: Props) {
  const market = useMemo(() => {
    const sec = sections.find((s) => sectionMeta(s.title).kicker === "시장 동향");
    return sec ? parseMarketRows(sec.paragraphs)[0] ?? null : null;
  }, [sections]);
  const conclusion = useMemo(() => {
    if (analysis) return splitSentences(clean(analysis)).slice(0, 2).join(" ");
    const sec = sections.find((s) => sectionMeta(s.title).kicker === "발명 요약");
    return sec ? clean(toReportParagraphs(sec.paragraphs).lead) : "";
  }, [analysis, sections]);

  if (isStreaming && !sections.length) return null;

  return (
    <section className="report-overview mb-10" aria-labelledby="report-overview-title">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 id="report-overview-title" className="text-[13px] font-bold tracking-[0.04em] text-[#4E5968]">핵심 요약</h2>
        <span className="text-[11px] text-[#6B7684]">아래 본문의 값을 한눈에 모았습니다</span>
      </div>
      <dl className="report-overview-grid">
        <div className="report-overview-cell">
          <dt>사업화 점수</dt>
          <dd>
            {score != null ? <><b className="tabular-nums">{score}</b><span className="unit">/ 100</span><span className="sub">{scoreSummary}</span></> : <span className="sub">{scoreLoading ? "분석 중…" : "점수 없음"}</span>}
          </dd>
        </div>
        <div className="report-overview-cell">
          <dt>기술 성숙도</dt>
          <dd>
            {trl != null ? <><b className="tabular-nums">TRL {trl}</b><span className="unit">/ 9</span><span className="sub">{[trlName, trlStage].filter(Boolean).join(" · ")}</span></> : <span className="sub">{scoreLoading ? "분석 중…" : "-"}</span>}
          </dd>
        </div>
        <div className="report-overview-cell wide">
          <dt>대표 시장</dt>
          <dd>
            {market ? (
              <>
                <span className="label">{market.label}</span>
                <span className="fig tabular-nums">
                  {market.baseYear && market.baseAmount ? `${market.baseYear}년 ${market.baseAmount}` : ""}
                  {market.cagr ? `${market.baseAmount ? " · " : ""}연평균 ${market.cagr}` : ""}
                </span>
                <TrustBadge trust={market.trust} source={market.source} compact />
              </>
            ) : <span className="sub">{isStreaming ? "작성 중…" : "시장 수치 없음"}</span>}
          </dd>
        </div>
        {conclusion && (
          <div className="report-overview-cell full">
            <dt>한 줄 결론</dt>
            <dd><p>{conclusion}</p></dd>
          </div>
        )}
      </dl>
      {toc.length > 0 && (
        <nav className="report-toc" aria-label="요약서 목차">
          <span className="report-toc-title">목차</span>
          <ol>
            {toc.map((t, i) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  onClick={(e) => { const el = document.getElementById(t.id); if (!el) return; e.preventDefault(); el.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                >
                  <span className="n tabular-nums">{i + 1}</span>{t.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </section>
  );
}
