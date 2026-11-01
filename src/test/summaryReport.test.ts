import { describe, it, expect } from "vitest";
import { parseMarketRows, splitSentences, splitTrustNotes, toReportParagraphs } from "@/lib/summaryReport";

const HFF = "KOSIS 국가통계포털, 식품의약품안전처 「건강기능식품 매출액」";
const MARKET =
  `본 기술이 적용되는 상위 시장인 **국내 건강기능식품 시장** 규모는 2024년 4조 131억 원이며 연평균 6.3% 성장하고 있다(출처: ${HFF}, 2024년 기준). ` +
  `이를 2026년 시점으로 환산하면 약 4조 5,347억 원 규모에 달할 것으로 전망된다(출처: ${HFF}, 2024년 기준값에서 환산). ` +
  `또한 원료 측면의 직접 시장에 해당하는 **국내 건강기능식품 원료 시장**은 2023년 1조 1,675억 원 규모에서 연평균 6.2% 성장하여 2026년 약 1조 3,984억 원을 형성할 것으로 추정된다(AI 추정치). ` +
  `연계 분야인 **세계 천연물 추출물 시장**은 2024년 USD 385억 규모이며 연평균 7.5%로 성장하여 2026년 USD 444.9억 수준에 이를 것으로 예상된다(AI 추정치). ` +
  `최근 소비자 수요가 증가하는 추세다.`;

describe("요약서 보고서 레이아웃 도우미", () => {
  it("소수점·괄호 안 마침표에서는 문장을 나누지 않는다", () => {
    const s = splitSentences(MARKET);
    expect(s).toHaveLength(5);
    expect(s[0].endsWith("2024년 기준).")).toBe(true);
    expect(s[3]).toContain("USD 444.9억");
  });

  it("첫 문장을 요지로, 나머지를 3문장 단위 문단으로 묶는다", () => {
    const r = toReportParagraphs(["가는 1이다. 나는 2이다. 다는 3이다.", "라는 4이다. 마는 5이다."]);
    expect(r.lead).toBe("가는 1이다.");
    expect(r.body).toEqual(["나는 2이다. 다는 3이다. 라는 4이다.", "마는 5이다."]);
  });

  it("시장별 기준 규모·성장률·전망·근거를 뽑는다", () => {
    const rows = parseMarketRows([MARKET]);
    expect(rows.map((r) => r.label)).toEqual(["국내 건강기능식품 시장", "국내 건강기능식품 원료 시장", "세계 천연물 추출물 시장"]);
    expect(rows[0]).toMatchObject({ baseYear: 2024, baseAmount: "4조 131억 원", cagr: "6.3%", projYear: 2026, projAmount: "4조 5,347억 원", trust: "official", source: HFF });
    expect(rows[1]).toMatchObject({ baseYear: 2023, baseAmount: "1조 1,675억 원", cagr: "6.2%", projYear: 2026, projAmount: "1조 3,984억 원", trust: "ai" });
    expect(rows[2]).toMatchObject({ baseYear: 2024, baseAmount: "USD 385억", cagr: "7.5%", projYear: 2026, projAmount: "USD 444.9억", trust: "ai" });
  });

  it("굵게 표시가 없어도 '국내 …시장' 명사구를 시장명으로 본다", () => {
    const rows = parseMarketRows(["국내 버섯 시장은 2023년 1,500억 원 규모이며 연평균 6.5% 성장하고 있다(AI 추정치)."]);
    expect(rows[0]).toMatchObject({ label: "국내 버섯 시장", baseAmount: "1,500억 원", cagr: "6.5%", trust: "ai" });
  });

  it("근거 괄호를 배지 조각으로 나눈다", () => {
    const parts = splitTrustNotes(`규모는 4조 원이다(출처: ${HFF}, 2024년 기준값에서 환산). 다음은 추정이다(AI 추정치). 섞인 경우(출처: ${HFF}, 2024년 기준; AI 추정치)`);
    expect(parts).toEqual([
      { text: "규모는 4조 원이다" },
      { trust: "official", source: HFF, converted: true },
      { text: ". 다음은 추정이다" },
      { trust: "ai" },
      { text: ". 섞인 경우" },
      { trust: "official", source: HFF, converted: false },
      { trust: "ai" },
    ]);
  });
});
