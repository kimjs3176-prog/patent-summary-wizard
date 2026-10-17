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
  it("한 본문에 여러 시장이 있으면 각 시장의 수치만 따로 보정된다", () => {
    const text = "국내 사료 시장은 2023년 약 10조 2,000억 원이며 연평균 4.2% 성장해 2026년 약 11조 5,399억 원에 이른다. 국내 미생물 첨가제 시장은 2023년 약 1,250억 원에서 연평균 5.2% 성장해 2026년 약 1,455억 원 규모다.";
    const feedRef = { market_key: "국내사료시장", label: "국내 사료 시장", base_year: 2023, base_value_eok: 102000, cagr: 4.2 };
    const microRef = { market_key: "국내미생물첨가제시장", label: "국내 미생물 첨가제 시장", base_year: 2023, base_value_eok: 1250, cagr: 5.2 };
    let out = applyMarketRef(text, feedRef);
    // 사료 시장 보정이 미생물 첨가제 시장 수치를 바꾸지 않는다
    expect(out).toContain("1,250억");
    expect(out).toContain("1,455억");
    out = applyMarketRef(out, microRef);
    expect(out).toContain("11조 5,399억");
    expect(out).toContain("5.2%");
    // 사료 시장 값은 그대로 유지
    expect(out).toContain("10조 2,000억");
    expect(out).toContain("4.2%");
  });
  it("한 시장의 2026년 값을 바꿀 때 다른 시장의 2026년 값은 바뀌지 않는다", () => {
    const text = "국내 종자 시장은 2022년 약 8,000억 원이며 연평균 7.2% 성장해 2026년 약 1조 471억 원이다. 국내 쌀가공식품 시장은 2023년 약 7조 4,117억 원에서 연평균 2.5% 성장해 2026년 약 7조 7,869억 원이다.";
    const seedRef = { market_key: "국내종자시장", label: "국내 종자 시장", base_year: 2022, base_value_eok: 8000, cagr: 7.2 };
    const out = applyMarketRef(text, seedRef);
    expect(out).toContain("1조 558억"); // 8000*1.072^4 재계산
    expect(out).toContain("7조 7,869억"); // 쌀가공식품 2026년 값 유지
  });
});
