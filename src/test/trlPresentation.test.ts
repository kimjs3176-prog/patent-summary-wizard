import { describe, expect, it } from "vitest";
import { resolveTrlLevels } from "../lib/trlPresentation";

describe("TRL presentation settings resolution", () => {
  it("always returns nine ordered levels without altering level numbers", () => {
    expect(resolveTrlLevels([{ level: 6 }, { level: 25 }]).map((item) => item.level))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("preserves custom settings by level rather than array position", () => {
    const custom = { level: 6, label: "custom", description: "custom definition" };
    const resolved = resolveTrlLevels([custom]);
    expect(resolved[5]).toMatchObject(custom);
    expect(resolved[0].level).toBe(1);
  });
  it("safely falls back for malformed saved levels", () => {
    expect(resolveTrlLevels(null)).toEqual(resolveTrlLevels({ levels: [] }));
    expect(resolveTrlLevels([null, { level: 6, label: 12 }])).toEqual(resolveTrlLevels(undefined));
  });
});