import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Check cache first
    try {
      const supabase = getSupabaseClient();
      const { data: cached } = await supabase
        .from("patent_ai_cache")
        .select("summary_content")
        .eq("patent_number", trimmedPatent)
        .eq("analysis_mode", "detailed")
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

    // Read custom prompt additions from site_settings
    let customPromptExtra = "";
    try {
      const supabase = getSupabaseClient();
      const { data: promptSetting } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "summary_ai_prompt_extra")
        .maybeSingle();
      if (promptSetting?.value) {
        customPromptExtra = promptSetting.value;
      }
    } catch (e) {
      console.error("Failed to read custom prompt setting:", e);
    }

    const systemPrompt = `한국 특허 기술 분석 전문가. 제공된 특허 데이터로 상세 요약서 작성.
규칙: 헤더/작성일 금지, "특허 기본 정보" 금지, 말머리표/번호 금지, 섹션은 ## 사용.
정보 없으면 "정보 없음" 표기. Abstract 복사 금지, 분석적 재구성 필수.

**볼드 처리 규칙 (매우 중요!):**
- 각 섹션에서 핵심 기술 용어, 고유명사, 수치 데이터, 핵심 키워드를 반드시 **볼드**로 표기
- 예시: **스마트팜**, **연평균 성장률 12.5%**, **딥러닝 기반 영상 분석**, **정밀농업**
- 한 문장 내에 1~3개의 핵심어를 볼드 처리하되, 과도한 볼드는 지양
- 문장 전체를 볼드하지 말 것. 핵심 단어/구만 볼드 처리

섹션별 상세 지침:
## 기술 분야 - IPC 해석, 산업 분야, 응용 영역, 기술적 맥락을 구체적으로 서술
## 발명의 요약 - 배경기술 한계→기술과제→핵심 해결수단→작동원리→차별적 효과를 논리적으로 연결하여 상세 서술
## 기술적 특징 - 핵심 구성요소별 역할, 작동원리, 기존 기술 대비 차별점을 구체적으로 분석
## 시장동향 - 반드시 2024년 이후 최신 시장 데이터를 활용하여 서술. 국내외 시장 규모/성장률(KRW 단위, 2024~2025년 기준), CAGR, 경쟁기술 현황, 정책/규제 동향. 시장규모 추정시 출처와 연도를 반드시 명시하고 2023년 이전 데이터만 있을 경우 CAGR 기반으로 2024~2025년 추정치를 산출하여 제시
## 농산업 활용 특장점 - 스마트팜/정밀농업 등 구체적 활용 시나리오와 기대 효과 서술
## 기술 성숙도 및 상용화 전망 - TRL 숫자 언급 금지, 기술 완성도와 상용화 경로를 정성적으로 설명

각 섹션 5~7문장 상세 서술. 기술적 깊이와 실용적 인사이트를 균형있게 포함.${customPromptExtra ? `\n\n추가 지시사항:\n${customPromptExtra}` : ""}`;

    const userMessage = patentData
      ? `분석:\n${patentContext}`
      : `특허 ${patentNumber} 요약서 작성.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: true,
        max_tokens: 3000,
      }),
    });

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
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullContent = "";

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          if (fullContent.length > 0) {
            try {
              const supabase = getSupabaseClient();
              await supabase.from("patent_ai_cache").upsert({
                patent_number: trimmedPatent,
                analysis_mode: "detailed",
                summary_content: fullContent,
              }, { onConflict: "patent_number,analysis_mode" });
              console.log(`[CACHE SAVED] ${trimmedPatent}`);
            } catch (saveErr) {
              console.error("Cache save error:", saveErr);
            }
          }
          return;
        }

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && line.slice(6).trim() !== "[DONE]") {
            try {
              const parsed = JSON.parse(line.slice(6));
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullContent += content;
            } catch { /* ignore */ }
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
