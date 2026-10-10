import { describe, expect, it } from "vitest";
import { aggregateFilings, classifyTechnology, filingPeriod } from "../../supabase/functions/_shared/technologyFields";
import { layoutTechnologyFields, groupTechnologyFields, visibleTechnologyFields } from "../lib/technologyTreemap";

describe("three-year technology filings", () => {
  it("includes 10 filings and excludes counts below 10 without changing source statistics", () => {
    const fields = [{ id: "food", count: 154 }, { id: "cosmetics", count: 10 }, { id: "bio", count: 9 }, { id: "soil", count: 0 }] as const;
    expect(visibleTechnologyFields([...fields])).toEqual([{ id: "food", count: 154 }, { id: "cosmetics", count: 10 }]);
    expect(fields.reduce((sum, field) => sum + field.count, 0)).toBe(173);
  });
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
    expect(classifyTechnology("A01H 4/00")).toBe("breeding");
  });
  it("sizes area by application counts rather than search popularity", () => {
    const nodes = layoutTechnologyFields([{ id: "food", count: 300 }, { id: "bio", count: 100 }], 1000, 400);
    const food = nodes.find(node => node.id === "food");
    const bio = nodes.find(node => node.id === "bio");
    expect(food && bio ? (food.width * food.height) / (bio.width * bio.height) : 0).toBeCloseTo(3, 1);
  });
  it("separates breeding from biotechnology by primary IPC", () => {
    expect(classifyTechnology("A01H 1/00|C12N 15/00")).toBe("breeding");
    expect(classifyTechnology("C12N 15/00|A01H 5/00")).toBe("bio");
    expect(classifyTechnology("C07K 14/00")).toBe("chemistry");
  });
  it("separates cosmetic preparations from medicinal technologies", () => {
    expect(classifyTechnology("A61K 8/97")).toBe("cosmetics");
    expect(classifyTechnology("A61Q 19/00")).toBe("cosmetics");
    expect(classifyTechnology("A61K 36/00")).toBe("health");
    expect(classifyTechnology("A61K 80/00")).toBe("health");
  });
  it("separates pest protection, fertilizers and environmental treatment", () => {
    expect(classifyTechnology("A01P 7/04")).toBe("protection");
    expect(classifyTechnology("A01N 65/00")).toBe("protection");
    expect(classifyTechnology("A01M 1/00")).toBe("protection");
    expect(classifyTechnology("C05F 11/00")).toBe("fertilizer");
    expect(classifyTechnology("C02F 1/00")).toBe("environment");
    expect(classifyTechnology("A01G 9/00")).toBe("crop");
  });
  it("places beverage fermentation in food and veterinary equipment in livestock", () => {
    expect(classifyTechnology("C12G 3/00")).toBe("fermentation");
    expect(classifyTechnology("A61D 7/00")).toBe("livestock");
  });
  it("retains a complete total when splitting the old merged fields", () => {
    const rows = ["A01H", "C12N", "A61K 36/00", "A61K 8/97", "A01N", "C05F", "C02F"].map((ipc, i) => ({ number: String(i), applicant: "농촌진흥청", ipc, date: "20261010" }));
    const fields = aggregateFilings(rows, "20231010", "20261010");
    for (const id of ["breeding", "bio", "health", "cosmetics", "protection", "fertilizer", "environment"]) {
      expect(fields.find(field => field.id === id)?.count).toBe(1);
    }
    expect(fields.reduce((sum, field) => sum + field.count, 0)).toBe(7);
  });
  it("splits combined fields using distinct primary IPC groups", () => {
    const cases = [
      ["A23L 2/00", "food"], ["A23N 1/00", "processing"], ["A23B 7/00", "storage"],
      ["A01H 1/00", "breeding"], ["A01H 5/00", "variety"],
      ["A01K 61/00", "aquaculture"], ["A01K 1/00", "livestock"],
      ["B09B 3/00", "recycling"], ["C09K 17/00", "soil"],
      ["G06F 16/00", "computing"], ["G01N 21/00", "digital"], ["G05B 19/00", "control"], ["H04W 4/00", "electronics"],
    ];
    for (const [ipc, id] of cases) expect(classifyTechnology(ipc)).toBe(id);
  });
  it("includes low-count and zero-count fields exactly once in rotating groups without changing counts", () => {
    const fields = [{ id: "food", count: 300 }, { id: "bio", count: 100 }, { id: "fertilizer", count: 2 }, { id: "soil", count: 0 }] as const;
    const groups = groupTechnologyFields([...fields], 4);
    expect(groups.flat()).toEqual([...fields]);
    expect(groups.flat().reduce((sum, field) => sum + field.count, 0)).toBe(402);
    expect(groups.some(group => group.some(field => field.id === "fertilizer"))).toBe(true);
    expect(groups.some(group => group.some(field => field.id === "soil"))).toBe(true);
  });
});