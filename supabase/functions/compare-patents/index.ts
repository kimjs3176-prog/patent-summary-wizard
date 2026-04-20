import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
        return new Response(cached.summary_content, {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (_) { /* ignore */ }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "AI 서비스가 설정되지 않았습니다." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fmtPatent = (p: any, label: string) => {
      const parts: string[] = [`【${label}】`];
      parts.push(`번호: ${p.patentNumber || p.patentId || p.displayNumber || ""}`);
      if (p.title || p.titleKo) parts.push(`명칭: ${p.titleKo || p.title}`);
      if (p.assignee) parts.push(`출원인: ${p.assignee}`);
      if (p.abstract) parts.push(`초록: ${(p.abstract || "").substring(0, 400)}`);
      if (p.snippet) parts.push(`요약: ${(p.snippet || "").substring(0, 300)}`);
      if (p.classifications?.length) parts.push(`IPC: ${p.classifications.slice(0, 3).join(", ")}`);
      return parts.join("\n");
    };

    const ctx = [
      fmtPatent(currentPatent, "분석 대상"),
      ...top3.map((p: any, i: number) => fmtPatent(p, `경쟁 특허 ${i + 1}`)),
    ].join("\n\n");

    const systemPrompt = `한국 특허 비교 분석 전문가. 분석 대상 특허와 경쟁 특허 ${top3.length}건을 비교.
JSON 형식으로만 응답. 다른 텍스트 금지.

평가 축 (정확히 5개):
1. 핵심 기술 방식
2. 적용 분야/용도
3. 차별적 효과
4. 구현 복잡도
5. 상용화 가능성

각 축마다 분석 대상과 경쟁 특허들의 특징을 12~25자 이내 짧은 구문으로 비교.

각 셀(분석대상/경쟁)마다 "strength" 평가:
- "strong": 해당 축에서 명확한 우위/완성도가 높음
- "medium": 보통 수준
- "weak": 해당 축에서 약점/부재

advantage: 분석 대상이 우수하면 "current", 경쟁이 우수하면 "competitor", 동등하면 "neutral".

또한 각 경쟁 특허마다 분석 대상과의 기술적 유사도를 0~100 정수로 평가 (similarityScore).

응답 형식:
{
  "rows": [
    {
      "axis": "핵심 기술 방식",
      "current": "...", "currentStrength": "strong",
      "competitors": ["...","...","..."],
      "competitorStrengths": ["medium","weak","strong"],
      "advantage": "current"
    }
  ],
  "competitorSimilarities": [85, 72, 60],
  "summary": "분석 대상의 차별적 우위 2~3문장 요약"
}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: ctx },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "요청이 너무 많습니다." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await aiResp.text();
      console.error("AI compare error:", aiResp.status, t);
      return new Response(JSON.stringify({ success: false, error: "AI 비교 분석 오류" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    let parsed: { rows: ComparisonRow[]; summary: string; competitorSimilarities?: number[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { rows: [], summary: "" };
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
