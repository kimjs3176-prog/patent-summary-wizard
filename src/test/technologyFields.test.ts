import { describe, expect, it } from "vitest";
import { aggregateFilings, classifyTechnology, filingPeriod } from "../../supabase/functions/_shared/technologyFields";
import { layoutTechnologyFields } from "../lib/technologyTreemap";

describe("three-year technology filings", () => {
  it("uses exactly the most recent three years", () => {
    expect(filingPeriod(new Date("2026-10-10T00:50:00Z"))).toEqual({ start: "20231010", end: "20261010" });
    expect(filingPeriod(new Date("2024-02-29T00:00:00Z"))).toEqual({ start: "20210228", end: "20240229" });
  });
  it("counts each application once using its primary IPC, only within scope and dates", () => {
    const rows = [
      { number: "1", applicant: "대한민국(농촌진흥청장)", ipc: "A23L 2/00|C12N 1/00", date: "20231010" },
      { number: "1", applicant: "농업기술원", ipc: "C12N", date: "20231010" },
      { number: "2", applicant: "외부 기업", ipc: "A23L", date: "20240101" },
      { number: "3", applicant: "농촌진흥청", ipc: "A23L", date: "20231009" },
      { number: "4", applicant: "농업기술센터", ipc: "G01N", date: "20261010" },
    ];
    const result = aggregateFilings(rows, "20231010", "20261010");
    expect(result.find(field => field.id === "food")?.count).toBe(1);
    expect(result.find(field => field.id === "digital")?.count).toBe(1);
    expect(result.reduce((sum, field) => sum + field.count, 0)).toBe(2);
    expect(classifyTechnology("A01H 4/00")).toBe("bio");
  });
  it("sizes area by application counts rather than search popularity", () => {
    const nodes = layoutTechnologyFields([{ id: "food", count: 300 }, { id: "bio", count: 100 }], 1000, 400);
    const food = nodes.find(node => node.id === "food");
    const bio = nodes.find(node => node.id === "bio");
    expect(food && bio ? (food.width * food.height) / (bio.width * bio.height) : 0).toBeCloseTo(3, 1);
  });
});