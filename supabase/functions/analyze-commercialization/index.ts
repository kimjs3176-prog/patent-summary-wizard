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
    // Basic input validation
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({ success: false, error: "잘못된 요청입니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { patentNumber, patentData } = body;

    if (!patentNumber || typeof patentNumber !== "string" || !patentData) {
      return new Response(
        JSON.stringify({ error: "특허 정보가 필요합니다." }),
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[CONFIG] LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "서비스 일시적 오류입니다. 잠시 후 다시 시도해주세요." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = patentData as PatentData;
    
    // Calculate years since filing for TRL adjustment
    const filingDateStr = data.filingDate;
    let yearsSinceFiling = 0;
    if (filingDateStr) {
      const filingDate = new Date(filingDateStr);
      if (!isNaN(filingDate.getTime())) {
        yearsSinceFiling = Math.floor((Date.now() - filingDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      }
    }

    const patentContext = `
특허 정보:
- 등록번호/공개번호: ${data.patentNumber || patentNumber}
- 발명의 명칭: ${data.titleKo || data.title || "정보 없음"}
- 출원번호: ${data.applicationNumber || "정보 없음"}
- 출원인/권리자: ${data.assignee || "정보 없음"}
- 발명자: ${data.inventors?.join(", ") || "정보 없음"}
- 출원일: ${data.filingDate || "정보 없음"}
- 출원 후 경과 연수: 약 ${yearsSinceFiling}년
- 기술 분류(IPC): ${data.classifications?.join(", ") || "정보 없음"}
- 청구항 수: ${data.claims?.length || 0}개

초록:
${data.abstract || "정보 없음"}

${data.claims && data.claims.length > 0 ? `주요 청구항:\n${data.claims.slice(0, 3).map((c, i) => `${i + 1}. ${c}`).join("\n")}` : ""}
`;

    const systemPrompt = `당신은 특허 기술의 사업화 가능성을 평가하는 기술이전 전문가입니다.
주어진 특허 정보를 분석하여 기술사업화점수와 기술성숙도(TRL)를 평가해주세요.

## 핵심 원칙: 공정하고 균형 잡힌 평가
- 특허로 등록/공개된 기술은 이미 신규성과 진보성을 인정받은 것이므로 기본적인 기술적 가치를 존중하세요.
- 점수 분포 가이드: 하위 (45~60점), 중하위 (60~70점), 중간 (70~78점), 상위 (78~88점), 최상위 (88~95점)
- 대부분의 등록 특허는 65~88점 범위에 분포하는 것이 자연스럽습니다.
- 기술적 구체성(실시예, 실험 데이터)이 있는 특허는 기본 70점 이상에서 시작하세요.
- 세 항목(기술성, 시장성, 사업성) 점수 간 차이는 특허 특성에 따라 자연스럽게 발생할 수 있습니다.
- 45점 미만은 명백한 결함이 있는 경우에만, 88점 이상은 기술적 우수성이 뛰어난 특허에 부여하세요.

## 평가 기준 (각 0-100점)

### 1. 기술성 (가중치 35%)
- 청구항 독립항의 구성요소 수와 기술적 깊이
- 종속항의 구체성과 권리 보호 범위의 계층적 설계
- IPC 분류의 특이성
- 명세서에 기재된 실시예/실험 데이터의 유무와 구체성
- **가점 요인**: 독창적 메커니즘, 구체적 실시예, 넓은 권리 범위
- **감점 요인**: 공지기술의 단순 변형, 청구항이 지나치게 모호한 경우

### 2. 시장성 (가중치 35%)
- 해당 기술이 속한 시장의 현재 규모와 성장 추세
- 기존 경쟁 기술/제품 대비 차별점 존재 여부
- B2B vs B2C 적용 가능성, 타겟 고객층의 구매력
- 기술의 범용성 (단일 용도 vs 다중 산업 적용 가능)
- **가점 요인**: 성장 시장, 명확한 수요, 다중 산업 적용 가능
- **감점 요인**: 포화 시장, 대체 기술이 매우 풍부한 영역

### 3. 사업성 (가중치 30%)
- 제조/구현 난이도와 초기 투자 규모
- 라이선싱 가능성, 기술이전 매력도
- 규제/인허가 장벽의 존재 여부
- 농식품 분야 적용 시 현실적 실현 가능성
- **가점 요인**: 낮은 진입 장벽, 기존 인프라 활용 가능, 빠른 상용화
- **감점 요인**: 높은 초기 투자, 복잡한 규제 환경

## 종합점수 계산
totalScore = round(기술성 × 0.35 + 시장성 × 0.35 + 사업성 × 0.30)
반드시 이 공식대로 계산하세요.

## 기술성숙도(TRL) 평가

### TRL 단계 정의
- TRL 1: 기본 원리 관찰 및 보고
- TRL 2: 기술 개념 및 응용 정립
- TRL 3: 핵심 기능의 분석적/실험적 증명
- TRL 4: 실험실 환경에서 기술 검증
- TRL 5: 유사 환경에서 기술 검증
- TRL 6: 시제품의 유사 환경 시연
- TRL 7: 실제 운영 환경에서 시연
- TRL 8: 시스템 완성 및 검증
- TRL 9: 실제 운영 환경에서 성공적 검증 (상용화 완료)

### TRL 판단 기준 (명세서 기반 베이스라인)
- 단순 개념/방법론 특허 → 베이스라인 TRL 2~3
- 구체적 실험 데이터/성능 비교가 있으면 → 베이스라인 TRL 4~5
- 시제품/프로토타입 언급이 있으면 → 베이스라인 TRL 5~6
- 실제 제품/상용 사례 언급이 있으면 → 베이스라인 TRL 7~8

### ★ 출원 후 시간 경과에 따른 TRL 보정 (중요!)
특허 출원 후 상당한 시간이 경과한 경우, 해당 기술 분야에서 후속 연구개발·검증·개량이 이루어졌을 가능성이 높습니다.
출원 후 경과 연수 정보가 제공되므로, 아래 기준으로 베이스라인 TRL에 보정을 적용하세요:
- 3년 미만: 보정 없음 (베이스라인 유지)
- 3~5년 경과: TRL +1 보정 (후속 검증 가능성)
- 6~10년 경과: TRL +2 보정 (실증·개량 가능성 높음)
- 11년 이상 경과: TRL +2~3 보정 (상용화 또는 후속 기술 발전 가능성 매우 높음)
- 단, 최종 TRL은 9를 초과할 수 없습니다.
- trlReason에 시간 경과 보정을 반영했음을 명시하세요.

반드시 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "technologyScore": 72,
  "marketScore": 65,
  "businessScore": 78,
  "totalScore": 71,
  "trl": 6,
  "trlReason": "TRL 추정 근거를 2문장으로 상세히 작성 (60~80자). 첫 문장은 명세서 내 근거, 둘째 문장은 시간 경과 보정 반영 사항을 기술",
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
        error: "서버 오류가 발생했습니다." 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
