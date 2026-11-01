import { describe, expect, it } from "vitest";
import { isServiceActive, SERVICES, visibleServices } from "@/lib/services";

const byKey = (k: string) => SERVICES.find((s) => s.key === k)!;

describe("service menu", () => {
  it("hides 출원도우미 when the feature_filing setting is off", () => {
    expect(visibleServices({ feature_filing: "false" }).map((s) => s.key)).not.toContain("filing");
    expect(visibleServices({}).map((s) => s.key)).toContain("filing");
  });

  it("marks 홈 active on the home page and on search results", () => {
    expect(isServiceActive(byKey("home"), "/")).toBe(true);
    expect(isServiceActive(byKey("home"), "/search")).toBe(true);
    expect(isServiceActive(byKey("home"), "/finder")).toBe(false);
    expect(isServiceActive(byKey("finder"), "/finder")).toBe(true);
  });
});
