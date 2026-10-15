import { describe, it, expect } from "vitest";
import { claimToRef, isAmbiguousMarket } from "../../supabase/functions/summarize-patent/marketConsistency";

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
