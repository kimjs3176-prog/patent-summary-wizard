import { describe, it, expect } from "vitest";
import { applyGlobalRef, applyMarketRef, extractGlobalClaim, parseUsdEok } from "../../supabase/functions/summarize-patent/marketConsistency";

const gref = { market_key: "글로벌농업용드론시장", label: "글로벌 농업용 드론 시장", base_year: 2024, base_value_eok: 54, cagr: 28.6 };

describe("글로벌 시장규모 일관성", () => {
  it("USD 금액 표기를 같은 단위로 읽는다", () => {
    expect(parseUsdEok("USD 54억")).toBe(54);
    expect(parseUsdEok("USD 5.4 billion")).toBe(54);
    expect(parseUsdEok("54억 달러")).toBe(54);
  });
  it("다른 규모·성장률이 나와도 표준값으로 통일", () => {
    const t = "글로벌 농업용 드론 시장은 2023년 약 USD 61억 규모에서 연평균 약 31.2% 성장할 전망이다.";
    expect(extractGlobalClaim(t)?.key).toBe("글로벌농업용드론시장");
    const out = applyGlobalRef(t, gref);
    expect(out).toContain("2024년 약 USD 54억");
    expect(out).toContain("28.6%");
  });
  it("국내 보정은 글로벌 문장의 성장률을 바꾸지 않는다", () => {
    const t = "국내 건강기능식품 시장은 2024년 약 4조 원이다. 글로벌 시장은 연평균 9.1% 성장한다.";
    const out = applyMarketRef(t, { market_key: "k", label: "l", base_year: 2024, base_value_eok: 40131, cagr: 6.3 });
    expect(out).toContain("9.1%");
  });
});
