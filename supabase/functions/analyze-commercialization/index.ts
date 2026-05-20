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

function cleanKoreanText(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[①-⑨\d]+[).]\s*/g, "")
    .replace(/^(강점|제언|분석|근거|평가|의견)\s*[:：-]\s*/g, "")
    .trim();
}

function isIncompleteSentence(value: unknown): boolean {
  const text = cleanKoreanText(value);
  if (!text || text.length < 18) return true;
  if (/[,(·•및와과의로]$/.test(text)) return true;
  if (/(이며|하고|또는|및|으로|에서|하는|된|되어|통해|위해|관련된|필요한)$/.test(text)) return true;
  return !/(다|된다|있다|없다|필요하다|판단된다|기대된다|관건이다|수준이다)[.!?。]?$/.test(text);
}

function ensureCompleteSentence(value: unknown, fallback: string): string {
  const text = cleanKoreanText(value);
  if (isIncompleteSentence(text)) return fallback;
  return /[.!?。]$/.test(text) ? text : `${text}.`;
}

function looksLikePatentSummary(value: unknown): boolean {
  const text = cleanKoreanText(value);
  const summaryTone = /(본\s*발명|에\s*관한\s*것|포함한다|포함하는|유효성분|분리하였|확인하였|확인되었|화합물인|계열\s*화합물|NO\s*생성|조성물|방법이다|특허\s*기능)/.test(text);
  const evaluationTone = /(근거|검증|차별|진보|구체|제한|보완|상용|사업|시장|평가|판단|수준|장벽|실증|데이터|리스크|청구항\s*구체성|재현성)/.test(text);
  return summaryTone && !evaluationTone;
}

function makeTechnologyFallback(score: number, claimsCount: number, hasData: boolean, multiIpc: boolean): string {
  const evidence = `${claimsCount >= 10 ? `청구항 ${claimsCount}건` : "청구항 구성"}, ${hasData ? "실험 수치" : "실시예"}${multiIpc ? ", 복수 IPC 적용성" : ""}`;
  if (score >= 80) return `${evidence}이 확인돼 기술 완성도는 일정 수준 이상으로 평가되어 ${score}점대에 해당한다. 다만 선행기술 대비 차별성을 더 선명히 하려면 비교실험·재현 데이터 보강이 필요하다.`;
  if (score >= 70) return `${evidence}은 확인되지만 차별성·재현성 근거가 제한적이어서 ${score}점대 보통 수준으로 평가된다. 80점대 진입에는 비교예와 진보성 근거의 구체화가 추가로 요구된다.`;
  return `청구항과 실시예만으로는 검증 근거가 부족해 기술성은 ${score}점대로 평가된다. 점수 상향을 위해서는 비교예 확보와 반복 실험·진보성 서술 보완이 필요하다.`;
}

function makeTrlFallback(trl: number): string {
  if (trl <= 2) return `원리·개념 서술 중심으로 실험 검증 근거가 확인되지 않아 TRL ${trl}로 판단되며, 단편 실험 데이터가 확보되어야 다음 단계로 진입할 수 있다.`;
  if (trl === 3) return `핵심 원리에 대한 단편 실험은 확인되지만 반복 데이터와 구성요소 검증이 부족해 TRL 3으로 판단되며, 실험실 수준의 정량 데이터 누적이 필요하다.`;
  if (trl === 4) return `실험실 수준의 수치 데이터와 구성요소 검증이 확인돼 TRL 4로 판단되며, 모사 환경의 통합 실시예가 보강되면 5단계로 진입 가능하다.`;
  if (trl === 5) return `모사 환경에서의 통합 실시예와 복수 구성 검증이 확인돼 TRL 5로 판단되며, 파일럿·시작품 단계의 현장 적용 사례가 추가되면 6단계로 올라설 수 있다.`;
  if (trl === 6) return `시작품·파일럿 또는 현장 적용 사례가 제시돼 TRL 6으로 판단되며, 실환경 운영 데이터가 누적되어야 상용화 단계인 7로 진입할 수 있다.`;
  if (trl === 7) return `실환경 적용 또는 상용화 언급이 확인돼 TRL 7로 판단되며, 기존 설비 기반의 안정적 양산·유통 근거가 확보되면 8단계로 인정 가능하다.`;
  if (trl === 8) return `제조방법과 실시예가 구체적이고 기존 설비로 즉시 구현 가능한 수준이어서 TRL 8로 판단되며, 동일 형태의 시판이 확인되면 9단계로 평가된다.`;
  return `본 기술이 동일 형태로 시판·유통되는 근거가 확인돼 상용화 완료 단계인 TRL 9로 판단된다.`;
}

function makeMarketFallback(score: number): string {
  if (score >= 80) return `적용 산업과 수요처가 비교적 명확하고 차별적 우위가 본문에 드러나 시장성은 ${score}점대로 평가된다. 다만 실제 구매 수요와 경쟁 대체재 검증이 보강되어야 상위 점수대 진입이 가능하다.`;
  if (score >= 70) return `관련 산업 적용성은 확인되지만 수요 규모와 차별적 구매 요인이 제한적이어서 시장성은 ${score}점대 보통 수준으로 평가된다. 목표 시장을 좁혀 차별점을 구체화하면 점수 상향 여지가 있다.`;
  return `적용처가 협소하거나 수요 근거가 부족해 시장성은 ${score}점대로 평가된다. 점수 개선을 위해서는 수요처·활용 시나리오와 차별적 우위를 본문에서 명확히 제시해야 한다.`;
}

function makeBusinessFallback(score: number): string {
  if (score >= 80) return `기존 공정·설비 활용 여지가 있고 인허가 장벽이 낮아 사업성은 ${score}점대로 평가된다. 기술이전 조건 정비와 초기 수요처 확보가 마무리되면 상용화 속도를 더 끌어올릴 수 있다.`;
  if (score >= 70) return `구현 가능성은 확인되지만 양산 조건과 투자회수 근거가 부족해 사업성은 ${score}점대 보통 수준으로 평가된다. 파일럿 단가 검증과 라이선싱 수요 구체화가 점수 상향의 관건이다.`;
  return `공정·비용·수요처 근거가 부족해 사업성은 ${score}점대로 평가된다. 점수 상향을 위해서는 후속 실증과 기술이전 전략, 단가 경쟁력 분석 보완이 필요하다.`;
}

function normalizeReason(value: unknown, fallback: string): string {
  if (looksLikePatentSummary(value) || isIncompleteSentence(value)) return fallback;
  return ensureCompleteSentence(value, fallback);
}

function makeAnalysisFallback(scores: any): string {
  const techScore = Number(scores.technologyScore) || 65;
  const marketScore = Number(scores.marketScore) || 65;
  const tech = techScore >= 80 ? "기술 검증 근거는 양호하고" : techScore >= 70 ? "기술 근거는 일부 확보됐지만" : "기술 근거는 보완이 필요하지만";
  const market = marketScore >= 80 ? "시장 적용성은 기대된다" : marketScore >= 70 ? "시장 적용성은 보통이다" : "시장 적용성은 더 확인해야 한다";
  const action = scores.businessScore >= 75 ? "상용화는 적용처 검증과 이전 전략이 관건이다" : "후속 실증과 수요처 검증이 필요하다";
  return `${tech} ${market}. ${action}.`;
}

function normalizeAnalysis(value: unknown, fallback: string): string {
  let text = cleanKoreanText(value);
  const sentenceCount = (text.match(/[.!?。]/g) || []).length;
  // analysis는 요약서를 압축한 결과이므로 발명 어투 검출은 적용하지 않음(요약서 용어 그대로 포함될 수 있음).
  if (isIncompleteSentence(text) || sentenceCount < 2) return fallback;
  // 길이 상한은 여유롭게(요약을 두 문장으로 압축한 결과)
  if (text.length > 220) {
    const sentences = text.match(/[^.!?。]+[.!?。]+/g);
    if (sentences && sentences.length >= 2) text = sentences.slice(0, 2).join(" ").trim();
  }
  const sentences = text.match(/[^.!?。]+[.!?。]+/g);
  if (sentences && sentences.length > 2) text = sentences.slice(0, 2).join(" ");
  return ensureCompleteSentence(text, fallback);
}

// ============ 한글 조사 자동 교정 ============
// 마지막 한글 글자에 받침이 있는지 판별해 은/는, 이/가, 을/를, 와/과, 으로/로 등을 올바른 형태로 보정.
function hasJongseong(ch: string): boolean | null {
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null; // not a Hangul syllable
  return ((code - 0xac00) % 28) !== 0;
}
function jongseongIsRieul(ch: string): boolean {
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return ((code - 0xac00) % 28) === 8; // ㄹ
}
export function fixKoreanParticles(input: string): string {
  if (!input) return input;
  // 한글 글자 뒤에 오는 조사 쌍을 받침 유무에 따라 교정.
  // 경계: 뒤가 공백/구두점/문장끝/한자/영문/숫자가 아닌 한글이면 단어 일부일 수 있어 보수적으로 처리.
  const PAIRS: Array<[RegExp, (jong: boolean, isRieul: boolean) => string]> = [
    // 은/는
    [/([\uac00-\ud7a3])(은|는)(?=[\s.,!?;:)\]\}"'’”·…\-]|$)/g, (j) => (j ? "은" : "는")],
    // 이/가
    [/([\uac00-\ud7a3])(이|가)(?=[\s.,!?;:)\]\}"'’”·…\-]|$)/g, (j) => (j ? "이" : "가")],
    // 을/를
    [/([\uac00-\ud7a3])(을|를)(?=[\s.,!?;:)\]\}"'’”·…\-]|$)/g, (j) => (j ? "을" : "를")],
    // 와/과
    [/([\uac00-\ud7a3])(와|과)(?=[\s.,!?;:)\]\}"'’”·…\-]|$)/g, (j) => (j ? "과" : "와")],
    // 으로/로 (ㄹ받침은 '로')
    [/([\uac00-\ud7a3])(으로|로)(?=[\s.,!?;:)\]\}"'’”·…\-]|$)/g, (j, r) => (j && !r ? "으로" : "로")],
    // 이라/라, 이며/며, 이고/고, 이나/나, 이란/란 (받침 있을 때 '이' 형태)
    [/([\uac00-\ud7a3])(이라|라)(?=[\s.,!?;:)\]\}"'’”·…\-]|$)/g, (j) => (j ? "이라" : "라")],
    [/([\uac00-\ud7a3])(이며|며)(?=[\s.,!?;:)\]\}"'’”·…\-]|$)/g, (j) => (j ? "이며" : "며")],
    [/([\uac00-\ud7a3])(이고|고)(?=[\s.,!?;:)\]\}"'’”·…\-]|$)/g, (j) => (j ? "이고" : "고")],
  ];
  let out = input;
  for (const [re, pick] of PAIRS) {
    out = out.replace(re, (_m, ch: string, _p: string) => {
      const jong = hasJongseong(ch);
      if (jong === null) return _m; // not Hangul, leave as-is
      const rieul = jongseongIsRieul(ch);
      return ch + pick(jong, rieul);
    });
  }
  return out;
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
    const { patentNumber, patentData, summaryContent } = body;

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
    const summaryText = typeof summaryContent === "string"
      ? summaryContent.replace(/\s+/g, " ").trim().slice(0, 3500)
      : "";

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
    // 근거/분석 문구는 UI에서 잘리지 않도록 짧은 완결문으로 제한
    const baseRanges = isDetailedScore
      ? { reason: [45, 70], trl: [55, 85], analysis: [50, 80] }
      : { reason: [35, 55], trl: [45, 70], analysis: [45, 75] };

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
    if (summaryText) {
      patentContext += `\n\n[AI 요약서 본문 — analysis 필드는 반드시 이 내용을 압축·정리할 것]\n${summaryText}`;
    }

    // System prompt - richer for detailed mode
    const systemPrompt = isDetailedScore
      ? `특허 기술사업화 평가 전문가. JSON으로만 응답.

결정론적 채점 절차(반드시 이 순서/규칙대로):
모든 항목은 기본점 60에서 시작해, 아래 체크리스트의 증거 유무에 따라 가점/감점을 합산해 산출한다. 동일 입력은 항상 동일 점수가 나와야 한다. 추정·확률·"느낌"으로 점수를 흔들지 말 것.

[기술성 T] 시작 60
 +5 청구항 수 ≥ 10
 +5 청구항 수 ≥ 20
 +5 실시예 1건 이상 명시
 +5 실험데이터·수치결과 명시(수율, 효율, 효능 등)
 +5 비교예/대조군 존재
 +5 IPC 서브클래스 2개 이상(다분야 융합)
 +5 선행기술 대비 구체적 진보성 서술
 -5 청구항 수 ≤ 3
 -5 실시예·데이터 전무(개념만 서술)
상한 95, 하한 55.

[시장성 M] 시작 60
 +5 IPC 메인그룹이 소비재/식품/생활용품/농축산물(A21~A24, A01, A47 등)
 +5 동일 카테고리에 이미 유통 중인 유사 제품군 존재(떡·빵·음료·면·발효식품·기능성식품 등)
 +5 복수 산업·복수 용도 적용 가능(IPC 다른 섹션 2개 이상)
 +5 수요처가 일반 소비자(B2C)로 명확
 +5 차별적 우위(천연·친환경·기능성·간편화 등)가 본문에 구체 서술
 +5 농가·중소기업이 직접 활용 가능한 응용 제품
 -5 적용 산업이 단일·협소
 -5 차별점이 본문에 드러나지 않음
상한 95, 하한 55.

[사업성 B] 시작 60
 +5 기존 설비·공정으로 구현 가능
 +5 제조방법 단계가 본문에 구체적으로 기술
 +5 원료·재료가 시중 조달 가능
 +5 인허가·규제 장벽이 낮은 식품/생활용품 범주
 +5 라이선싱·기술이전 수요가 명확한 농가/중소기업 대상
 +5 양산 시 단가 경쟁력 또는 초기 투자 규모가 작음
 -5 고가 특수설비·임상시험 등 진입장벽 큰 분야
 -5 후속 R&D가 추가로 크게 필요
상한 95, 하한 55.

총점 = round(T×0.35 + M×0.35 + B×0.30). 세 항목은 위 체크리스트로 산출된 값을 그대로 사용하며, 임의 보정 금지.
세 항목 간 편차 5점 이상이 자연스러우나 강제하지 않음(체크리스트 결과를 우선).

점수-근거 정합성(필수): 위 체크리스트로 산출된 점수와 근거 텍스트의 톤이 반드시 일치할 것.
- 근거에 "우수/탁월/광범위/독보적/높은 경쟁력/검증된 시장/수요 명확/즉시 상용화/높은 확장성" 등 강한 긍정 표현이 포함되면 해당 항목 점수는 80점 이상이어야 한다.
- 근거에 "매우 우수/독보적/시장 검증 완료/광범위한 산업 적용" 등 최상급 표현이 포함되면 85점 이상이어야 한다.
- 점수가 70~79이면 근거에는 "보통/일부 한계/제한적 차별성" 등 중립~온건한 표현만 사용할 것.

TRL(1-9) 결정론적 판정 규칙(아래 조건 중 충족되는 가장 높은 단계 하나만 선택, 출원 경과연수는 반영하지 않음):
 TRL 2: 개념·원리만 서술, 실험 전무
 TRL 3: 핵심 원리에 대한 단편적 실험·시뮬레이션 1건
 TRL 4: 실험실 수준 데이터(수치·표) 다수, 구성요소 검증
 TRL 5: 모사 환경에서의 통합 실험·실시예 다수
 TRL 6: 실증·파일럿·시작품 명시(현장·필드 적용 사례)
 TRL 7: 실환경 운영 데이터 또는 상용화 언급
 TRL 8: 제조방법·실시예가 구체적이고 기존 설비로 즉시 구현 가능, 또는 이미 유통 중인 카테고리(떡·빵·음료·면·발효식품·기능성식품·가공식품 등)
 TRL 9: 본 특허 기술이 동일 형태로 시판·유통 중임이 명확

주의: 시장 규모·성장률 등 특허 문서에 없는 외부 데이터를 추측하여 근거로 제시하지 말 것. IPC 분류와 기술 특성에서 추론 가능한 산업 적용성만 평가할 것.

analysis 필드 작성 규칙(매우 중요):
- 사용자 메시지 끝에 제공된 [AI 요약서 본문]을 압축·정리한 결과로 작성. 요약서에 없는 새로운 주장·수치·시장 평가를 추가하지 말 것.
- 요약서가 강조한 핵심(문제·해결방식·차별성·활용처·기대효과)을 같은 흐름으로 요약하되, 발명 서술 어투("~에 관한 것이다 / ~포함한다 / ~방법이다")는 평가·전망 평어체("~다 / ~할 만하다 / ~가 기대된다 / ~가 관건이다")로 다듬을 것.
- 정확히 2문장(${analysisMin}~${analysisMax}자). 첫 문장은 요약서가 짚은 기술 강점과 활용 가능성을, 둘째 문장은 요약서가 언급한 사업화 유의점·기대효과를 압축.
- 요약서가 비어있거나 매우 짧을 때만 특허 데이터로 보완. 항목 라벨(①②③, "강점:", "제언:")·"매우/굉장히/다양한" 남발 금지.

technologyReason 작성 규칙(매우 중요):
- 특허 기능·성분·작용을 그대로 요약하지 말 것. "본 발명은...", "~을 분리하였다", "~을 확인하였다" 같은 초록 복사 어투 금지.
- 반드시 아래 3단 흐름으로 작성(평가결과와 코멘트의 비약 방지):
  1) 확인된 증거 명시(청구항 수·실시예·실험 수치·비교예·IPC 범위 중 실제 본문에서 확인된 것).
  2) "그래서 기술성은 산출된 점수대(예: 70점대/80점대)로 평가된다"는 식으로 점수 도달 근거를 명시적으로 연결.
  3) 부족한 증거(또는 상위 점수대 진입에 필요한 보완점)를 짧게 서술.
- 정확히 2문장. 마지막은 반드시 "다."로 종료.

trlReason 작성 규칙(매우 중요):
- 정확히 1문장(${trlMin}~${trlMax}자). 아래 흐름을 한 문장에 자연스럽게 녹일 것:
  "[본문에서 확인된 검증 단계 근거] → 따라서 TRL n으로 판단되며 → [상위 단계 진입에 필요한 추가 근거 한 가지]."
- 라벨식 단답("실험실데이터 다수") 금지. 마지막은 반드시 "TRL n으로 판단된다." 또는 "TRL n 수준이다."를 포함하되 그 뒤에 보완 요건을 이어 붙여도 됨.

businessReason 작성 규칙(중요):
- 발명/조성물 구성 설명 금지.
- 3단 흐름 필수: (1) 확인된 사업화 근거(기존 설비 활용성·제조방법 구체성·인허가 장벽·라이선싱 수요 등) → (2) "그래서 사업성은 산출된 점수대로 평가된다" 식으로 산출 점수대(70점대/80점대 등)를 문장 안에 명시 → (3) 점수 상향을 위한 보완점(파일럿·단가 검증·이전 전략 등).
- 정확히 2문장. 평가 어투로만 서술.

marketReason 작성 규칙(중요):
- 3단 흐름 필수: (1) IPC·수요처·차별적 우위 등 본문에서 확인된 시장 근거 → (2) 산출 점수대(예: 70점대/80점대)를 문장 안에 명시해 "그래서 시장성은 ~점대로 평가된다" 식으로 연결 → (3) 상위 점수대 진입에 필요한 보완점(수요 검증·경쟁 대체재 분석 등).
- 정확히 2문장. 시장규모 추정 등 외부 데이터 금지.

JSON형식:
{"technologyScore":72,"marketScore":65,"businessScore":78,"totalScore":71,"trl":6,"trlReason":"${trlMin}~${trlMax}자 상세근거: 기술 완성도, 실증 수준, 상용화 단계를 구체적으로 서술","analysis":"${analysisMin}~${analysisMax}자 종합평가(발명요약 금지, 평가·전망 어투): 기술적 차별성·강점, 시장 진입 가능성, 사업화 리스크, 추진 전략 제언을 종합 서술","technologyReason":"${reasonMin}~${reasonMax}자: 청구항 독창성, 실시예 구체성, 선행기술 대비 진보성을 간결하게 분석","marketReason":"${reasonMin}~${reasonMax}자: IPC 기반 산업 적용 범위, 차별적 우위, 확장 가능성을 간결하게 분석","businessReason":"${reasonMin}~${reasonMax}자: 기술구현 난이도, 라이선싱·투자회수 가능성을 간결하게 분석"}`
       : `특허 기술사업화 평가 전문가. JSON으로만 응답.

결정론적 채점(체크리스트 합산, 동일 입력→동일 점수, 추정 금지):
[기술성 T] 시작 60
 +5 청구항 ≥ 10, +5 청구항 ≥ 20, +5 실시예 명시, +5 실험데이터·수치 명시, +5 비교예 존재, +5 IPC 서브클래스 2+, +5 진보성 구체 서술
 -5 청구항 ≤ 3, -5 실시예·데이터 전무
 상한 95, 하한 55
[시장성 M] 시작 60
 +5 IPC가 소비재·식품·생활용품·농축산물(A21~A24, A01, A47), +5 유사 제품군 이미 유통, +5 복수 산업 적용, +5 B2C 수요 명확, +5 차별적 우위 구체 서술, +5 농가·중소기업 직접 활용 가능
 -5 적용 산업 단일·협소, -5 차별점 불명확
 상한 95, 하한 55
[사업성 B] 시작 60
 +5 기존 설비 구현, +5 제조방법 구체, +5 원료 시중 조달 가능, +5 인허가 장벽 낮음, +5 라이선싱·이전 수요 명확, +5 단가 경쟁력·낮은 초기투자
 -5 고가 특수설비·임상 필요, -5 후속 R&D 다량 필요
 상한 95, 하한 55
총점 = round(T×0.35 + M×0.35 + B×0.30). 임의 보정 금지.

TRL(1-9) 결정론적 판정(충족되는 가장 높은 단계 하나만, 경과연수 미반영):
 2:개념만 / 3:단편실험 / 4:실험실데이터 다수 / 5:통합실시예 다수 / 6:실증·파일럿 / 7:실환경 운영 또는 상용화 언급 / 8:제조방법 구체+기존설비 구현 또는 유통중 카테고리 / 9:동일형태 시판 중

점수-근거 정합성(필수): 강한 긍정 표현("우수/탁월/광범위/독보적/검증된 시장/수요 명확") → 80+, 최상급("매우 우수/독보적") → 85+. 70~79대 점수는 "보통/일부 한계" 등 중립 표현만.

주의: 특허문서에 없는 시장규모 등 외부데이터 추측 금지. IPC·기술특성 기반 산업적용성만 평가.

analysis 필드 작성 규칙(중요):
- 사용자 메시지의 [AI 요약서 본문]을 압축·정리한 결과로 작성. 요약서에 없는 내용 추가 금지.
- 요약서의 흐름(기술 강점·차별성·활용처·기대효과·유의점)을 따라 평어체("~다/~가 기대된다/~가 관건이다")로 정리. 발명 서술 어투 금지.
- 정확히 2문장(${analysisMin}~${analysisMax}자). 첫 문장: 요약서가 짚은 강점+활용 가능성, 둘째 문장: 요약서가 언급한 유의점·기대효과. 항목 라벨/번호 금지.
- 요약서가 비어있거나 매우 짧을 때만 특허 데이터로 보완.

technologyReason 규칙: 특허 기능·성분·작용 요약 금지. 청구항 구체성, 실험/수치 데이터, 재현성, 선행기술 대비 차별성 기준의 평가문으로만 작성하고 반드시 완결문으로 끝낼 것.
trlReason 규칙: 라벨 금지. 정확히 1문장(${trlMin}~${trlMax}자)으로 왜 해당 TRL인지 쓰고 반드시 "TRL n으로 판단된다." 또는 "TRL n 수준이다."로 끝낼 것.

businessReason 규칙: 발명·조성물 구성 설명 금지("~을 유효성분으로 포함하는 조성물을 개발할 수 있다" 류 금지). 구현 난이도, 기존 설비 활용성, 라이선싱·이전 용이성, 투자회수 관점의 평가 어투로만 작성.

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
          temperature: 0,
          top_p: 0.1,
          seed: 42,
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
    const finishReason = result.choices?.[0]?.finish_reason || result.choices?.[0]?.finishReason || result.candidates?.[0]?.finishReason;
    const tokenLimitHit = typeof finishReason === "string" && /length|max_tokens|max_output_tokens/i.test(finishReason);
    if (tokenLimitHit) {
      console.warn(`[AI] output may be truncated for ${trimmedPatent}: finishReason=${finishReason}, max_tokens=${scoreMaxTokens}`);
    }
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
    const STRONG_POS = /(우수|뛰어|탁월|광범위|높은\s*경쟁력|차별적\s*우위|검증된\s*시장|수요[가\s]*명확|높은\s*확장|상용화\s*용이|즉시\s*적용|구현\s*가능성[이가]?\s*(?:매우\s*)?높|완성도[가이]?\s*(?:매우\s*)?높|차별성[이가]?\s*(?:매우\s*)?높|확장성[이가]?\s*(?:매우\s*)?높|상용화\s*가능성[이가]?\s*(?:매우\s*)?높|기술[적성]?\s*완성도[가이]?\s*(?:매우\s*)?높)/;
    const enforceConsistency = (score: number, reason: string): number => {
      if (!reason || typeof score !== "number") return score;
      if (STRONG_TOP.test(reason) && score < 85) return 85;
      if (STRONG_POS.test(reason) && score < 80) return 80;
      return score;
    };
    // 거꾸로: 점수가 보통/낮은데 문구가 과도하게 단정적이면 어조를 완화.
    const softenIfOverclaim = (score: number, reason: string): string => {
      if (!reason || typeof score !== "number") return reason;
      if (score >= 78) return reason;
      let out = reason;
      // "~가 매우 높다 / 매우 우수하다" 등을 보통 수준 어조로 치환
      out = out.replace(/매우\s*(높|우수|뛰어|탁월)/g, "일정 수준 $1");
      // "기술적 구현 가능성이 높다" → "기술적 구현 가능성은 보통 수준이다"
      out = out.replace(/(구현\s*가능성|완성도|차별성|확장성|상용화\s*가능성|경쟁력)([이가])?\s*높다/g, "$1은 보통 수준이다");
      out = out.replace(/(우수|탁월)하다/g, "양호하다");
      out = out.replace(/(뛰어나다|뛰어남)/g, "안정적이다");
      return out;
    };
    const beforeMarket = scores.marketScore;
    scores.technologyScore = enforceConsistency(scores.technologyScore, scores.technologyReason || "");
    scores.marketScore = enforceConsistency(scores.marketScore, scores.marketReason || "");
    scores.businessScore = enforceConsistency(scores.businessScore, scores.businessReason || "");
    scores.technologyReason = softenIfOverclaim(scores.technologyScore, scores.technologyReason || "");
    scores.marketReason = softenIfOverclaim(scores.marketScore, scores.marketReason || "");
    scores.businessReason = softenIfOverclaim(scores.businessScore, scores.businessReason || "");
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

    // 문구 후처리: 초록 복사/중단 문장을 UI에 저장하지 않도록 완결된 평가문으로 보정
    const normalizedTrl = Math.max(1, Math.min(9, Number(scores.trl) || 5));
    const hasDataEvidence = /실험|데이터|수치|효능|효율|수율|비교예|대조군/.test(`${data.abstract || ""} ${data.description || ""} ${(data.claims || []).join(" ")}`);
    const multiIpcEvidence = ipcSections.size >= 2 || (data.classifications || []).length >= 2;
    const techFallback = makeTechnologyFallback(Number(scores.technologyScore) || 65, claimsCount, hasDataEvidence, multiIpcEvidence);
    const marketFallback = makeMarketFallback(Number(scores.marketScore) || 65);
    const businessFallback = makeBusinessFallback(Number(scores.businessScore) || 65);
    scores.trl = normalizedTrl;
    scores.technologyReason = normalizeReason(scores.technologyReason, techFallback);
    scores.marketReason = normalizeReason(scores.marketReason, marketFallback);
    scores.businessReason = normalizeReason(scores.businessReason, businessFallback);
    scores.trlReason = ensureCompleteSentence(scores.trlReason, makeTrlFallback(normalizedTrl));
    scores.analysis = normalizeAnalysis(scores.analysis, makeAnalysisFallback(scores));

    // 한글 조사(은/는, 이/가, 을/를, 와/과, 으로/로 등) 교정
    scores.technologyReason = fixKoreanParticles(scores.technologyReason);
    scores.marketReason = fixKoreanParticles(scores.marketReason);
    scores.businessReason = fixKoreanParticles(scores.businessReason);
    scores.trlReason = fixKoreanParticles(scores.trlReason);
    scores.analysis = fixKoreanParticles(scores.analysis);

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
