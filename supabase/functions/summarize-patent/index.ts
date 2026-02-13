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

    // Validate analysisMode
    if (analysisMode && !["summary", "detailed"].includes(analysisMode)) {
      return new Response(
        JSON.stringify({ error: "잘못된 분석 모드입니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[CONFIG] LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "서비스 일시적 오류입니다. 잠시 후 다시 시도해주세요." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    const isDetailed = analysisMode === "detailed";

    const summaryPrompt = `당신은 한국 특허 문서를 심층 분석하는 기술 전문가입니다.
${patentData ? "아래 제공된 실제 특허 데이터를 기반으로" : "특허 등록번호를 기반으로"} 핵심을 빠르게 파악할 수 있는 집약적 요약서를 작성하세요.

[핵심 원칙]
1. 집약적 분석: 서술형 나열을 지양하고, 핵심 기술 포인트를 압축적으로 전달하세요.
2. 분석적 재구성: Abstract/Claims를 그대로 복사하지 말고 핵심 원리를 추출하여 재구성하세요.
3. 정보 부재 시: "정보 없음"으로 명시하세요.

[서식 규칙]
- 별도의 제목, 작성일, 분석 전문가 등의 헤더 절대 포함 금지
- "특허 기본 정보" 섹션 절대 포함 금지
- 말머리표(-, •), 숫자 번호(1. 2. 3.) 절대 사용 금지
- 핵심 기술명과 중요 문구는 **볼드** 강조
- 섹션 제목만 ## 사용, 나머지는 일반 텍스트
- 각 섹션은 2~3문장으로 압축 (기술적 특징만 3~4문장 허용)

## 기술 분야
IPC/CPC 분류(${patentData?.classifications?.join(", ") || "정보 없음"})를 해석하여 해당 기술의 산업 분야와 핵심 응용 영역을 1~2문장으로 명시하세요.

## 발명의 요약
핵심 기술 과제 → 해결 접근법 → 기술 원리 순으로 2~3문장의 통합적 요약문을 작성하세요. Abstract를 단순 복사하지 말고 분석적으로 재구성하세요.

## 기술적 특징
핵심 구성요소의 역할, 작동 메커니즘, 종래 기술 대비 차별점을 각각 1~2문장으로 압축하세요. 기술적 인과관계를 명확히 하되 장황하게 서술하지 마세요.

## 산업적 활용 가능성
실제 산업 현장에서의 구체적 활용 시나리오를 2~3문장으로 제시하세요.

## 기술 성숙도 및 상용화 전망
중요: TRL 숫자(예: "TRL 4")는 절대 언급 금지. 현재 개발 단계를 정성적으로 1문장, 상용화까지의 핵심 과제와 예상 기간을 1~2문장으로 작성하세요.

## 농산업 기술사업화 특장점
농산업(스마트팜, 정밀농업, 농기계, 유통/저장, 센서/IoT, 친환경 농법 등) 적용 시 특장점을 2~3문장으로 분석하세요. 직접 관련이 없으면 융합 가능성을 제시하세요.

${patentData ? "" : "참고: 특허 데이터베이스에서 정보를 가져오지 못했습니다. 일반적인 형식으로 예시 요약서를 생성합니다."}`;

    const detailedPrompt = `당신은 한국 특허 문서를 심층 분석하는 기술 전문가입니다.
${patentData ? "아래 제공된 실제 특허 데이터를 기반으로" : "특허 등록번호를 기반으로"} 상세하고 포괄적인 기술 분석 보고서를 작성하세요.

[핵심 원칙]
1. 상세 분석: 각 섹션에서 충분한 기술적 깊이와 배경을 제공하세요.
2. 분석적 재구성: Abstract/Claims를 그대로 복사하지 말고 핵심 원리를 추출하여 상세히 설명하세요.
3. 정보 부재 시: "정보 없음"으로 명시하세요.

[서식 규칙]
- 별도의 제목, 작성일, 분석 전문가 등의 헤더 절대 포함 금지
- "특허 기본 정보" 섹션 절대 포함 금지
- 말머리표(-, •), 숫자 번호(1. 2. 3.) 절대 사용 금지
- 핵심 기술명과 중요 문구는 **볼드** 강조
- 섹션 제목만 ## 사용, 나머지는 일반 텍스트
- 각 섹션은 4~6문장으로 상세하게 서술

## 기술 분야
IPC/CPC 분류(${patentData?.classifications?.join(", ") || "정보 없음"})를 해석하여 해당 기술의 산업 분야, 핵심 응용 영역, 관련 기술 생태계를 상세히 설명하세요.

## 발명의 요약
기술 배경 → 종래 기술의 한계 → 핵심 기술 과제 → 해결 접근법 → 기술 원리 → 기대 효과 순으로 포괄적인 요약문을 작성하세요.

## 기술적 특징
핵심 구성요소별로 역할, 작동 원리, 상호작용 메커니즘, 종래 기술 대비 차별점을 상세하게 분석하세요. 기술적 인과관계와 설계 의도를 명확히 서술하세요.

## 산업적 활용 가능성
실제 산업 현장에서의 구체적 활용 시나리오, 타겟 시장, 기대 효과, 경쟁 기술 대비 장점을 상세히 분석하세요.

## 기술 성숙도 및 상용화 전망
중요: TRL 숫자(예: "TRL 4")는 절대 언급 금지. 현재 개발 단계를 정성적으로 설명하고, 상용화까지의 핵심 과제, 필요 투자, 예상 기간, 시장 진입 전략을 상세히 서술하세요.

## 농산업 기술사업화 특장점
농산업(스마트팜, 정밀농업, 농기계, 유통/저장, 센서/IoT, 친환경 농법 등) 적용 시 특장점, 구체적 적용 시나리오, 기대 효과를 상세히 분석하세요. 직접 관련이 없으면 융합 가능성과 응용 방안을 제시하세요.

${patentData ? "" : "참고: 특허 데이터베이스에서 정보를 가져오지 못했습니다. 일반적인 형식으로 예시 요약서를 생성합니다."}`;

    const systemPrompt = isDetailed ? detailedPrompt : summaryPrompt;

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
