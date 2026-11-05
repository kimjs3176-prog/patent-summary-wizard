import { describe, it, expect } from "vitest";
import { aggregateTrends } from "../../supabase/functions/filing-trends/trendAggregation";
import type { TrendSnapshot } from "@/hooks/useFilingTrends";
import { fieldSnapshotTrend, resolveFieldId, resultYearCounts } from "@/components/insights/fieldTrend";

const now = new Date(Date.UTC(2026, 9, 24)); // 2026-10-24 → 기준연도 2024
const f = (number: string, date: string, applicant = "농촌진흥청", ipc = "A23L 2/00") => ({ number, date, applicant, ipc, title: "제목" });
const filings = [
  ...Array.from({ length: 6 }, (_, i) => f(`10202300000${10 + i}`, "20230310")),
  ...Array.from({ length: 9 }, (_, i) => f(`10202400000${10 + i}`, "20240310")),
  f("1020250000001", "20250610", "국립종자원", "A01H 5/00"),
];
const snapshot: TrendSnapshot = { ...aggregateTrends(filings, now), insights: [], updatedAt: "2026-10-24T01:00:00.000Z" };

describe("검색 결과 분야 추이 패널", () => {
  it("fieldId를 먼저 쓰고, 없으면 분야 이름으로 찾는다", () => {
    expect(resolveFieldId("crop", "아무거나")).toBe("crop");
    expect(resolveFieldId("", "식품")).toBe("food");
    expect(resolveFieldId("nope", "없는분야")).toBeNull();
  });

  it("스냅샷 수치를 그대로 쓰고 잠정 연도는 선에서 뺀다", () => {
    const t = fieldSnapshotTrend(snapshot, "food", "식품")!;
    expect([t.completeYear, t.latest, t.previous, t.growth]).toEqual([2024, 9, 6, 50]);
    expect(t.years.find((y) => y.year === "2024")).toEqual({ year: "2024", count: 9, provisional: false, completeCount: 9 });
    expect(t.years.find((y) => y.year === "2025")?.completeCount).toBeNull();
    expect(fieldSnapshotTrend(snapshot, "", "센서")).toBeNull(); // 스냅샷에 없는 분야 → 검색 결과 기준으로 대체
  });

  it("검색 결과 연도 집계는 보조 수치로만 쓴다", () => {
    const r = resultYearCounts([{ publicationDate: "2023.01.02" }, { publicationDate: "20240105" }, { publicationDate: "2024-03-01" }, { publicationDate: "" }]);
    expect(r).toEqual({ years: [{ year: "2023", count: 1 }, { year: "2024", count: 2 }], total: 3, lastYear: "2024", delta: 100 });
  });
});
