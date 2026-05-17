import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

async function callAI(payload: Record<string, unknown> & { model: string }): Promise<Response> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (GEMINI_API_KEY) {
    try {
      const geminiModel = payload.model.replace(/^google\//, "");
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, model: geminiModel }),
        },
      );
      if (r.ok) return r;
    } catch (_) { /* fall through */ }
  }
  if (GROQ_API_KEY) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, model: "llama-3.1-8b-instant" }),
      });
      if (r.ok) return r;
    } catch (_) { /* fall through */ }
  }
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function extractKeywords(title: string, abstract: string): Promise<string[]> {
  const prompt = `다음 농업·식품·바이오 특허의 핵심 시각 요소를 표현하는 영어 이미지 검색 키워드 2개를 추출해줘.
규칙:
- 1번 키워드: "핵심 소재/원료" 자체 (예: "eleuthero plant", "ginseng root", "rice grains", "fresh strawberry")
- 2번 키워드: "최종 제품/응용 형태" (예: "herbal extract powder", "health supplement capsule", "rice cake snack", "agricultural drone")
- 각 1~3단어, 구체적이고 시각적인 명사구
- 금지어: technology, system, method, innovation, process, composition, invention, abstract
- 한국 한약재/식물명은 영문 학명·통용명 사용 (오가피→eleuthero, 황기→astragalus, 당귀→angelica, 구기자→goji berry, 오미자→schisandra)
JSON만 반환: {"material":"...", "product":"..."}

제목: ${title}
초록: ${abstract.slice(0, 600)}`;
  const res = await callAI({
    model: "google/gemini-2.5-flash-lite",
    messages: [
      { role: "system", content: "특허 → 소재·제품 영어 이미지 검색 키워드 추출기. JSON으로만 응답." },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 120,
    response_format: { type: "json_object" },
  });
  if (!res.ok) throw new Error("AI keyword extraction failed");
  const j = await res.json();
  const content = j.choices?.[0]?.message?.content || "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(content); } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  }
  const out: string[] = [];
  const push = (v: any) => {
    if (typeof v === "string" && v.trim().length > 0 && !out.includes(v.trim())) out.push(v.trim());
  };
  push(parsed.material);
  push(parsed.product);
  push(parsed.keyword);
  if (Array.isArray(parsed.keywords)) parsed.keywords.forEach(push);
  return out.slice(0, 2);
}

interface PexelsPhoto {
  id: number;
  src: { medium: string; large: string; tiny: string };
  alt?: string;
  photographer: string;
  photographer_url: string;
  url: string;
}

async function searchPexels(keyword: string, perPage = 3): Promise<any[]> {
  const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
  if (!PEXELS_API_KEY) throw new Error("PEXELS_API_KEY not configured");
  // Pexels 자체 관련도 순(기본)을 사용하고 가로형만 필터
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=${perPage}&orientation=landscape&size=medium`;
  const r = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
  if (!r.ok) {
    console.warn(`[Pexels] ${keyword} -> ${r.status}`);
    return [];
  }
  const j = await r.json();
  const photos: PexelsPhoto[] = j.photos || [];
  return photos.map((p) => ({
    id: p.id,
    url: p.src.large,
    thumb: p.src.medium,
    alt: p.alt || keyword,
    photographer: p.photographer,
    photographerUrl: p.photographer_url,
    pexelsUrl: p.url,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { patentNumber, title, abstract } = body;
    if (!patentNumber || typeof patentNumber !== "string") {
      return new Response(JSON.stringify({ error: "patentNumber required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const trimmed = patentNumber.trim();
    if (trimmed.length > 50 || !/^[0-9-]+$/.test(trimmed)) {
      return new Response(JSON.stringify({ error: "Invalid patentNumber" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseClient();

    // cache lookup
    try {
      const { data: cached } = await supabase
        .from("product_image_cache")
        .select("keywords, images, expires_at")
        .eq("patent_number", trimmed)
        .maybeSingle();
      if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
        return new Response(
          JSON.stringify({ success: true, cached: true, keywords: cached.keywords, groups: cached.images }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } catch (e) {
      console.warn("cache read error", e);
    }

    const safeTitle = typeof title === "string" ? title.slice(0, 300) : "";
    const safeAbstract = typeof abstract === "string" ? abstract.slice(0, 1500) : "";

    let keywords: string[] = [];
    try {
      keywords = await extractKeywords(safeTitle, safeAbstract);
    } catch (e) {
      console.error("keyword extraction failed", e);
    }
    if (keywords.length === 0) {
      keywords = [safeTitle.split(/\s+/).slice(0, 3).join(" ") || "agriculture technology"];
    }

    // 소재·제품 각 키워드에서 Pexels 상위 1개씩 추출 → 총 2개 이미지 (관련도 우선)
    const targetKeywords = keywords.slice(0, 2);
    const groups = await Promise.all(
      targetKeywords.map(async (k) => ({ keyword: k, images: (await searchPexels(k, 1)) })),
    );
    // 중복 이미지 ID 제거
    const seenIds = new Set<number>();
    const filtered = groups
      .map((g) => ({ ...g, images: g.images.filter((im: any) => { if (seenIds.has(im.id)) return false; seenIds.add(im.id); return true; }) }))
      .filter((g) => g.images.length > 0);

    try {
      await supabase.from("product_image_cache").upsert({
        patent_number: trimmed,
        keywords,
        images: filtered,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "patent_number" });
    } catch (e) {
      console.warn("cache write error", e);
    }

    return new Response(
      JSON.stringify({ success: true, cached: false, keywords, groups: filtered }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("search-product-images error", error);
    return new Response(
      JSON.stringify({ success: false, error: "이미지 검색 중 오류가 발생했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});