import { describe, expect, it } from "vitest";
import { CONSORTIUM_ORGS, consortiumKind } from "@/lib/consortium";
import { CONSORTIUM_ORGS as SERVER_ORGS, normalizeApplicant } from "../../supabase/functions/_shared/consortiumOrgs";

describe("식품기술이전 협의체 기관", () => {
  it("화면 목록과 서버 목록이 같은 이름·순서다", () => {
    expect(SERVER_ORGS.map((o) => o.name)).toEqual(CONSORTIUM_ORGS);
    expect(new Set(CONSORTIUM_ORGS).size).toBe(53);
  });

  it("출원인명은 띄어쓰기·법인 표기만 지우고 비교해 비슷한 기관을 섞지 않는다", () => {
    expect(normalizeApplicant("(재)금산인삼약초산업진흥원")).toBe(normalizeApplicant("재단법인 금산인삼약초산업진흥원"));
    expect(normalizeApplicant("㈜명지대학교 기술지주회사")).toBe(normalizeApplicant("주식회사 명지대학교기술지주회사"));
    expect(normalizeApplicant("건국대학교글로컬 산학협력단")).toBe(normalizeApplicant("건국대학교 글로컬산학협력단"));
    expect(normalizeApplicant("건국대학교 산학협력단")).not.toBe(normalizeApplicant("건국대학교 글로컬산학협력단"));
    expect(normalizeApplicant("연세대학교 기술지주회사")).not.toBe(normalizeApplicant("연세대학교 미래캠퍼스 산학협력단"));
  });

  it("기관을 대학·연구기관·기술지주회사로 나눈다", () => {
    expect(consortiumKind("연세대학교 기술지주회사")).toBe("holding");
    expect(consortiumKind("건국대학교 글로컬산학협력단")).toBe("univ");
    expect(consortiumKind("세계김치연구소")).toBe("inst");
    expect(consortiumKind("(재)금산인삼약초산업진흥원")).toBe("inst");
  });
});
