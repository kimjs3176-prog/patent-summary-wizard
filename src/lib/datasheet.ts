/**
 * 요약서(1열 구성): 화면은 위에서 아래로 한 줄, 인쇄·PDF는 A4 두 쪽.
 *   1쪽: 머리(명칭·기본정보·키워드) → 점수·TRL → 기술 분야 → 도면 → 발명 요약 → 농산업 활용
 *   2쪽: 시장 동향 → 상용화 전망 → 예상 규제 → 비슷한 특허 → 종합 의견
 * 요약서 절은 제목(kicker)으로 자리를 정하고, 어디에도 안 맞는 절은 2쪽 마지막 본문에 붙인다.
 */
export type DatasheetSlot = "tech" | "invention" | "use" | "market" | "biz" | "extra";

const SLOT_OF: Record<string, DatasheetSlot> = { "기술 분야": "tech", "발명 요약": "invention", "농산업 활용": "use", "시장 동향": "market", "상용화 전망": "biz" };

export function datasheetSlots(kickers: string[]): Record<DatasheetSlot, number[]> {
  const out: Record<DatasheetSlot, number[]> = { tech: [], invention: [], use: [], market: [], biz: [], extra: [] };
  kickers.forEach((k, i) => {
    const slot = SLOT_OF[k];
    // 같은 자리에 두 번째 절이 오면 덮어쓰지 않고 마지막에 붙인다
    if (slot && out[slot].length === 0) out[slot].push(i);
    else out.extra.push(i);
  });
  return out;
}

/** 인쇄·PDF 직전: 쪽마다 본문이 넘치면 글자를 2%씩 줄인다(최소 78%). 그래도 넘치면 자르지 않고 쪽을 늘린다(ds-free). */
export function fitDatasheet(root: HTMLElement | null, minScale = 0.78): void {
  if (!root) return;
  root.querySelectorAll<HTMLElement>(".ds-sheet").forEach((sheet) => {
    sheet.classList.remove("ds-free");
    let scale = 1;
    sheet.style.setProperty("--ds-scale", "1");
    const body = sheet.querySelector<HTMLElement>(".ds-body");
    if (!body) return;
    const over = () => body.scrollHeight > body.clientHeight + 1;
    while (over() && scale > minScale + 0.001) {
      scale = Math.max(minScale, scale - 0.02);
      sheet.style.setProperty("--ds-scale", scale.toFixed(2));
    }
    if (over()) sheet.classList.add("ds-free");
  });
}

/** 인쇄가 끝나면 화면 글자 크기로 되돌린다 */
export function unfitDatasheet(root: HTMLElement | null): void {
  root?.querySelectorAll<HTMLElement>(".ds-sheet").forEach((sheet) => {
    sheet.style.removeProperty("--ds-scale");
    sheet.classList.remove("ds-free");
  });
}
