import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import {
  CancelledError, generateChatCompletion, GatewayError, PaymentRequiredError, RateLimitError, TimeoutError,
} from "npm:@lovable.dev/ai-gateway@0.1.11";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  buildResults, MAX_CANDIDATES, mergeCandidates, PURPOSES, sanitizeTerms,
  type FinderCandidate, type Readiness,
} from "./finderPolicy.ts";

// ── Latency budget (the page waits up to 110 s) ──
// Measured live: each search-patents call takes ~11–17 s, so the old 2-at-a-time
// batches (3 serial rounds for 5 terms) spent ~40 s on retrieval alone.
const PLAN_TIMEOUT_MS = 10_000;        // search-term planning; falls back to the item words
const SEARCH_CONCURRENCY = 3;          // each search-patents call already fans out to 6 KIPRIS calls
const SEARCH_CALL_TIMEOUT_MS = 30_000; // one term
const RETRIEVAL_BUDGET_MS = 40_000;    // all terms; terms still running then are dropped
const TRL_TIMEOUT_MS = 4_000;          // score-cache lookup is optional enrichment
const RANK_TIMEOUT_MS = 40_000;        // fit ranking
const AI_MAX_RETRIES = 1;              // SDK default (2 + 10 s waits) could triple a slow call

const isAbort = (e: unknown) =>
  e instanceof TimeoutError || e instanceof CancelledError || (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError"));

class RankTimeoutError extends Error {}

const TEXT_RE = /^[\w\s가-힣ㄱ-ㅎㅏ-ㅣ\-(),.·/&+~!?]*$/u;
const safeText = (min: number, max: number) =>
  z.string().trim().min(min).max(max).regex(TEXT_RE, "허용되지 않는 문자가 포함되어 있습니다.");

const BodySchema = z.object({
  industry: safeText(1, 60),
  item: safeText(1, 120),
  purposes: z.array(z.enum(PURPOSES)).max(PURPOSES.length).default([]),
  capabilities: safeText(0, 300).optional().default(""),
  readiness: z.enum(["ready", "improve", "codevelop", "any"]).default("any"),
});
type Body = z.infer<typeof BodySchema>;

const READINESS_LABEL: Record<Readiness, string> = {
  ready: "바로 적용 가능한 기술(TRL 7~9 선호)",
  improve: "일부 보완 후 적용할 기술(TRL 4~6 선호)",
  codevelop: "공동 연구·개발로 키울 기술(TRL 1~3도 가능)",
  any: "완성도 무관",
};

const CACHE = new Map<string, { at: number; payload: unknown }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function profileText(b: Body) {
  return [
    `업종: ${b.industry}`,
    `아이템: ${b.item}`,
    `도입 목적: ${b.purposes.length ? b.purposes.join(", ") : "지정 안 함"}`,
    `보유 설비·역량: ${b.capabilities || "지정 안 함"}`,
    `원하는 기술 완성도: ${READINESS_LABEL[b.readiness]}`,
  ].join("\n");
}

function parseJson(content: unknown): Record<string, unknown> | null {
  if (typeof content !== "string") return null;
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fallthrough */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function planSearchTerms(b: Body): Promise<{ terms: string[]; need: string }> {
  const fallback = [b.item, ...b.item.split(/\s+/)].filter((t) => t.length >= 2);
  try {
    const res = await (generateChatCompletion as any)({
      model: "google/gemini-3.1-flash-lite",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "당신은 한국 농업 공공기관 특허(KIPRIS) 검색 전문가입니다. 회사 정보를 보고, 그 회사가 도입할 만한 기술을 찾기 위한 특허 검색어를 만듭니다. Return JSON only.",
        },
        {
          role: "user",
          content: `${profileText(b)}

규칙:
- terms: 특허 제목·요약에 실제로 쓰일 만한 한국어 기술 명사 4~5개(각 1~3단어). 업종 이름 자체보다 아이템의 원료·공정·소재·장치·기능 위주.
- 도입 목적과 보유 설비에 맞는 기술 쪽으로 검색어를 구체화.
- need: 회사가 찾는 기술을 한 문장(40자 이내)으로 요약.
형식: {"terms":["..."],"need":"..."}`,
        },
      ],
    }, { signal: AbortSignal.timeout(PLAN_TIMEOUT_MS), maxRetries: AI_MAX_RETRIES });
    const parsed = parseJson(res.choices?.[0]?.message?.content);
    return {
      terms: sanitizeTerms(parsed?.terms, fallback),
      need: typeof parsed?.need === "string" ? parsed.need.slice(0, 80) : "",
    };
  } catch (e) {
    console.error("[find-my-patents] plan failed", isAbort(e) ? "timeout" : e instanceof GatewayError ? e.code : e);
    if (e instanceof PaymentRequiredError || e instanceof RateLimitError) throw e;
    return { terms: sanitizeTerms([], fallback), need: "" };
  }
}

async function searchTerm(term: string, forwardedFor: string | null, budget: AbortSignal): Promise<Array<Record<string, unknown>>> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/search-patents`;
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  // Aborts on this call's own timeout or when the whole retrieval budget runs out.
  const ctrl = new AbortController();
  const abort = () => ctrl.abort();
  const timer = setTimeout(abort, SEARCH_CALL_TIMEOUT_MS);
  if (budget.aborted) abort();
  else budget.addEventListener("abort", abort, { once: true });
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
      },
      body: JSON.stringify({ keyword: term }),
    });
    if (!res.ok) { console.warn(`[find-my-patents] search "${term}" ${res.status}`); return []; }
    const data = await res.json();
    return Array.isArray(data?.patents) ? data.patents : [];
  } catch (e) {
    console.warn(`[find-my-patents] search "${term}" failed`, e instanceof Error ? e.message : e);
    return [];
  } finally {
    clearTimeout(timer);
    budget.removeEventListener("abort", abort);
  }
}

/**
 * Runs the per-term searches through a small worker pool (SEARCH_CONCURRENCY at a time,
 * the next term starting as soon as one finishes) under one overall budget. Groups keep
 * the planned term order so mergeCandidates ranks exactly as before.
 */
async function retrieveGroups(terms: string[], forwardedFor: string | null) {
  const budget = new AbortController();
  const budgetTimer = setTimeout(() => budget.abort(), RETRIEVAL_BUDGET_MS);
  const found: Array<Array<Record<string, unknown>>> = terms.map(() => []);
  let next = 0;
  const worker = async () => {
    while (next < terms.length && !budget.signal.aborted) {
      const i = next++;
      found[i] = await searchTerm(terms[i], forwardedFor, budget.signal);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(SEARCH_CONCURRENCY, terms.length) }, worker));
  } finally {
    clearTimeout(budgetTimer);
  }
  if (budget.signal.aborted) console.warn(`[find-my-patents] retrieval budget reached after ${next}/${terms.length} terms`);
  return terms.map((term, i) => ({ term, patents: found[i] }));
}

async function attachTrl(candidates: FinderCandidate[]) {
  const keys = candidates.map((c) => c.patentId.replace(/\D/g, "")).filter(Boolean);
  if (!keys.length) return;
  const { data } = await supabaseAdmin()
    .from("patent_score_cache")
    .select("patent_number, trl")
    .in("patent_number", keys)
    .abortSignal(AbortSignal.timeout(TRL_TIMEOUT_MS));
  const map = new Map((data || []).map((r: { patent_number: string; trl: number }) => [r.patent_number, r.trl]));
  for (const c of candidates) c.trl = map.get(c.patentId.replace(/\D/g, "")) ?? null;
}

async function rankCandidates(b: Body, need: string, candidates: FinderCandidate[]) {
  // mergeCandidates already caps the pool; the explicit slice keeps the prompt bounded by the policy constant.
  const list = candidates.slice(0, MAX_CANDIDATES).map((c) => ({
    patentId: c.patentId,
    title: c.title,
    abstract: (c.snippet || "").slice(0, 220),
    ipc: c.ipc || "",
    trl: c.trl ?? "미분석",
  }));
  const res = await (generateChatCompletion as any)({
    model: "google/gemini-3.8-flash",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "당신은 농업 공공기술 이전 컨설턴트입니다. 회사 정보와 후보 특허 목록을 보고 회사에 도입하기 적합한 특허를 고릅니다. 후보 목록에 없는 특허는 절대 만들지 않습니다. Return JSON only.",
      },
      {
        role: "user",
        content: `[회사 정보]
${profileText(b)}
${need ? `찾는 기술 요약: ${need}` : ""}

[후보 특허 — 제목·요약만 근거로 판단]
${JSON.stringify(list)}

평가 규칙:
- fit(0~100): 아이템 관련성 40%, 도입 목적 부합 25%, 보유 설비·역량으로 실행 가능성 20%, 원하는 기술 완성도 부합 15%.
- 완성도는 trl 값이 있을 때만 판단에 반영하고, "미분석"이면 완성도를 추측해 쓰지 말 것.
- reason: 이 회사에 왜 맞는지 1~2문장(120자 이내). 회사의 아이템·목적·설비를 구체적으로 연결. 시장 규모·매출 등 숫자를 지어내지 말 것.
- matchPoints: 맞는 지점 2~3개, 각 10자 이내 명사구(예: "원료 대체", "기존 설비 활용").
- considerations: 도입 전 확인할 점 1문장(70자 이내).
- fit 50 미만은 제외, 최대 12개, fit 높은 순.
형식: {"results":[{"patentId":"...","fit":0,"reason":"...","matchPoints":["..."],"considerations":"..."}]}`,
      },
    ],
  }, { signal: AbortSignal.timeout(RANK_TIMEOUT_MS), maxRetries: AI_MAX_RETRIES }).catch((e) => {
    if (isAbort(e)) throw new RankTimeoutError("rank timeout");
    throw e;
  });
  const parsed = parseJson(res.choices?.[0]?.message?.content);
  return parsed?.results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "허용되지 않는 요청입니다." }, 405);

  const limited = await enforceRateLimit(req, { bucket: "find-my-patents", limit: 10, windowSeconds: 300 });
  if (limited) return limited;

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return jsonResponse({ success: false, error: first?.message || "입력값을 확인해 주세요." }, 400);
  }
  const body = parsed.data;

  const cacheKey = JSON.stringify({ ...body, purposes: [...body.purposes].sort() });
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return jsonResponse(hit.payload);

  const t0 = Date.now();
  const marks: Record<string, number> = {};
  const mark = (stage: string) => { marks[stage] = Date.now() - t0; };
  try {
    const { terms, need } = await planSearchTerms(body);
    mark("plan");
    if (!terms.length) return jsonResponse({ success: false, error: "검색어를 만들 수 없습니다. 아이템을 조금 더 구체적으로 적어 주세요." }, 400);

    const forwardedFor = req.headers.get("x-forwarded-for");
    const groups = await retrieveGroups(terms, forwardedFor);
    mark("search");

    const candidates = mergeCandidates(groups);
    if (!candidates.length) {
      return jsonResponse({ success: true, terms, need, candidateCount: 0, results: [] });
    }
    await attachTrl(candidates).catch((e) => console.warn("[find-my-patents] trl lookup failed", e));
    mark("trl");

    const ranked = await rankCandidates(body, need, candidates);
    mark("rank");
    console.log(`[find-my-patents] timings ms ${JSON.stringify(marks)} candidates=${candidates.length}`);
    const results = buildResults(ranked, candidates, body.readiness);
    const payload = { success: true, terms, need, candidateCount: candidates.length, results };
    if (results.length) {
      CACHE.set(cacheKey, { at: Date.now(), payload });
      if (CACHE.size > 100) { const k = CACHE.keys().next().value; if (k) CACHE.delete(k); }
    }
    return jsonResponse(payload);
  } catch (e) {
    if (e instanceof PaymentRequiredError) return jsonResponse({ success: false, error: "AI 사용 한도가 소진되어 잠시 이용할 수 없습니다." }, 402);
    if (e instanceof RateLimitError) return jsonResponse({ success: false, error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." }, 429);
    if (e instanceof RankTimeoutError) {
      console.warn(`[find-my-patents] rank timed out; timings ms ${JSON.stringify(marks)}`);
      return jsonResponse({ success: false, timedOut: true, error: "적합도 평가가 지연되고 있어요. 잠시 후 다시 시도해 주세요." }, 504);
    }
    console.error("[find-my-patents] error", e instanceof GatewayError ? { code: e.code, ids: e.ids } : e);
    return jsonResponse({ success: false, error: "추천 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, 500);
  }
});
