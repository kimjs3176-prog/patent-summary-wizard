import { BadgeCheck, Loader2 } from "lucide-react";
import type { PatentSummaryProps as BasePatentSummaryProps } from "../types";
import type { CommercializationDetails } from "../commercialization";
import type { GovtPatentData } from "../GovtPatentInfo";
import { KeywordChip, type KwItem } from "../_keywords";
import { formatPatentNumber } from "./helpers";
import { PatentStatusBadge } from "./PatentStatusBadge";
import { renderBold } from "./RenderBold";

type PatentData = BasePatentSummaryProps["patentData"];

/**
 * 요약서 머리(1열): 분석 꼬리표·상태 → 특허 명칭 → 특허 기본정보 → 관련 키워드.
 * 기본정보는 머리에만 둔다(본문에 같은 정보를 다시 두지 않는다).
 */
export function ReportHead({ patentData, title, govt, owner, keywords, onKeywordClick }: {
  patentData: PatentData; title: string; govt: GovtPatentData | null; owner: string | null; keywords: KwItem[]; onKeywordClick?: (k: string) => void;
}) {
  const inv = patentData?.inventors ?? [];
  const assignee = patentData?.assignee;
  const rows: [string, string | undefined][] = patentData ? [
    ["출원번호", patentData.applicationNumber ? formatPatentNumber(patentData.applicationNumber, "application") : undefined],
    ["출원일", patentData.filingDate],
    ["등록번호", patentData.registrationNumber ? formatPatentNumber(patentData.registrationNumber, "registration") : undefined],
    [patentData.registrationDate ? "등록일" : "공개일", patentData.registrationDate || patentData.publicationDate],
    ["발명기관", assignee],
    // 권리가 넘어간 특허만 지금 권리자를 따로 적는다
    ["현 권리자", owner && owner !== assignee ? owner : undefined],
    ["관리기관", govt?.institution],
    ["발명자", inv.length ? (inv.length >= 5 ? `${inv.slice(0, 4).join(", ")} 외 ${inv.length - 4}명` : inv.join(", ")) : undefined],
    ["특허분류", (patentData.classifications ?? []).flatMap((c) => c.split("|")).map((c) => c.trim()).filter(Boolean).slice(0, 4).join(", ") || undefined],
  ] : [];
  return (
    <header id="sec-basic" data-summary-section data-summary-label="기본 정보" className="ds-head scroll-mt-24">
      <div className="ds-doc">
        <b>AI 특허 기술 분석</b>
        <PatentStatusBadge data={patentData} />
        {govt && <span className="ds-govt"><BadgeCheck className="w-[1.1em] h-[1.1em]" aria-hidden="true" />국유특허</span>}
      </div>
      <h1 className="ds-title">{title}</h1>
      {rows.some(([, v]) => v) && (
        <dl className="ds-meta">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className={k === "발명자" || k === "특허분류" ? "ds-meta-wide" : undefined}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      )}
      {keywords.length > 0 && (
        <div className="ds-kwrow">
          <span>관련 키워드</span>
          <div className="ds-kw">
            {keywords.map(({ cat, word }) => (
              <KeywordChip key={`${cat}-${word}`} category={cat} onClick={() => onKeywordClick?.(word)}>{word}</KeywordChip>
            ))}
          </div>
        </div>
      )}
      {govt && <p className="ds-src">국유특허·관리기관: KIPRIS 국유특허 기본조회</p>}
    </header>
  );
}

/** 본문 위 가로 띠: 사업화 점수·세부 점수 | 기술 성숙도(TRL). 점수 근거는 펼쳐서 본다(인쇄 제외). */
export function ScoreStrip({ score, scoreSummary, scoreLoading, details, trl, trlName, trlStage }: {
  score: number | null; scoreSummary: string; scoreLoading: boolean; details: CommercializationDetails | null; trl: number | null; trlName: string | null | undefined; trlStage: string;
}) {
  return (
    <section id="sec-score" data-summary-section data-summary-label="사업화 점수" className="ds-score scroll-mt-24">
      <div className="ds-score-main">
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
      </div>
      {trl != null && (
        <div className="ds-score-trl">
          <b className="ds-note-t">기술 성숙도 TRL {trl} / 9</b>
          <div className="ds-trl" role="img" aria-label={`기술 성숙도 TRL ${trl} / 9`}>
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <span key={n} className={`${n <= trl ? "on" : ""}${n === trl ? " cur" : ""}`}>{n}</span>
            ))}
          </div>
          <p className="ds-sub">{[trlName, trlStage].filter(Boolean).join(" · ")}</p>
          {details?.trlReason && <p>{details.trlReason}</p>}
        </div>
      )}
      {details && (details.technologyReason || details.marketReason || details.businessReason) && (
        <details className="ds-why print:hidden">
          <summary>점수 근거 보기</summary>
          {[["기술성", details.technologyReason], ["시장성", details.marketReason], ["사업성", details.businessReason]].filter(([, r]) => r).map(([k, r]) => (
            <p key={k} className="score-reason"><b>{k}</b> {renderBold(r as string)}</p>
          ))}
        </details>
      )}
    </section>
  );
}

/** 시장 표 아래 한 줄: 시장 규모 근거 읽는 법 */
export function MarketReadNote() {
  return (
    <p className="ds-read">
      <span><span className="trust-badge official">공식 통계</span> KOSIS 등 국가통계나 검증된 자료의 값</span>
      <span><span className="trust-badge ai">AI 추정</span> 출처를 확인하지 못한 참고값</span>
      <span>전망은 기준 규모에 연평균 성장률을 적용해 환산했습니다.</span>
    </p>
  );
}
