import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_STRING,
  createRequestLogger,
  formatLog,
  log,
  requestIdFrom,
  sanitizeFields,
  truncate,
  withRequestLog,
} from "../../supabase/functions/_shared/log";

afterEach(() => vi.restoreAllMocks());

describe("edge function structured log", () => {
  it("prints one JSON line with the envelope fields first", () => {
    const line = formatLog("info", "cache.hit", { fn: "fetch-patent", reqId: "abc", count: 3 }, new Date("2026-10-31T00:00:00Z"));
    expect(line).not.toContain("\n");
    const parsed = JSON.parse(line);
    expect(Object.keys(parsed).slice(0, 5)).toEqual(["ts", "level", "fn", "event", "reqId"]);
    expect(parsed).toMatchObject({ ts: "2026-10-31T00:00:00.000Z", level: "info", fn: "fetch-patent", event: "cache.hit", reqId: "abc", count: 3 });
  });

  it("does not let fields override the envelope", () => {
    const parsed = JSON.parse(formatLog("warn", "real", { event: "fake", level: "debug", ts: "x" }));
    expect(parsed.event).toBe("real");
    expect(parsed.level).toBe("warn");
    expect(parsed.ts).not.toBe("x");
  });

  it("redacts credential-like keys at any depth but keeps search keywords", () => {
    const out = sanitizeFields({
      apiKey: "k-123",
      KIPRIS_API_KEY: "k-456",
      authorization: "Bearer abc",
      nested: { accessToken: "t", client_secret: "s", password: "p", ok: 1 },
      list: [{ ServiceKey: "x" }],
      keyword: "딸기 재배",
      keywords: ["인삼"],
    });
    expect(out).toEqual({
      apiKey: "[REDACTED]",
      KIPRIS_API_KEY: "[REDACTED]",
      authorization: "[REDACTED]",
      nested: { accessToken: "[REDACTED]", client_secret: "[REDACTED]", password: "[REDACTED]", ok: 1 },
      list: [{ ServiceKey: "[REDACTED]" }],
      keyword: "딸기 재배",
      keywords: ["인삼"],
    });
  });

  it("masks secrets embedded in strings such as upstream URLs and errors", () => {
    const out = sanitizeFields({
      url: "https://plus.kipris.or.kr/openapi/rest/x?word=a&ServiceKey=SECRET123&numOfRows=5",
      message: "upstream said: Authorization Bearer eyJhbGciOi.payload.sig",
    });
    expect(out.url).toBe("https://plus.kipris.or.kr/openapi/rest/x?word=a&ServiceKey=***&numOfRows=5");
    expect(String(out.message)).not.toContain("eyJhbGciOi");
  });

  it("truncates long strings to the limit so raw payloads are never dumped", () => {
    const xml = "<response>" + "가".repeat(5000) + "</response>";
    const out = sanitizeFields({ body: xml, err: new Error("x".repeat(1000)) });
    expect(String(out.body).length).toBeLessThanOrEqual(MAX_STRING);
    expect(String(out.body)).toContain("chars)");
    expect((out.err as { message: string }).message.length).toBeLessThanOrEqual(MAX_STRING);
    expect(truncate("short")).toBe("short");
  });

  it("bounds large arrays, deep objects and cycles", () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    const out = sanitizeFields({ items: Array.from({ length: 50 }, (_, i) => i), deep: { a: { b: { c: { d: { e: 1 } } } } }, cyclic });
    expect((out.items as unknown[]).length).toBe(21);
    expect(JSON.stringify(out.deep)).toContain("[Object]");
    expect((out.cyclic as Record<string, unknown>).self).toBe("[Circular]");
  });

  it("reuses a well-formed x-request-id and generates one otherwise", () => {
    expect(requestIdFrom(new Request("https://x.test", { headers: { "x-request-id": "req-42" } }))).toBe("req-42");
    const generated = requestIdFrom(new Request("https://x.test", { headers: { "x-request-id": "bad id {\"json\": true}" } }));
    expect(generated).toMatch(/^[0-9a-f]{16}$/);
    expect(requestIdFrom(null)).not.toBe(requestIdFrom(null));
  });

  it("routes levels to the matching console method and logs request end with duration", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    log("error", "boom", { fn: "t" });
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const logger = createRequestLogger("search-patents", new Request("https://x.test", { method: "POST" }));
    expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toMatchObject({ event: "request.start", fn: "search-patents", method: "POST", reqId: logger.reqId });
    logger.end(422, { reason: "invalid" });
    const end = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(end).toMatchObject({ level: "warn", event: "request.end", status: 422, reason: "invalid", reqId: logger.reqId });
    expect(typeof end.durationMs).toBe("number");
  });

  it("wraps a handler: echoes the request id, logs end status, skips preflights", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withRequestLog("fetch-patent", async (req) =>
      req.method === "OPTIONS" ? new Response(null, { status: 204 }) : new Response("{}", { status: 200 }));

    const preflight = await handler(new Request("https://x.test", { method: "OPTIONS" }));
    expect(preflight.status).toBe(204);
    expect(logSpy).not.toHaveBeenCalled();

    const res = await handler(new Request("https://x.test", { method: "POST", headers: { "x-request-id": "r1" } }));
    expect(res.headers.get("x-request-id")).toBe("r1");
    const events = logSpy.mock.calls.map((c) => JSON.parse(c[0] as string));
    expect(events.map((e) => e.event)).toEqual(["request.start", "request.end"]);
    expect(events[1]).toMatchObject({ status: 200, reqId: "r1", fn: "fetch-patent" });

    const failing = withRequestLog("x", async () => { throw new Error("boom token=abc"); });
    await expect(failing(new Request("https://x.test", { method: "POST" }))).rejects.toThrow("boom");
    const errorEvents = errorSpy.mock.calls.map((c) => JSON.parse(c[0] as string));
    expect(errorEvents.map((e) => e.event)).toEqual(["request.unhandled", "request.end"]);
    expect(errorEvents[0].error.message).toBe("boom token=***");
  });
});
