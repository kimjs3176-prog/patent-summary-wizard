// 요약서가 AI 참고자료라는 안내 (화면 아래 문구, 인쇄·PDF 2쪽 바닥글).
// 요약은 공개된 초록과 청구항만 읽고 만든다(명세서 본문은 받지 않는다). 안내도 그 사실과 같아야 한다.

export const DEFAULT_SUMMARY_DISCLAIMER =
  "※ 본 분석은 공개된 초록·청구항을 바탕으로 AI가 작성한 참고자료로, 실제 연구 및 개발 단계와는 다를 수 있습니다.";

/**
 * 화면 아래 안내문: 관리자가 저장한 문구(summary_disclaimer)를 쓰고, 비어 있으면 기본 문구를 쓴다.
 * 예전 기본 문구를 그대로 저장해 둔 곳이 많아 '특허명세서를 바탕으로'는 실제 입력에 맞게 고쳐 보여 준다.
 */
export function summaryDisclaimerText(saved?: string | null): string {
  const text = String(saved ?? "").trim() || DEFAULT_SUMMARY_DISCLAIMER;
  return text.replace(/특허\s*명세서를\s*바탕으로/g, "공개된 초록·청구항을 바탕으로");
}

/** 요약서 생성 시각(ISO)을 한국 날짜 2026.11.03 꼴로. 읽을 수 없으면 빈 문자열 */
export function formatReportDate(iso?: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const kst = new Date(t + 9 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${kst.getUTCFullYear()}.${pad(kst.getUTCMonth() + 1)}.${pad(kst.getUTCDate())}`;
}

/** 인쇄·PDF 2쪽 바닥글 가운데 칸: 공식 평가로 오해하지 않도록 참고자료임과 생성일을 적는다(한 줄) */
export function sheetFooterNote(generatedAt?: string | null): string {
  const date = formatReportDate(generatedAt);
  return date ? `AI 분석 참고자료 · 생성 ${date}` : "AI 분석 참고자료";
}
