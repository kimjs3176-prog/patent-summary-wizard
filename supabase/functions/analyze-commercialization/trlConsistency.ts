// 요약서 본문(특히 상용화전망)의 기술완성도 서술과 TRL 판정을 일치시키는 결정론적 검증기.
// 요약서가 먼저 생성되고 TRL은 그 뒤 별도 호출로 판정되므로, 서술 단계와 TRL이 어긋나면
// TRL을 서술이 허용하는 범위로 보정한다.

export interface TrlBand { min: number; max: number; label: string }

const BANDS: Array<{ re: RegExp; band: TrlBand }> = [
  { re: /(개념\s*(?:증명|단계|수준)|원리\s*(?:수준|단계)|기초\s*연구\s*(?:수준|단계))/, band: { min: 2, max: 3, label: "기초연구" } },
  { re: /(실험실\s*(?:수준|단계|규모|검증|에서)|랩\s*스케일|lab\s*scale|소규모\s*실험\s*(?:수준|단계))/i, band: { min: 3, max: 4, label: "실험실" } },
  { re: /(파일럿|시작품|시제품|프로토타입|실증\s*(?:단계|수준)|현장\s*(?:시험|실증|적용)\s*(?:단계|수준))/, band: { min: 5, max: 6, label: "파일럿·실증" } },
  { re: /(양산\s*(?:준비|단계|가능|체계)|즉시\s*(?:구현|적용|양산|생산)|기존\s*설비로\s*(?:바로|즉시|곧바로)?\s*(?:구현|생산|제조)|상용\s*(?:단계|수준)|시판\s*(?:중|되고))/, band: { min: 7, max: 9, label: "양산준비" } },
];

/** 상용화전망 섹션(없으면 전체)에서 현재 기술완성도로 서술된 첫 단계를 찾는다. */
export function detectSummaryMaturity(summary: string): TrlBand | null {
  if (!summary) return null;
  const idx = summary.search(/상용화\s*전망/);
  const scope = idx >= 0 ? summary.slice(idx) : summary;
  let best: { pos: number; band: TrlBand } | null = null;
  for (const { re, band } of BANDS) {
    const m = re.exec(scope);
    if (!m) continue;
    // "실험실 수준을 넘어" 처럼 극복한 단계 서술은 제외
    const tail = scope.slice(m.index + m[0].length, m.index + m[0].length + 8);
    if (/^\s*(?:을|를)?\s*(?:넘어|넘어선|벗어나|지나)/.test(tail)) continue;
    if (!best || m.index < best.pos) best = { pos: m.index, band };
  }
  return best?.band ?? null;
}

/** TRL이 서술 단계 범위를 벗어나면 범위 안으로 보정. changed=true면 근거문도 재작성해야 한다. */
export function reconcileTrl(trl: number, summary: string): { trl: number; changed: boolean; band: TrlBand | null } {
  const t = Math.max(1, Math.min(9, Math.round(Number(trl) || 5)));
  const band = detectSummaryMaturity(summary);
  if (!band) return { trl: t, changed: false, band };
  const fixed = Math.max(band.min, Math.min(band.max, t));
  return { trl: fixed, changed: fixed !== t, band };
}
