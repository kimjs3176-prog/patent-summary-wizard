// 출원도우미 서버 AI(Lovable AI 게이트웨이) — supabase/functions/filing-api/lib/gateway.js · draft.js · ai.js
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chat, GatewayError, gatewayErrorResponse, GATEWAY_URL, SERVER_MODEL } from "../../supabase/functions/filing-api/lib/gateway.js";
import { draftSpec, draftEnabled, validateDraftInput } from "../../supabase/functions/filing-api/lib/draft.js";
import { runAi, parseJsonObject } from "../../supabase/functions/filing-api/lib/ai.js";

const ok = (content: string, finish = "stop") =>
  new Response(JSON.stringify({ model: "google/gemini-3.8-flash", choices: [{ message: { content }, finish_reason: finish }] }), { status: 200 });
const noSleep = async () => {};

describe("filing-api gateway", () => {
  const saved = process.env.LOVABLE_API_KEY;
  beforeEach(() => { process.env.LOVABLE_API_KEY = "test-key"; });
  afterEach(() => { if (saved === undefined) delete process.env.LOVABLE_API_KEY; else process.env.LOVABLE_API_KEY = saved; });

  it("is enabled only when LOVABLE_API_KEY is set", () => {
    expect(draftEnabled()).toBe(true);
    delete process.env.LOVABLE_API_KEY;
    expect(draftEnabled()).toBe(false);
  });

  it("posts an OpenAI-style request to the Lovable gateway with the key", async () => {
    const fetchImpl = vi.fn(async () => ok("{\"a\":1}"));
    const out = await chat({ system: "S", user: "U", json: true, maxTokens: 100 }, { fetchImpl, sleep: noSleep });
    expect(out).toEqual({ text: "{\"a\":1}", finishReason: "stop", model: "google/gemini-3.8-flash" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GATEWAY_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ model: SERVER_MODEL, max_tokens: 100, response_format: { type: "json_object" } });
    expect(body.messages).toEqual([{ role: "system", content: "S" }, { role: "user", content: "U" }]);
  });

  it("retries busy responses, then maps errors to user messages", async () => {
    const fetchImpl = vi.fn(async () => new Response("busy", { status: 503 }));
    const err = await chat({ system: "S", user: "U" }, { fetchImpl, sleep: noSleep }).catch((e: unknown) => e);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(err).toBeInstanceOf(GatewayError);
    expect(gatewayErrorResponse(err)).toEqual([502, "AI 서버 오류 (503)"]);
    expect(gatewayErrorResponse(new GatewayError(402, "x"))[0]).toBe(503);
    expect(gatewayErrorResponse(new GatewayError(429, "x"))[0]).toBe(429);
    expect(gatewayErrorResponse(new Error("plain"))).toBeNull();
  });

  it("does not retry a credit or auth error", async () => {
    const fetchImpl = vi.fn(async () => new Response("no credit", { status: 402 }));
    await expect(chat({ system: "S", user: "U" }, { fetchImpl, sleep: noSleep })).rejects.toBeInstanceOf(GatewayError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("draftSpec keeps the response shape and flags truncation", async () => {
    const chatImpl = vi.fn(async () => ({ text: "【발명의 설명】\n본문\n<<<검토메모>>>\n- 수치 확인", finishReason: "length", model: "m" }));
    const out = await draftSpec(validateDraftInput({ title: "딸기 저장 장치" }), { chatImpl });
    expect(out.spec.startsWith("【발명의 설명】")).toBe(true);
    expect(out.review).toEqual(["수치 확인"]);
    expect(out.truncated).toBe(true);
    expect(out.model).toBe("m");
    expect(out.checks).toBeTruthy();
  });

  it("runAi sends the JSON schema in the instructions and reads fenced JSON", async () => {
    const chatImpl = vi.fn(async () => ({ text: "```json\n{\"ideas\":[]}\n```", finishReason: "stop", model: "m" }));
    const out = await runAi("ideate", { keywords: ["딸기", "저장"] }, { chatImpl });
    expect(out).toEqual({ task: "ideate", result: { ideas: [] }, model: "m" });
    const call = (chatImpl.mock.calls[0] as unknown as [{ system: string; json: boolean }])[0];
    expect(call.json).toBe(true);
    expect(call.system).toContain("[답 형식]");
  });

  it("parseJsonObject tolerates surrounding text", () => {
    expect(parseJsonObject("결과: {\"a\": {\"b\": 2}} 끝")).toEqual({ a: { b: 2 } });
    expect(() => parseJsonObject("없음")).toThrow();
  });
});
