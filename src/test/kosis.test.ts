import { describe, it, expect } from "vitest";
import { findSeries, refFromSeries } from "../../supabase/functions/summarize-patent/kosis";
import { addSourceNote } from "../../supabase/functions/summarize-patent/marketConsistency";

describe("국가통계 시장 표준값", () => {
  it("건강기능식품 시장은 KOSIS 통계표에 연결된다", () => {
    expect(findSeries("국내건강기능식품시장")?.tblId).toBe("DT_145010_009");
    expect(findSeries("국내홍삼시장")?.c1Name).toBe("홍삼");
    expect(findSeries("국내스마트팜시장")).toBeNull();
  });
  it("최근 연도 값과 5년 CAGR을 계산한다", () => {
    const r = refFromSeries([
      { year: 2019, eok: 29508 }, { year: 2020, eok: 33254 }, { year: 2021, eok: 40321 },
      { year: 2022, eok: 41695 }, { year: 2023, eok: 40919 }, { year: 2024, eok: 40131 },
    ]);
    expect(r).toEqual({ baseYear: 2024, baseEok: 40131, cagr: 6.3 });
  });
  it("출처 괄호를 기준 금액 문장 끝에 넣는다", () => {
    expect(addSourceNote("시장은 2024년 약 4조 131억 원이다. 다음.", "4조 131억", "(출처: KOSIS)"))
      .toBe("시장은 2024년 약 4조 131억 원이다 (출처: KOSIS). 다음.");
  });
});
