import { describe, expect, it } from "vitest";
import { isTokenLimitFinish, parseScoreJson } from "../../supabase/functions/analyze-commercialization/scoreJson";

describe("commercialization score JSON parsing", () => {
  it("parses plain JSON", () => {
    expect(parseScoreJson('{"technologyScore":72}')).toEqual({ technologyScore: 72 });
  });

  it("parses JSON wrapped in a code fence with extra text", () => {
    expect(parseScoreJson('결과입니다\n```json\n{"marketScore":65}\n```')).toEqual({ marketScore: 65 });
  });

  it("returns null for cut-off output so the request is retried", () => {
    expect(parseScoreJson('{"technologyScore":72,"analysis":"기술 강점이')).toBeNull();
  });

  it("returns null for empty output", () => {
    expect(parseScoreJson("")).toBeNull();
    expect(parseScoreJson(undefined)).toBeNull();
  });

  it("detects token-limit finish reasons", () => {
    expect(isTokenLimitFinish("length")).toBe(true);
    expect(isTokenLimitFinish("MAX_TOKENS")).toBe(true);
    expect(isTokenLimitFinish("stop")).toBe(false);
  });
});
