import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callAIChatCompletions(
  payload: Record<string, unknown> & { model: string },
  init: { signal?: AbortSignal } = {},
): Promise<Response> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (GEMINI_API_KEY) {
    try {
      const geminiModel = payload.model.replace(/^google\//, "");
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
          method: "POST",
          signal: init.signal,
          headers: {
            Authorization: `Bearer ${GEMINI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...payload, model: geminiModel }),
        },
      );
      if (r.ok) {
        console.log("[AI] using personal Gemini API");
        return r;
      }
      const errText = await r.text().catch(() => "");
      console.warn(`[AI] personal Gemini failed ${r.status}: ${errText.slice(0, 200)} — trying Groq next`);
    } catch (e) {
      console.warn("[AI] personal Gemini error, trying Groq:", e);
    }
  }
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  if (GROQ_API_KEY) {
    try {
      const m = payload.model;
      const groqModel = m.includes("flash-lite") || m.includes("nano") || m.includes("mini")
        ? "llama-3.1-8b-instant"
        : "llama-3.3-70b-versatile";
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: init.signal,
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...payload, model: groqModel }),
      });
      if (r.ok) {
        console.log(`[AI] using personal Groq API (${groqModel})`);
        return r;
      }
      const errText = await r.text().catch(() => "");
      console.warn(`[AI] personal Groq failed ${r.status}: ${errText.slice(0, 200)} — falling back to Lovable AI`);
    } catch (e) {
      console.warn("[AI] personal Groq error, falling back:", e);
    }
  }
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal: init.signal,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

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

    // ===== 동적 길이 조절 로직 =====
    // 1) 문서 정보량 점수 (0~100)
    const abstractLen = (data.abstract || "").length;
    const descLen = (data.description || "").length;
    const claimsCount = data.claims?.length || 0;
    const firstClaimLen = data.claims?.[0]?.length || 0;
    const totalContentLen = abstractLen + descLen + firstClaimLen;

    let infoScore = 0;
    if (totalContentLen >= 2500) infoScore = 100;
    else if (totalContentLen >= 1500) infoScore = 80;
    else if (totalContentLen >= 800) infoScore = 60;
    else if (totalContentLen >= 400) infoScore = 40;
    else infoScore = 20;
    // 청구항 다수면 가산
    if (claimsCount >= 10) infoScore = Math.min(100, infoScore + 15);
    else if (claimsCount >= 5) infoScore = Math.min(100, infoScore + 8);

    // 2) IPC 복잡도 — 첨단/융합 분야는 길게, 단순 분야는 짧게
    const ipcStr = (data.classifications || []).join(" ").toUpperCase();
    const ipcSections = new Set(
      (data.classifications || []).map(c => c.charAt(0).toUpperCase()).filter(Boolean)
    );
    // 첨단/복합 섹션 가중: A(생활필수=의약/식품/농업), C(화학/생화학), G(물리/계측), H(전기/IT)
    const advancedHits = ["A61", "C12", "C07", "G06", "G01", "H04", "H01", "B01"]
      .filter(p => ipcStr.includes(p)).length;
    // 단순 기계/생활 분야: B(처리/운수), F(기계/조명/난방)
    const simpleHits = ["B65", "F24", "F26", "A47", "A23L", "A23B"]
      .filter(p => ipcStr.includes(p)).length;

    let complexityScore = 50;
    complexityScore += advancedHits * 8;          // 첨단 분야 가산
    complexityScore += (ipcSections.size - 1) * 6; // 다분야 가산
    complexityScore -= simpleHits * 6;             // 단순 분야 감산
    complexityScore = Math.max(20, Math.min(100, complexityScore));

    // 3) 종합 길이 배수 계산 (0.7 ~ 1.4)
    //    정보량 70% + 복잡도 30% 가중 평균
    const lengthIndex = (infoScore * 0.7 + complexityScore * 0.3) / 100;
    const lengthMultiplier = Math.max(0.7, Math.min(1.4, 0.7 + lengthIndex * 0.7));

    // 4) 모드별 기본 범위에 배수 적용
    const round = (n: number) => Math.round(n / 5) * 5;
    // analysis는 3줄 이내(≈120자)로 간결화
    const baseRanges = isDetailedScore
      ? { reason: [55, 85], trl: [100, 150], analysis: [90, 130] }
      : { reason: [40, 55], trl: [80, 100], analysis: [80, 120] };

    const reasonMin = round(baseRanges.reason[0] * lengthMultiplier);
    const reasonMax = round(baseRanges.reason[1] * lengthMultiplier);
    const trlMin = round(baseRanges.trl[0] * lengthMultiplier);
    const trlMax = round(baseRanges.trl[1] * lengthMultiplier);
    const analysisMin = round(baseRanges.analysis[0] * lengthMultiplier);
    const analysisMax = round(baseRanges.analysis[1] * lengthMultiplier);

    console.log(`[LENGTH-AUTO] ${trimmedPatent} info=${infoScore} complexity=${complexityScore} multiplier=${lengthMultiplier.toFixed(2)} reason=${reasonMin}~${reasonMax}자`);

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
2.시장성(35%): IPC 기반 산업분류 범용성, 기존기술 대비 차별적 경쟁력, 다분야 적용 가능성, 수요처 다양성. 단일산업/낮은차별55~65, 복수산업적용68~80, 범용+높은차별80~90, 광범위+독보적88~96
3.사업성(30%): 기술구현 난이도/소요기간, 라이선싱/기술이전 용이성, 투자회수 가능성. 구현난이도높음55~65, 보통난이도65~78, 구현용이+이전가능75~85, 즉시상용화85~95
총점=기술×0.35+시장×0.35+사업×0.30 (반올림)
세항목 최고-최저 차이 5점이상 권장(강제아님).

점수-근거 정합성(필수): 근거 텍스트의 톤과 점수는 반드시 일치할 것.
- 근거에 "우수/탁월/광범위/독보적/높은 경쟁력/검증된 시장/수요 명확/즉시 상용화/높은 확장성" 등 강한 긍정 표현이 포함되면 해당 항목 점수는 80점 이상이어야 한다.
- 근거에 "매우 우수/독보적/시장 검증 완료/광범위한 산업 적용" 등 최상급 표현이 포함되면 85점 이상이어야 한다.
- 점수가 70~79이면 근거에는 "보통/일부 한계/제한적 차별성" 등 중립~온건한 표현만 사용할 것.

중요 보정사항:
- 식품·농산물 가공 특허 중 소비자가 직접 이해할 수 있는 제품(떡, 빵, 음료, 면류, 과자 등)은 시장성·사업성을 현실적으로 높게 평가할 것. 소비재 식품의 경우 수요 명확성과 상용화 용이성을 반영.
- 이미 유사 제품군이 시장에 존재하는 기술(예: 떡류, 발효식품, 기능성 음료 등)은 시장 검증이 된 것으로 간주하고 시장성 75점 이상 부여 검토.
- 제조 공정이 기존 설비로 구현 가능한 경우 사업성을 높게 평가(75점 이상 검토).

TRL(1-9): 특허 텍스트에서 확인 가능한 기술 완성도만 기준으로 판단. 개념만 서술→2~3, 실험/시뮬레이션 데이터→4~5, 시제품/실증→5~6, 상용화 언급→7~8. 출원 경과연수는 TRL 판정에 반영하지 않음.
단, 해당 기술이 이미 제품화되어 시장에서 판매·유통되고 있는 카테고리(예: 떡류, 발효식품, 기능성 음료, 면류, 건강기능식품, 가공식품 등)에 속하고, 제조 공정이 기존 설비로 구현 가능한 경우에는 TRL 7~8 이상으로 평가할 것. 특허 내 실시예나 제조방법이 구체적으로 기술되어 있으면 TRL 8 이상도 가능.

주의: 시장 규모·성장률 등 특허 문서에 없는 외부 데이터를 추측하여 근거로 제시하지 말 것. IPC 분류와 기술 특성에서 추론 가능한 산업 적용성만 평가할 것.

JSON형식:
analysis 필드 작성 규칙(매우 중요):
- 발명/초록 요약 금지. "~에 관한 것이다/포함한다/방법이다" 어투 금지. 평가·전망 어투.
- 최대 3문장(${analysisMin}~${analysisMax}자) 이내로 간결하게. 핵심 강점 + 시장 가능성 + 리스크/제언을 압축 서술.

JSON형식:
{"technologyScore":72,"marketScore":65,"businessScore":78,"totalScore":71,"trl":6,"trlReason":"${trlMin}~${trlMax}자 상세근거: 기술 완성도, 실증 수준, 상용화 단계를 구체적으로 서술","analysis":"${analysisMin}~${analysisMax}자 종합평가(발명요약 금지, 평가·전망 어투): 기술적 차별성·강점, 시장 진입 가능성, 사업화 리스크, 추진 전략 제언을 종합 서술","technologyReason":"${reasonMin}~${reasonMax}자: 청구항 독창성, 실시예 구체성, 선행기술 대비 진보성을 간결하게 분석","marketReason":"${reasonMin}~${reasonMax}자: IPC 기반 산업 적용 범위, 차별적 우위, 확장 가능성을 간결하게 분석","businessReason":"${reasonMin}~${reasonMax}자: 기술구현 난이도, 라이선싱·투자회수 가능성을 간결하게 분석"}`
      : `특허 기술사업화 평가 전문가. JSON으로만 응답.

평가기준(0-100):
1.기술성(35%): 청구항 깊이, IPC 특이성, 실시예 유무. 단순개념55~65, 실시예65~78, 실험데이터75~85, 독창+실증85~95
2.시장성(35%): IPC 기반 산업분류 범용성, 차별점, 다분야적용. 단일산업55~65, 복수산업68~80, 범용+차별80~90, 광범위+독보88~96
3.사업성(30%): 구현난이도, 라이선싱, 이전가능성. 난이도높음55~65, 보통65~78, 용이75~85, 즉시상용85~95
총점=기술×0.35+시장×0.35+사업×0.30 (반올림)
세항목 최고-최저 차이 5점이상 권장.

점수-근거 정합성(필수): 근거에 "우수/탁월/광범위/독보적/검증된 시장/수요 명확" 등 강한 긍정이 있으면 80점 이상, "매우 우수/독보적" 등 최상급은 85점 이상. 점수 70~79대는 "보통/일부 한계" 등 중립 표현만 사용.

중요: 식품·농산물 가공 특허 중 소비자 접점이 명확한 제품(떡, 빵, 음료, 면류 등)은 시장성·사업성을 현실적으로 높게 평가. 유사제품 시장 존재 시 시장성 75+, 기존설비 구현 가능 시 사업성 75+ 검토.

TRL(1-9): 특허 텍스트 기반 기술 완성도만 판단. 개념→2~3, 실험데이터→4~5, 시제품→5~6, 상용→7~8. 경과연수 미반영. 단, 이미 제품화·유통 중인 카테고리(떡류, 발효식품, 음료, 면류, 가공식품 등)이고 기존설비 구현 가능 시 TRL 7~8+, 실시예 구체적이면 8+.

주의: 특허문서에 없는 시장규모 등 외부데이터 추측 금지. IPC·기술특성 기반 산업적용성만 평가.

JSON형식:
analysis 필드 작성 규칙(중요):
- 발명/초록 요약 금지. "~에 관한 것이다/포함한다/방법이다" 어투 금지.
- 최대 3문장(${analysisMin}~${analysisMax}자) 이내. 강점·시장 가능성·리스크/제언을 압축 서술.

JSON형식:
{"technologyScore":72,"marketScore":65,"businessScore":78,"totalScore":71,"trl":6,"trlReason":"${trlMin}~${trlMax}자 근거","analysis":"${analysisMin}~${analysisMax}자 종합평가(발명요약 금지, 강점·시장·리스크·제언 포함)","technologyReason":"${reasonMin}~${reasonMax}자 핵심근거","marketReason":"${reasonMin}~${reasonMax}자 핵심근거","businessReason":"${reasonMin}~${reasonMax}자 핵심근거"}`;


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
    // max_tokens — 절대 잘리지 않도록 충분한 한도 확보.
    // 한국어 1글자 ≈ 2~3 토큰(JSON 이스케이프 포함). 5개 필드 합계 최대 ~600자 → 약 2,000토큰.
    // 안전 마진 2배 적용하여 detailed 4,800 / lite 3,600 기본.
    const baseMaxTokens = isDetailedScore ? 4800 : 3600;
    const scoreMaxTokens = Math.max(
      isDetailedScore ? 4000 : 3000,
      Math.round(baseMaxTokens * lengthMultiplier),
    );

    const aiController = new AbortController();
    const aiTimer = setTimeout(() => aiController.abort(), 60000);
    let response: Response;
    try {
      response = await callAIChatCompletions(
        {
          model: scoreModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: patentContext },
          ],
          temperature: 0.3,
          max_tokens: scoreMaxTokens,
          response_format: { type: "json_object" },
        },
        { signal: aiController.signal },
      );
    } finally {
      clearTimeout(aiTimer);
    }

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

    // 견고한 JSON 파싱: response_format이 무시될 수 있으므로 폴백 포함
    let scores: any;
    try {
      scores = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("AI 응답 파싱 실패, raw content:", content.substring(0, 500));
        throw new Error("점수 분석 결과를 파싱할 수 없습니다.");
      }
      try {
        scores = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error("JSON.parse 실패, raw:", jsonMatch[0].substring(0, 500));
        throw new Error("점수 분석 결과를 파싱할 수 없습니다.");
      }
    }

    // 점수-근거 정합성 보정: 근거 텍스트가 강한 긍정인데 점수가 낮으면 끌어올림
    const STRONG_TOP = /(매우\s*우수|매우\s*뛰어|독보적|독보|최고|최상|광범위한|매우\s*광범|시장\s*검증\s*완료|즉시\s*상용)/;
    const STRONG_POS = /(우수|뛰어|탁월|광범위|높은\s*경쟁력|차별적\s*우위|검증된\s*시장|수요\s*명확|높은\s*확장|상용화\s*용이|즉시\s*적용)/;
    const enforceConsistency = (score: number, reason: string): number => {
      if (!reason || typeof score !== "number") return score;
      if (STRONG_TOP.test(reason) && score < 85) return 85;
      if (STRONG_POS.test(reason) && score < 80) return 80;
      return score;
    };
    const beforeMarket = scores.marketScore;
    scores.technologyScore = enforceConsistency(scores.technologyScore, scores.technologyReason || "");
    scores.marketScore = enforceConsistency(scores.marketScore, scores.marketReason || "");
    scores.businessScore = enforceConsistency(scores.businessScore, scores.businessReason || "");
    if (beforeMarket !== scores.marketScore) {
      console.log(`[CONSISTENCY] market ${beforeMarket} -> ${scores.marketScore} (reason matched strong-positive)`);
    }
    // 총점 재계산
    if (
      typeof scores.technologyScore === "number" &&
      typeof scores.marketScore === "number" &&
      typeof scores.businessScore === "number"
    ) {
      scores.totalScore = Math.round(
        scores.technologyScore * 0.35 + scores.marketScore * 0.35 + scores.businessScore * 0.3
      );
    }

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
