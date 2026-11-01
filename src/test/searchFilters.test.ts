import { describe, it, expect } from "vitest";
import {
  applySearchFilters, EMPTY_SEARCH_FILTERS, isFilterActive, parseFilterParams, resultYear, topOrgs, writeFilterParams,
  type SearchResultRow,
} from "@/components/search/searchFilters";
import { cardToFavorite } from "@/components/search/cardFavorite";

const row = (patentId: string, extra: Partial<SearchResultRow> = {}): SearchResultRow => ({ patentId, title: patentId, ...extra });

describe("검색 결과 필터 URL 상태", () => {
  it("URL 쿼리에서 필터를 읽고, 잘못된 값은 버린다", () => {
    const s = parseFilterParams(new URLSearchParams("keyword=딸기&yf=2015&yt=abcd&org=농촌진흥청&org=농촌진흥청&org=%20&reg=1&sort=newest"));
    expect(s).toEqual({ yearFrom: 2015, yearTo: null, orgs: ["농촌진흥청"], registered: "registered", sort: "newest" });
    expect(parseFilterParams(new URLSearchParams("reg=x&sort=old&yf=1800"))).toEqual(EMPTY_SEARCH_FILTERS);
  });

  it("시작 연도가 끝 연도보다 크면 서로 바꾼다", () => {
    const s = parseFilterParams(new URLSearchParams("yf=2022&yt=2018"));
    expect([s.yearFrom, s.yearTo]).toEqual([2018, 2022]);
  });

  it("쓰기 → 읽기 왕복이 같은 상태를 돌려주고 다른 쿼리(keyword/field)는 유지한다", () => {
    const state = { yearFrom: 2010, yearTo: 2020, orgs: ["농촌진흥청", "국립종자원"], registered: "unregistered" as const, sort: "newest" as const };
    const params = writeFilterParams(new URLSearchParams("keyword=딸기&field=스마트팜&fieldId=x&yf=1999"), state);
    expect(params.get("keyword")).toBe("딸기");
    expect(params.get("field")).toBe("스마트팜");
    expect(params.get("fieldId")).toBe("x");
    expect(parseFilterParams(params)).toEqual(state);
  });

  it("기본값은 URL에 쓰지 않는다", () => {
    const params = writeFilterParams(new URLSearchParams("keyword=딸기&yf=2015&org=a&reg=1&sort=newest"), EMPTY_SEARCH_FILTERS);
    expect(params.toString()).toBe(new URLSearchParams("keyword=딸기").toString());
    expect(isFilterActive(EMPTY_SEARCH_FILTERS)).toBe(false);
    expect(isFilterActive({ ...EMPTY_SEARCH_FILTERS, sort: "newest" })).toBe(false);
  });
});

describe("검색 결과 필터 적용", () => {
  const rows = [
    row("A", { applicationDate: "2012.03.01", assignee: "농촌진흥청", registrationNumber: "1012345670000" }),
    row("B", { applicationDate: "2021.07.15", assignee: "국립종자원", registrationNumber: "" }),
    row("C", { publicationDate: "2019.01.02", assignee: "농촌진흥청" }),
    row("D", { assignee: "농촌진흥청" }),
  ];

  it("출원연도는 출원일 우선, 없으면 공개일", () => {
    expect(rows.map(resultYear)).toEqual([2012, 2021, 2019, null]);
  });

  it("연도·기관·등록 여부 조건을 함께 적용하고 연도가 없는 특허는 연도 필터에서 제외", () => {
    const f = (patch: object) => applySearchFilters(rows, { ...EMPTY_SEARCH_FILTERS, ...patch }).map((r) => r.patentId);
    expect(f({})).toEqual(["A", "B", "C", "D"]);
    expect(f({ yearFrom: 2015 })).toEqual(["B", "C"]);
    expect(f({ yearTo: 2019 })).toEqual(["A", "C"]);
    expect(f({ orgs: ["농촌진흥청"] })).toEqual(["A", "C", "D"]);
    expect(f({ registered: "registered" })).toEqual(["A"]);
    expect(f({ registered: "unregistered", orgs: ["농촌진흥청"] })).toEqual(["C", "D"]);
  });

  it("최신순은 날짜 내림차순, 날짜 없는 특허는 뒤로, 같은 날짜는 관련도 순서 유지", () => {
    const withTie = [...rows, row("E", { applicationDate: "2021.07.15" })];
    const ids = applySearchFilters(withTie, { ...EMPTY_SEARCH_FILTERS, sort: "newest" }).map((r) => r.patentId);
    expect(ids).toEqual(["B", "E", "C", "A", "D"]);
  });

  it("기관 목록은 많은 순 상위 N개, 선택된 기관은 상위에 없어도 포함", () => {
    expect(topOrgs(rows, 1).map((o) => o.name)).toEqual(["농촌진흥청"]);
    expect(topOrgs(rows, 1, ["국립종자원"])).toEqual([{ name: "농촌진흥청", count: 3 }, { name: "국립종자원", count: 1 }]);
  });
});

describe("카드에서 담기", () => {
  it("카드 필드만으로 최소 관심특허를 만든다(점수는 비워 두고 빈 값은 저장하지 않음)", () => {
    const fav = cardToFavorite({ patentNumber: "10-1234567", title: "딸기 저장 방법", assignee: " 농촌진흥청 ", registrationNumber: null, publicationDate: "" });
    expect(fav.patentNumber).toBe("10-1234567");
    expect(fav.commercializationScore).toBeNull();
    expect(fav.patentData).toEqual({ title: "딸기 저장 방법", titleKo: "딸기 저장 방법", assignee: "농촌진흥청", patentNumber: "10-1234567" });
  });
});
