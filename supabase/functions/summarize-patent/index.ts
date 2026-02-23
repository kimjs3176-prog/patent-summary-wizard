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
    const { patentNumber, patentData, analysisMode = "summary" } = body;

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

    if (analysisMode && !["summary", "detailed"].includes(analysisMode)) {
      return new Response(
        JSON.stringify({ error: "잘못된 분석 모드입니다." }),
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
        .eq("analysis_mode", analysisMode)
        .maybeSingle();

      if (cached?.summary_content) {
        console.log(`[CACHE HIT] ${trimmedPatent} / ${analysisMode}`);
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

    // Build compact patent context - minimize token usage
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
        // Truncate abstract to 500 chars max
        patentContext += `\n\n초록:\n${data.abstract.substring(0, 500)}`;
      }
      if (data.claims?.length) {
        // Only first 2 claims, truncated
        patentContext += `\n\n청구항:\n${data.claims.slice(0, 2).map((c, i) => `${i + 1}. ${c.substring(0, 200)}`).join("\n")}`;
      }
      // Skip description entirely to save tokens
    }

    const isDetailed = analysisMode === "detailed";

    const systemPrompt = `한국 특허 기술 분석 전문가. 제공된 특허 데이터로 요약서 작성.
규칙: 헤더/작성일 금지, "특허 기본 정보" 금지, 말머리표/번호 금지, 핵심어 **볼드**, 섹션은 ## 사용.
정보 없으면 "정보 없음" 표기. Abstract 복사 금지, 분석적 재구성.

섹션:
## 기술 분야 - IPC 해석, 산업 분야/응용 영역
## 발명의 요약 - 배경→한계→과제→해결법→원리→효과 순
## 기술적 특징 - 핵심 구성요소 역할/원리/차별점
## 시장동향 - 시장 동향/성장 추세, 경쟁 기술, 정책/규제
## 농산업 활용 특장점 - 구체적 활용 시나리오, 스마트팜/정밀농업 등
## 기술 성숙도 및 상용화 전망 - TRL 숫자 언급 금지, 정성적 설명

${isDetailed ? "각 섹션 4~6문장 상세 서술." : "각 섹션 2~3문장 압축 (기술적 특징만 3~4문장)."}`;

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
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: true,
        max_tokens: isDetailed ? 1500 : 900,
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
                analysis_mode: analysisMode,
                summary_content: fullContent,
              }, { onConflict: "patent_number,analysis_mode" });
              console.log(`[CACHE SAVED] ${trimmedPatent} / ${analysisMode}`);
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
