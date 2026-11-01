import { describe, it, expect } from "vitest";
import { claimToRef, isAmbiguousMarket, reconcileMarketSection, type MarketRef } from "../../supabase/functions/summarize-patent/marketConsistency";

describe("불분명한 시장명은 기준값으로 저장하지 않음", () => {
  it("상위/관련/이름 없는 시장은 거부", () => {
    expect(isAmbiguousMarket("국내상위시장")).toBe(true);
    expect(isAmbiguousMarket("국내시장")).toBe(true);
    expect(isAmbiguousMarket("국내콩가공품및건기식상위시장")).toBe(true);
    expect(claimToRef({ label: "국내 상위 시장", key: "국내상위시장", baseYear: 2023, baseEok: 62022, cagr: 5.4 })).toBeNull();
  });
  it("구체적 시장은 저장", () => {
    expect(isAmbiguousMarket("국내버섯시장")).toBe(false);
  });
});

describe("지역만 붙은 지시 표현('국내 관련 시장')은 앞 시장의 범위로 이어진다", () => {
  // 실측 요약서(v19, 벼 품종 특허) 발췌. 공식(KOSIS) 표준값 시장의 환산 문장이 "국내 관련 시장"으로 이어진다.
  const official: MarketRef = {
    market_key: "국내쌀가공식품시장", label: "국내 쌀가공식품 시장", base_year: 2024, base_value_eok: 74117, cagr: 2.5,
    source: "KOSIS 국가통계포털, 농림축산식품부 「쌀가공식품제조업 실태조사」", status: "official",
  };
  const section = "**국내 쌀가공식품 시장**은 2024년 7조 4,117억 원을 기록하였으며 연평균 2.5%의 성장률을 나타내고 있다(농림축산식품부, 2024). 이를 복리 적용하여 환산할 경우 2026년 국내 관련 시장 규모는 약 7조 7,868억 원에 달할 것으로 전망된다.";

  it("환산값을 표준값으로 다시 계산하고 공식 출처(환산)를 붙인다", () => {
    const out = reconcileMarketSection(section, [official], { targetYear: 2026 });
    // 같은 시장을 다룬 다른 특허 요약과 같은 값: 74,117억 × 1.025² ≈ 7조 7,869억
    expect(out).toContain("2026년 국내 관련 시장 규모는 약 7조 7,869억 원에 달할 것으로 전망된다(출처: KOSIS 국가통계포털, 농림축산식품부 「쌀가공식품제조업 실태조사」, 2024년 기준값에서 환산)");
    expect(out).not.toContain("(AI 추정치)");
    expect(out).not.toContain("(농림축산식품부, 2024)");
  });

  it("고유한 이름이 붙은 다른 시장은 여전히 별개 시장으로 본다", () => {
    const text = "국내 쌀가공식품 시장은 2024년 7조 4,117억 원이며 연평균 2.5% 성장한다. 국내 콩가공품 상위 시장은 2023년 5,000억 원이며 연평균 4% 성장한다.";
    const out = reconcileMarketSection(text, [official], { targetYear: 2026 });
    expect(out).toContain("국내 콩가공품 상위 시장은 2023년 5,000억 원이며 연평균 4% 성장한다(AI 추정치)");
  });
});
