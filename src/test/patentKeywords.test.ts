import { describe, it, expect } from "vitest";
import { parsePatentTitle, titleNouns } from "@/lib/patentKeywords";
import { extractKeywordsFromPatent } from "@/components/PatentSummary/_keywords";

const words = (t: string, ipc: string[] = [], summary = "") => extractKeywordsFromPatent({ titleKo: t, classifications: ipc }, 5, summary).map((k) => k.word);

describe("특허 명칭 나누기", () => {
  it("'…을 포함하는 …용 조성물': 원료·방식·용도·형태", () => {
    expect(parsePatentTitle("미생물 발효 유채박을 유효성분으로 함유하는 식물 생장 촉진용 조성물 및 이를 이용한 식물 생장 촉진 방법")).toMatchObject({ subject: "유채박", way: "미생물 발효", use: "식물 생장 촉진", kind: "조성물" });
  });
  it("'…을 이용한 … 방법': 수단·용도", () => {
    expect(parsePatentTitle("영상 분석을 이용한 작물 생육 관리 방법")).toMatchObject({ means: "영상 분석", use: "작물 생육 관리", kind: "방법" });
  });
  it("'…의 …을 위한 … 방법/시스템': 대상·용도·수단·형태 (쉼표·괄호·'및'이 섞여도)", () => {
    expect(parsePatentTitle("딸기의 저장, 유통성 향상을 위한 페룰린산(Ferulic acid) 처리 방법 및 이의 용도")).toMatchObject({ subject: "딸기", use: "저장·유통성 향상", means: "페룰린산 처리", kind: "방법" });
    expect(parsePatentTitle("유기질비료의 부숙도 판정을 위한 기체 포집 및 농도 계측 시스템 및 그 동작 방법")).toMatchObject({ subject: "유기질비료", use: "부숙도 판정", means: "기체 포집·농도 계측", kind: "시스템" });
  });
  it("명칭의 내용 낱말(조사·형태·연결 낱말 제외)", () => {
    expect(titleNouns("스마트 온실의 환기 장치")).toEqual(["스마트", "온실"]);
    expect(titleNouns("그 동작 방법")).toEqual(["동작"]);
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
  it("명칭에서 뽑지 못하면 명칭 낱말을 먼저, 분류 규칙은 보충만", () => {
    const kw = words("스마트 온실", ["A01G 9/24"]);
    expect(kw.slice(0, 2)).toEqual(["스마트", "온실"]);
    expect(kw).not.toContain("스마트팜");
  });
  it("'…을 위한' 명칭: 분류 이름(스마트팜·비료산업)만 나오지 않고 이 특허의 낱말이 앞에 온다", () => {
    // 운영 요약서에서 '스마트팜 · 음료 · 친환경', '비료산업 · 비료 · 친환경'만 나오던 두 특허
    const a = words("딸기의 저장, 유통성 향상을 위한 페룰린산(Ferulic acid) 처리 방법 및 이의 용도", ["A01G 22/05|A01G 7/06|A01N 37/02"]);
    expect(a.slice(0, 3)).toEqual(["딸기", "저장·유통성 향상", "페룰린산 처리"]);
    expect(a).not.toContain("스마트팜");
    const b = words("유기질비료의 부숙도 판정을 위한 기체 포집 및 농도 계측 시스템 및 그 동작 방법", ["G01N 33/00|G01N 1/22"]);
    expect(b.slice(0, 3)).toEqual(["유기질비료", "부숙도 판정", "기체 포집·농도 계측"]);
  });
  it("A01G(원예·재배 전반)는 '스마트팜'이 아니라 '원예·재배'", () => {
    expect(words("스마트 온실", ["A01G 9/24"])).toContain("원예·재배");
  });
  it("'…을 위한 … 장치 및 방법'·'…을 위한 조성물': '및'이나 형태 낱말만 남은 조각을 키워드로 쓰지 않는다", () => {
    expect(parsePatentTitle("작물 재배를 위한 양액 공급 장치 및 방법")).toMatchObject({ use: "작물 재배", means: "양액 공급", kind: "방법" });
    expect(parsePatentTitle("식물 생장 촉진을 위한 조성물")).toMatchObject({ use: "식물 생장 촉진", means: "", kind: "조성물" });
    expect(words("돼지 사육을 위한 스마트 축사 관리 시스템 및 방법").slice(0, 2)).toEqual(["돼지 사육", "스마트 축사 관리"]);
    expect(words("식물 생장 촉진을 위한 조성물")).not.toContain("조성물");
  });
  it("덜 나뉜 명칭 조각('…조성물, 이')과 이음 조사('종류와')는 키워드가 되지 않는다", () => {
    const a = words("축산분뇨의 악취 제거용 조성물, 이를 이용한 비료 및 그 제조방법");
    expect(a.slice(0, 2)).toEqual(["축산분뇨", "악취"]);
    expect(a.some((w) => w.includes(","))).toBe(false);
    expect(titleNouns("약제의 종류와 양을 가변하여 살포 가능한 방제용 드론")).toEqual(["약제", "종류"]);
    expect(titleNouns("수송형 드론과 사과 수확 장치")).toEqual(["수송형", "드론"]);
    expect(titleNouns("무화과 결과 분석")).toEqual(["무화과", "결과"]);
    expect(titleNouns("이미지 기반 딸기 품질 판정 시스템")).toEqual(["이미지", "딸기"]);
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
