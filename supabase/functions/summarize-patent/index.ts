import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Try personal Gemini API first (if GEMINI_API_KEY set), fall back to Lovable AI Gateway.
// Both endpoints are OpenAI-compatible.
async function callAIChatCompletions(
  payload: Record<string, unknown> & { model: string },
  init: { signal?: AbortSignal } = {},
): Promise<Response> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (GEMINI_API_KEY) {
    try {
      const geminiModel = payload.model.replace(/^google\//, "");
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
          method: "POST",
          signal: init.signal,
          headers: {
            Authorization: `Bearer ${GEMINI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...payload, model: geminiModel }),
        },
      );
      if (r.ok) {
        console.log("[AI] using personal Gemini API");
        return r;
      }
      const errText = await r.text().catch(() => "");
      console.warn(`[AI] personal Gemini failed ${r.status}: ${errText.slice(0, 200)} — falling back to Lovable AI`);
    } catch (e) {
      console.warn("[AI] personal Gemini error, falling back:", e);
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
    let maxTokens = 6000;
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
            if (!isNaN(parsed) && parsed >= 500 && parsed <= 16000) maxTokens = parsed;
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
    const promptVersion = "v6-flow-quality";
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
- 볼드는 의미 있는 완전한 단어/구에만 적용. 조사·어미·접속사는 절대 볼드 안에 포함하지 않음
- 올바른 예: **바이오매스**를, **발효당**으로, 약 **1,700억 달러** 규모, **CAGR**은 15%
- 잘못된 예: **바이오매스를**, **발효당으로**, **약 1,700억 달러 규모에서**, **CAGR은**
- 볼드 범위: 핵심 기술 용어, 고유명사, 수치(단위 포함 가능), 핵심 키워드만 볼드 처리
- 한 문장당 1~2개만 볼드 처리. 과도한 볼드 금지. 문장 전체 볼드 금지
- 조사(을/를/이/가/은/는/의/에/로/으로/와/과 등)는 반드시 볼드 바깥에 위치

섹션별 작성 지침(분량은 위 균일화 규칙을 최우선으로 준수):
## 기술분야 - IPC 해석, 산업 분야, 응용 영역, 기술적 맥락의 핵심만 압축 서술
## 발명요약 및 특징 - 배경기술 한계→기술과제→핵심 해결수단→작동원리→차별적 효과의 흐름과 핵심 구성요소의 역할·차별점을 하나의 흐름으로 압축 서술(불필요한 부연 금지)
## 관련시장 동향 - 반드시 2024년 이후 최신 시장 데이터를 활용. 국내외 시장 규모/성장률(KRW 단위, 2024~2025년 기준), CAGR, 경쟁기술 현황, 정책/규제 동향을 핵심 수치 중심으로 간결히 서술. 2023년 이전 데이터만 있을 경우 CAGR 기반 추정치를 제시.
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
## 상용화전망 - 기술 완성도, 상용화 경로(시장 진입 전략, 사업화 단계), 예상 수요처 및 비즈니스 모델을 핵심만 정성적으로 설명. TRL 숫자 직접 언급 금지.

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
      response = await callAIChatCompletions(
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
              } catch { /* ignore */ }
            }
          }
          controller.close();
          if (fullContent.length > 0) {
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
