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
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
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
          body: JSON.stringify({ ...payload, model: geminiModel, stream: false }),
        },
      );
      if (r.ok) {
        const data = await r.json();
        const content = data.choices?.[0]?.message?.content ?? "";
        const finishReason = data.choices?.[0]?.finish_reason ?? "stop";
        if (content) {
          console.log("[AI] using personal Gemini API (non-streaming summary)");
          t.cancel();
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              for (let i = 0; i < content.length; i += 80) {
                const chunk = content.slice(i, i + 80);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`));
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ finish_reason: finishReason }] })}\n\n`));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            },
          });
          return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
        }
        console.warn("[AI] personal Gemini returned empty summary — falling back to Lovable AI");
      } else {
        const errText = await r.text().catch(() => "");
        if (r.status >= 500 || r.status === 429) markCooldown("gemini");
        console.warn(`[AI] personal Gemini failed ${r.status}: ${errText.slice(0, 200)} — falling back to Lovable AI`);
      }
    } catch (e) {
      markCooldown("gemini");
      console.warn("[AI] personal Gemini summary error, falling back:", e);
    } finally {
      t.cancel();
    }
  }
  return await callAIChatCompletions(payload, init);
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
    const { patentNumber, patentData } = body;

    if (!patentNumber || typeof patentNumber !== "string") {
      return new Response(
        JSON.stringify({ error: "특허 등록번호를 입력해주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedPatent = patentNumber.trim();
    if (trimmedPatent.length > 50 || !/^[0-9-]+$/.test(trimmedPatent)) {
      return new Response(
        JSON.stringify({ error: "유효하지 않은 특허 번호 형식입니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read custom prompt additions, total max tokens, model, and per-section length settings.
    let customPromptExtra = "";
    let maxTokens = 12000;
    let aiModel = "google/gemini-2.5-flash";
    let sectionLengthSettings: Record<string, number> = {};
    try {
      const supabase = getSupabaseClient();
      const { data: settings } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["summary_ai_prompt_extra", "summary_max_tokens", "ai_model", "summary_section_lengths"]);
      if (settings) {
        for (const row of settings) {
          if (row.key === "summary_ai_prompt_extra" && row.value) customPromptExtra = row.value;
          if (row.key === "summary_max_tokens" && row.value) {
            const parsed = parseInt(row.value, 10);
            if (!isNaN(parsed) && parsed >= 500 && parsed <= 16000) maxTokens = Math.max(parsed, 8000);
          }
          if (row.key === "ai_model" && row.value) aiModel = row.value;
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
    const promptVersion = "v7-completeness";
    const settingsSignature = JSON.stringify({ customPromptExtra, maxTokens, aiModel, sectionLengthSettings, promptVersion });
    let signatureHash = 0;
    for (let i = 0; i < settingsSignature.length; i++) signatureHash = ((signatureHash << 5) - signatureHash + settingsSignature.charCodeAt(i)) | 0;
    const summaryAnalysisMode = `detailed_${Math.abs(signatureHash).toString(36)}`;

    // Check cache first, scoped to settings that affect generated content.
    try {
      const supabase = getSupabaseClient();
      const { data: cached } = await supabase
        .from("patent_ai_cache")
        .select("summary_content")
        .eq("patent_number", trimmedPatent)
        .eq("analysis_mode", summaryAnalysisMode)
        .maybeSingle();

      if (cached?.summary_content) {
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
      parts.push(`번호: ${data.patentNumber || patentNumber}`);
      if (data.title) parts.push(`명칭: ${data.title}`);
      if (data.assignee) parts.push(`출원인: ${data.assignee}`);
      if (data.filingDate) parts.push(`출원일: ${data.filingDate}`);
      if (data.classifications?.length) parts.push(`IPC: ${data.classifications.slice(0, 3).join(", ")}`);
      patentContext = parts.join("\n");

      if (data.abstract) {
        patentContext += `\n\n초록:\n${data.abstract.substring(0, 750)}`;
      }
      if (data.claims?.length) {
        patentContext += `\n\n청구항:\n${data.claims.slice(0, 3).map((c, i) => `${i + 1}. ${c.substring(0, 300)}`).join("\n")}`;
      }
      if (data.description) {
        patentContext += `\n\n설명(일부):\n${data.description.substring(0, 500)}`;
      }
    }

    // 섹션 균일화 정책: 가장 분량이 적은 섹션을 기준으로 모든 섹션을 ±1문장 이내로 맞춤
    const sectionKeys = ["기술분야", "발명요약 및 특징", "관련시장 동향", "농산업활용 가능성", "상용화전망"];
    const baseTarget = maxTokens <= 2000 ? 3 : maxTokens >= 4000 ? 6 : 5;
    const minSentences = baseTarget;
    const maxSentences = baseTarget + 1;

    // 사용자 정의 섹션 길이가 있으면 가장 작은 값을 기준으로 통일
    let uniformMin = minSentences;
    let uniformMax = maxSentences;
    if (Object.keys(sectionLengthSettings).length) {
      const values = Object.values(sectionLengthSettings).filter((n) => Number.isFinite(n) && n > 0);
      if (values.length) {
        const smallest = Math.max(2, Math.min(...values));
        uniformMin = smallest;
        uniformMax = smallest + 1;
      }
    }

    const lengthInstruction = `\n\n[섹션 균일화 규칙 — 최우선 준수]\n- 모든 ## 섹션은 정확히 ${uniformMin}~${uniformMax}문장으로 작성한다.\n- 가장 분량이 적은 섹션의 길이에 다른 섹션을 맞추며, 어떤 섹션도 다른 섹션보다 1문장 이상 길어서는 안 된다.\n- 특정 섹션에 정보가 많아도 핵심만 압축해서 동일한 분량 범위 내에서 서술한다.\n- 섹션별 글자 수 편차가 30% 이내가 되도록 길이를 조절한다.\n- "관련시장 동향"의 출처 목록(### 출처)은 문장 수 계산에서 제외한다.`;
    const sectionLengthInstruction = "";

    const systemPrompt = `한국 특허 기술 분석 전문가. 제공된 특허 데이터로 상세 요약서 작성.
규칙: 헤더/작성일 금지, "특허 기본 정보" 금지, 말머리표/번호 금지, 섹션은 ## 사용.
정보 없으면 "정보 없음" 표기. Abstract 복사 금지, 분석적 재구성 필수.

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
- 문장 종결을 단조롭게 반복하지 말고 다음과 같이 변주한다: ~한다 / ~된다 / ~다 / ~이다 / ~할 수 있다 / ~로 평가된다 / ~로 작용한다 / ~다는 점이 특징이다.
- 한 문단(섹션) 안에서 동일 종결어미를 3회 이상 연속 사용 금지.
- 군더더기 표현(~에 속합니다, ~인 것입니다, ~라 할 수 있습니다, ~할 것입니다 등)은 가급적 짧고 단정적인 표현으로 대체한다.
- 같은 명사·핵심어를 한 문단에서 3회 이상 그대로 반복하지 말고, 대명사·축약어·동의어로 자연스럽게 변주한다.
- 수동태 남용을 피하고 능동·서술형 위주로 작성한다.
- 모든 문장이 명확한 주술 관계를 가져야 하며, 비문·중복 수식·모호한 지시어("이것", "그것" 단독 사용)는 사용하지 않는다.
- 문어체 보고서 톤을 유지하되, 딱딱하지 않게 자연스럽게 읽히도록 다듬는다.

**볼드 처리 규칙 (매우 중요! 반드시 준수!):**
- 볼드는 "문장의 의미 흐름상 독자가 반드시 주목해야 하는 핵심 정보"에만 선택적으로 적용한다. 단순 장식·나열식 볼드 금지.
- **[밀도]** 한 문장당 0~2곳, 한 문단당 3~6곳 수준이 적정. 모든 명사를 기계적으로 볼드 처리하지 말 것. 정보가 없는 문장은 볼드 0개도 허용한다.
- 볼드 대상(아래에 해당하고, 동시에 문맥상 강조 가치가 있을 때만):
  ① **구체적 수치·지표**: 수율, 농도, CAGR, 시장규모, 효율 향상 배수 등(단위·기호 포함 가능, 예: **1,700억 달러**, **15%**, **2.5배**)
  ② **고유 명칭**: 고유 화합물명·펩타이드명·균주명·품종명·학명 대응 한글명, 신규 물질명, 서열번호(예: **프로테티아마이신 2**, **서열번호 1**, **그람 양성균**)
  ③ **기술의 차별적 핵심 효능·기능**: 해당 특허만의 차별점이 드러나는 효능 키워드(예: **항균 활성**, **생체이용률 향상**, **저독성**) — 일반 산업에서 흔한 단어는 제외
  ④ **핵심 적용 분야**: 특허의 1차 응용처(예: **천연 농약**, **사료 첨가제**, **장염 치료제**) — 문장에서 "어디에 쓰이는가"가 핵심일 때만
  ⑤ **결정적 차별점·정량 비교 키워드**: **세계 최초**, **기존 대비 2.5배**, **저비용 양산** 등 비교/우위 근거가 명확한 표현
- **[금지 - 절대 볼드하지 말 것]**
  · 접속사·연결어: 또한, 따라서, 그러나, 한편, 특히, 아울러, 나아가, 반면, 즉, 이를 통해, 결과적으로 등
  · 조사·어미: 을/를/이/가/은/는/의/에/로/으로/와/과/도/만, ~한다/~된다/~이다/~있다/~수 있다 등
  · 의미 없는 일반 명사(단독): 기술, 발명, 방법, 방식, 장치, 시스템, 제품, 구조, 공정, 과정, 단계, 분야, 산업, 영역, 내용, 사항, 부분, 측면, 경우, 특징, 효과, 결과, 수단, 원리, 기능, 성능, 용도, 본 기술, 해당 기술, 본 발명 등
  · 지시어·관형사: 이, 그, 본, 해당, 동, 당해, 이러한, 그러한, 다양한, 여러
  · **IPC 분류 코드(예: C07K 7/08, A61K 38/10)** — 본문에 표기는 하되 볼드 처리 금지
  · 흔한 일반 단어 단독: 시장, 수요, 공급, 가격, 비용, 사용, 활용, 적용, 개발, 연구, 도입 등(단, 구체 수식어와 결합되어 차별성이 드러나는 경우는 허용: 예 **친환경 농약**, **저비용 양산 공정**)
- 볼드 구절 길이: 1~5 어절(약 2~20자) 범위 내 자연스러운 명사구 단위. 절·문장 단위 볼드 절대 금지.
- 같은 단어를 한 섹션 내에서 2회 이상 반복 볼드 처리하지 말 것(첫 등장 시 1회만 강조).

**학명 표기 규칙 (매우 중요! 반드시 준수!):**
- 생물의 학명(라틴어 속명·종명)은 본문에서 반드시 마크다운 이탤릭(*..*) 으로 표기한다.
- 속명은 첫 글자만 대문자, 종소명은 모두 소문자로 작성한다. 예: *Lactobacillus plantarum*, *Oryza sativa*, *Bacillus subtilis*, *Saccharomyces cerevisiae*.
- 속명만 단독 표기 시에도 이탤릭 유지. 예: *Lactobacillus* 속.
- 약식 표기(L. plantarum 등)도 이탤릭 유지. 예: *L. plantarum*.
- 한글 통칭(유산균, 벼, 고초균 등)이나 균주 번호(KCTC 1234), 영문 일반명(rice, soybean)에는 이탤릭을 적용하지 않는다.
- 학명 뒤의 조사·구두점·괄호는 이탤릭 바깥에 위치시킨다. 올바른 예: *Lactobacillus plantarum*은 / *Oryza sativa*(벼). 잘못된 예: *Lactobacillus plantarum은* / *Oryza sativa(벼)*.
- 볼드와 동시에 적용해야 할 경우 ***학명*** 형식(별표 3개)으로 작성한다.

섹션별 작성 지침(분량은 위 균일화 규칙을 최우선으로 준수):
## 기술분야 - IPC 해석, 산업 분야, 응용 영역, 기술적 맥락의 핵심만 압축 서술
## 발명요약 및 특징 - 배경기술 한계→기술과제→핵심 해결수단→작동원리→차별적 효과의 흐름과 핵심 구성요소의 역할·차별점을 하나의 흐름으로 압축 서술(불필요한 부연 금지)
## 관련시장 동향 - **현재 시점(2026년) 기준 시장 데이터로 환산하여 제시하는 것을 최우선으로 한다.** 국내외 시장 규모/성장률(KRW 단위), CAGR, 경쟁기술 현황, 정책/규제 동향을 핵심 수치 중심으로 간결히 서술.
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
## 농산업활용 가능성 - 본 특허의 핵심 기술 원리·구성요소에서 직접 도출 가능한 농산업 활용 시나리오만, 다음 3요소를 각 1~2문장으로 균등하게 서술(전체 분량은 균일화 규칙 준수):
  (1) **직접 적용 분야**: 특허 청구항·기술분야와 직결되는 1차 적용처를 구체적으로 명시
  (2) **현장 활용 시나리오**: 누가/어디서/어떤 문제를 어떻게 해결하는지 핵심만 제시
  (3) **기대 효과**: 수율·품질·인건비·에너지·로스율 등 정량적 지표 중심
  **[금지] 특허의 기술 원리와 무관한 분야로의 비약 금지**(예: 토양 센서 특허를 의료/우주 분야에 활용 제안 금지). 청구항에 명시된 적용대상이 좁은 경우, 인접 작물·인접 공정 정도까지만 확장 허용. 확장 시 "기술원리가 동일하게 적용 가능한 인접 분야"임을 명시할 것.
## 상용화전망 - 다음 4요소를 빠짐없이 구체적으로 서술하되 균일화 규칙을 준수:
  (1) **기술 완성도 수준**: 현재 개발 단계(실험실/파일럿/실증/양산 준비 등)를 정성적으로 표현하고, 상용화까지 남은 핵심 과제(예: 스케일업, 인허가, 단가절감, 안정성 검증)를 1가지 이상 구체적으로 명시
  (2) **상용화 경로·일정 감각**: 단기(1~2년)·중기(3~5년) 관점에서 시장 진입 전략과 사업화 단계(라이선싱·기술이전·자체 양산·합작 등)를 구체적으로 제시
  (3) **예상 수요처·비즈니스 모델**: 1차 수요처(기업·기관 유형)와 수익모델(B2B 공급, 로열티, OEM, 구독형 서비스 등)을 명확히 지목
  (4) **종합 평가(총평)**: 마지막 1~2문장은 반드시 "본 기술은 ~한 강점과 ~한 한계를 동시에 가지며, ~ 조건이 충족될 경우 ~ 영역에서 우선 상용화가 유망하다" 형태로 **강점·한계·핵심 성공조건·유망 적용영역**을 모두 포함하는 구체적 종합 평가로 마무리한다. "유망하다", "기대된다" 등 막연한 표현 단독 사용 금지.
  [금지] TRL 숫자 직접 언급 금지. "향후 발전 가능성이 크다", "다양한 분야에 활용될 수 있다" 같은 추상적·일반론적 문장으로 마무리 금지.

**[전체 완성도 규칙 - 필수 준수]**
- 모든 섹션은 "정보 없음"·공란·일반론적 한 줄 마무리를 금지한다. 제공된 특허 데이터가 부족하면 IPC·청구항·초록의 단서를 근거로 합리적 추론을 하되, 추론임을 한 단어("추정", "예상")로 명시한다.
- 각 섹션에는 최소 1개 이상의 **구체적 수치·고유명사·기관명·작물명·균주명·공정명** 중 어느 하나가 포함되어야 한다. 모호한 일반 명사("다양한 산업", "여러 분야", "많은 효과")만으로 채우지 않는다.
- "관련시장 동향"의 출처 각주는 최소 2개 이상이어야 하며, 가급적 국내 1차 출처(KISTEP/KREI/통계청/농식품부) 1개 + 글로벌 2차 출처 1개를 함께 인용한다.
- 모든 수치(시장규모·CAGR·점유율·수율·단가·효율 등)는 단위와 기준연도를 명확히 표기한다. 단순한 "약 ~배 향상"이 아니라 "기존 대비 약 ~배(예: 2.5배) 향상" 형태로 비교 기준을 구체화한다.

**[문장 흐름 보강 규칙]**
- 각 섹션의 첫 문장은 해당 섹션의 핵심 메시지 1줄 요약(도입 문장) 역할을 하고, 이어지는 문장이 그 메시지를 "총괄 → 세부 → 근거 → 함의" 순서로 점차 구체화한다.
- 섹션 내 문장 사이는 반드시 연결어구로 이어지며, 단문 나열·주제 단절을 금지한다. 인접 문장의 핵심어를 받아 다음 문장으로 이어가는 "주제 사슬(topic chain)" 구조를 유지한다.

[중요] 위 5개 섹션(기술분야 / 발명요약 및 특징 / 관련시장 동향 / 농산업활용 가능성 / 상용화전망)만 사용. 다른 ## 섹션을 추가로 만들지 말 것. "기술적 특징"을 별도 섹션으로 분리하지 말 것.

기술적 깊이와 실용적 인사이트를 균형있게 포함.${lengthInstruction}${sectionLengthInstruction}${customPromptExtra ? `\n\n추가 지시사항:\n${customPromptExtra}` : ""}`;

    const userMessage = patentData
      ? `분석:\n${patentContext}`
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

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          // Process any remaining buffered data
          if (sseBuffer.trim()) {
            const remaining = sseBuffer.trim();
            if (remaining.startsWith("data: ") && remaining.slice(6).trim() !== "[DONE]") {
              try {
                const parsed = JSON.parse(remaining.slice(6));
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) fullContent += content;
                const fr = parsed.choices?.[0]?.finish_reason;
                if (fr) finishReason = fr;
              } catch { /* ignore */ }
            }
          }
          controller.close();
          if (fullContent.length > 0) {
            if (finishReason && finishReason !== "stop") {
              console.warn(`[TRUNCATED] ${trimmedPatent} finish_reason=${finishReason} chars=${fullContent.length} maxTokens=${maxTokens} — skipping cache save so it regenerates next time`);
            } else {
            try {
              const supabase = getSupabaseClient();
              await supabase.from("patent_ai_cache").upsert({
                patent_number: trimmedPatent,
                analysis_mode: summaryAnalysisMode,
                summary_content: fullContent,
              }, { onConflict: "patent_number,analysis_mode" });
              console.log(`[CACHE SAVED] ${trimmedPatent} (${fullContent.length} chars)`);
            } catch (saveErr) {
              console.error("Cache save error:", saveErr);
            }
            }
          }
          return;
        }

        const text = decoder.decode(value, { stream: true });
        sseBuffer += text;

        // Process complete lines only (split by double newline for SSE)
        let newlineIndex: number;
        while ((newlineIndex = sseBuffer.indexOf("\n")) !== -1) {
          const line = sseBuffer.slice(0, newlineIndex).replace(/\r$/, "");
          sseBuffer = sseBuffer.slice(newlineIndex + 1);

          if (line.startsWith("data: ") && line.slice(6).trim() !== "[DONE]") {
            try {
              const parsed = JSON.parse(line.slice(6));
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullContent += content;
              const fr = parsed.choices?.[0]?.finish_reason;
              if (fr) finishReason = fr;
            } catch {
              // Incomplete JSON - put it back and wait for more data
              sseBuffer = line + "\n" + sseBuffer;
              break;
            }
          }
        }

        controller.enqueue(value);
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
