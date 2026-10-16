import { describe, expect, it } from "vitest";
import { getSectionBudgets, SUMMARY_SECTIONS } from "../../supabase/functions/summarize-patent/sectionBalance";

describe("summary section balance budgets", () => {
  it("gives all five sections equal default budgets", () => {
    const budgets = getSectionBudgets();
    expect(budgets.map((b) => b.title)).toEqual([...SUMMARY_SECTIONS]);
    expect(new Set(budgets.map((b) => b.minChars)).size).toBe(1);
    expect(new Set(budgets.map((b) => b.maxChars)).size).toBe(1);
  });

  it("honors individual settings while keeping the target spread under 30 percent", () => {
    const budgets = getSectionBudgets({ "기술분야": 1, "상용화전망": 10 });
    const targets = budgets.map((b) => (b.minChars + b.maxChars) / 2);
    expect(targets[0]).toBeLessThan(targets[4]);
    expect(Math.max(...targets) / Math.min(...targets)).toBeLessThanOrEqual(1.3);
  });

  it("handles malformed and out-of-range saved settings with bounded budgets", () => {
    expect(getSectionBudgets({ "기술분야": NaN })).toEqual(getSectionBudgets());
    expect(getSectionBudgets({ "상용화전망": 100 })).toEqual(getSectionBudgets({ "상용화전망": 10 }));
    expect(getSectionBudgets({ "기술분야": -100 })).toEqual(getSectionBudgets({ "기술분야": 1 }));
  });
});