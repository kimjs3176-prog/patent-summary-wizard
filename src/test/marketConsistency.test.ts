import { describe, it, expect } from "vitest";
import { applyMarketRef, extractMarketClaim, formatKrwEok, parseKrwEok, projectEok } from "../../supabase/functions/summarize-patent/marketConsistency";

const ref = { market_key: "국내건강기능식품시장", label: "국내 건강기능식품 시장", base_year: 2023, base_value_eok: 62022, cagr: 5.4 };

describe("시장규모 일관성", () => {
  it("원화 금액 파싱/표기", () => {
    expect(parseKrwEok("6조 2,022억")).toBe(62022);
    expect(parseKrwEok("1.45조")).toBe(14500);
    expect(formatKrwEok(72624)).toBe("7조 2,624억");
  });
  it("같은 기준값·CAGR이면 2026년 값은 항상 동일", () => {
    expect(projectEok(62022, 5.4, 2023)).toBe(72622);
  });
  it("다른 2026년 값·CAGR이 나와도 표준값으로 통일", () => {
    const a = "국내 건강기능식품 시장은 2023년 약 6조 2,022억 원이며 연평균 6.2% 성장해 2026년 약 7조 6,400억 원에 이를 전망이다.";
    const b = "국내 건강기능식품 시장 규모는 2023년 6조 2,022억 원으로, 연평균 성장률 5.8%를 적용하면 2026년 약 7조 3,446억 원이다.";
    const outA = applyMarketRef(a, ref), outB = applyMarketRef(b, ref);
    expect(outA).toContain("2026년 약 7조 2,622억 원");
    expect(outB).toContain("2026년 약 7조 2,622억 원");
    expect(outA).toContain("5.4%");
  });
  it("시장 주장 추출", () => {
    const c = extractMarketClaim("국내 건강기능식품 시장은 2023년 약 6조 2,022억 원이며 연평균 6.2% 성장");
    expect(c?.key).toBe("국내건강기능식품시장");
    expect(c?.cagr).toBe(6.2);
  });
});
