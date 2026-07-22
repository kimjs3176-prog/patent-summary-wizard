import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callGemini(prompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-lite",
      messages: [
        { role: "system", content: "당신은 한국어 특허·과학기술 용어 사전 편집자입니다. 반드시 JSON만 반환하고 코드펜스를 쓰지 마세요." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  if (!r.ok) throw new Error(`AI failed ${r.status}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}

function extractJson(text: string): any {
  if (!text) return null;
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { content, title } = await req.json();
    if (!content || typeof content !== "string") {
      return new Response(JSON.stringify({ success: false, error: "content required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = content.slice(0, 6000);
    const prompt = `다음 특허 요약문에서 일반인이 바로 이해하기 어려운 전문·학술 용어를 추출해줘.

[특허 제목] ${title || ""}
[요약 본문]
${trimmed}

요구사항:
- 실제로 요약문에 등장하는 표현만 사용 (원문 그대로의 표기)
- 전문 학술어, 과학·공학 개념, 산업 특수용어, 약어(영문 대문자 3~5자), 학명, 화학·생물 용어 우선
- 일반적으로 널리 쓰이는 단어(예: 방법, 시스템, 장치, 사용, 개발, 문제, 효과)는 제외
- 이미 문맥 자체로 쉽게 이해되는 단어는 제외
- 각 용어의 정의는 1~2문장, 60자 이내, 존댓말 없이 간결한 서술
- 정의는 특허 맥락과 무관하게 일반적이고 사전적인 뜻으로 작성
- 15개 이내, 중요도 순

JSON 형식:
{ "terms": [ { "term": "용어", "definition": "정의" } ] }`;

    const raw = await callGemini(prompt);
    const parsed = extractJson(raw) || { terms: [] };
    const list = Array.isArray(parsed.terms) ? parsed.terms : [];
    const glossary: Record<string, string> = {};
    for (const it of list) {
      const term = String(it?.term ?? "").trim();
      const def = String(it?.definition ?? "").trim();
      if (!term || !def) continue;
      if (term.length < 2 || term.length > 40) continue;
      // Must literally appear in the source content
      if (!trimmed.includes(term)) continue;
      if (glossary[term]) continue;
      glossary[term] = def;
      if (Object.keys(glossary).length >= 20) break;
    }

    return new Response(JSON.stringify({ success: true, glossary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-glossary error", e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});