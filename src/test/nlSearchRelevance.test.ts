import { describe, it, expect } from "vitest";
import {
  buildConceptGroups,
  rankNaturalLanguage,
  sanitizeNlTerms,
  MIN_NL_RESULTS,
} from "../../supabase/functions/search-patents/nlRelevance";

const p = (title: string, snippet = "") => ({ title, snippet });

describe("문장형 검색 정합도 규칙", () => {
  it("'제조방법'·'기술' 같은 일반어는 핵심어에서 제외", () => {
    expect(sanitizeNlTerms(["쌀", "제조방법", "간식", "기술"])).toEqual(["쌀", "간식"]);
  });

  it("모든 핵심 개념을 충족한 특허가 하나만 충족한 특허보다 먼저 나옴", () => {
    const groups = buildConceptGroups(["딸기", "저장성"], ["선도유지"]);
    const ranked = rankNaturalLanguage([
      p("딸기 재배용 냉난방 시스템"),
      p("딸기의 저장, 유통성 향상을 위한 페룰린산 처리 방법"),
      p("선도 유지를 위한 딸기 포장 용기"),
    ], groups);
    expect(ranked.map((x) => x.title)).toEqual([
      "딸기의 저장, 유통성 향상을 위한 페룰린산 처리 방법",
      "선도 유지를 위한 딸기 포장 용기",
      "딸기 재배용 냉난방 시스템",
    ]);
  });

  it("어떤 핵심 개념도 없는 특허는 제외", () => {
    const groups = buildConceptGroups(["딸기", "저장"], []);
    const ranked = rankNaturalLanguage([p("사과 착즙 장치"), p("딸기 저장 방법")], groups);
    expect(ranked.map((x) => x.title)).toEqual(["딸기 저장 방법"]);
  });

  it("한 글자 작물명(쌀)도 핵심어로 인정하되 단어 중간(새찰쌀보리)은 제외", () => {
    const groups = buildConceptGroups(["쌀"], []);
    const ranked = rankNaturalLanguage([p("새찰쌀보리 추출물 조성물"), p("쌀 호두과자 및 이의 제조 방법")], groups);
    expect(ranked.map((x) => x.title)).toEqual(["쌀 호두과자 및 이의 제조 방법"]);
  });

  it("전체 충족 결과가 10건 이상이면 일부만 충족한 특허는 붙이지 않음", () => {
    const groups = buildConceptGroups(["딸기", "저장"], []);
    const full = Array.from({ length: MIN_NL_RESULTS }, (_, i) => p(`딸기 저장 방법 ${i}`));
    const ranked = rankNaturalLanguage([...full, p("딸기 수확 운반차")], groups);
    expect(ranked).toHaveLength(10);
    expect(ranked.some((x) => x.title === "딸기 수확 운반차")).toBe(false);
  });

  it("전체 충족 결과가 적으면 일부 충족 특허로 10건까지 채움", () => {
    const groups = buildConceptGroups(["딸기", "저장"], []);
    const partial = Array.from({ length: 15 }, (_, i) => p(`딸기 재배 ${i}`));
    const ranked = rankNaturalLanguage([...partial, p("딸기 저장 방법")], groups);
    expect(ranked).toHaveLength(10);
    expect(ranked[0].title).toBe("딸기 저장 방법");
  });
});
