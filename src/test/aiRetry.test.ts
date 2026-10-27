import { afterEach, describe, expect, it, vi } from "vitest";
import { AiUnavailableError, aiUnavailableResponse, fetchAiWithRetry } from "../../supabase/functions/_shared/aiRetry";

const res = (status: number) => new Response("{}", { status });

describe("AI gateway retry", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("retries a temporary 503 and returns the later success", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(200));
    vi.stubGlobal("fetch", fetchMock);
    const p = fetchAiWithRetry("https://x", {});
    await vi.runAllTimersAsync();
    expect((await p).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 attempts with an AI-unavailable error", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(async () => res(503));
    vi.stubGlobal("fetch", fetchMock);
    const p = fetchAiWithRetry("https://x", {}).catch((e) => e);
    await vi.runAllTimersAsync();
    const err = await p;
    expect(err).toBeInstanceOf(AiUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 400 request error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(400));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchAiWithRetry("https://x", {})).rejects.toBeInstanceOf(AiUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports an outage as HTTP 200 with success false", async () => {
    const r = aiUnavailableResponse({});
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(false);
  });
});
