import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 토스트는 [종류, 문구, id] 로 기록한다: 같은 id 는 화면에서 한 개로 덮어써진다
const toasts: { kind: string; msg: string; id?: string }[] = [];
vi.mock("sonner", () => {
  const rec = (kind: string) => (msg: string, opts?: { id?: string }) => { toasts.push({ kind, msg, id: opts?.id }); };
  return { toast: { info: rec("info"), success: rec("success"), warning: rec("warning"), error: rec("error"), loading: rec("loading") } };
});

import { SUMMARY_TOAST_ID, usePatentSummary } from "@/hooks/usePatentSummary";

const patent = { title: "딸기 저장 방법", titleKo: "딸기 저장 방법", abstract: "x".repeat(40), claims: [], patentNumber: "10-2080834" };
const GOOD = "가".repeat(300);

function sse(lines: string[]) {
  const enc = new TextEncoder();
  return new Response(new ReadableStream({
    start(c) { for (const l of lines) c.enqueue(enc.encode(l)); c.close(); },
  }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
}
const frame = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;
const good = () => sse([frame({ final_content: GOOD }), "data: [DONE]\n\n"]);
const errorFrame = (error: string, message: string) => () => sse([frame({ error, message }), "data: [DONE]\n\n"]);
const http = (status: number, error: string) => () => new Response(JSON.stringify({ error }), { status });

let bodies: { forceRegenerate: boolean }[] = [];
function mockFetch(summarize: (() => Response)[], fetchPatent: () => Response = () => new Response(JSON.stringify({ success: true, data: patent, relatedPatents: [] }), { status: 200 })) {
  let i = 0;
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("fetch-patent")) return fetchPatent();
    if (String(url).includes("summarize-patent")) {
      bodies.push(JSON.parse(String(init?.body)));
      return summarize[Math.min(i++, summarize.length - 1)]();
    }
    throw new Error("unexpected " + url);
  }) as unknown as typeof fetch;
}

/** Runs generateSummary while fast-forwarding the retry backoff (1.5s, 4s). */
async function run(force = false) {
  const hook = renderHook(() => usePatentSummary());
  await act(async () => {
    const p = hook.result.current.generateSummary("10-2080834", { forceRegenerate: force });
    for (let k = 0; k < 4; k++) await vi.advanceTimersByTimeAsync(5000);
    await p;
  });
  return hook;
}

beforeEach(() => {
  toasts.length = 0;
  bodies = [];
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("usePatentSummary — retries follow the server's error code, not its wording", () => {
  it("retries an empty_response frame and succeeds without forcing regeneration", async () => {
    mockFetch([errorFrame("empty_response", "AI 응답이 비어 있습니다. 자동 재시도합니다."), good]);
    const { result } = await run();
    expect(bodies.map((b) => b.forceRegenerate)).toEqual([false, false]);
    expect(result.current.summary).toBe(GOOD);
    expect(result.current.summaryError).toBeNull();
    expect(toasts.at(-1)).toEqual({ kind: "success", msg: "요약서가 생성되었습니다! (재시도 1회)", id: SUMMARY_TOAST_ID });
  });

  it("retries a gateway ai_error twice and reports the real count without promising another retry", async () => {
    mockFetch([errorFrame("ai_error", "AI 서비스 오류가 발생했습니다.")]);
    const { result } = await run();
    expect(bodies).toHaveLength(3);
    expect(toasts.at(-1)).toEqual({ kind: "error", msg: "AI 서비스 오류가 발생했습니다. (재시도 2회 모두 실패)", id: SUMMARY_TOAST_ID });
    expect(result.current.summaryError).toEqual({ message: "AI 서비스 오류가 발생했습니다.", retries: 2 });
  });

  it("drops '자동 재시도합니다' from the last message once every try has failed", async () => {
    mockFetch([errorFrame("empty_response", "AI 응답이 비어 있습니다. 자동 재시도합니다.")]);
    const { result } = await run();
    expect(bodies).toHaveLength(3);
    expect(toasts.at(-1)?.msg).toBe("AI 응답이 비어 있습니다. (재시도 2회 모두 실패)");
    expect(result.current.summaryError?.message).toBe("AI 응답이 비어 있습니다.");
  });

  it("does not retry rate limits or missing credits, and says no retry happened", async () => {
    mockFetch([errorFrame("ai_error", "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.")]);
    let hook = await run();
    expect(bodies).toHaveLength(1);
    expect(toasts.at(-1)).toEqual({ kind: "error", msg: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", id: SUMMARY_TOAST_ID });
    expect(hook.result.current.summaryError?.retries).toBe(0);

    bodies = [];
    mockFetch([http(429, "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.")]);
    await run();
    expect(bodies).toHaveLength(1);

    bodies = [];
    mockFetch([http(402, "credits")]);
    hook = await run();
    expect(bodies).toHaveLength(1);
    expect(hook.result.current.summaryError?.message).toMatch(/크레딧/);
  });

  it("retries a 503 whose message names no status code", async () => {
    mockFetch([http(503, "서비스 일시적 오류입니다. 잠시 후 다시 시도해 주세요."), good]);
    const { result } = await run();
    expect(bodies).toHaveLength(2);
    expect(result.current.summary).toBe(GOOD);
  });

  it("retries a too-short stream and a network drop, never with forceRegenerate", async () => {
    mockFetch([() => sse([frame({ choices: [{ delta: { content: "짧음" } }] }), "data: [DONE]\n\n"]), () => { throw new TypeError("Failed to fetch"); }, good]);
    const { result } = await run();
    expect(bodies.map((b) => b.forceRegenerate)).toEqual([false, false, false]);
    expect(result.current.summary).toBe(GOOD);
  });

  it("keeps the reader's own 재생성 forced on every try", async () => {
    mockFetch([errorFrame("stream_error", "요약 생성 중 오류가 발생했습니다. 자동 재시도합니다."), good]);
    await run(true);
    expect(bodies.map((b) => b.forceRegenerate)).toEqual([true, true]);
  });
});

describe("usePatentSummary — one toast and an on-screen error instead of a silent return home", () => {
  it("uses a single toast id and no KIPRIS progress toasts (the stepper shows those steps)", async () => {
    mockFetch([errorFrame("empty_response", "AI 응답이 비어 있습니다. 자동 재시도합니다."), good]);
    await run();
    expect(toasts.every((t) => t.id === SUMMARY_TOAST_ID)).toBe(true);
    expect(toasts.some((t) => /KIPRIS|가져왔습니다|일반 요약/.test(t.msg))).toBe(false);
  });

  it("a failed patent fetch shows one error, keeps it for the result area and never calls the AI", async () => {
    mockFetch([good], () => new Response(JSON.stringify({ success: false, error: "유효하지 않은 특허 번호 형식입니다." }), { status: 400 }));
    const { result } = await run();
    expect(bodies).toHaveLength(0);
    expect(toasts).toEqual([{ kind: "error", msg: "특허 원문을 가져오지 못했습니다. 유효하지 않은 특허 번호 형식입니다.", id: SUMMARY_TOAST_ID }]);
    expect(result.current.summaryError).toEqual({ message: "특허 원문을 가져오지 못했습니다. 유효하지 않은 특허 번호 형식입니다.", retries: 0 });
    expect(result.current.currentPatent).toBe("10-2080834");
    expect(result.current.isLoading).toBe(false);
    act(() => result.current.reset());
    expect(result.current.summaryError).toBeNull();
  });
});
