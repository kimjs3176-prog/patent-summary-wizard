import { describe, expect, it } from "vitest";
import { CONSORTIUM_ORGS, consortiumKind } from "@/lib/consortium";
import { CONSORTIUM_ORGS as SERVER_ORGS, normalizeApplicant } from "../../supabase/functions/_shared/consortiumOrgs";

describe("식품기술이전 협의체 기관", () => {
  it("화면 목록과 서버 목록이 같은 이름·순서다", () => {
    expect(SERVER_ORGS.map((o) => o.name)).toEqual(CONSORTIUM_ORGS);
    expect(new Set(CONSORTIUM_ORGS).size).toBe(51);
  });

  it("출원인명은 띄어쓰기·법인 표기만 지우고 비교해 비슷한 기관을 섞지 않는다", () => {
    expect(normalizeApplicant("(재)금산인삼약초산업진흥원")).toBe(normalizeApplicant("재단법인 금산인삼약초산업진흥원"));
    expect(normalizeApplicant("연세대학교기술지주 주식회사")).toBe(normalizeApplicant("주식회사 연세대학교기술지주"));
    expect(normalizeApplicant("건국대학교글로컬 산학협력단")).toBe(normalizeApplicant("건국대학교 글로컬산학협력단"));
    expect(normalizeApplicant("건국대학교 산학협력단")).not.toBe(normalizeApplicant("건국대학교 글로컬산학협력단"));
    expect(normalizeApplicant("연세대학교기술지주 주식회사")).not.toBe(normalizeApplicant("연세대학교 미래캠퍼스 산학협력단"));
  });

  it("owner 가 확인한 특허고객번호는 12자리로 그대로 둔다", () => {
    const pinned = Object.fromEntries(SERVER_ORGS.filter((o) => o.codes).map((o) => [o.name, o.codes]));
    expect(pinned).toEqual({
      "명지대학교 산학협력단": ["220050139720"],
      "부산대학교 산학협력단": ["220040044843"],
      "연세대학교기술지주 주식회사": ["120110324773"],
    });
  });

  it("기관을 대학·연구기관·기술지주회사로 나눈다", () => {
    expect(consortiumKind("연세대학교기술지주 주식회사")).toBe("holding");
    expect(consortiumKind("건국대학교 글로컬산학협력단")).toBe("univ");
    expect(consortiumKind("한국식품연구원")).toBe("inst");
    expect(consortiumKind("(재)금산인삼약초산업진흥원")).toBe("inst");
  });
});

describe("협의체 기관 목록 정렬", () => {
  it("가나다순으로 놓고 앞의 '국립'·'(재)'는 빼고 첫 글자를 본다", async () => {
    const { consortiumInitial, consortiumShortName, sortedConsortiumOrgs } = await import("@/lib/consortium");
    expect(consortiumShortName("건국대학교 글로컬산학협력단")).toBe("건국대학교 글로컬");
    expect(consortiumShortName("가천대학교 산학협력단")).toBe("가천대학교");
    expect(consortiumInitial("국립목포대학교 산학협력단")).toBe("ㅁ");
    expect(consortiumInitial("(재)금산인삼약초산업진흥원")).toBe("ㄱ");
    expect(consortiumInitial("국립생태원")).toBe("ㅅ");
    const sorted = sortedConsortiumOrgs();
    expect(sorted[0]).toBe("가천대학교 산학협력단");
    expect(sorted.at(-1)).toBe("한양대학교 산학협력단");
    expect(sorted.length).toBe(CONSORTIUM_ORGS.length);
  });
});
