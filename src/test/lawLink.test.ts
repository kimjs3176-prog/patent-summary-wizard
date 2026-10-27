import { describe, expect, it } from "vitest";
import { publicLawLink } from "../../supabase/functions/analyze-regulations/lawLink";

describe("public law links", () => {
  it("builds the public law page from the law serial number and effective date", () => {
    expect(publicLawLink({ mst: "289591", effectiveDate: "20260915" }))
      .toBe("https://www.law.go.kr/lsInfoP.do?lsiSeq=289591&efYd=20260915");
  });

  it("falls back to the serial number inside the API detail link without exposing the API account", () => {
    const link = publicLawLink({ detailLink: "/DRF/lawService.do?OC=secretid&target=law&MST=276591&type=HTML&efYd=20251001" });
    expect(link).toBe("https://www.law.go.kr/lsInfoP.do?lsiSeq=276591&efYd=20251001");
    expect(link).not.toContain("OC=");
  });

  it("returns no link when the serial number is missing", () => {
    expect(publicLawLink({ effectiveDate: "20260915" })).toBeUndefined();
  });
});
