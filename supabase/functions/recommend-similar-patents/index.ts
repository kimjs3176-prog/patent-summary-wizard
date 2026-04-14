import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, abstract, classifications, patentNumber } = await req.json();

    if (!title && !abstract) {
      return new Response(
        JSON.stringify({ success: false, error: "특허 제목 또는 초록이 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "AI 서비스가 설정되지 않았습니다." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Use AI to generate search queries for similar patents
    const classInfo = classifications?.length > 0 ? `IPC 분류: ${classifications.join(", ")}` : "";
    const prompt = `다음 특허와 유사한 특허를 찾기 위한 검색 키워드 3세트를 생성해주세요.

특허 제목: ${title || "없음"}
초록: ${(abstract || "").substring(0, 500)}
${classInfo}

각 키워드 세트는 KIPRIS 한국 특허 검색에서 AND 검색으로 사용됩니다.
서로 다른 관점에서 유사 특허를 찾을 수 있도록 다양하게 구성해주세요.
- 첫 번째: 핵심 기술 키워드 (가장 관련도 높은)
- 두 번째: 응용 분야 키워드
- 세 번째: 대체 기술 키워드

JSON 형식으로만 응답: {"queries": [["keyword1", "keyword2"], ["keyword3", "keyword4"], ["keyword5", "keyword6"]]}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a Korean patent search expert. Output only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI query generation failed:", aiResponse.status);
      return new Response(
        JSON.stringify({ success: false, error: "AI 추천 서비스 오류" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    
    let searchQueries: string[][] = [];
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        searchQueries = parsed.queries || [];
      } catch {
        console.error("Failed to parse AI response:", aiContent);
      }
    }

    if (searchQueries.length === 0) {
      // Fallback: extract words from title
      const words = (title || "").split(/\s+/).filter((w: string) => w.length >= 2).slice(0, 3);
      searchQueries = [words];
    }

    console.log("AI generated search queries:", JSON.stringify(searchQueries));

    // Step 2: Search KIPRIS with generated queries
    let KIPRIS_API_KEY = Deno.env.get("KIPRIS_API_KEY");
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: row } = await sb.from("site_settings").select("value").eq("key", "kipris_api_key").maybeSingle();
      if (row?.value) KIPRIS_API_KEY = row.value;
    } catch {}

    if (!KIPRIS_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "KIPRIS API 키가 설정되지 않았습니다." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    interface SimilarPatent {
      patentId: string;
      title: string;
      assignee?: string;
      publicationDate?: string;
      snippet?: string;
      thumbnail?: string;
      relevanceGroup: number;
    }

    const allPatents: SimilarPatent[] = [];

    const searchKipris = async (keywords: string[], groupIndex: number): Promise<SimilarPatent[]> => {
      const kw = keywords.slice(0, 3).join("*");
      const results: SimilarPatent[] = [];

      try {
        const url = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch");
        url.searchParams.set("ServiceKey", KIPRIS_API_KEY!);
        url.searchParams.set("inventionTitle", kw);
        url.searchParams.set("applicant", "");
        url.searchParams.set("astrtCont", "");
        url.searchParams.set("pageNo", "1");
        url.searchParams.set("numOfRows", "20");
        url.searchParams.set("sortSpec", "AD");
        url.searchParams.set("descSort", "true");
        url.searchParams.set("patent", "true");
        url.searchParams.set("utility", "true");

        const res = await fetch(url.toString());
        const text = await res.text();

        if (!res.ok || text.includes("<successYN>N</successYN>")) return results;

        const itemMatches = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)];
        for (const match of itemMatches) {
          const itemXml = match[1];
          const getField = (field: string): string | undefined => {
            const cdataMatch = itemXml.match(new RegExp(`<${field}><!\\[CDATA\\[([^\\]]*?)\\]\\]><\\/${field}>`, 'i'));
            if (cdataMatch) return cdataMatch[1].trim();
            const simpleMatch = itemXml.match(new RegExp(`<${field}>([^<]*)<\\/${field}>`, 'i'));
            return simpleMatch ? simpleMatch[1].trim() : undefined;
          };

          const applicationNumber = getField("applicationNumber") || "";
          const registrationNumber = getField("registerNumber") || getField("registrationNumber") || "";
          const inventionTitle = getField("inventionTitle") || "";
          const applicant = getField("applicant") || "";
          const astrtCont = getField("astrtCont") || "";
          const drawing = getField("bigDrawing") || getField("drawing") || "";
          const openDate = getField("openDate") || "";
          const registerDate = getField("registerDate") || "";

          let displayNumber = "";
          if (registrationNumber) {
            const cleanNum = registrationNumber.replace(/[^0-9]/g, "");
            if (cleanNum.length >= 9 && cleanNum.startsWith("10")) {
              displayNumber = `10-${cleanNum.slice(2, 9)}`;
            } else if (cleanNum.length >= 7) {
              displayNumber = `10-${cleanNum.slice(-7)}`;
            }
          } else if (applicationNumber) {
            const cleanNum = applicationNumber.replace(/[^0-9]/g, "");
            if (cleanNum.length === 13 && cleanNum.startsWith("10")) {
              displayNumber = `10-${cleanNum.slice(2, 6)}-${cleanNum.slice(6)}`;
            } else if (cleanNum.length >= 11) {
              displayNumber = `10-${cleanNum.slice(0, 4)}-${cleanNum.slice(4, 11)}`;
            } else {
              displayNumber = `10-${cleanNum}`;
            }
          }

          if (!displayNumber || !inventionTitle) continue;

          // Skip the current patent
          if (patentNumber && displayNumber.includes(patentNumber.replace(/^10-/, ""))) continue;

          const dateStr = openDate || registerDate;
          results.push({
            patentId: displayNumber,
            title: inventionTitle,
            assignee: applicant || undefined,
            publicationDate: dateStr ? `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}` : undefined,
            snippet: astrtCont ? astrtCont.substring(0, 200) + (astrtCont.length > 200 ? "..." : "") : undefined,
            thumbnail: drawing || undefined,
            relevanceGroup: groupIndex,
          });
        }
      } catch (e) {
        console.error(`KIPRIS search error for "${kw}":`, e);
      }

      return results;
    };

    // Run all queries in parallel
    const queryResults = await Promise.all(
      searchQueries.map((q, i) => searchKipris(q, i))
    );

    for (const results of queryResults) {
      allPatents.push(...results);
    }

    // Deduplicate and prioritize by relevance group
    const seen = new Set<string>();
    const uniquePatents: SimilarPatent[] = [];
    
    // Sort by relevance group (lower = more relevant)
    allPatents.sort((a, b) => a.relevanceGroup - b.relevanceGroup);
    
    for (const patent of allPatents) {
      if (!seen.has(patent.patentId)) {
        seen.add(patent.patentId);
        uniquePatents.push(patent);
      }
    }

    const topPatents = uniquePatents.slice(0, 12);

    console.log(`Found ${uniquePatents.length} unique similar patents, returning ${topPatents.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        patents: topPatents,
        searchQueries: searchQueries.map(q => q.join(" + ")),
        totalCount: uniquePatents.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("recommend-similar-patents error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
