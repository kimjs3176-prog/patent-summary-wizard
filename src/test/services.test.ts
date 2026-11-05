import { describe, expect, it } from "vitest";
import { heroCtaServices, isServiceActive, headerBadgeServices, SERVICES, visibleServices } from "@/lib/services";

const byKey = (k: string) => SERVICES.find((s) => s.key === k)!;

describe("service menu", () => {
  it("hides 출원도우미 when the feature_filing setting is off", () => {
    expect(visibleServices({ feature_filing: "false" }).map((s) => s.key)).not.toContain("filing");
    expect(visibleServices({}).map((s) => s.key)).toContain("filing");
  });

  it("leaves 출원도우미 out of the desktop header badges (owner: its badge lives in the home hero)", () => {
    expect(headerBadgeServices({}).map((s) => s.key)).not.toContain("filing");
    expect(headerBadgeServices({}).map((s) => s.key)).not.toContain("home");
    // The badge only moved: the full visible list (mobile menu panel) still offers it.
    expect(visibleServices({}).map((s) => s.key)).toContain("filing");
  });

  it("leaves 기술소개영상 out of the desktop header badges (owner)", () => {
    expect(headerBadgeServices({}).map((s) => s.key)).not.toContain("videos");
    // The page stays reachable: the mobile menu panel lists it and the home 영상 section links to it.
    expect(visibleServices({}).map((s) => s.key)).toContain("videos");
  });

  it("gives 무상기술이전 and, to its right, 식품기술이전 협의체 their own entries at the bottom of the home hero (owner)", () => {
    expect(heroCtaServices({}).map((s) => s.key)).toEqual(["potential", "consortium"]);
    // The hero entry reads the same visible list as the menu, so it can never point at a hidden service.
    expect(heroCtaServices({ feature_filing: "false" })).toEqual(
      visibleServices({ feature_filing: "false" }).filter((s) => s.key === "potential" || s.key === "consortium"),
    );
  });

  it("marks 홈 active on the home page and on search results", () => {
    expect(isServiceActive(byKey("home"), "/")).toBe(true);
    expect(isServiceActive(byKey("home"), "/search")).toBe(true);
    expect(isServiceActive(byKey("home"), "/finder")).toBe(false);
    expect(isServiceActive(byKey("finder"), "/finder")).toBe(true);
  });
});
