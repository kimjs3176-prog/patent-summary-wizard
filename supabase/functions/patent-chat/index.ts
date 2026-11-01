// Conversational patent assistant for the home '물어보기' tab.
// Answers only from retrieved, applicant-scoped patents (search-patents), the
// filing-trend snapshot, stored TRL values and the fixed tech-transfer guide.
// Commercialization scores are intentionally not shown here — users see them in the patent summary.
import { z } from "npm:zod@3.23.8";
import {
  generateChatCompletion, streamChatCompletion, GatewayError, PaymentRequiredError, RateLimitError,
} from "npm:@lovable.dev/ai-gateway@0.1.11";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { TECHNOLOGY_FIELDS } from "../_shared/technologyFields.ts";
import {
  buildCards, digitsOf, MAX_HISTORY, MAX_MESSAGE_CHARS, normalizeRoute, pickTrendField, TRANSFER_GUIDE, trendFacts,
  type ChatRoute, type ChatTool, type PatentCard, type PatentHit, type ScoreRow, type TrendSnapshotLike,
} from "./chatPolicy.ts";

// Same site_settings entry that filing-trends writes; keep the two in sync.
const CACHE_KEY = "filing_trends_v1";

const BodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS * 2),
  })).min(1).max(40),
});
type ChatMessage = { role: "user" | "assistant"; content: string };

const TOOL_TITLES: Record<ChatTool, string> = {
  trends: "출원 동향 조회",
  search: "특허 검색",
  transfer: "기술이전 절차 확인",
};
const fieldLabel = (id: string) => TECHNOLOGY_FIELDS.find((f) => f.id === id)?.label ?? id;

function parseJson(content: unknown): Record<string, unknown> | null {
  if (typeof content !== "string") return null;
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fallthrough */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function route(history: ChatMessage[], question: string): Promise<ChatRoute> {
  const context = history.slice(-4).map((m) => `${m.role === "user" ? "사용자" : "상담"}: ${m.content.slice(0, 300)}`).join("\n");
  try {
    const res = await generateChatCompletion({
      model: "google/gemini-3.1-flash-lite",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "당신은 농업 국가연구기관 특허 상담 서비스의 질문 분류기입니다. 질문에 답하는 데 필요한 자료를 고릅니다. Return JSON only." },
        {
          role: "user",
          content: `[이전 대화]
${context || "(없음)"}

[현재 질문]
${question}

규칙:
- tools: 아래 중 필요한 것만 배열로.
  - "trends": 최근 출원 동향, 유망·인기 분야, 출원이 많거나 늘어난 분야를 물을 때.
  - "search": 특정 작물·식품·제품·공정·문제에 맞는 특허를 찾거나 추천받고 싶을 때.
  - "transfer": 기술이전 절차, 계약, 기술료, 무상기술이전을 물을 때.
- query: "search"일 때만. 특허 제목에 실제로 쓰일 핵심 한국어 명사 1~3개(공백 구분, 예: "딸기 저장", "돼지 질병 진단"). 이전 대화 맥락을 반영(예: "그중 저장 기술은?" → 앞 주제 + 저장).
- recommendFromTrend: 주제 없이 "요즘 활용하면 좋은 기술", "유망 기술 추천"처럼 물으면 true (이때 search는 넣지 말 것).
- fromHistory: 이미 보여준 특허나 이전 답변에 대한 후속 질문(예: "첫 번째 특허 TRL은?")이면 true, tools는 [].
- smalltalk: 인사·감사처럼 자료가 필요 없으면 true, tools는 [].
형식: {"tools":[],"query":"","recommendFromTrend":false,"fromHistory":false,"smalltalk":false}`,
        },
      ],
    });
    return normalizeRoute(parseJson(res.choices?.[0]?.message?.content), question);
  } catch (e) {
    if (e instanceof PaymentRequiredError || e instanceof RateLimitError) throw e;
    console.warn("[patent-chat] route fallback", e instanceof GatewayError ? e.code : e);
    return normalizeRoute(null, question);
  }
}

async function loadTrends(): Promise<(TrendSnapshotLike & { updatedAt?: string }) | null> {
  const { data } = await supabaseAdmin().from("site_settings").select("value").eq("key", CACHE_KEY).maybeSingle();
  try {
    if (data?.value) return JSON.parse(data.value);
  } catch { /* fall through to live call */ }
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/filing-trends`, {
    headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? ""}` },
  }).catch(() => null);
  if (!res?.ok) return null;
  const json = await res.json().catch(() => null);
  return json?.success ? json : null;
}

async function searchPatents(body: Record<string, unknown>, forwardedFor: string | null): Promise<PatentHit[]> {
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/search-patents`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) { await res.body?.cancel(); return []; }
    const data = await res.json();
    return Array.isArray(data?.patents) ? data.patents : [];
  } catch (e) {
    console.warn("[patent-chat] search failed", e instanceof Error ? e.message : e);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function scoresFor(hits: PatentHit[]): Promise<ScoreRow[]> {
  const keys = [...new Set(hits.slice(0, 40).flatMap((h) => [h.patentId, digitsOf(h.patentId)]).filter(Boolean))];
  if (!keys.length) return [];
  const { data } = await supabaseAdmin().from("patent_score_cache")
    .select("patent_number, trl")
    .in("patent_number", keys);
  return (data as ScoreRow[] | null) ?? [];
}

const cardFacts = (cards: PatentCard[]) => cards.map((c, i) => ({
  순번: i + 1,
  제목: c.title,
  출원인: c.applicant,
  출원일: c.applicationDate,
  요약: c.snippet,
  TRL: c.trl ?? "미분석",
}));

const ANSWER_RULES = `당신은 '농업 국가연구기관 6곳(농촌진흥청 등)이 보유한 특허'를 안내하는 Agri IP Summary의 특허 상담원입니다.
규칙:
- 한국어 존댓말로, 핵심을 먼저 말하고 3~8문장 또는 짧은 목록으로 답합니다. 굵게(**)와 목록은 써도 되지만 표와 제목(#)은 쓰지 않습니다.
- [자료]에 있는 특허와 숫자만 사용합니다. 자료에 없는 특허명, 특허번호, 통계, 시장 규모, 금액은 절대 만들지 않습니다.
- 특허는 제목으로 언급하고, 특허번호는 나열하지 않습니다. [자료]에 특허가 있을 때만 답변 아래 카드에서 AI 요약을 볼 수 있다고 한 번 안내합니다.
- TRL은 값이 있을 때만 "TRL 6"처럼 그대로 씁니다. "미분석"이면 추정하지 말고 "카드를 눌러 AI 요약을 열면 확인할 수 있다"고 안내합니다.
- 사업화 점수·등급(종합·기술성·시장성·사업성)은 이 상담에서 말하지 않습니다. 물어보면 "카드의 AI 요약 보기를 누르면 요약서에서 사업화 평가를 확인할 수 있다"고 안내합니다.
- 특허 검색 결과가 비어 있으면 찾지 못했다고 솔직히 말하고, 더 구체적인 작물·제품·공정 이름으로 다시 물어보도록 제안합니다.
- 동향은 기준연도와 통계 숫자를 그대로 인용하고, 원인이나 전망을 단정하지 않습니다.
- 이 서비스 범위(6개 농업 국가연구기관 특허, 출원 동향, 기술이전 절차) 밖의 질문은 범위를 정중히 안내합니다. 법률 자문은 하지 않습니다.
- 특허 존속기간이나 잔여기간은 언급하지 않습니다.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "허용되지 않는 요청입니다." }, 405);

  const limited = await enforceRateLimit(req, { bucket: "patent-chat", limit: 20, windowSeconds: 300 });
  if (limited) return limited;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ success: false, error: "질문을 확인해 주세요." }, 400);
  const all = parsed.data.messages.slice(-MAX_HISTORY);
  const last = all[all.length - 1];
  if (last.role !== "user") return jsonResponse({ success: false, error: "질문을 입력해 주세요." }, 400);
  const question = last.content.slice(0, MAX_MESSAGE_CHARS);
  const history = all.slice(0, -1);
  const forwardedFor = req.headers.get("x-forwarded-for");

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        const plan = await route(history, question);
        const facts: Record<string, unknown> = {};

        const runTool = async (tool: ChatTool, input: Record<string, unknown>, run: () => Promise<Record<string, unknown>>) => {
          const id = `${tool}-${crypto.randomUUID().slice(0, 8)}`;
          send({ type: "tool-start", id, toolName: tool, title: TOOL_TITLES[tool], input });
          try {
            const output = await run();
            send({ type: "tool-result", id, output });
            return output;
          } catch (e) {
            console.warn(`[patent-chat] ${tool} failed`, e instanceof Error ? e.message : e);
            send({ type: "tool-error", id, errorText: "자료를 불러오지 못했습니다." });
            return null;
          }
        };

        const jobs: Promise<unknown>[] = [];
        if (plan.tools.includes("transfer")) {
          jobs.push(runTool("transfer", { 주제: "기술이전 절차" }, async () => {
            facts.기술이전_안내 = TRANSFER_GUIDE;
            return { steps: TRANSFER_GUIDE.단계.length };
          }));
        }

        const trendJob = plan.tools.includes("trends")
          ? runTool("trends", { 범위: "6개 기관 최근 출원" }, async () => {
            const snap = await loadTrends();
            if (!snap) throw new Error("no trend snapshot");
            facts.출원_동향 = trendFacts(snap);
            const field = plan.recommendFromTrend ? pickTrendField(snap.fields) : null;
            return { completeYear: snap.completeYear, recommendField: field ? { id: field.id, label: fieldLabel(field.id), growth: field.growth, latest: field.latest } : null };
          })
          : Promise.resolve(null);
        jobs.push(trendJob);

        if (plan.query) {
          jobs.push(runTool("search", { 검색어: plan.query }, async () => {
            const hits = await searchPatents({ keyword: plan.query }, forwardedFor);
            const cards = buildCards(hits, await scoresFor(hits));
            facts.특허_검색 = { 검색어: plan.query, 결과수: hits.length, 특허: cardFacts(cards) };
            return { query: plan.query, total: hits.length, cards };
          }));
        } else if (plan.recommendFromTrend) {
          jobs.push(trendJob.then(async (out) => {
            const field = (out as { recommendField?: { id: string; label: string } } | null)?.recommendField;
            if (!field) return;
            await runTool("search", { 분야: field.label, 기준: "최근 출원 순" }, async () => {
              const hits = await searchPatents({ keyword: field.label, fieldId: field.id }, forwardedFor);
              const cards = buildCards(hits, await scoresFor(hits), { newestFirst: true });
              facts.추천_분야_특허 = { 분야: field.label, 선정이유: "기준연도 출원 증가율이 가장 높은 분야(출원 10건 이상)", 결과수: hits.length, 특허: cardFacts(cards) };
              return { query: field.label, field: field.label, total: hits.length, cards };
            });
          }));
        }
        await Promise.all(jobs);

        const dataBlock = Object.keys(facts).length
          ? `\n\n[자료]\n${JSON.stringify(facts)}`
          : "\n\n[자료]\n(이번 질문에는 새로 조회한 자료가 없습니다. 이전 대화에 나온 내용만 근거로 답하고, 없으면 무엇을 찾아볼지 되물어 주세요. 이번 답변 아래에는 카드가 없으니 카드 안내는 하지 마세요.)";

        const aiStream = await streamChatCompletion({
          model: "google/gemini-3.8-flash",
          messages: [
            { role: "system", content: ANSWER_RULES },
            ...history.map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS * 2) })),
            { role: "user", content: `${question}${dataBlock}` },
          ],
        });
        for await (const event of aiStream) {
          const delta = (event as { choices?: { delta?: { content?: unknown } }[] }).choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) send({ type: "text-delta", delta });
        }
        send({ type: "done" });
      } catch (e) {
        const message = e instanceof PaymentRequiredError
          ? "AI 사용 한도가 소진되어 잠시 이용할 수 없습니다."
          : e instanceof RateLimitError
            ? "요청이 많습니다. 잠시 후 다시 시도해 주세요."
            : "답변 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
        console.error("[patent-chat] error", e instanceof GatewayError ? { code: e.code, ids: e.ids } : e);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
});
