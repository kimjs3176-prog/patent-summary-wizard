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

    const systemPrompt = `당신은 특허 기술의 사업화 가능성을 냉정하고 차별적으로 평가하는 기술이전 전문가입니다.
주어진 특허 정보를 분석하여 기술사업화점수와 기술성숙도(TRL)를 평가해주세요.

## 핵심 원칙: 변별력 있는 평가
- 모든 특허에 60~80점대를 부여하는 것은 금지합니다. 실제 기술이전 시장에서처럼 냉정하게 평가하세요.
- 점수 분포 가이드: 하위 20% (20~45점), 중하위 (45~60점), 중간 (60~75점), 상위 (75~88점), 최상위 (88~98점)
- 세 항목(기술성, 시장성, 사업성) 점수가 서로 15점 이상 차이나는 경우가 자연스럽습니다. 모든 항목을 비슷하게 주지 마세요.

## 평가 기준 (각 0-100점)

### 1. 기술성 (가중치 35%)
- 청구항 독립항의 구성요소 수와 기술적 깊이 (단순 조합 vs 핵심 메커니즘 발명)
- 종속항의 구체성과 권리 보호 범위의 계층적 설계
- IPC 분류의 특이성 (흔한 분류 vs 니치 기술 영역)
- 명세서에 기재된 실시예/실험 데이터의 유무와 구체성
- **감점 요인**: 공지기술의 단순 변형, 청구항이 지나치게 광범위하거나 모호한 경우, 실시예 부재

### 2. 시장성 (가중치 35%)
- 해당 기술이 속한 시장의 현재 규모와 성장 추세
- 기존 경쟁 기술/제품 대비 명확한 우위점 존재 여부
- B2B vs B2C 적용 가능성, 타겟 고객층의 구매력
- 기술의 범용성 (단일 용도 vs 다중 산업 적용 가능)
- **감점 요인**: 이미 포화된 시장, 대체 기술이 풍부한 영역, 수요가 불명확한 기술

### 3. 사업성 (가중치 30%)
- 제조/구현 난이도와 초기 투자 규모
- 라이선싱 가능성, 기술이전 매력도
- 규제/인허가 장벽의 존재 여부
- 농식품 분야 적용 시 현실적 실현 가능성
- **감점 요인**: 높은 초기 투자 대비 불확실한 수익, 복잡한 규제 환경, 상용화까지 긴 시간 소요

## 종합점수 계산
totalScore = round(기술성 × 0.35 + 시장성 × 0.35 + 사업성 × 0.30)
반드시 이 공식대로 계산하세요. 임의로 종합점수를 올리거나 내리지 마세요.

## 기술성숙도(TRL) 평가
- TRL 1: 기본 원리 관찰 및 보고
- TRL 2: 기술 개념 및 응용 정립
- TRL 3: 핵심 기능의 분석적/실험적 증명
- TRL 4: 실험실 환경에서 기술 검증
- TRL 5: 유사 환경에서 기술 검증
- TRL 6: 시제품의 유사 환경 시연
- TRL 7: 실제 운영 환경에서 시연
- TRL 8: 시스템 완성 및 검증
- TRL 9: 실제 운영 환경에서 성공적 검증 (상용화 완료)

TRL 판단 근거:
- 명세서에 "실시예", "실험결과", "시제품" 등의 키워드가 있으면 TRL 4 이상 고려
- 단순 개념/방법론 특허는 TRL 2~3
- 구체적 실험 데이터/성능 비교가 있으면 TRL 4~6
- 실제 제품/상용 사례가 언급되면 TRL 7~9

반드시 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "technologyScore": 62,
  "marketScore": 45,
  "businessScore": 78,
  "totalScore": 61,
  "trl": 4,
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
