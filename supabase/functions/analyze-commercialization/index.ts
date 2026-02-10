import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PatentData {
  title?: string;
  titleKo?: string;
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

    if (!patentNumber || !patentData) {
      return new Response(
        JSON.stringify({ error: "특허 정보가 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const data = patentData as PatentData;
    
    const patentContext = `
특허 정보:
- 등록번호/공개번호: ${data.patentNumber || patentNumber}
- 발명의 명칭: ${data.titleKo || data.title || "정보 없음"}
- 출원번호: ${data.applicationNumber || "정보 없음"}
- 출원인/권리자: ${data.assignee || "정보 없음"}
- 발명자: ${data.inventors?.join(", ") || "정보 없음"}
- 출원일: ${data.filingDate || "정보 없음"}
- 기술 분류(IPC): ${data.classifications?.join(", ") || "정보 없음"}
- 청구항 수: ${data.claims?.length || 0}개

초록:
${data.abstract || "정보 없음"}

${data.claims && data.claims.length > 0 ? `주요 청구항:\n${data.claims.slice(0, 3).map((c, i) => `${i + 1}. ${c}`).join("\n")}` : ""}
`;

    const systemPrompt = `당신은 특허 기술의 사업화 가능성을 평가하는 전문가입니다.
주어진 특허 정보를 분석하여 기술사업화점수와 기술성숙도(TRL)를 평가해주세요.

평가 기준:
1. 기술성 (0-100점): 기술의 혁신성, 독창성, 완성도, 청구항의 범위와 품질
2. 시장성 (0-100점): 시장 수요, 적용 분야의 크기, 경쟁 기술 대비 우위성
3. 사업성 (0-100점): 상용화 가능성, 투자 대비 수익성, 실현 가능성, 농식품 분야 적용 가능성

종합점수는 세 점수의 가중 평균입니다: 기술성(35%) + 시장성(35%) + 사업성(30%)

기술성숙도(TRL, Technology Readiness Level) 평가:
- TRL 1: 기본 원리 관찰 및 보고
- TRL 2: 기술 개념 및 응용 정립
- TRL 3: 핵심 기능의 분석적/실험적 증명
- TRL 4: 실험실 환경에서 기술 검증
- TRL 5: 유사 환경에서 기술 검증
- TRL 6: 시제품의 유사 환경 시연
- TRL 7: 실제 운영 환경에서 시연
- TRL 8: 시스템 완성 및 검증
- TRL 9: 실제 운영 환경에서 성공적 검증 (상용화 완료)

특허 내용(초록, 청구항, 기술분류)을 기반으로 해당 기술의 TRL 단계를 1-9 사이로 추정하세요.

반드시 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "technologyScore": 75,
  "marketScore": 68,
  "businessScore": 72,
  "totalScore": 72,
  "trl": 5,
  "trlReason": "TRL 추정 근거를 한 문장으로 (30자 이내)",
  "analysis": "농식품 분야에서의 의미와 잠재력을 포함한 종합 평가를 2문장으로 작성 (80~120자)",
  "technologyReason": "기술성 점수의 근거를 한 문장으로 (30자 이내)",
  "marketReason": "시장성 점수의 근거를 한 문장으로 (30자 이내)",
  "businessReason": "사업성 점수의 근거를 한 문장으로 (30자 이내)"
}`;

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
          { role: "user", content: patentContext },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI 서비스 오류");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("AI 응답이 비어있습니다.");
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("점수 분석 결과를 파싱할 수 없습니다.");
    }

    const scores = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify({
        success: true,
        score: scores.totalScore,
        details: {
          technologyScore: scores.technologyScore,
          marketScore: scores.marketScore,
          businessScore: scores.businessScore,
          analysis: scores.analysis,
          trl: scores.trl || 5,
          trlReason: scores.trlReason || "",
          technologyReason: scores.technologyReason || "",
          marketReason: scores.marketReason || "",
          businessReason: scores.businessReason || "",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-commercialization error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "알 수 없는 오류" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
