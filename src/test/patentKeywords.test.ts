import { describe, it, expect } from "vitest";
import { parsePatentTitle } from "@/lib/patentKeywords";
import { extractKeywordsFromPatent } from "@/components/PatentSummary/_keywords";

const words = (t: string, ipc: string[] = [], summary = "") => extractKeywordsFromPatent({ titleKo: t, classifications: ipc }, 5, summary).map((k) => k.word);

describe("특허 명칭 나누기", () => {
  it("'…을 포함하는 …용 조성물': 원료·방식·용도·형태", () => {
    expect(parsePatentTitle("미생물 발효 유채박을 유효성분으로 함유하는 식물 생장 촉진용 조성물 및 이를 이용한 식물 생장 촉진 방법")).toMatchObject({ subject: "유채박", way: "미생물 발효", use: "식물 생장 촉진", kind: "조성물" });
  });
  it("'…을 이용한 … 방법': 수단·용도", () => {
    expect(parsePatentTitle("영상 분석을 이용한 작물 생육 관리 방법")).toMatchObject({ means: "영상 분석", use: "작물 생육 관리", kind: "방법" });
  });
  it("'…을'이 없으면 '…용' 앞 낱말", () => {
    expect(parsePatentTitle("콩 들불병 진단용 조성물 및 이의 용도")).toMatchObject({ useWords: ["콩", "들불병", "진단"], kind: "조성물" });
  });
});

describe("요약서 관련 키워드", () => {
  it("분류 이름 대신 이 특허의 원료·용도·방식을 먼저", () => {
    const kw = words("미생물 발효 유채박을 유효성분으로 함유하는 식물 생장 촉진용 조성물 및 이를 이용한 식물 생장 촉진 방법", ["A01N 63/10", "C05F 11/08"], "유채박을 발효한 비료 조성물로 생육을 촉진한다. 비료 사용량을 줄인다.");
    expect(kw.slice(0, 3)).toEqual(["유채박", "식물 생장 촉진", "미생물 발효"]);
    expect(kw).not.toContain("발효기능");
    expect(kw.length).toBeLessThanOrEqual(5);
  });
  it("진단용 조성물", () => {
    expect(words("콩 들불병 진단용 조성물 및 이의 용도", ["C12Q 1/68"]).slice(0, 2)).toEqual(["콩", "들불병 진단"]);
  });
  it("명칭에서 뽑지 못하면 분류 규칙 결과", () => {
    expect(words("스마트 온실", ["A01G 9/24"]).length).toBeGreaterThan(0);
  });
  it("'라이스 볼의 제조방법': 조사가 붙은 꼴 대신 낱말 '라이스 볼'을 제품으로", () => {
    expect(parsePatentTitle("쌀 단백질을 함유하는 라이스 볼의 제조방법")).toMatchObject({ subject: "단백질", product: "라이스 볼", use: "" });
    const kw = words("쌀 단백질을 함유하는 라이스 볼의 제조방법", ["A23L 7/157", "A23L 17/00"], "쌀 단백질을 첨가해 식감을 개선한 라이스 볼을 제조한다. ".repeat(4));
    expect(kw).toContain("라이스 볼");
    expect(kw).not.toContain("라이스 볼의");
    expect(kw).not.toContain("장치·시스템");
    expect(kw.every((w) => !/(의|을|를)$/.test(w))).toBe(true);
  });
});
