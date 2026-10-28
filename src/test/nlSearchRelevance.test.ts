import { describe, it, expect } from "vitest";
import {
  buildConceptGroups,
  buildPlanQueries,
  rankNaturalLanguage,
  sanitizeNlTerms,
  sanitizeSynonymMap,
  requiredConcepts,
} from "../../supabase/functions/search-patents/nlRelevance";

const p = (title: string, snippet = "") => ({ title, snippet });

describe("문장형 검색 정합도 규칙", () => {
  it("'제조방법'·'기술' 같은 일반어는 핵심어에서 제외", () => {
    expect(sanitizeNlTerms(["쌀", "제조방법", "간식", "기술"])).toEqual(["쌀", "간식"]);
  });

  it("핵심 개념이 2개면 둘 다 충족한 특허만 보여줌", () => {
    const groups = buildConceptGroups(["딸기", "저장성"], ["선도유지"]);
    const ranked = rankNaturalLanguage([
      p("딸기 재배용 냉난방 시스템"),
      p("딸기의 저장, 유통성 향상을 위한 페룰린산 처리 방법"),
      p("선도 유지를 위한 딸기 포장 용기"),
    ], groups);
    expect(ranked.map((x) => x.title)).toEqual([
      "딸기의 저장, 유통성 향상을 위한 페룰린산 처리 방법",
      "선도 유지를 위한 딸기 포장 용기",
    ]);
  });

  it("필요한 개념 수: 1개→1, 2개→2, 3개→2", () => {
    expect([1, 2, 3].map(requiredConcepts)).toEqual([1, 2, 2]);
  });

  it("'음식 기름 제거' 질문에 '씨 제거'·'들기름'처럼 한 개념만 맞는 특허는 보여주지 않음", () => {
    const groups = buildConceptGroups(["음식", "기름", "제거"], [], [], { 기름: ["유지", "지방"] });
    const ranked = rankNaturalLanguage([
      p("과일 씨앗 제거장치", "과일이 온전한 형태가 유지될 수 있도록 씨앗을 제거"),
      p("향기성분이 강화된 늘새미 들기름"),
      p("튀김 음식의 기름 제거 장치"),
    ], groups);
    expect(ranked.map((x) => x.title)).toEqual(["튀김 음식의 기름 제거 장치"]);
  });

  it("두 번째 개념이 초록에만 스치듯 나오면 제외('딸기 재배용 냉난방'의 '유체를 저장')", () => {
    const groups = buildConceptGroups(["딸기", "저장"], []);
    const ranked = rankNaturalLanguage([
      p("딸기 재배용 냉난방 시스템", "태양열을 집열하고 유체를 저장하는 버퍼부"),
      p("딸기의 저장 유통성 향상 처리 방법"),
    ], groups);
    expect(ranked.map((x) => x.title)).toEqual(["딸기의 저장 유통성 향상 처리 방법"]);
  });

  it("동의어는 초록에만 있으면 개념 충족으로 치지 않음", () => {
    const groups = buildConceptGroups(["과일", "기름"], [], [], { 기름: ["유지"] });
    expect(rankNaturalLanguage([p("과일 세척 장치", "형태가 유지될 수 있도록")], groups)).toEqual([]);
    expect(rankNaturalLanguage([p("과일 유지 추출 방법")], groups)).toHaveLength(1);
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

  it("문장 속 세 개념(돼지·질병·진단)을 모두 충족한 특허가 일부만 충족한 특허보다 먼저 나옴", () => {
    const groups = buildConceptGroups(["돼지", "질병", "진단"], [], [], { 질병: ["증후군"], 진단: ["검출"] });
    const ranked = rankNaturalLanguage([
      p("돼지 임신 진단 장치"),
      p("돼지 생식기호흡기증후군 진단용 조성물"),
    ], groups);
    expect(ranked[0].title).toBe("돼지 생식기호흡기증후군 진단용 조성물");
  });

  it("검색어 조합은 전체 AND → 동의어 치환 → 대상 포함 쌍 → 단일어 순", () => {
    expect(buildPlanQueries(["돼지", "질병", "진단"], { 진단: ["검출"] })).toEqual([
      "돼지*질병*진단", "돼지*질병*검출", "돼지*진단", "돼지*질병", "돼지", "질병", "진단",
    ]);
  });

  it("동의어 목록은 실제 핵심어에 연결된 것만 유지", () => {
    expect(sanitizeSynonymMap({ 진단: ["검출", "기술"], 사과: ["배"] }, ["돼지", "진단"])).toEqual({ 진단: ["검출"] });
  });
});
