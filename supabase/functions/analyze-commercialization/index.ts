import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    // Check cache first
    try {
      const supabase = getSupabaseClient();
      const { data: cached } = await supabase
        .from("patent_score_cache")
        .select("*")
        .eq("patent_number", trimmedPatent)
        .maybeSingle();

      if (cached) {
        console.log(`[CACHE HIT] score for ${trimmedPatent}`);
        return new Response(
          JSON.stringify({
            success: true,
            score: cached.total_score,
            details: {
              technologyScore: cached.technology_score,
              marketScore: cached.market_score,
              businessScore: cached.business_score,
              analysis: cached.analysis,
              trl: cached.trl,
              trlReason: cached.trl_reason || "",
              technologyReason: cached.technology_reason || "",
              marketReason: cached.market_reason || "",
              businessReason: cached.business_reason || "",
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (cacheErr) {
      console.error("Cache read error (continuing):", cacheErr);
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

    let yearsSinceFiling = 0;
    if (data.filingDate) {
      const fd = new Date(data.filingDate);
      if (!isNaN(fd.getTime())) {
        yearsSinceFiling = Math.floor((Date.now() - fd.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      }
    }

    // Detect if detailed mode (check body for analysisMode)
    const isDetailedScore = body.analysisMode === "detailed";

    // Patent context - richer for detailed
    const abstractLimit = isDetailedScore ? 450 : 300;
    let patentContext = `번호: ${data.patentNumber || patentNumber}
명칭: ${data.titleKo || data.title || "없음"}
출원인: ${data.assignee || "없음"}
IPC: ${data.classifications?.slice(0, 3).join(", ") || "없음"}
청구항수: ${data.claims?.length || 0}
경과연수: ${yearsSinceFiling}년
초록: ${(data.abstract || "없음").substring(0, abstractLimit)}`;
    if (isDetailedScore && data.claims?.length) {
      patentContext += `\n대표청구항: ${data.claims[0].substring(0, 200)}`;
    }

    // System prompt - richer for detailed mode
    const systemPrompt = isDetailedScore
      ? `특허 기술사업화 평가 전문가. JSON으로만 응답.

평가기준(0-100):
1.기술성(35%): 청구항 깊이/범위, IPC 특이성, 실시예/실험데이터 유무, 선행기술 대비 진보성. 단순개념55~65, 실시예포함65~78, 실험데이터포함75~85, 독창+실증85~95
2.시장성(35%): IPC 기반 산업분류 범용성, 기존기술 대비 차별적 경쟁력, 다분야 적용 가능성, 수요처 다양성. 단일산업/낮은차별55~65, 복수산업적용65~78, 범용+높은차별75~85, 광범위+독보적85~95
3.사업성(30%): 기술구현 난이도/소요기간, 라이선싱/기술이전 용이성, 투자회수 가능성. 구현난이도높음55~65, 보통난이도65~78, 구현용이+이전가능75~85, 즉시상용화85~95
총점=기술×0.35+시장×0.35+사업×0.30 (반올림)
세항목 최고-최저 차이 5점이상 권장(강제아님).

중요 보정사항:
- 식품·농산물 가공 특허 중 소비자가 직접 이해할 수 있는 제품(떡, 빵, 음료, 면류, 과자 등)은 시장성·사업성을 현실적으로 높게 평가할 것. 소비재 식품의 경우 수요 명확성과 상용화 용이성을 반영.
- 이미 유사 제품군이 시장에 존재하는 기술(예: 떡류, 발효식품, 기능성 음료 등)은 시장 검증이 된 것으로 간주하고 시장성 75점 이상 부여 검토.
- 제조 공정이 기존 설비로 구현 가능한 경우 사업성을 높게 평가(75점 이상 검토).

TRL(1-9): 특허 텍스트에서 확인 가능한 기술 완성도만 기준으로 판단. 개념만 서술→2~3, 실험/시뮬레이션 데이터→4~5, 시제품/실증→5~6, 상용화 언급→7~8. 출원 경과연수는 TRL 판정에 반영하지 않음.
단, 해당 기술이 이미 제품화되어 시장에서 판매·유통되고 있는 카테고리(예: 떡류, 발효식품, 기능성 음료, 면류, 건강기능식품, 가공식품 등)에 속하고, 제조 공정이 기존 설비로 구현 가능한 경우에는 TRL 7~8 이상으로 평가할 것. 특허 내 실시예나 제조방법이 구체적으로 기술되어 있으면 TRL 8 이상도 가능.

주의: 시장 규모·성장률 등 특허 문서에 없는 외부 데이터를 추측하여 근거로 제시하지 말 것. IPC 분류와 기술 특성에서 추론 가능한 산업 적용성만 평가할 것.

JSON형식:
{"technologyScore":72,"marketScore":65,"businessScore":78,"totalScore":71,"trl":6,"trlReason":"100~150자 상세근거: 기술 완성도, 실증 수준, 상용화 단계를 구체적으로 서술","analysis":"180~250자 종합평가: 기술적 차별성, 시장 적용 가능성, 사업화 전략을 종합적으로 분석","technologyReason":"55~85자: 청구항 독창성, 실시예 구체성, 선행기술 대비 진보성을 간결하게 분석","marketReason":"55~85자: IPC 기반 산업 적용 범위, 차별적 우위, 확장 가능성을 간결하게 분석","businessReason":"55~85자: 기술구현 난이도, 라이선싱·투자회수 가능성을 간결하게 분석"}`
      : `특허 기술사업화 평가 전문가. JSON으로만 응답.

평가기준(0-100):
1.기술성(35%): 청구항 깊이, IPC 특이성, 실시예 유무. 단순개념55~65, 실시예65~78, 실험데이터75~85, 독창+실증85~95
2.시장성(35%): IPC 기반 산업분류 범용성, 차별점, 다분야적용. 단일산업55~65, 복수산업65~78, 범용+차별75~85, 광범위+독보85~95
3.사업성(30%): 구현난이도, 라이선싱, 이전가능성. 난이도높음55~65, 보통65~78, 용이75~85, 즉시상용85~95
총점=기술×0.35+시장×0.35+사업×0.30 (반올림)
세항목 최고-최저 차이 5점이상 권장.

중요: 식품·농산물 가공 특허 중 소비자 접점이 명확한 제품(떡, 빵, 음료, 면류 등)은 시장성·사업성을 현실적으로 높게 평가. 유사제품 시장 존재 시 시장성 75+, 기존설비 구현 가능 시 사업성 75+ 검토.

TRL(1-9): 특허 텍스트 기반 기술 완성도만 판단. 개념→2~3, 실험데이터→4~5, 시제품→5~6, 상용→7~8. 경과연수 미반영. 단, 이미 제품화·유통 중인 카테고리(떡류, 발효식품, 음료, 면류, 가공식품 등)이고 기존설비 구현 가능 시 TRL 7~8+, 실시예 구체적이면 8+.

주의: 특허문서에 없는 시장규모 등 외부데이터 추측 금지. IPC·기술특성 기반 산업적용성만 평가.

JSON형식:
{"technologyScore":72,"marketScore":65,"businessScore":78,"totalScore":71,"trl":6,"trlReason":"80~100자 근거","analysis":"120~160자 종합평가","technologyReason":"40~55자 핵심근거","marketReason":"40~55자 핵심근거","businessReason":"40~55자 핵심근거"}`;


    // Read AI model from settings
    let configuredModel = "google/gemini-2.5-flash";
    try {
      const supabase2 = getSupabaseClient();
      const { data: modelSetting } = await supabase2
        .from("site_settings")
        .select("value")
        .eq("key", "ai_model")
        .maybeSingle();
      if (modelSetting?.value) configuredModel = modelSetting.value;
    } catch { /* use default */ }

    const scoreModel = isDetailedScore ? configuredModel : "google/gemini-2.5-flash-lite";
    const scoreMaxTokens = isDetailedScore ? 650 : 420;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: scoreModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: patentContext },
        ],
        temperature: 0.3,
        max_tokens: scoreMaxTokens,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "서비스 크레딧이 부족합니다." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI 서비스 오류");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("AI 응답이 비어있습니다.");
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("점수 분석 결과를 파싱할 수 없습니다.");
    }

    const scores = JSON.parse(jsonMatch[0]);

    // Save to cache
    try {
      const supabase = getSupabaseClient();
      await supabase.from("patent_score_cache").upsert({
        patent_number: trimmedPatent,
        total_score: scores.totalScore,
        technology_score: scores.technologyScore,
        market_score: scores.marketScore,
        business_score: scores.businessScore,
        trl: scores.trl || 5,
        trl_reason: scores.trlReason || "",
        analysis: scores.analysis || "",
        technology_reason: scores.technologyReason || "",
        market_reason: scores.marketReason || "",
        business_reason: scores.businessReason || "",
      }, { onConflict: "patent_number" });
      console.log(`[CACHE SAVED] score for ${trimmedPatent}`);
    } catch (saveErr) {
      console.error("Cache save error:", saveErr);
    }

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
        error: "서버 오류가 발생했습니다.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
