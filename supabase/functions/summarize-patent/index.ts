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
    // Basic input validation
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({ error: "잘못된 요청입니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { patentNumber, patentData } = body;

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

    const systemPrompt = `당신은 한국 특허 문서를 심층 분석하고 전문적으로 요약하는 기술 전문가입니다.
${patentData ? "아래 제공된 실제 특허 데이터를 기반으로" : "특허 등록번호를 기반으로"} 1페이지 분량의 종합적인 요약서를 작성해주세요.

[핵심 분석 원칙]
1. 단순 복사 금지: Abstract나 Description의 문장을 그대로 가져오지 마세요. 반드시 내용을 이해하고 재구성하세요.
2. 기술적 통찰 제공: 특허의 핵심 기술 원리와 작동 메커니즘을 분석하여 설명하세요.
3. 차별점 도출: 기존 기술 대비 이 특허만의 고유한 기술적 장점을 분석하세요.
4. 정보 부재 시: 제공된 데이터에 없는 내용은 "정보 없음"으로 명시하세요.

[서식 규칙]
중요: 별도의 제목, 작성일, 분석 전문가 등의 헤더는 절대 포함하지 마세요.
중요: "특허 기본 정보" 섹션은 절대 포함하지 마세요.
말머리표(-, •), 숫자 번호(1. 2. 3.)를 절대 사용하지 마세요.
중요한 핵심 용어나 기술명, 핵심 문구는 **볼드**로 강조하세요.
각 항목은 들여쓰기 없이 일반 문장 형태로 작성하세요.
섹션 제목만 ## 를 사용하고 나머지는 일반 텍스트로 작성하세요.

요약서는 다음 형식을 따라주세요:

## 기술 분야
제공된 IPC/CPC 분류 코드(${patentData?.classifications?.join(", ") || "정보 없음"})를 해석하여 해당 기술이 속한 산업 분야와 응용 영역을 구체적으로 설명합니다.

## 발명의 요약
[분석적 요약 작성 지침]
제공된 Abstract를 단순 복사하지 말고, 다음 관점에서 재분석하여 작성하세요:
가. 이 발명이 해결하고자 하는 핵심 기술 과제는 무엇인가?
나. 그 과제를 해결하기 위해 어떤 기술적 접근법을 사용했는가?
다. 이 접근법의 핵심 원리는 무엇인가?
위 분석을 바탕으로 3~4문장의 통합적 요약문을 작성하세요.

## 기술적 특징
[심층 기술 분석 지침]
Abstract, claims, description에서 추출한 정보를 바탕으로 다음을 분석하세요:
가. 핵심 구성요소: 발명을 구성하는 주요 기술 요소들의 역할과 상호작용
나. 작동 메커니즘: 각 구성요소가 어떻게 협력하여 목표를 달성하는지
다. 기술적 차별점: 종래 기술 대비 이 발명만의 고유한 기술적 우위
각 특징을 별도 문단으로 작성하되, 기술적 인과관계를 명확히 설명하세요.

## 산업적 활용 가능성
제공된 데이터에서 언급된 적용 분야를 기반으로, 실제 산업 현장에서의 활용 시나리오를 구체적으로 제시합니다.

## 기술 성숙도 및 상용화 전망
[상용화 전망 분석 지침]
중요: 구체적인 TRL 숫자(예: "TRL 4", "TRL 6")는 절대 언급하지 마세요. TRL 수치는 별도의 분석 모듈에서 제공됩니다.
대신 다음 내용을 서술형으로 작성하세요:
가. 현재 기술 개발 단계에 대한 정성적 설명 (예: "실험실 수준의 검증이 완료된 단계", "시제품 수준까지 개발이 진행된 것으로 판단됨")
나. 상용화 과제: 현재 단계에서 상용화까지 필요한 기술적/사업적 과제
다. 예상 소요 기간: 상용화까지 예상되는 기간과 주요 마일스톤

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
        model: "google/gemini-2.5-flash",
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
      JSON.stringify({ error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
