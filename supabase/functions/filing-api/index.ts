// 출원지원 API (에이프 server/*.js 를 그대로 가져와 Deno 로 돌린다) — scripts/sync-filing-app.mjs 가 lib/ 를 갱신한다.
//   GET  /filing-api/api/health · trends · kr-trends
//   POST /filing-api/api/explore (KIPRIS 유사 특허·공백 맵) · draft (명세서 초안) · ai (AI 분석) · prompt (사용자 키로 쓸 지침)
// 수출 실적·지원사업 공고·기사(에이프 해외동향·해외사업용)는 출원지원에 필요 없어 두지 않는다.
// 비밀값: KIPRIS_API_KEY(필수, 기존 함수와 공유) · 선택 ANTHROPIC_API_KEY(서버 AI, 없으면 화면에서 넣는 키로) · KIPRIS_MOCK=1(모의)
import "./lib/env.ts";
import { kipris, MOCK, validate, explore, allowed, health, KiprisError } from "./lib/explore.js";
import { draftEnabled, validateDraftInput, draftSpec, draftErrorResponse, draftPrompt } from "./lib/draft.js";
import { trends } from "./lib/trends.js";
import { aiPrompt, runAi } from "./lib/ai.js";
import { krTrendsCached, krCached, validateKr } from "./lib/kr-trends.js";

// 같은 사이트(AIS)와 Lovable 미리보기, 로컬 개발만 받는다
const ORIGIN_OK = /^https:\/\/([a-z0-9-]+\.)*(lovable\.app|lovableproject\.com)$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const cors = (req: Request): Record<string, string> => {
  const o = req.headers.get("origin") || "";
  return {
    "access-control-allow-origin": ORIGIN_OK.test(o) ? o : "https://atipsum.lovable.app",
    "access-control-allow-headers": "content-type, authorization, apikey, x-client-info",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "origin",
  };
};
const json = (req: Request, status: number, body: unknown, cache = "no-store") =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "content-type": "application/json; charset=utf-8", "cache-control": cache, "x-content-type-options": "nosniff" } });
const bad = (status: number, message: string) => Object.assign(new Error(message), { status });
const ip = (req: Request) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
async function readJson(req: Request, limit = 32 * 1024) {
  if (Number(req.headers.get("content-length") || 0) > limit) throw bad(413, "요청이 너무 큽니다.");
  const text = await req.text();
  if (new TextEncoder().encode(text).length > limit) throw bad(413, "요청이 너무 큽니다.");
  try { return JSON.parse(text || "{}"); } catch { throw bad(400, "JSON 형식이 아닙니다."); }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/filing-api/, "");
  const q = Object.fromEntries(url.searchParams);
  const who = ip(req);
  try {
    if (req.method === "GET" && path === "/api/health") return json(req, 200, health());
    if (req.method === "POST" && path === "/api/explore") {
      if (!kipris) return json(req, 503, { error: "서버에 KIPRIS_API_KEY 가 설정되지 않았습니다." });
      if (!allowed(who)) return json(req, 429, { error: "요청이 너무 많습니다. 1분 뒤 다시 시도하세요." });
      return json(req, 200, await explore(kipris, validate(await readJson(req))));
    }
    if (req.method === "POST" && path === "/api/draft") {
      if (!draftEnabled()) return json(req, 503, { error: "서버에 ANTHROPIC_API_KEY 가 설정되지 않았습니다." });
      if (!allowed(`draft:${who}`, 3)) return json(req, 429, { error: "명세서 작성은 1분에 3번까지 할 수 있습니다." });
      try { return json(req, 200, await draftSpec(validateDraftInput(await readJson(req)))); }
      catch (e) { const r = draftErrorResponse(e); if (r) return json(req, r[0], { error: r[1] }); throw e; }
    }
    if (req.method === "GET" && path === "/api/kr-trends") {
      if (!kipris) return json(req, 503, { error: "서버에 KIPRIS_API_KEY 가 설정되지 않았습니다." });
      const input = validateKr(q), mode = MOCK ? "mock" : "live";
      if (!krCached(input.field, mode) && !allowed(`kr:${who}`, 6)) return json(req, 429, { error: "요청이 너무 많습니다. 1분 뒤 다시 시도하세요." });
      return json(req, 200, await krTrendsCached(kipris, input, { mode }), "public, max-age=21600");
    }
    if (req.method === "GET" && path === "/api/trends") return json(req, 200, trends(q), "public, max-age=3600");
    if (req.method === "POST" && path === "/api/prompt") {
      if (!allowed(`prompt:${who}`, 20)) return json(req, 429, { error: "요청이 너무 많습니다. 1분 뒤 다시 시도하세요." });
      const body = await readJson(req, 96 * 1024);
      return json(req, 200, body?.task ? aiPrompt(body.task, body.input) : draftPrompt(validateDraftInput(body)));
    }
    if (req.method === "POST" && path === "/api/ai") {
      if (!draftEnabled()) return json(req, 503, { error: "서버에 ANTHROPIC_API_KEY 가 설정되지 않았습니다. 화면에서 AI 키를 넣어 쓰세요." });
      if (!allowed(`ai:${who}`, 6)) return json(req, 429, { error: "AI 분석은 1분에 6번까지 할 수 있습니다." });
      const body = await readJson(req, 96 * 1024);
      try { return json(req, 200, await runAi(body?.task, body?.input)); }
      catch (e) { const r = draftErrorResponse(e); if (r) return json(req, r[0], { error: r[1] }); throw e; }
    }
    return json(req, 404, { error: "찾을 수 없습니다." });
  } catch (e) {
    if (e instanceof KiprisError) return json(req, 502, { error: (e as Error).message, code: (e as { code?: string }).code });
    const err = e as { status?: number; message?: string };
    if (err.status) return json(req, err.status, { error: err.message });
    console.error(e);
    return json(req, 500, { error: "서버 오류가 발생했습니다." });
  }
});
