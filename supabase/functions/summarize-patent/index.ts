import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patentNumber, patentData } = await req.json();

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

    // Build context from patent data
    let patentContext = "";
    if (patentData) {
      const data = patentData as PatentData;
      patentContext = `
실제 특허 데이터:
- 등록번호/공개번호: ${data.patentNumber || patentNumber}
- 발명의 명칭: ${data.title || "정보 없음"}
- 출원번호: ${data.applicationNumber || "정보 없음"}
- 출원인/권리자: ${data.assignee || "정보 없음"}
- 발명자: ${data.inventors?.join(", ") || "정보 없음"}
- 출원일: ${data.filingDate || "정보 없음"}
- 공개일/등록일: ${data.publicationDate || "정보 없음"}
- 기술 분류: ${data.classifications?.join(", ") || "정보 없음"}

초록:
${data.abstract || "정보 없음"}

${data.claims && data.claims.length > 0 ? `주요 청구항:\n${data.claims.slice(0, 5).map((c, i) => `${i + 1}. ${c}`).join("\n")}` : ""}

${data.description ? `상세 설명 (일부):\n${data.description.substring(0, 2000)}...` : ""}
`;
    }

    const systemPrompt = `당신은 한국 특허 문서를 분석하고 요약하는 전문가입니다.
${patentData ? "아래 제공된 실제 특허 데이터를 기반으로" : "특허 등록번호를 기반으로"} 1페이지 분량의 종합적인 요약서를 작성해주세요.

요약서는 다음 형식을 따라주세요:

## 특허 기본 정보
- 등록번호: [번호]
- 발명의 명칭: [명칭]
- 출원인/권리자: [정보]
- 출원일/등록일: [날짜]
- 발명자: [이름]

## 기술 분야
[해당 특허가 속하는 기술 분야 설명 - IPC/CPC 분류 코드 해석 포함]

## 발명의 요약
[발명의 핵심 내용을 2-3문장으로 요약]

## 주요 청구항 분석
[대표 청구항의 핵심 내용과 보호 범위]

## 기술적 특징
1. [특징 1]
2. [특징 2]
3. [특징 3]

## 산업적 활용 가능성
[해당 기술의 실제 적용 분야 및 상업적 가치]

## 유사 기술 대비 차별점
[기존 기술과의 차이점 및 혁신성]

${patentData ? "" : "참고: 특허 데이터베이스에서 정보를 가져오지 못했습니다. 일반적인 형식으로 예시 요약서를 생성합니다."}`;

    const userMessage = patentData 
      ? `다음 특허 데이터를 분석하여 1페이지 요약서를 작성해주세요:\n${patentContext}`
      : `한국 특허 등록번호 ${patentNumber}에 대한 1페이지 요약서를 작성해주세요.`;

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
          { role: "user", content: userMessage },
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
