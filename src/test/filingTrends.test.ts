import { describe, it, expect } from "vitest";
import { aggregateTrends, disclosureWindow, formatApplicationNumber, growthRate, trendPeriod, verifiedInsights } from "../../supabase/functions/filing-trends/trendAggregation";

const now = new Date(Date.UTC(2026, 9, 24)); // 2026-10-24
const f = (number: string, date: string, applicant = "농촌진흥청", ipc = "A23L 2/00", title = "제목") => ({ number, date, applicant, ipc, title });

describe("농식품 특허 출원 동향 규칙", () => {
  it("공개 지연 18개월: 2026-10-24 기준 완결 연도는 2024년", () => {
    expect(disclosureWindow(now)).toEqual({ completeYear: 2024, disclosedThrough: "20250424" });
  });

  it("최근 5개 완결 연도부터 오늘까지 집계 (2020-01-01 ~ 2026-10-24)", () => {
    expect(trendPeriod(now)).toEqual({ start: "20200101", end: "20261024" });
  });

  it("6개 기관 밖 출원인과 중복 출원번호는 제외", () => {
    const r = aggregateTrends([f("1020240000001", "20240301"), f("1020240000001", "20240301"), f("1020240000002", "20240302", "주식회사 에이")], now);
    expect(r.total).toBe(1);
  });

  it("2025·2026년은 아직 공개 중인 잠정 수치로 표시", () => {
    const r = aggregateTrends([f("1020240000001", "20240301")], now);
    expect(r.yearly.find((y) => y.year === 2024)?.provisional).toBe(false);
    expect(r.yearly.find((y) => y.year === 2025)?.provisional).toBe(true);
  });

  it("실용신안(20으로 시작)은 특허와 따로 셈", () => {
    const r = aggregateTrends([f("1020240000001", "20240301"), f("2020240000002", "20240302")], now);
    const y = r.yearly.find((x) => x.year === 2024)!;
    expect([y.patent, y.utility]).toEqual([1, 1]);
  });

  it("증감률은 전년 5건 이상일 때만 계산", () => {
    expect(growthRate(12, 10)).toBe(20);
    expect(growthRate(8, 4)).toBeNull();
  });

  it("도 농업기술원과 시·군 농업기술센터를 구분", () => {
    const r = aggregateTrends([f("1020240000001", "20240301", "경기도농업기술원"), f("1020240000002", "20240301", "평택시농업기술센터")], now);
    expect(r.institutes.map((i) => i.id).sort()).toEqual(["ares", "atec"]);
  });

  it("AI 요약 문장에 통계에 없는 숫자가 있으면 버림", () => {
    const r = aggregateTrends(Array.from({ length: 7 }, (_, i) => f(`10202400000${10 + i}`, "20240301")), now);
    const out = verifiedInsights(["2024년 출원은 7건입니다.", "2024년 출원은 99건으로 급증했습니다."], r);
    expect(out).toEqual(["2024년 출원은 7건입니다."]);
  });

  it("출원번호 표기: 1020240123456 → 10-2024-0123456", () => {
    expect(formatApplicationNumber("1020240123456")).toBe("10-2024-0123456");
  });
});
