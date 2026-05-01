import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface ComparisonRow {
  axis: string;
  current: string;
  currentStrength: "strong" | "medium" | "weak";
  competitors: string[];
  competitorStrengths: ("strong" | "medium" | "weak")[];
  advantage: "current" | "competitor" | "neutral";
}

interface ComparisonResult {
  rows: ComparisonRow[];
  summary: string;
  competitors: Array<{ patentId: string; title: string; assignee?: string; similarityScore: number }>;
}

function buildFallbackComparison(currentPatent: any, competitors: any[]): ComparisonResult {
  const currentText = `${currentPatent.titleKo || currentPatent.title || ""} ${currentPatent.abstract || ""} ${(currentPatent.classifications || []).join(" ")}`;
  const competitorTexts = competitors.map((p: any) => `${p.titleKo || p.title || ""} ${p.snippet || p.abstract || ""}`);
  const hasAny = (text: string, words: string[]) => words.some((word) => text.includes(word));
  const score = (text: string, words: string[]) => hasAny(text, words) ? "strong" : text.length > 80 ? "medium" : "weak";
  const makeCompetitorCells = (words: string[], fallback: string) => competitorTexts.map((text) => hasAny(text, words) ? fallback : "관련 기술 요소 일부 공유");

  const rows: ComparisonRow[] = [
    {
      axis: "핵심 기술 방식",
      current: hasAny(currentText, ["제어", "장치", "시스템", "방법"]) ? "구체적 구현수단 중심" : "기술 구성 중심",
      currentStrength: score(currentText, ["제어", "장치", "시스템", "방법"]),
      competitors: makeCompetitorCells(["제어", "장치", "시스템", "방법"], "유사 구현수단 보유"),
      competitorStrengths: competitorTexts.map((text) => score(text, ["제어", "장치", "시스템", "방법"])),
      advantage: "neutral",
    },
    {
      axis: "적용 분야/용도",
      current: hasAny(currentText, ["농", "식품", "재배", "스마트팜"]) ? "농식품 적용성 명확" : "특정 용도 중심",
      currentStrength: score(currentText, ["농", "식품", "재배", "스마트팜"]),
      competitors: makeCompetitorCells(["농", "식품", "재배", "스마트팜"], "농산업 활용 가능"),
      competitorStrengths: competitorTexts.map((text) => score(text, ["농", "식품", "재배", "스마트팜"])),
      advantage: "neutral",
    },
    {
      axis: "차별적 효과",
      current: hasAny(currentText, ["효과", "향상", "개선", "증가", "감소"]) ? "개선 효과 제시" : "효과 검증 필요",
      currentStrength: score(currentText, ["효과", "향상", "개선", "증가", "감소"]),
      competitors: makeCompetitorCells(["효과", "향상", "개선", "증가", "감소"], "효과 주장 일부 존재"),
      competitorStrengths: competitorTexts.map((text) => score(text, ["효과", "향상", "개선", "증가", "감소"])),
      advantage: "neutral",
    },
    {
      axis: "구현 복잡도",
      current: hasAny(currentText, ["복합", "플랫폼", "센서", "알고리즘"]) ? "복합 구현 필요" : "구현 난도 보통",
      currentStrength: score(currentText, ["구성", "단계", "플랫폼", "센서"]),
      competitors: makeCompetitorCells(["구성", "단계", "플랫폼", "센서"], "구현 요소 확인"),
      competitorStrengths: competitorTexts.map((text) => score(text, ["구성", "단계", "플랫폼", "센서"])),
      advantage: "neutral",
    },
    {
      axis: "상용화 가능성",
      current: currentPatent.assignee ? "공공 기술이전 가능" : "사업화 검토 필요",
      currentStrength: currentPatent.assignee ? "medium" : "weak",
      competitors: competitors.map((p: any) => p.assignee ? "기관 보유 기술" : "권리자 확인 필요"),
      competitorStrengths: competitors.map((p: any) => p.assignee ? "medium" : "weak"),
      advantage: "neutral",
    },
  ];

  return {
    rows,
    summary: "AI 정밀 비교가 지연되어 특허 제목·초록·분류 기반의 보조 비교 결과를 표시했습니다. 유사 특허의 기술 키워드와 적용 분야를 기준으로 차별점을 우선 검토할 수 있습니다.",
    competitors: competitors.map((p: any, i: number) => ({
      patentId: p.patentId || p.patentNumber || "",
      title: p.title || p.titleKo || "유사 특허",
      assignee: p.assignee,
      similarityScore: Math.max(55, 78 - i * 8),
    })),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { currentPatent, competitorPatents } = await req.json();
    if (!currentPatent || !Array.isArray(competitorPatents) || competitorPatents.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "비교할 특허 데이터가 부족합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplicate: remove competitors that match the current patent number
    const normalizeNum = (s: string) => (s || "").replace(/[^0-9]/g, "");
    const currentNum = normalizeNum(currentPatent.patentNumber || currentPatent.displayNumber || currentPatent.applicationNumber || "");
    const filtered = competitorPatents.filter((p: any) => {
      const pn = normalizeNum(p.patentId || p.patentNumber || "");
      if (!pn || !currentNum) return true;
      return !(pn.includes(currentNum) || currentNum.includes(pn));
    });
    const top3 = filtered.slice(0, 3);
    if (top3.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "비교할 유사 특허가 없습니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const cacheKey = `cmp_v2_${currentPatent.patentNumber || currentPatent.displayNumber || ""}_${top3.map((p: any) => p.patentId).join("_")}`;

    // Cache check
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    try {
      const { data: cached } = await supabase
        .from("patent_ai_cache")
        .select("summary_content")
        .eq("patent_number", cacheKey)
        .eq("analysis_mode", "comparison")
        .maybeSingle();
      if (cached?.summary_content) {
        try {
          const parsedCache = JSON.parse(cached.summary_content);
          if (!parsedCache?.success || !Array.isArray(parsedCache.rows) || parsedCache.rows.length === 0 || !Array.isArray(parsedCache.competitors) || parsedCache.competitors.length === 0) {
            throw new Error("invalid cached comparison");
          }
        } catch {
          throw new Error("invalid cached comparison");
        }
        return new Response(cached.summary_content, {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (_) { /* ignore invalid/missing cache */ }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      const fallback = buildFallbackComparison(currentPatent, top3);
      return new Response(JSON.stringify({ success: true, fallback: true, ...fallback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fmtPatent = (p: any, label: string) => {
      const parts: string[] = [`【${label}】`];
      parts.push(`번호: ${p.patentNumber || p.patentId || p.displayNumber || ""}`);
      if (p.title || p.titleKo) parts.push(`명칭: ${p.titleKo || p.title}`);
      if (p.assignee) parts.push(`출원인: ${p.assignee}`);
      if (p.abstract) parts.push(`초록: ${(p.abstract || "").substring(0, 220)}`);
      else if (p.snippet) parts.push(`요약: ${(p.snippet || "").substring(0, 180)}`);
      if (p.classifications?.length) parts.push(`IPC: ${p.classifications.slice(0, 3).join(", ")}`);
      return parts.join("\n");
    };

    const ctx = [
      fmtPatent(currentPatent, "분석 대상"),
      ...top3.map((p: any, i: number) => fmtPatent(p, `경쟁 특허 ${i + 1}`)),
    ].join("\n\n");

    const systemPrompt = `한국 특허 비교 분석 전문가. 분석 대상 vs 경쟁 ${top3.length}건.
JSON만 출력. 평가 축 4개 고정:
1. 핵심 기술 방식
2. 차별적 효과
3. 적용 분야
4. 상용화 가능성

각 셀: 10~20자 짧은 구문. strength: strong/medium/weak.
advantage: current(분석대상우위) | competitor(경쟁우위) | neutral.
similarityScore: 각 경쟁 0~100 정수.

형식:
{"rows":[{"axis":"핵심 기술 방식","current":"...","currentStrength":"strong","competitors":["...","...","..."],"competitorStrengths":["medium","weak","strong"],"advantage":"current"}],"competitorSimilarities":[85,72,60],"summary":"분석 대상의 핵심 우위 1~2문장"}`;

    const aiResp = await fetchWithTimeout(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: ctx },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1200,
          temperature: 0.3,
        }),
      },
      30000,
    );

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI compare error:", aiResp.status, t);
      const fallback = buildFallbackComparison(currentPatent, top3);
      return new Response(JSON.stringify({ success: true, fallback: true, ...fallback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    let parsed: { rows: ComparisonRow[]; summary: string; competitorSimilarities?: number[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      try {
        parsed = m ? JSON.parse(m[0]) : { rows: [], summary: "" };
      } catch {
        const fallback = buildFallbackComparison(currentPatent, top3);
        return new Response(JSON.stringify({ success: true, fallback: true, ...fallback }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!Array.isArray(parsed.rows) || parsed.rows.length === 0) {
      const fallback = buildFallbackComparison(currentPatent, top3);
      return new Response(JSON.stringify({ success: true, fallback: true, ...fallback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sims = parsed.competitorSimilarities || [];
    const result: ComparisonResult = {
      rows: (parsed.rows || []).map((r: any) => ({
        axis: r.axis || "",
        current: r.current || "",
        currentStrength: r.currentStrength || "medium",
        competitors: r.competitors || [],
        competitorStrengths: r.competitorStrengths || ["medium", "medium", "medium"],
        advantage: r.advantage || "neutral",
      })),
      summary: parsed.summary || "",
      competitors: top3.map((p: any, i: number) => ({
        patentId: p.patentId || p.patentNumber || "",
        title: p.title || p.titleKo || "",
        assignee: p.assignee,
        similarityScore: typeof sims[i] === "number" ? Math.max(0, Math.min(100, sims[i])) : 70,
      })),
    };

    const responseBody = JSON.stringify({ success: true, ...result });

    // Cache
    try {
      await supabase.from("patent_ai_cache").upsert({
        patent_number: cacheKey,
        analysis_mode: "comparison",
        summary_content: responseBody,
      }, { onConflict: "patent_number,analysis_mode" });
    } catch (_) { /* ignore */ }

    return new Response(responseBody, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("compare-patents error:", error);
    return new Response(JSON.stringify({ success: false, error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
