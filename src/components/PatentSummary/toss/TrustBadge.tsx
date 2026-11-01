import type { MarketTrust } from "@/lib/summaryReport";

/** 시장 수치의 근거 배지: 공식 통계(출처 표시) · AI 추정 · 근거 미표기 */
export function TrustBadge({ trust, source, converted, compact }: { trust: MarketTrust; source?: string; converted?: boolean; compact?: boolean }) {
  if (trust === "official") {
    return (
      <span className="trust-note">
        <span className="trust-badge official" title={source ? `출처: ${source}` : undefined}>{converted ? "공식 통계 기준 환산" : "공식 통계"}</span>
        {source && !compact && <span className="trust-source">{source}</span>}
      </span>
    );
  }
  if (trust === "ai") {
    return <span className="trust-badge ai" title="출처를 확인하지 못한 AI 추정값입니다. 참고용으로만 보세요.">AI 추정</span>;
  }
  return compact ? <span className="trust-badge none">근거 미표기</span> : null;
}
