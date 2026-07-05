import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegulationLaw {
  name: string;
  ministry?: string;
  effectiveDate?: string;
  lawId?: string;
  link?: string;
  reason?: string;
}

interface RegulationResult {
  keywords: string[];
  laws: RegulationLaw[];
  summary: string;
}

async function callGemini(prompt: string): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const payload = {
    model: "gemini-2.5-flash-lite",
    messages: [
      { role: "system", content: "You are a Korean regulatory expert. Reply strictly in JSON, no code fences." },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
  };

  if (GEMINI_API_KEY) {
    try {
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (r.ok) {
        const j = await r.json();
        return j.choices?.[0]?.message?.content ?? "";
      }
    } catch (_) { /* fallback */ }
  }

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, model: "google/gemini-2.5-flash-lite" }),
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

async function searchLaw(oc: string, query: string): Promise<RegulationLaw[]> {
  const url = `https://www.law.go.kr/DRF/lawSearch.do?OC=${encodeURIComponent(oc)}&target=law&type=JSON&display=5&query=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return [];
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { return []; }
    const rawLaws = data?.LawSearch?.law;
    if (!rawLaws) return [];
    const arr = Array.isArray(rawLaws) ? rawLaws : [rawLaws];
    return arr.slice(0, 3).map((l: any) => {
      const link = l["법령상세링크"];
      return {
        name: l["법령명한글"] || l["법령명"] || query,
        ministry: l["소관부처명"],
        effectiveDate: l["시행일자"] ? String(l["시행일자"]) : undefined,
        lawId: l["법령ID"] ? String(l["법령ID"]) : undefined,
        link: link ? `https://www.law.go.kr${link.startsWith("/") ? "" : "/"}${link}` : undefined,
      } as RegulationLaw;
    });
  } catch (e) {
    console.error("law.go.kr fetch error", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const OC = Deno.env.get("LAW_GO_KR_OC");
    if (!OC) {
      return new Response(JSON.stringify({ success: false, error: "LAW_GO_KR_OC not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { patentNumber, patentData } = await req.json();
    if (!patentNumber || !patentData) {
      return new Response(JSON.stringify({ success: false, error: "patentNumber and patentData required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const title = patentData.titleKo || patentData.title || "";
    const abstract = (patentData.abstract || "").slice(0, 1500);
    const claim0 = Array.isArray(patentData.claims) ? patentData.claims[0]?.slice(0, 800) || "" : "";

    const prompt = `다음 특허를 사업화할 때 관련될 수 있는 대한민국 법령명을 추출해줘.

[특허 제목] ${title}
[요약] ${abstract}
[대표 청구항] ${claim0}

요구사항:
- 실제 사업화(제품 출시, 인허가, 유통, 안전관리, 환경, 시험)에 적용되는 대한민국 법령명만 추출
- 농약관리법, 종자산업법, 비료관리법, 식품위생법, 축산물위생관리법, 사료관리법, 화학물질관리법, 전기용품및생활용품안전관리법 등 실제 존재하는 법령명 사용
- 3~5개, 우선순위 순
- 각 법령별로 이 특허와 연관되는 이유를 한 문장(50자 이내)
- 전체 규제 개요를 2문장으로 요약

JSON 형식:
{
  "keywords": ["법령명1", "법령명2", ...],
  "reasons": {"법령명1": "관련 이유", ...},
  "summary": "전체 규제 개요 2문장"
}`;

    const aiRaw = await callGemini(prompt);
    const parsed = extractJson(aiRaw) || { keywords: [], reasons: {}, summary: "" };
    const keywords: string[] = Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 5) : [];
    const reasons: Record<string, string> = parsed.reasons || {};

    // Search law.go.kr for each keyword in parallel
    const results = await Promise.all(keywords.map((k) => searchLaw(OC, k)));
    const laws: RegulationLaw[] = [];
    const seen = new Set<string>();
    keywords.forEach((k, idx) => {
      const hits = results[idx];
      if (hits.length > 0) {
        const top = hits[0];
        const key = top.name;
        if (!seen.has(key)) {
          seen.add(key);
          laws.push({ ...top, reason: reasons[k] || "" });
        }
      } else {
        // No hit — still surface the AI-suggested law name
        if (!seen.has(k)) {
          seen.add(k);
          laws.push({ name: k, reason: reasons[k] || "" });
        }
      }
    });

    const result: RegulationResult = {
      keywords,
      laws,
      summary: parsed.summary || "",
    };

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-regulations error", e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});