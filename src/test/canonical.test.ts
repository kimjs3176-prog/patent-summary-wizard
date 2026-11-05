import { describe, expect, it } from "vitest";
import { canonicalFor } from "@/lib/canonical";

describe("canonicalFor", () => {
  it("keeps only the keys that select the page content", () => {
    expect(canonicalFor("/search", "?keyword=%EB%94%B8%EA%B8%B0&_swreset=1")).toBe("https://atipsum.lovable.app/search?keyword=%EB%94%B8%EA%B8%B0");
    expect(canonicalFor("/", "?patent=10-2021-0162560&utm_source=x")).toBe("https://atipsum.lovable.app/?patent=10-2021-0162560");
    expect(canonicalFor("/insights", "?tab=1")).toBe("https://atipsum.lovable.app/insights");
  });
  it("normalizes trailing slashes and empty values", () => {
    expect(canonicalFor("/insights/", "")).toBe("https://atipsum.lovable.app/insights");
    expect(canonicalFor("/search", "?keyword=")).toBe("https://atipsum.lovable.app/search");
    expect(canonicalFor("", "")).toBe("https://atipsum.lovable.app/");
  });
});
