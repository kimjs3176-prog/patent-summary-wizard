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
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function extractKeywords(
  title: string,
  abstract: string,
  industryKeywords: string[] = [],
  productKeywords: string[] = [],
  materialKeywords: string[] = [],
  functionKeywords: string[] = [],
  techKeywords: string[] = [],
): Promise<string[]> {
  const hint = (label: string, arr: string[]) =>
    arr.length > 0 ? `\n- ${label}: ${arr.join(", ")}` : "";
  const prompt = `당신은 농업·식품·바이오 특허의 "실제 산업 응용 현장"을 영어 이미지 검색 키워드로 변환하는 전문가다.
아래 키워드 카테고리를 모두 종합해서, 이 기술이 실제로 사용되는 "구체적 응용 현장·설비·제품"을 표현하는 영어 검색어 2개를 만들어라.

카테고리 키워드:${hint("핵심 소재/원료", materialKeywords)}${hint("주요 기능", functionKeywords)}${hint("활용 산업", industryKeywords)}${hint("최종 제품", productKeywords)}${hint("기술 특징", techKeywords)}

키워드 구성 규칙:
- 단순히 "소재"나 "산업명"만 쓰지 말고, **기능·기술특징·소재·제품을 결합한 응용 장면**으로 작성
  예시:
  · "가시광선 LED + 떡 + 유통기한 연장" → "LED illuminated food display", "bakery refrigerated showcase"
  · "오가피 + 추출 + 건강기능식품" → "herbal capsule supplement", "ginseng extract bottle"
  · "드론 + 농약 살포 + 작물" → "agricultural spraying drone", "smart farm field"
  · "유전자 마커 + 품종 판별" → "DNA sequencing lab", "genetic test kit"
- 각 1~4단어, 구체적이고 시각적으로 식별 가능한 명사구
- 시설·장비·실제 제품 풍경 우선 (사람 단독, 추상적 아이콘 금지)
- 금지어: technology, system, method, innovation, process, composition, invention, abstract, raw material, generic
- 한국 한약재는 영문 통용명 (오가피→eleuthero, 황기→astragalus, 인삼→ginseng, 오미자→schisandra)
- 2개 키워드는 서로 다른 시각적 장면이어야 함 (현장/설비 1개 + 제품/소비자 형태 1개 권장)

JSON만 반환: {"scene":"현장/설비 영어 키워드", "product":"제품/소비자 형태 영어 키워드"}

제목: ${title}
초록: ${abstract.slice(0, 400)}`;
  const res = await callAI({
    model: "google/gemini-3.1-flash-lite",
    messages: [
      { role: "system", content: "특허 키워드 → 실제 응용 현장 영어 이미지 검색어 변환기. JSON으로만 응답." },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 150,
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
  push(parsed.scene);
  push(parsed.product);
  push(parsed.industry);
  push(parsed.product1);
  push(parsed.product2);
  push(parsed.material);
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
    const { patentNumber, title, abstract, industryKeywords, productKeywords, materialKeywords, functionKeywords, techKeywords } = body;
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
    const sanitize = (arr: any): string[] =>
      Array.isArray(arr)
        ? arr.filter((k: any) => typeof k === "string" && k.trim().length > 0).slice(0, 5)
        : [];
    const safeIndustryKws = sanitize(industryKeywords);
    const safeProductKws = sanitize(productKeywords);
    const safeMaterialKws = sanitize(materialKeywords);
    const safeFunctionKws = sanitize(functionKeywords);
    const safeTechKws = sanitize(techKeywords);
    // 캐시 키: 핵심 4개 카테고리를 모두 포함해 키워드 변화 시 자동 무효화
    const cacheParts = [...safeMaterialKws, ...safeFunctionKws, ...safeIndustryKws, ...safeProductKws];
    const cacheSuffix = cacheParts.length > 0 ? `__${cacheParts.join("|").slice(0, 100)}` : "";

    // cache lookup
    try {
      const { data: cached } = await supabase
        .from("product_image_cache")
        .select("keywords, images, expires_at")
        .eq("patent_number", trimmed + cacheSuffix)
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
      keywords = await extractKeywords(
        safeTitle, safeAbstract,
        safeIndustryKws, safeProductKws,
        safeMaterialKws, safeFunctionKws, safeTechKws,
      );
    } catch (e) {
      console.error("keyword extraction failed", e);
    }
    if (keywords.length === 0) {
      keywords = safeIndustryKws.length > 0
        ? [safeIndustryKws[0]]
        : [safeTitle.split(/\s+/).slice(0, 3).join(" ") || "agriculture industry"];
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
        patent_number: trimmed + cacheSuffix,
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