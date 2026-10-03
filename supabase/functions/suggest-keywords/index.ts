import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

// Suggests alternative agricultural-patent search terms when a search returns nothing.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const limited = await enforceRateLimit(req, { bucket: "suggest-keywords", limit: 30, windowSeconds: 300 });
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const keyword = typeof body?.keyword === "string" ? body.keyword.trim().slice(0, 100) : "";
    if (!keyword) return jsonResponse({ success: false, error: "검색어가 필요합니다." }, 400);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return jsonResponse({ success: false, error: "AI 설정 오류" }, 500);

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        messages: [
          {
            role: "system",
            content:
              "당신은 한국 농식품 분야 특허 검색 도우미입니다. 사용자의 검색어로 결과가 없을 때, 특허 문헌에서 실제로 쓰일 법한 대체 검색어를 제안합니다. 오타가 있으면 교정어를 첫 번째로 넣으세요. 반드시 JSON만 반환: {\"corrected\": \"교정어 또는 빈 문자열\", \"suggestions\": [\"검색어\", ...]} (suggestions 5~6개, 각 2~12자, 원래 검색어와 동일한 것 제외)",
          },
          { role: "user", content: keyword },
        ],
      }),
    });

    if (!r.ok) {
      const status = r.status === 429 || r.status === 402 || r.status === 403 ? r.status : 502;
      return jsonResponse({ success: false, error: "추천 검색어를 불러오지 못했습니다." }, status);
    }
    const j = await r.json();
    const text: string = j.choices?.[0]?.message?.content ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    let parsed: any = {};
    try { parsed = m ? JSON.parse(m[0]) : {}; } catch { parsed = {}; }

    const clean = (s: unknown) => String(s ?? "").replace(/["'`]/g, "").trim();
    const corrected = clean(parsed.corrected);
    const seen = new Set([keyword]);
    const suggestions: string[] = [];
    for (const s of Array.isArray(parsed.suggestions) ? parsed.suggestions : []) {
      const v = clean(s);
      if (v.length < 2 || v.length > 20 || seen.has(v)) continue;
      seen.add(v);
      suggestions.push(v);
      if (suggestions.length >= 6) break;
    }

    return jsonResponse({ success: true, corrected: corrected && corrected !== keyword ? corrected : "", suggestions });
  } catch (e) {
    console.error("suggest-keywords error", e);
    return jsonResponse({ success: false, error: "추천 검색어를 불러오지 못했습니다." }, 500);
  }
});
