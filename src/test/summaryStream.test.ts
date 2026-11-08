import { describe, expect, it } from "vitest";
import { finalFailureMessage, isRetryableErrorFrame, isRetryableSummaryStatus, metaFromPayload, parseSseLine, splitSseBuffer } from "@/lib/summaryStream";

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
    expect(parseSseLine('data: {"error":"stream_error","message":"요약 생성 중 오류"}')).toEqual({ type: "error", code: "stream_error", message: "요약 생성 중 오류" });
  });

  it("decides retries from the error code and HTTP status, not from the wording", () => {
    expect(isRetryableErrorFrame("empty_response", "AI 응답이 비어 있습니다. 자동 재시도합니다.")).toBe(true);
    expect(isRetryableErrorFrame("stream_error", "아무 문구")).toBe(true);
    expect(isRetryableErrorFrame("ai_error", "AI 서비스 오류가 발생했습니다.")).toBe(true);
    expect(isRetryableErrorFrame("ai_error", "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.")).toBe(false);
    expect(isRetryableErrorFrame("ai_error", "서비스 크레딧이 부족합니다.")).toBe(false);
    expect(isRetryableErrorFrame(undefined, "요약 생성 중 오류가 발생했습니다.")).toBe(false);
    expect([500, 502, 503, 504, 408].every(isRetryableSummaryStatus)).toBe(true);
    expect([400, 402, 422, 429].some(isRetryableSummaryStatus)).toBe(false);
  });

  it("drops the retry promise from a message shown after the last try", () => {
    expect(finalFailureMessage("AI 응답이 비어 있습니다. 자동 재시도합니다.")).toBe("AI 응답이 비어 있습니다.");
    expect(finalFailureMessage("요약 생성 중 오류가 발생했습니다. 자동 재시도합니다.")).toBe("요약 생성 중 오류가 발생했습니다.");
    expect(finalFailureMessage("AI 서비스 오류가 발생했습니다.")).toBe("AI 서비스 오류가 발생했습니다.");
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
  it("keeps true/false application flags without coercing strings", () => {
    const application = { label: "식품 발효", claimed_in_claims: false, source: "description", evidence: "발효용 조성물" };
    const line = `data: ${JSON.stringify({ meta: { applications: [application, { ...application, claimed_in_claims: "false" }] } })}`;
    expect(metaFromPayload(line)?.applications).toEqual([application]);
  });
});
