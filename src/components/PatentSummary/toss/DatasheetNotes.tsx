import { Loader2 } from "lucide-react";
import type { PatentSummaryProps as BasePatentSummaryProps } from "../types";
import type { CommercializationDetails } from "../commercialization";
import { KeywordChip, type KwItem } from "../_keywords";
import { formatPatentNumber } from "./helpers";
import { renderBold } from "./RenderBold";

type PatentData = BasePatentSummaryProps["patentData"];

/** 왼쪽 여백 주석: 기본 정보와 관련 키워드 */
export function FactsNote({ patentData, owner, keywords, onKeywordClick }: { patentData: PatentData; owner: string | null; keywords: KwItem[]; onKeywordClick?: (k: string) => void }) {
  if (!patentData) return null;
  const inv = patentData.inventors ?? [];
  const rows: [string, string | undefined][] = [
    ["권리자", owner ?? patentData.assignee],
    ["출원번호", patentData.applicationNumber ? formatPatentNumber(patentData.applicationNumber, "application") : undefined],
    ["출원일", patentData.filingDate],
    ["등록번호", patentData.registrationNumber ? formatPatentNumber(patentData.registrationNumber, "registration") : undefined],
    [patentData.registrationDate ? "등록일" : "공개일", patentData.registrationDate || patentData.publicationDate],
    ["발명자", inv.length ? (inv.length >= 5 ? `${inv.slice(0, 4).join(", ")} 외 ${inv.length - 4}명` : inv.join(", ")) : undefined],
  ];
  const ipc = (patentData.classifications ?? []).flatMap((c) => c.split("|")).map((c) => c.trim()).filter(Boolean).slice(0, 4);
  return (
    <aside id="sec-basic" data-summary-section data-summary-label="기본 정보" className="ds-note scroll-mt-24">
      <b className="ds-note-t">기본 정보</b>
      <dl className="ds-facts">
        {rows.filter(([, v]) => v).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
        {ipc.length > 0 && <div><dt>특허분류</dt><dd>{ipc.map((c) => <span key={c} className="block">{c}</span>)}</dd></div>}
      </dl>
      {keywords.length > 0 && (
        <>
          <b className="ds-note-t">관련 키워드</b>
          <div className="ds-kw">
            {keywords.map(({ cat, word }) => (
              <KeywordChip key={`${cat}-${word}`} category={cat} onClick={() => onKeywordClick?.(word)}>{word}</KeywordChip>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

/** 왼쪽 여백 주석: 사업화 점수·세부 점수·기술 성숙도(TRL) */
export function ScoreNote({ score, scoreSummary, scoreLoading, details, trl, trlName, trlStage }: {
  score: number | null; scoreSummary: string; scoreLoading: boolean; details: CommercializationDetails | null; trl: number | null; trlName: string | null | undefined; trlStage: string;
}) {
  return (
    <aside id="sec-score" data-summary-section data-summary-label="사업화 점수" className="ds-note scroll-mt-24">
      <b className="ds-note-t">사업화 점수</b>
      {score == null ? (
        <p className="ds-wait">{scoreLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />분석 중…</> : "점수 없음"}</p>
      ) : (
        <p className="ds-big"><b>{score}</b><span>/ 100 · {scoreSummary}</span></p>
      )}
      {details && (
        <dl className="ds-s3">
          <div><dt>기술성</dt><dd>{details.technologyScore}</dd></div>
          <div><dt>시장성</dt><dd>{details.marketScore}</dd></div>
          <div><dt>사업성</dt><dd>{details.businessScore}</dd></div>
        </dl>
      )}
      {trl != null && (
        <>
          <b className="ds-note-t">기술 성숙도 TRL {trl} / 9</b>
          <div className="ds-trl" role="img" aria-label={`기술 성숙도 TRL ${trl} / 9`}>
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <span key={n} className={`${n <= trl ? "on" : ""}${n === trl ? " cur" : ""}`}>{n}</span>
            ))}
          </div>
          <p className="ds-sub">{[trlName, trlStage].filter(Boolean).join(" · ")}</p>
          {details?.trlReason && <p>{details.trlReason}</p>}
        </>
      )}
      {details && (details.technologyReason || details.marketReason || details.businessReason) && (
        <details className="ds-why print:hidden">
          <summary>점수 근거 보기</summary>
          {[["기술성", details.technologyReason], ["시장성", details.marketReason], ["사업성", details.businessReason]].filter(([, r]) => r).map(([k, r]) => (
            <p key={k} className="score-reason"><b>{k}</b> {renderBold(r as string)}</p>
          ))}
        </details>
      )}
    </aside>
  );
}

/** 왼쪽 여백 주석: 시장 규모 근거 읽는 법 */
export function MarketReadNote() {
  return (
    <div className="ds-read">
      <b className="ds-note-t">시장 규모 읽는 법</b>
      <p><span className="trust-badge official">공식 통계</span> 는 KOSIS 등 국가통계나 검증된 자료의 값이고, <span className="trust-badge ai">AI 추정</span> 은 출처를 확인하지 못한 값이라 참고용입니다. 전망은 기준 규모에 연평균 성장률을 적용해 환산했습니다.</p>
    </div>
  );
}
