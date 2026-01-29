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

[정확성 최우선 원칙]
반드시 제공된 Abstract(초록)과 Description(상세 설명)의 내용을 그대로 반영하세요.
제공된 데이터에 없는 내용은 절대 추측하거나 창작하지 마세요.
정보가 부족한 항목은 "정보 없음" 또는 "제공된 데이터에서 확인 불가"로 명시하세요.
기술적 특징과 발명의 요약은 반드시 Abstract와 청구항 원문에서 직접 추출하세요.

[서식 규칙]
중요: 별도의 제목, 작성일, 분석 전문가 등의 헤더는 절대 포함하지 마세요.
중요: "특허 기본 정보" 섹션은 절대 포함하지 마세요. (등록번호, 발명의 명칭, 출원인, 발명자 등의 정보는 요약서 본문에 포함하지 않습니다.)
말머리표(-, •), 숫자 번호(1. 2. 3.), 별표(**)를 절대 사용하지 마세요.
각 항목은 들여쓰기 없이 일반 문장 형태로 작성하세요.
섹션 제목만 ## 를 사용하고 나머지는 일반 텍스트로 작성하세요.

요약서는 다음 형식을 따라주세요 (특허 기본 정보 섹션 없이 바로 시작):

## 기술 분야
제공된 classifications 코드(${patentData?.classifications?.join(", ") || "정보 없음"})를 해석하여 해당 기술 분야를 설명합니다. 추측하지 마세요.

## 발명의 요약
제공된 Abstract 원문을 바탕으로 핵심 내용을 2~3문장으로 재구성합니다. 원문에 없는 내용은 추가하지 마세요.

## 주요 청구항 분석
제공된 claims 원문을 바탕으로 핵심 내용과 보호 범위를 설명합니다. 원문에 없는 내용은 추가하지 마세요.

## 기술적 특징
제공된 Abstract, claims, description에서 직접 추출한 특징을 문장 형태로 나열합니다. 각 특징은 새 줄에 작성하되 번호나 말머리표 없이 작성합니다.

## 산업적 활용 가능성
제공된 데이터에서 언급된 적용 분야만 기술합니다. 추측을 최소화하세요.

## 유사 기술 대비 차별점
제공된 데이터에서 언급된 기존 기술 대비 차이점만 기술합니다. 정보가 없으면 "제공된 데이터에서 확인 불가"로 표시합니다.

## 농산업 기술사업화 특장점
이 특허 기술을 농업 및 농산업 분야에 적용할 경우의 특장점을 분석합니다.
스마트팜, 정밀농업, 농기계 자동화, 농산물 유통/저장, 농업용 센서/IoT, 친환경 농법, 작물 생육 관리 등 농산업 관련 적용 가능성을 구체적으로 제안합니다.
해당 기술이 농산업에 직접 관련이 없는 경우에도 간접적인 활용 방안이나 융합 가능성을 제시합니다.

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
