import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CRITERIA_NETWORK_MESSAGE, CRITERIA_SERVER_MESSAGE, CRITERIA_TIMEOUT_MESSAGE, criteriaErrorMessage, criteriaPageSize,
} from "@/lib/batchCriteria";
import { safeFetch } from "@/lib/safeFetch";

/** A fetch that never answers until it is aborted, like a server still calling KIPRIS for every row. */
const hangingFetch = () =>
  vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    const fail = () => reject(new DOMException("signal is aborted without reason", "AbortError"));
    if (init?.signal?.aborted) fail();
    init?.signal?.addEventListener("abort", fail);
  }));

describe("일괄조회 조건 모드", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("발명자를 함께 받을 때만 작게 나눠 받는다", () => {
    expect(criteriaPageSize(false)).toBe(500);
    expect(criteriaPageSize(true)).toBe(50);
  });

  it("실패는 쉬운 한국어로 보여 주고, 이 화면의 한국어 안내는 그대로 둔다", () => {
    expect(criteriaErrorMessage(new DOMException("signal is aborted without reason", "AbortError"))).toBe(CRITERIA_TIMEOUT_MESSAGE);
    expect(criteriaErrorMessage(new TypeError("Failed to fetch"))).toBe(CRITERIA_NETWORK_MESSAGE);
    expect(criteriaErrorMessage(new Error("LIMITED NUMBER OF SERVICE REQUESTS EXCEEDS ERROR"))).toBe(CRITERIA_SERVER_MESSAGE);
    expect(criteriaErrorMessage(new Error("요청이 많아 잠시 제한됐어요. 몇 분 뒤 다시 시도해 주세요."))).toBe("요청이 많아 잠시 제한됐어요. 몇 분 뒤 다시 시도해 주세요.");
    expect(criteriaErrorMessage(undefined)).toBe(CRITERIA_SERVER_MESSAGE);
  });

  it("시간 초과는 다시 보내지 않는다 (retryTimeouts: false)", async () => {
    vi.useFakeTimers();
    const fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    const run = safeFetch("https://example.test/export", { timeoutMs: 1000, retries: 2, retryTimeouts: false });
    const settled = run.then(() => "ok", (e: unknown) => (e as { name?: string }).name);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await settled).toBe("AbortError");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("다른 호출은 예전처럼 시간 초과도 다시 보낸다", async () => {
    vi.useFakeTimers();
    const fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    const settled = safeFetch("https://example.test/x", { timeoutMs: 1000, retries: 2 }).then(() => "ok", () => "failed");
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await settled).toBe("failed");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("이미 멈춘 신호로는 요청을 끝까지 기다리지 않는다", async () => {
    const fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(safeFetch("https://example.test/x", { timeoutMs: 60_000, retries: 2, signal: ctrl.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
