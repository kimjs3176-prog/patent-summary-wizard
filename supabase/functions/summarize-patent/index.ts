import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patentNumber } = await req.json();

    if (!patentNumber) {
      return new Response(
        JSON.stringify({ error: "특허 등록번호를 입력해주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `당신은 한국 특허 문서를 분석하고 요약하는 전문가입니다. 
사용자가 제공하는 특허 등록번호에 대해 1페이지 분량의 종합적인 요약서를 작성해주세요.

요약서는 다음 형식을 따라주세요:

## 특허 기본 정보
- 등록번호: [번호]
- 발명의 명칭: [명칭]
- 출원인/권리자: [정보]
- 출원일/등록일: [날짜]

## 기술 분야
[해당 특허가 속하는 기술 분야 설명]

## 발명의 요약
[발명의 핵심 내용을 2-3문장으로 요약]

## 주요 청구항
[대표 청구항의 핵심 내용]

## 기술적 특징
1. [특징 1]
2. [특징 2]
3. [특징 3]

## 산업적 활용 가능성
[해당 기술의 실제 적용 분야 및 가치]

## 유사 기술 대비 차별점
[기존 기술과의 차이점]

참고: 실제 특허 데이터베이스 접근이 제한되어 있으므로, 등록번호 형식을 기반으로 일반적인 한국 특허 문서의 구조에 맞춰 예시 요약서를 생성합니다. 실제 서비스에서는 KIPRIS API 등을 통해 정확한 특허 정보를 조회해야 합니다.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `한국 특허 등록번호 ${patentNumber}에 대한 1페이지 요약서를 작성해주세요.` },
        ],
        stream: true,
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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("summarize-patent error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "알 수 없는 오류" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
