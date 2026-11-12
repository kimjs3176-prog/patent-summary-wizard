import { afterEach, describe, it, expect, vi } from "vitest";
import { fetchKosisRef, findSeries, refFromSeries } from "../../supabase/functions/summarize-patent/kosis";
import { addSourceNote } from "../../supabase/functions/summarize-patent/marketConsistency";

afterEach(() => vi.unstubAllGlobals());

describe("국가통계 시장 표준값", () => {
  it("건강기능식품 시장은 KOSIS 통계표에 연결된다", () => {
    expect(findSeries("국내건강기능식품시장")?.tblId).toBe("DT_145010_009");
    expect(findSeries("국내홍삼시장")?.c1Name).toBe("홍삼");
    expect(findSeries("국내스마트팜시장")).toBeNull();
  });
  it("쌀가공식품·떡 시장은 실태조사 표에 연결된다", () => {
    expect(findSeries("국내쌀가공식품시장")).toMatchObject({ tblId: "DT_446001_A024", c2Name: "총계" });
    expect(findSeries("국내떡시장")).toMatchObject({ tblId: "DT_446001_A024", c2Name: "전통떡" });
    expect(findSeries("국내쌀시장")).toBeNull();
  });
  it("식품유형별 시장은 식품 생산실적의 국내판매액에 연결된다", () => {
    expect(findSeries("국내음료시장")).toMatchObject({ tblId: "DT_145003_A001", c1Name: "음료류", c2Name: "국내판매액" });
    expect(findSeries("국내장류시장")?.c1Name).toBe("장류");
    expect(findSeries("국내육가공품시장")).toBeNull(); // 식품 생산실적의 식육가공품은 축산물 가공업 실적이 빠져 시장 전체가 아니다
    expect(findSeries("국내농산가공식품시장")?.c1Name).toBe("농산가공식품류");
  });
  it("화장품·의료기기·건강기능식품 세부 원료 시장도 연결된다", () => {
    expect(findSeries("국내화장품시장")).toMatchObject({ tblId: "DT_145011_A004", itmId: "T003" });
    expect(findSeries("국내의료기기시장")?.c1Name).toBe("시장규모");
    expect(findSeries("국내개별인정형건강기능식품시장")?.c1Name).toBe("개별인정제품");
    expect(findSeries("국내인삼건강기능식품시장")?.c1Name).toBe("인삼");
  });
  it("범위가 다른 시장에는 통계값을 붙이지 않는다", () => {
    expect(findSeries("국내기능성화장품시장")).toBeNull();
    expect(findSeries("국내전통주시장")).toBeNull();
    expect(findSeries("국내인삼시장")).toBeNull();
    expect(findSeries("국내간건강기능성식품시장")).toBeNull();
    expect(findSeries("국내체외진단시장")).toBeNull();
    expect(findSeries("국내건강기능식품및기능성식품소재시장")).toBeNull();
  });
  it("실제 통계표에 있는 식품·화장품 세부 유형만 연결한다", () => {
    expect(findSeries("국내유가공품시장")).toMatchObject({ tblId: "DT_145003_A001", c1Name: "유가공품" });
    expect(findSeries("국내잼류시장")?.c1Name).toBe("잼류");
    expect(findSeries("국내과자빵떡시장")?.c1Name).toBe("과자류 빵류 또는 떡류");
    expect(findSeries("국내과자시장")).toBeNull(); // 통계상 과자·빵·떡을 별도 값으로 나눌 수 없다
    expect(findSeries("국내색조화장품시장")).toMatchObject({ tblId: "DT_145011_A013", c1Name: "색조화장용 제품류" });
    expect(findSeries("국내영·유아용제품시장")?.c1Name).toBe("영.유아용 제품류");
  });
  it("생물농약은 제조업 출하액으로 구분하고 복합 농자재 시장에는 적용하지 않는다", () => {
    expect(findSeries("국내생물살균살충제및식물보호제제조업시장")).toMatchObject({
      tblId: "DT_1FS1101", itmId: "T04", c1Name: "전국", c2Code: "C20322",
    });
    expect(findSeries("국내생물농약시장")).toBeNull();
    expect(findSeries("국내생물농약및친환경농자재시장")).toBeNull();
  });
  it("생물농약 제조업 코드로 2024년 출하액과 5년 CAGR을 계산한다", async () => {
    const series = findSeries("국내생물살균살충제및식물보호제제조업시장")!;
    const values: Record<number, number> = { 2020: 219215, 2021: 221609, 2022: 54663, 2023: 58137, 2024: 58764 };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ response: { body: { items: { item: Object.entries(values).map(([year, value]) => ({
      C1_NM: "전국", C2: "C20322", ITM_ID: "T04", PRD_DE: year, DT: String(value),
    })) } } } }), { status: 200 })));
    const ref = await fetchKosisRef("국내생물살균살충제및식물보호제제조업시장", series, "test-key");
    expect(ref).toMatchObject({ base_year: 2024, base_value_eok: 588, cagr: -28, status: "official" });
    expect(ref?.source).toContain("출하액");
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
