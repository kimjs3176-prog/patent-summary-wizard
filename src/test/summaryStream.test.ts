import { describe, expect, it } from "vitest";
import { metaFromPayload, parseSseLine, splitSseBuffer } from "@/lib/summaryStream";

describe("summary SSE parser", () => {
  it("parses incremental deltas", () => {
    expect(parseSseLine('data: {"choices":[{"delta":{"content":"안녕"}}]}')).toEqual({ type: "delta", content: "안녕" });
  });

  it("treats a replacement final_content as final", () => {
    expect(parseSseLine('data: {"final_content":"## 기술분야\\n본문"}')).toEqual({ type: "final", content: "## 기술분야\n본문" });
  });

  it("skips malformed JSON instead of re-queuing it (the line is already complete)", () => {
    expect(parseSseLine('data: {"choices":[{"delta":{"content":"깨진')).toEqual({ type: "skip" });
    expect(parseSseLine("data: not-json")).toEqual({ type: "skip" });
  });

  it("recognises comments, blank lines, [DONE] and CRLF endings", () => {
    expect(parseSseLine(": keep-alive")).toEqual({ type: "skip" });
    expect(parseSseLine("")).toEqual({ type: "skip" });
    expect(parseSseLine("data: [DONE]\r")).toEqual({ type: "done" });
  });

  it("surfaces server error frames", () => {
    expect(parseSseLine('data: {"error":"stream_error","message":"요약 생성 중 오류"}')).toEqual({ type: "error", message: "요약 생성 중 오류" });
  });

  it("parses meta frames and ignores unknown fields", () => {
    expect(parseSseLine('data: {"meta":{"model":"google/gemini-3.8-flash","cached":true,"generatedAt":"2026-10-31T00:00:00Z","junk":1}}')).toEqual({
      type: "meta",
      meta: { model: "google/gemini-3.8-flash", cached: true, generatedAt: "2026-10-31T00:00:00Z" },
    });
  });

  it("lets a final frame carry meta too", () => {
    const line = 'data: {"final_content":"본문","meta":{"marketFallback":true}}';
    expect(parseSseLine(line)).toEqual({ type: "final", content: "본문" });
    expect(metaFromPayload(line)).toEqual({ marketFallback: true });
  });

  it("splits buffers on newlines and keeps the partial tail", () => {
    expect(splitSseBuffer("data: a\n\ndata: b\ndata: partial")).toEqual({ lines: ["data: a", "", "data: b"], rest: "data: partial" });
  });
});
