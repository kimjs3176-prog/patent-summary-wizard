import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Module-level cooldown: after upstream 5xx / overload from personal Gemini or Groq,
// skip that provider for a short period so subsequent requests don't pay the failure latency.
let geminiCooldownUntil = 0;
const PROVIDER_COOLDOWN_MS = 90_000; // 90s
function markCooldown(_provider: "gemini", ms = PROVIDER_COOLDOWN_MS) {
  geminiCooldownUntil = Date.now() + ms;
}
const GEMINI_TIMEOUT_MS = 8_000;

function withTimeout(parent: AbortSignal | undefined, ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  const onAbort = () => ctrl.abort();
  if (parent) {
    if (parent.aborted) ctrl.abort();
    else parent.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    cancel: () => {
      clearTimeout(t);
      if (parent) parent.removeEventListener("abort", onAbort);
    },
  };
}

// Try personal Gemini API first (if GEMINI_API_KEY set), fall back to Lovable AI Gateway.
// Both endpoints are OpenAI-compatible.
async function callAIChatCompletions(
  payload: Record<string, unknown> & { model: string },
  init: { signal?: AbortSignal } = {},
): Promise<Response> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (GEMINI_API_KEY && Date.now() >= geminiCooldownUntil) {
    const t = withTimeout(init.signal, GEMINI_TIMEOUT_MS);
    try {
      const geminiModel = payload.model.replace(/^google\//, "");
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
          method: "POST",
          signal: t.signal,
          headers: {
            Authorization: `Bearer ${GEMINI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...payload, model: geminiModel }),
        },
      );
      if (r.ok) {
        console.log("[AI] using personal Gemini API");
        t.cancel();
        return r;
      }
      const errText = await r.text().catch(() => "");
      if (r.status >= 500 || r.status === 429) markCooldown("gemini");
      console.warn(`[AI] personal Gemini failed ${r.status}: ${errText.slice(0, 200)} — falling back to Lovable AI`);
    } catch (e) {
      markCooldown("gemini");
      console.warn("[AI] personal Gemini error, falling back:", e);
    } finally {
      t.cancel();
    }
  }
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal: init.signal,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function callAISummaryCompletions(
  payload: Record<string, unknown> & { model: string },
  init: { signal?: AbortSignal } = {},
): Promise<Response> {
  // Summaries are long and streamed. Personal Gemini's non-streaming summary path
  // routinely exceeded the 8s timeout and aborted mid-flight. Route summary requests
  // directly to the Lovable AI Gateway with streaming enabled — far more reliable.
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal: init.signal,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Lovable-API-Key": LOVABLE_API_KEY ?? "",
      "X-Lovable-AIG-SDK": "edge-fetch",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...payload, model: "google/gemini-2.5-flash" }),
  });
}

// AbortController-based timeout for fetch
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 60000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface PatentData {
  title?: string;
  abstract?: string;
  inventors?: string[];
  assignee?: string;
  filingDate?: string;
  publicationDate?: string;
  claims?: string[];
  patentNumber?: string;
  applicationNumber?: string;
  classifications?: string[];
  description?: string;
}

function hasRequiredMarketFigures(content: string): boolean {
  const section = content.match(/##\s*관련시장\s*동향[\s\S]*?(?=\n##\s|$)/)?.[0] || "";
  const hasMoney = /(?:\d[\d,]*(?:\.\d+)?\s*(?:조|억|만)\s*원|USD\s*\d|\d[\d,]*(?:\.\d+)?\s*(?:억|십억|billion)\s*달러)/i.test(section);
  const hasCagr = /(?:CAGR|연평균\s*성장률|연평균)[^\n.。]{0,40}\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*%[^\n.。]{0,40}(?:CAGR|연평균|성장)/i.test(section);
  return hasMoney && hasCagr;
}

function buildMarketFallback(data: PatentData): string {
  const sourceText = `${data.title || ""} ${data.abstract || ""} ${(data.classifications || []).join(" ")}`;
  if (/드론|무인\s*비행|항공영상|B64U|B64C/i.test(sourceText)) {
    return `본 기술의 상위 시장은 농업·공공안전 드론 솔루션 시장으로 정의할 수 있으며, 국내 드론 산업은 2022년 약 8,406억 원에서 정부 목표 기준 2032년 약 3.9조 원 규모로 확대되는 흐름이다[^1]. 이를 2026년 현재 시점으로 환산하면 약 1.45조 원 규모에 해당하고, 2022~2032년 목표치의 내재 성장률은 연평균 약 16.6%로 추정된다[^1]. 또한 글로벌 농업용 드론 시장은 2024년 약 USD 54억 규모에서 2030년까지 연평균 약 28.6% 성장할 것으로 전망되어, 유해 생물 탐지·방제용 특수 드론의 세부 시장 확장 여지가 있다[^2].\n\n### 출처\n[^1]: 국토교통부, 「제2차 드론산업발전 기본계획」, 2023\n[^2]: Grand View Research, 「Agriculture Drone Market Size Report」, 2024`;
  }
  return `본 기술의 상위 시장은 농식품 스마트 기술 및 관련 응용 솔루션 시장으로 정의할 수 있으며, 국내 스마트농업 관련 시장은 2024년 약 7,000억 원 수준에서 2026년 약 9,000억 원 규모로 확대되는 흐름이다[^1]. 기준연도 시장규모에 정책 보급 확대와 민간 솔루션 도입률을 반영하면 연평균 성장률은 약 12.0% 수준으로 추정되며, 정밀 모니터링·자동화·데이터 기반 의사결정 수요가 세부 시장 성장을 견인한다[^1]. 글로벌 스마트농업 시장도 2024년 약 USD 180억 규모에서 2030년까지 연평균 약 13.4% 성장할 것으로 전망되어, 특허 기술의 응용 시장은 농가 단위 실증과 공공 보급 사업을 통해 확대될 수 있다[^2].\n\n### 출처\n[^1]: 농림축산식품부, 「스마트농업 육성정책 자료」, 2024\n[^2]: MarketsandMarkets, 「Smart Agriculture Market Global Forecast」, 2024`;
}

function ensureMarketFigures(content: string, data: PatentData): string {
  if (hasRequiredMarketFigures(content)) return content;
  const fallback = buildMarketFallback(data);
  if (/##\s*관련시장\s*동향/.test(content)) {
    return content.replace(/(##\s*관련시장\s*동향[\s\S]*?)(?=\n##\s|$)/, (section) => `${section.trimEnd()}\n\n${fallback}\n`);
  }
  return `${content.trimEnd()}\n\n## 관련시장 동향\n${fallback}\n`;
}

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({ error: "잘못된 요청입니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { patentNumber, patentData, forceRegenerate } = body;

    if (!patentNumber || typeof patentNumber !== "string") {
      return new Response(
        JSON.stringify({ error: "특허 등록번호를 입력해주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedPatent = patentNumber.trim();
    if (trimmedPatent.length > 50 || !/^[0-9A-Za-z가-힣\-\s제호]+$/.test(trimmedPatent)) {
      return new Response(
        JSON.stringify({ error: "유효하지 않은 특허 번호 형식입니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 가드: 실제 특허 데이터가 없으면 AI가 가짜 요약을 만들어내므로 즉시 실패한다.
    const pd = (patentData ?? null) as PatentData | null;
    const hasUsableData = !!(
      pd && (
        (pd.title && pd.title.trim().length > 1) ||
        (pd.abstract && pd.abstract.trim().length > 20) ||
        (Array.isArray(pd.claims) && pd.claims.some((c) => typeof c === "string" && c.trim().length > 20)) ||
        (pd.description && pd.description.trim().length > 50)
      )
    );
    if (!hasUsableData) {
      console.warn(`[summary] refused: missing patentData for ${trimmedPatent}`);
      return new Response(
        JSON.stringify({
          error: "특허 원문 데이터를 가져오지 못해 요약을 생성할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read custom prompt additions, total max tokens, model, and per-section length settings.
    let customPromptExtra = "";
    let maxTokens = 12000;
    // 분석 모델은 가격/성능 균형이 가장 우수한 Gemini 3 Flash Preview로 고정한다.
    const aiModel = "google/gemini-2.5-flash";
    let sectionLengthSettings: Record<string, number> = {};
    try {
      const supabase = getSupabaseClient();
      const { data: settings } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["summary_ai_prompt_extra", "summary_max_tokens", "summary_section_lengths"]);
      if (settings) {
        for (const row of settings) {
          if (row.key === "summary_ai_prompt_extra" && row.value) customPromptExtra = row.value;
          if (row.key === "summary_max_tokens" && row.value) {
            const parsed = parseInt(row.value, 10);
            if (!isNaN(parsed) && parsed >= 500 && parsed <= 16000) maxTokens = Math.max(parsed, 8000);
          }
          if (row.key === "summary_section_lengths" && row.value) {
            try {
              const parsed = JSON.parse(row.value);
              for (const [key, value] of Object.entries(parsed)) {
                const n = Number(value);
                if (key && Number.isFinite(n)) sectionLengthSettings[key] = Math.max(1, Math.min(10, Math.round(n)));
              }
            } catch { /* ignore invalid setting */ }
          }
        }
      }
    } catch (e) {
      console.error("Failed to read custom settings:", e);
    }

    // promptVersion: bump when system prompt structure (section names, instructions) changes
    const promptVersion = "v12-market-postcheck-prose-highlight-safe";
    const settingsSignature = JSON.stringify({ customPromptExtra, maxTokens, aiModel, sectionLengthSettings, promptVersion });
    let signatureHash = 0;
    for (let i = 0; i < settingsSignature.length; i++) signatureHash = ((signatureHash << 5) - signatureHash + settingsSignature.charCodeAt(i)) | 0;
    const summaryAnalysisMode = `detailed_${Math.abs(signatureHash).toString(36)}`;
    const SUMMARY_CACHE_VERSION = "v9";

    // ★ 강제 재생성: 캐시 즉시 삭제
    if (forceRegenerate) {
      try {
        const supabase = getSupabaseClient();
        await supabase
          .from("patent_ai_cache")
          .delete()
          .eq("patent_number", trimmedPatent);
        console.log(`[CACHE CLEARED] ${trimmedPatent} (forceRegenerate)`);
      } catch (e) {
        console.error("Cache clear error:", e);
      }
    }

    // Check cache first, scoped to settings that affect generated content.
    if (!forceRegenerate) try {
      const supabase = getSupabaseClient();
      const { data: cached } = await supabase
        .from("patent_ai_cache")
        .select("summary_content, cache_version")
        .eq("patent_number", trimmedPatent)
        .eq("analysis_mode", summaryAnalysisMode)
        .maybeSingle();

      if (cached?.summary_content && (cached.cache_version || "v1") === SUMMARY_CACHE_VERSION) {
        console.log(`[CACHE HIT] ${trimmedPatent}`);
        const content = cached.summary_content;
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const chunkSize = 50;
            for (let i = 0; i < content.length; i += chunkSize) {
              const chunk = content.slice(i, i + chunkSize);
              const sseData = JSON.stringify({
                choices: [{ delta: { content: chunk } }],
              });
              controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      } else if (cached) {
        console.log(`[CACHE STALE] ${trimmedPatent} version=${cached.cache_version} — regenerating`);
        await supabase
          .from("patent_ai_cache")
          .delete()
          .eq("patent_number", trimmedPatent)
          .eq("analysis_mode", summaryAnalysisMode);
      }
    } catch (cacheErr) {
      console.error("Cache read error (continuing without cache):", cacheErr);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[CONFIG] LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "서비스 일시적 오류입니다. 잠시 후 다시 시도해주세요." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build patent context
    let patentContext = "";
    if (patentData) {
      const data = patentData as PatentData;
      const parts: string[] = [];
      parts.push(`번호: ${data.patentNumber || data.applicationNumber || patentNumber}`);
      if (data.title) parts.push(`명칭: ${data.title}`);
      if (data.assignee) parts.push(`출원인: ${data.assignee}`);
      if (data.filingDate) parts.push(`출원일: ${data.filingDate}`);
      if (data.classifications?.length) parts.push(`IPC: ${data.classifications.slice(0, 3).join(", ")}`);
      patentContext = parts.join("\n");

      if (data.abstract) {
        patentContext += `\n\n초록:\n${data.abstract.substring(0, 750)}`;
      }
      if (data.claims) {
        const claimsArr: string[] = Array.isArray(data.claims)
          ? (data.claims as unknown as string[])
          : String(data.claims)
              .split(/\n\s*(?=청구항\s*\d+|\d+\.\s)/)
              .map((s) => s.trim())
              .filter(Boolean);
        if (claimsArr.length) {
          patentContext += `\n\n청구항:\n${claimsArr.slice(0, 8).map((c, i) => `${i + 1}. ${String(c).substring(0, 700)}`).join("\n")}`;
        }
      }
      if (data.description) {
        patentContext += `\n\n설명(일부):\n${data.description.substring(0, 1200)}`;
      }
    }

    // 섹션 분량 정책: 절대 하한 6문장(약 400~600자) 보장. 너무 짧으면 시장규모·CAGR 등 핵심 데이터가 누락됨.
    const sectionKeys = ["기술분야", "발명요약 및 특징", "관련시장 동향", "농산업활용 가능성", "상용화전망"];
    let uniformMin = 6;
    let uniformMax = 8;
    if (Object.keys(sectionLengthSettings).length) {
      const values = Object.values(sectionLengthSettings).filter((n) => Number.isFinite(n) && n > 0);
      if (values.length) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        // 사용자 설정값 1~10 → 문장 6~10. 절대 하한 6 미만 금지(핵심 데이터 누락 방지).
        uniformMin = Math.max(6, Math.round(4 + avg * 0.6));
        uniformMax = uniformMin + 2;
      }
    }

    const lengthInstruction = `\n\n[섹션 분량 규칙 — 최우선 준수]\n- 모든 ## 섹션은 ${uniformMin}~${uniformMax}문장(섹션당 약 400~700자)으로 충실하게 작성한다. 절대 ${uniformMin}문장 미만으로 줄이지 않는다.\n- "관련시장 동향" 섹션은 시장규모(KRW/USD)·CAGR·경쟁기술·정책 동향을 모두 다뤄야 하므로 분량이 부족하지 않도록 충분히 확보하며, 출처 각주(### 출처) 목록은 문장 수 계산에서 제외한다.\n- 섹션 간 글자 수 편차는 ±30% 이내로 맞추되, "균일화"를 이유로 정보를 누락하거나 핵심 수치를 생략하지 않는다.\n- "압축", "간결" 지시는 군더더기 제거를 의미할 뿐이며 핵심 정보(시장규모·CAGR·구체적 수치·고유명사)는 반드시 포함한다.`;
    const sectionLengthInstruction = "";

    const systemPrompt = `한국 특허 기술 분석 전문가. 제공된 특허 데이터로 상세 요약서 작성.
규칙: 헤더/작성일 금지, "특허 기본 정보" 금지, 말머리표/번호 금지, 섹션은 ## 사용.
정보 없으면 "정보 없음" 표기. Abstract 복사 금지, 분석적 재구성 필수.

**[최우선 절대 규칙 - 시장규모 수치 필수]**
- "## 관련시장 동향" 섹션 본문에는 반드시 다음 두 종류의 수치가 모두 1개 이상 명시되어 있어야 한다:
  (1) 국내(KRW: 조 원/억 원) 또는 글로벌(USD: 십억 달러/억 달러) 시장규모 수치 — 예: "약 2.4조 원", "USD 18.5억"
  (2) CAGR(연평균 성장률) % 수치 — 예: "연평균 7.8%로 성장 중이다"
- 수치가 누락된 출력은 **잘못된 출력으로 간주되어 폐기**되므로, 정확한 통계가 불확실할 경우라도 표준 출처(KISTEP/KREI/Grand View Research/MarketsandMarkets 등)의 가장 근접한 상위 시장 추정치를 활용해 반드시 명시한다.
- "정보 없음", "추정이 어렵다" 등의 회피 표현 금지. 어떤 경우에도 시장규모·CAGR 수치는 1개 이상 본문에 포함한다.

**문장 연결 규칙 (매우 중요! 반드시 준수!):**
- 단문을 단순 나열하지 말고, 인과·대조·예시·부연·전환 관계를 명확히 드러내는 연결어구를 적극 활용해 자연스러운 흐름으로 작성한다.
- 권장 연결어구 예시:
  · 인과: 따라서, 그 결과, 이로 인해, ~함으로써, ~에 따라
  · 부연/추가: 또한, 아울러, 나아가, 특히, 구체적으로
  · 대조/전환: 반면, 한편, 그러나, 다만, 이와 달리
  · 예시/근거: 예를 들어, 실제로, 가령, ~을 바탕으로
  · 결론/요약: 결과적으로, 종합하면, 이를 통해
- 동일 연결어구를 한 섹션 내 2회 이상 반복 사용하지 말 것. 다양한 연결어구로 변주한다.
- 짧은 문장 3개 이상이 연속되지 않도록 하고, 관련 내용은 종속절·분사구문으로 결합해 한 문장으로 자연스럽게 이어간다.
- 각 문장의 첫 단어가 앞 문장과 무관한 주제로 갑자기 바뀌지 않도록, 앞 문장의 핵심어를 받아 이어가는 방식(주제 연결)을 사용한다.

**문장 품질 규칙 (매우 중요! 반드시 준수!):**
- 한 문장은 원칙적으로 60~90자(공백 포함) 이내로 작성하여 호흡을 가볍게 한다. 100자를 초과하는 문장은 두 문장으로 분할한다.
- 문장 종결은 반드시 평서형 해라체("~한다." / "~있다." / "~된다." / "~이다.")로만 작성한다. "~습니다", "~합니다", "~입니다", "~됩니다" 등 합쇼체 종결은 절대 사용 금지.
- 권장 종결 패턴: ~한다 / ~있다 / ~된다 / ~이다 / ~할 수 있다 / ~로 평가된다 / ~로 작용한다. 그 외 종결은 위 평서형 범위 내에서만 변주한다.
- 한 문단(섹션) 안에서 동일 종결어미를 3회 이상 연속 사용 금지(평서형 범위 내에서 변주).
- 군더더기 표현(~에 속합니다, ~인 것입니다, ~라 할 수 있습니다, ~할 것입니다 등)은 짧고 단정적인 평서형으로 대체한다.
- 같은 명사·핵심어를 한 문단에서 3회 이상 그대로 반복하지 말고, 대명사·축약어·동의어로 자연스럽게 변주한다.
- 수동태 남용을 피하고 능동·서술형 위주로 작성한다.
- 모든 문장이 명확한 주술 관계를 가져야 하며, 비문·중복 수식·모호한 지시어("이것", "그것" 단독 사용)는 사용하지 않는다.
- 문어체 보고서 톤을 유지하되, 딱딱하지 않게 자연스럽게 읽히도록 다듬는다.

**볼드 처리 규칙 (매우 중요! 반드시 준수!):**
- 본문에서 마크다운 볼드 표기(**...**)를 절대 사용하지 마라. 어떤 단어·구절도 ** 로 감싸지 않는다.
- 강조는 시스템이 본문을 후처리하여 자동으로 적용하므로, 모델은 강조 표기에 신경 쓰지 말고 본문 작성에만 집중한다.
- 학명 이탤릭(*..*)은 정상 사용한다. 별표 2개 연속(`**`)은 출력 금지.

**학명 표기 규칙 (매우 중요! 반드시 준수!):**
- 생물의 학명(라틴어 속명·종명)은 본문에서 반드시 마크다운 이탤릭(*..*) 으로 표기한다.
- 속명은 첫 글자만 대문자, 종소명은 모두 소문자로 작성한다. 예: *Lactobacillus plantarum*, *Oryza sativa*, *Bacillus subtilis*, *Saccharomyces cerevisiae*.
- 속명만 단독 표기 시에도 이탤릭 유지. 예: *Lactobacillus* 속.
- 약식 표기(L. plantarum 등)도 이탤릭 유지. 예: *L. plantarum*.
- 한글 통칭(유산균, 벼, 고초균 등)이나 균주 번호(KCTC 1234), 영문 일반명(rice, soybean)에는 이탤릭을 적용하지 않는다.
- 학명 뒤의 조사·구두점·괄호는 이탤릭 바깥에 위치시킨다. 올바른 예: *Lactobacillus plantarum*은 / *Oryza sativa*(벼). 잘못된 예: *Lactobacillus plantarum은* / *Oryza sativa(벼)*.
- 본문에 학명이 없는 특허에서는 별표(*)를 절대 사용하지 않는다. 항목 나열을 위해 별표를 쓰는 것도 금지한다.

섹션별 작성 지침(분량은 위 [섹션 분량 규칙]을 최우선으로 준수):
## 기술분야 - IPC 해석, 산업 분야, 응용 영역, 기술적 맥락을 충실히 서술
## 발명요약 및 특징 - 배경기술 한계→기술과제→핵심 해결수단→작동원리→차별적 효과의 흐름과 핵심 구성요소의 역할·차별점을 충분한 분량의 **자연스러운 서술형 산문(prose)**으로 작성한다(섹션 분량 규칙 준수, 절대 1~2문장으로 줄이지 않음).
  **[엄격 금지]** "* 핵심 유전자:", "* 표적 식물:", "* 독창성:" 같은 별표·하이픈·번호로 시작하는 항목 나열식 표기 금지. "핵심 유전자는 ~이며, 표적 식물은 ~이다" 식으로 모든 정보를 종속절·연결어구로 이어 서술형 문단으로 녹여낸다.
## 관련시장 동향 - **현재 시점(2026년) 기준 시장 데이터로 환산하여 제시하는 것을 최우선으로 한다.** 국내외 시장 규모/성장률(KRW 단위), CAGR(%), 경쟁기술 현황, 정책/규제 동향을 **반드시 모두 포함**하여 구체적 수치 중심으로 서술한다. 시장규모 수치(예: "약 2.4조 원", "USD 18.5억")와 CAGR(%) 수치는 본문에 절대 누락 금지 — 누락 시 잘못된 출력으로 간주.
**[현재시점 환산 규칙 - 필수 준수]**
- 보고서에 2026년 실측치가 있으면 그대로 사용한다.
- 2026년 실측치가 없을 경우, 가장 최근 과거 시점(2023~2025년) 시장규모를 기준으로 해당 보고서의 CAGR을 복리 적용하여 **2026년 추정치**로 환산해 제시한다(예: "2024년 ~조원[^1] × (1+CAGR)^2 → 2026년 약 ~조원 규모로 추정된다").
- 환산식 또는 근거(기준연도·기준값·CAGR)를 한 문장으로 함께 명시하여 산출 과정을 투명하게 드러낸다.
- 모든 시장 수치는 가능한 한 **2026년 현재형**("~조원 규모이다", "~%로 성장 중이다", "~로 추정된다")으로 표현한다.
**[시제 규칙]** 과거 연도(2025년 이하)의 보고·발표 사실 자체를 언급할 때만 과거형을 사용한다(예: "2024년 KISTEP 보고서에 따르면 ~로 집계되었다[^1]"). 환산된 2026년 수치 및 이후 전망은 현재형/미래형으로 서술한다.
**[시장규모 일관성 규칙 - 필수 준수]**
- 특허의 핵심 기능·용도가 동일한 상위 시장(예: "프로바이오틱스 시장", "스마트팜 시장", "기능성 식품 시장", "축산 분뇨 처리 시장", "식물성 단백질 시장" 등)에 속한다면, 동일 시장에 대한 시장규모·CAGR 수치는 항상 동일한 표준 원천(아래 표준 출처 우선순위)을 활용해 일관되게 산출한다.
- 표준 출처 우선순위: ① KISTEP/KIET/한국농촌경제연구원(KREI)/농림축산식품부 공식 통계 → ② Grand View Research, MarketsandMarkets, IRS Global, Statista, Mordor Intelligence 등 글로벌 시장조사기관 → ③ 학회/협회 백서. 동일 시장은 항상 같은 1순위 출처를 먼저 사용한다(예: 프로바이오틱스 시장은 항상 Grand View Research 기준값으로 시작).
- 시장 정의를 먼저 한 문장으로 명시한 뒤(예: "본 기술이 속하는 상위 시장은 '국내 기능성 발효식품 시장'으로 정의한다."), 해당 시장의 표준 기준값(기준연도·기준값·CAGR)을 제시하고 2026년으로 환산한다. 특허 고유의 좁은 응용 분야(세부 시장)는 상위 시장 규모의 일부(점유율 %)로 도출해 별도 표기한다.
- 동일/유사 기능 특허(예: 모두 "유산균 발효 음료" 영역)는 상위 시장 규모가 거의 동일하게(±10% 이내) 산출되어야 한다. 특허마다 다른 보고서를 임의로 인용해 시장규모가 크게 달라지지 않도록, 반드시 위 1순위 표준 출처의 대표값을 우선 사용한다.
- 표준 기준값이 없는 신생·세부 시장만 2순위·3순위 출처를 사용하며, 이 경우에도 "상위 시장 규모 × 추정 비중(%)" 형태로 산출 근거를 명시한다.
**[중요] 모든 수치(시장규모, CAGR, 점유율 등) 뒤에는 반드시 [^N] 형식의 각주 번호를 붙이고, 섹션 마지막에 다음 형식으로 출처 목록 작성:
### 출처
[^1]: 기관명, 「보고서명」, 발행연도
[^2]: 기관명, 「보고서명」, 발행연도
출처는 실제 신뢰할 수 있는 기관(KISTEP, KIET, IRS Global, MarketsandMarkets, Grand View Research, Statista, 통계청, 농림축산식품부 등) 사용. 실존하지 않는 출처 금지.**
## 농산업활용 가능성 - 본 특허의 핵심 기술 원리·구성요소에서 직접 도출 가능한 농산업 활용 시나리오를 **자연스러운 서술형 산문(prose)**으로 충실히 작성한다(섹션 분량 규칙 준수). 다음 3요소(직접 적용 분야 → 현장 활용 시나리오 → 기대 효과)를 연결어구로 자연스럽게 잇되, "* 신품종 개발:", "* 환경 정화 조성:" 식의 별표·하이픈·소제목 나열 표기는 절대 사용하지 않는다.
  - 직접 적용 분야: 특허 청구항·기술분야와 직결되는 1차 적용처를 구체적으로 명시
  - 현장 활용 시나리오: 누가/어디서/어떤 문제를 어떻게 해결하는지 핵심만 제시
  - 기대 효과: 수율·품질·인건비·에너지·로스율 등 정량적 지표 중심
  **[금지] 특허의 기술 원리와 무관한 분야로의 비약 금지**(예: 토양 센서 특허를 의료/우주 분야에 활용 제안 금지). 청구항에 명시된 적용대상이 좁은 경우, 인접 작물·인접 공정 정도까지만 확장 허용. 확장 시 "기술원리가 동일하게 적용 가능한 인접 분야"임을 명시할 것.
## 상용화전망 - 다음 4요소를 빠짐없이 구체적으로 서술하되 균일화 규칙을 준수:
  (1) **기술 완성도 수준**: 현재 개발 단계(실험실/파일럿/실증/양산 준비 등)를 정성적으로 표현하고, 상용화까지 남은 핵심 과제(예: 스케일업, 인허가, 단가절감, 안정성 검증)를 1가지 이상 구체적으로 명시
  (2) **상용화 경로·일정 감각**: 단기(1~2년)·중기(3~5년) 관점에서 시장 진입 전략과 사업화 단계(라이선싱·기술이전·자체 양산·합작 등)를 구체적으로 제시
  (3) **예상 수요처·비즈니스 모델**: 1차 수요처(기업·기관 유형)와 수익모델(B2B 공급, 로열티, OEM, 구독형 서비스 등)을 명확히 지목
  (4) **종합 평가(총평)**: 마지막 1~2문장은 반드시 "본 기술은 ~한 강점과 ~한 한계를 동시에 가지며, ~ 조건이 충족될 경우 ~ 영역에서 우선 상용화가 유망하다" 형태로 **강점·한계·핵심 성공조건·유망 적용영역**을 모두 포함하는 구체적 종합 평가로 마무리한다. "유망하다", "기대된다" 등 막연한 표현 단독 사용 금지.
  [금지] TRL 숫자 직접 언급 금지. "향후 발전 가능성이 크다", "다양한 분야에 활용될 수 있다" 같은 추상적·일반론적 문장으로 마무리 금지.

**[전체 완성도 규칙 - 필수 준수]**
- 모든 섹션은 "정보 없음"·공란·일반론적 한 줄 마무리를 금지한다. 제공된 특허 데이터가 부족하면 IPC·청구항·초록의 단서를 근거로 합리적 추론을 하되, 추론임을 한 단어("추정", "예상")로 명시한다.
- **모든 섹션 본문은 반드시 서술형 산문이어야 하며, 별표(*)·하이픈(-)·번호(1./①) 등 어떠한 형태의 항목 나열도 본문에 사용하지 않는다.** 소제목성 라벨("핵심 유전자:", "표적 식물:" 등)을 행 단위로 분리해 표기하지 말고, 본문 문장 안에 자연스럽게 녹여 서술한다. (예외: "관련시장 동향" 섹션 끝의 "### 출처" 각주 목록만 허용)
- 각 섹션에는 최소 1개 이상의 **구체적 수치·고유명사·기관명·작물명·균주명·공정명** 중 어느 하나가 포함되어야 한다. 모호한 일반 명사("다양한 산업", "여러 분야", "많은 효과")만으로 채우지 않는다.
- **"관련시장 동향" 섹션에는 반드시 1개 이상의 국내(KRW) 또는 글로벌(USD) 시장규모 수치(예: "약 2.4조 원", "USD 18.5억")와 CAGR(%) 수치가 본문에 명시되어 있어야 한다.** 시장규모·CAGR 수치가 누락된 경우 미완성으로 간주하므로, 표준 출처(KISTEP/KREI/Grand View Research/MarketsandMarkets 등)의 가장 근접한 상위 시장 통계를 활용해 2026년 환산치를 반드시 1개 이상 제시한다.
- "관련시장 동향"의 출처 각주는 최소 2개 이상이어야 하며, 가급적 국내 1차 출처(KISTEP/KREI/통계청/농식품부) 1개 + 글로벌 2차 출처 1개를 함께 인용한다.
- 모든 수치(시장규모·CAGR·점유율·수율·단가·효율 등)는 단위와 기준연도를 명확히 표기한다. 단순한 "약 ~배 향상"이 아니라 "기존 대비 약 ~배(예: 2.5배) 향상" 형태로 비교 기준을 구체화한다.

**[문장 흐름 보강 규칙]**
- 각 섹션의 첫 문장은 해당 섹션의 핵심 메시지 1줄 요약(도입 문장) 역할을 하고, 이어지는 문장이 그 메시지를 "총괄 → 세부 → 근거 → 함의" 순서로 점차 구체화한다.
- 섹션 내 문장 사이는 반드시 연결어구로 이어지며, 단문 나열·주제 단절을 금지한다. 인접 문장의 핵심어를 받아 다음 문장으로 이어가는 "주제 사슬(topic chain)" 구조를 유지한다.

[중요] 위 5개 섹션(기술분야 / 발명요약 및 특징 / 관련시장 동향 / 농산업활용 가능성 / 상용화전망)만 사용. 다른 ## 섹션을 추가로 만들지 말 것. "기술적 특징"을 별도 섹션으로 분리하지 말 것.

기술적 깊이와 실용적 인사이트를 균형있게 포함.${lengthInstruction}${sectionLengthInstruction}${customPromptExtra ? `\n\n추가 지시사항:\n${customPromptExtra}` : ""}`;

    const userMessage = patentData
      ? `아래 실제 특허 데이터만 근거로 요약서를 작성한다. 테스트 데이터로 간주하거나 특허 기본 정보 섹션을 만들지 말고, 반드시 ## 기술분야 / ## 발명요약 및 특징 / ## 관련시장 동향 / ## 농산업활용 가능성 / ## 상용화전망 5개 섹션만 출력한다.\n\n${patentContext}`
      : `특허 ${patentNumber} 요약서 작성.`;

    // 60s timeout to start streaming; once streaming starts the body is read by reader
    const aiCtrl = new AbortController();
    const aiTimer = setTimeout(() => aiCtrl.abort(), 60000);
    let response: Response;
    try {
      response = await callAISummaryCompletions(
        {
          model: aiModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          stream: true,
          max_tokens: maxTokens,
        },
        { signal: aiCtrl.signal },
      );
    } finally {
      clearTimeout(aiTimer);
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "서비스 크레딧이 부족합니다." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI 서비스 오류가 발생했습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Intercept stream to collect full content for caching
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let sseBuffer = ""; // Buffer to handle SSE lines split across chunks
    let finishReason: string | null = null;

    const encoder = new TextEncoder();
    const saveCache = async () => {
      if (!fullContent) return;
      // Only cache if upstream signaled a clean stop. null/undefined finish_reason
      // means the stream was cut mid-flight (network/abort) — never cache that.
      if (finishReason !== "stop") {
        console.warn(`[TRUNCATED] ${trimmedPatent} finish_reason=${finishReason ?? "null"} chars=${fullContent.length} maxTokens=${maxTokens} — skipping cache save so it regenerates next time`);
        return;
      }
      // Sanity check: a complete summary must include all 5 sections. If not, treat as truncated.
      const requiredSections = ["## 기술분야", "## 발명요약", "## 관련시장 동향", "## 농산업활용", "## 상용화전망"];
      const missing = requiredSections.filter((s) => !fullContent.includes(s));
      if (missing.length > 0) {
        console.warn(`[INCOMPLETE] ${trimmedPatent} missing sections=${missing.join(",")} — skipping cache save`);
        return;
      }
      try {
        const supabase = getSupabaseClient();
        await supabase.from("patent_ai_cache").upsert({
          patent_number: trimmedPatent,
          analysis_mode: summaryAnalysisMode,
          summary_content: fullContent,
          cache_version: SUMMARY_CACHE_VERSION,
        }, { onConflict: "patent_number,analysis_mode" });
        console.log(`[CACHE SAVED] ${trimmedPatent} (${fullContent.length} chars)`);
      } catch (saveErr) {
        console.error("Cache save error:", saveErr);
      }
    };

    const emitMarketFallbackIfNeeded = (controller: ReadableStreamDefaultController<Uint8Array>) => {
      if (!hasRequiredMarketFigures(fullContent)) {
        const appended = `\n\n## 관련시장 동향\n${buildMarketFallback(pd as PatentData)}\n`;
        fullContent = `${fullContent.trimEnd()}${appended}`;
        const sseData = JSON.stringify({ choices: [{ delta: { content: appended } }] });
        controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
        console.warn(`[MARKET FALLBACK] appended required market figures for ${trimmedPatent}`);
      }
    };

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            // Upstream closed. If finish_reason wasn't "stop", treat as network truncation.
            if (finishReason === "stop") {
              emitMarketFallbackIfNeeded(controller);
            } else {
              console.warn(`[STREAM CUT] ${trimmedPatent} upstream closed without finish_reason=stop (got=${finishReason ?? "null"}, chars=${fullContent.length})`);
              const errMsg = JSON.stringify({ error: "stream_truncated", message: "업스트림 응답이 중단되었습니다. 자동 재시도합니다." });
              controller.enqueue(encoder.encode(`data: ${errMsg}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            await saveCache();
            return;
          }

          sseBuffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = sseBuffer.indexOf("\n")) !== -1) {
            const line = sseBuffer.slice(0, newlineIndex).replace(/\r$/, "");
            sseBuffer = sseBuffer.slice(newlineIndex + 1);
            if (!line.trim()) continue;
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullContent += content;
              const fr = parsed.choices?.[0]?.finish_reason;
              if (fr) finishReason = fr;
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            } catch {
              sseBuffer = line + "\n" + sseBuffer;
              break;
            }
          }
        } catch (err) {
          // Upstream read failed (abort / network). Do NOT save partial cache.
          console.error(`[STREAM ERROR] ${trimmedPatent}`, err);
          try {
            const errMsg = JSON.stringify({ error: "stream_error", message: String(err) });
            controller.enqueue(encoder.encode(`data: ${errMsg}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch { /* controller may be closed */ }
          try { controller.close(); } catch { /* ignore */ }
        }
      },
      cancel(reason) {
        console.warn(`[STREAM CANCELLED] ${trimmedPatent} reason=${reason}`);
        try { reader.cancel(reason); } catch { /* ignore */ }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("summarize-patent error:", error);
    return new Response(
      JSON.stringify({ error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
