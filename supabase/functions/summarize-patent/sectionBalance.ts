/** Content budgets, not display truncation: preserve complete facts in every output. */
export const SUMMARY_SECTIONS = [
  "기술분야", "발명요약 및 특징", "관련시장 동향", "농산업활용 가능성", "상용화전망",
] as const;

export function getSectionBudgets(settings: Record<string, number> = {}) {
  return SUMMARY_SECTIONS.map((title) => {
    const raw = settings[title];
    const level = Number.isFinite(raw) ? Math.max(1, Math.min(10, raw)) : 5;
    // Respect individual settings without allowing one section to dominate the report.
    const target = Math.round((520 + (level - 5) * 8) / 10) * 10;
    return { title, minChars: target - 60, maxChars: target + 60 };
  });
}

export function buildSectionBalanceInstruction(settings: Record<string, number> = {}) {
  const budgets = getSectionBudgets(settings);
  return `\n\n[섹션 분량 균형 — 최우선 준수]
- 제목·마크다운 기호를 제외한 본문 글자 수(공백 포함)를 기준으로 다음 범위를 목표로 작성한다.
${budgets.map(({ title, minChars, maxChars }) => `- ${title}: ${minChars}~${maxChars}자, 6~8문장.`).join("\n")}
- 다섯 섹션의 본문 분량을 비슷하게 유지한다. 상용화전망만 더 길게 쓰거나 기술분야를 반복 설명으로 늘리지 않는다.
- 발명요약은 해결수단·작동원리·차별적 효과, 시장은 기준연도·기준값·CAGR·환산값·출처, 활용은 적용 현장·효과, 상용화는 기술완성도·경로·수요처·수익모델·양산 제약·인허가·경쟁 비교·성공조건을 우선 보존한다.
- 관련 요소는 연결된 문장에 통합한다. 상용화전망의 요소별로 별도 문장을 늘리거나 다른 섹션의 배경·시장·효과를 재서술하지 않는다.
- 원문 근거가 적으면 짧더라도 정확하게 작성한다. 분량을 채우기 위한 반복·막연한 전망·확인되지 않은 수치 추가 금지.
- 전송 전 다섯 섹션의 분량을 비교해 긴 섹션의 중복 표현만 정리한다. 핵심 수치·단위·산출 근거·출처·기술 고유명사나 문장 끝을 잘라내지 않는다.`;
}