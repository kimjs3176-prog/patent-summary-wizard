import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fetch with timeout + retry on transient errors
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  { retries = 2, timeoutMs = 10000, baseDelay = 600 } = {},
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(url, options, timeoutMs);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable =
        msg.includes("abort") ||
        msg.includes("timeout") ||
        msg.includes("Connection") ||
        msg.includes("ECONNRESET") ||
        msg.includes("network");
      if (!retryable || attempt === retries) break;
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 200;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

interface KeywordSearchResult {
  patentId: string;
  title: string;
  titleKo?: string;
  assignee?: string;
  applicant?: string;
  publicationDate?: string;
  applicationDate?: string;
  applicationNumber?: string;
  registrationNumber?: string;
  snippet?: string;
  thumbnail?: string;
  organizationName?: string;
}

// 농업 관련 공공기관 출원인 코드
const AGRI_ORGANIZATIONS = [
  { id: "219980050314", name: "농촌진흥청" },
  { id: "219981064455", name: "농림축산검역본부" },
  { id: "219999001749", name: "국립농산물품질관리원" },
  { id: "220040383104", name: "국립종자원" },
  { id: "", name: "농업기술센터" },
  { id: "", name: "농업기술원" },
];

const AGRI_ORG_IDS = AGRI_ORGANIZATIONS.map(org => org.id);
const AGRI_ORG_NAMES = AGRI_ORGANIZATIONS.map(org => org.name);

/**
 * Detect if the input is a natural language problem/question rather than simple keywords.
 * Returns true for sentences like "딸기 저장기간 늘리고 싶음", "스마트팜 자동화 도입 검토"
 */
function isNaturalLanguageQuery(text: string): boolean {
  const trimmed = text.trim();
  // If it's very short (1-2 words, no verb endings), treat as keyword
  const words = trimmed.split(/\s+/);
  if (words.length <= 2 && !/[다음임요죠네게려고싶]+$/u.test(trimmed)) {
    return false;
  }
  // Check for sentence-like patterns: verb endings, particles, desire expressions
  const nlPatterns = [
    /[고을를이가에서로의은는]+\s/u, // particles mid-sentence
    /싶[다음어으]/u, // want to
    /하고\s/u, // and do
    /찾[기고아]/u, // find
    /검토/u, // review
    /도입/u, // introduce
    /방법/u, // method
    /어떻게/u, // how
    /늘리/u, // increase
    /줄이/u, // decrease
    /개선/u, // improve
    /해결/u, // solve
    /필요/u, // need
    /가능/u, // possible
    /[?？]/u, // question mark
  ];
  // If 3+ words or matches NL patterns, it's likely natural language
  if (words.length >= 4) return true;
  return nlPatterns.some(p => p.test(trimmed));
}

/**
 * Use AI to extract search keywords from a natural language query
 */
async function extractKeywordsWithAI(query: string): Promise<{ keywords: string[], originalIntent: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    // Fallback: just use the query as-is
    return { keywords: [query], originalIntent: query };
  }

  try {
    const response = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a Korean agricultural patent search keyword extractor.
Given a user's problem description or question in Korean, extract 2-3 concise technical search keywords for the Korean patent database (KIPRIS).

Rules:
- Output ONLY a JSON object: {"keywords": ["keyword1", "keyword2", ...], "intent": "one-line summary of what user needs"}
- Return keywords in priority order: most important first (e.g. crop name first, then technique)
- Keywords should be technical terms, not conversational phrases
- Focus on the core technology, crop, method, or domain
- Each keyword should be 1-2 words max, ideally single word
- Do NOT include particles or verb endings
- Keep to 2-3 keywords only for precise AND-combined search
- Think about what patent titles would contain`
          },
          {
            role: "user",
            content: query
          }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    }, 8000);

    if (!response.ok) {
      console.error("AI keyword extraction failed:", response.status);
      return { keywords: [query], originalIntent: query };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.keywords && Array.isArray(parsed.keywords) && parsed.keywords.length > 0) {
        console.log(`AI extracted keywords: ${parsed.keywords.join(", ")} from query: "${query}"`);
        return { 
          keywords: parsed.keywords.slice(0, 4), 
          originalIntent: parsed.intent || query 
        };
      }
    }
    
    return { keywords: [query], originalIntent: query };
  } catch (error) {
    console.error("AI keyword extraction error:", error);
    return { keywords: [query], originalIntent: query };
  }
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
    const { keyword } = body;

    if (!keyword || typeof keyword !== "string" || keyword.trim().length < 1) {
      return new Response(
        JSON.stringify({ success: false, error: "검색어를 1자 이상 입력해주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (keyword.length > 200) {
      return new Response(
        JSON.stringify({ success: false, error: "검색어는 200자 이내로 입력해주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Allow broader character set for natural language queries
    if (!/^[\w\s가-힣ㄱ-ㅎㅏ-ㅣ\-(),.?!~·]+$/u.test(keyword.trim())) {
      return new Response(
        JSON.stringify({ success: false, error: "검색어에 허용되지 않는 문자가 포함되어 있습니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try site_settings first, then env
    let KIPRIS_API_KEY = Deno.env.get("KIPRIS_API_KEY");
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: row } = await sb.from("site_settings").select("value").eq("key", "kipris_api_key").maybeSingle();
      if (row?.value) KIPRIS_API_KEY = row.value;
    } catch {}
    if (!KIPRIS_API_KEY) {
      console.error("[CONFIG] KIPRIS_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "서비스 일시적 오류입니다. 잠시 후 다시 시도해주세요." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Searching patents with input:", keyword);

    // Determine if this is a natural language query and extract keywords
    const rawInput = keyword.trim();
    let searchKeywords: string[] = [];
    let isNLQuery = false;
    let aiIntent = "";

    if (isNaturalLanguageQuery(rawInput)) {
      isNLQuery = true;
      console.log("Detected natural language query, extracting keywords with AI...");
      const extraction = await extractKeywordsWithAI(rawInput);
      searchKeywords = extraction.keywords;
      aiIntent = extraction.originalIntent;
      console.log(`AI keywords: [${searchKeywords.join(", ")}], intent: ${aiIntent}`);
    } else {
      // Original keyword processing
      const words = rawInput.split(/\s+/).filter((w: string) => w.length > 0);
      const searchKeyword = words.length > 1
        ? words.filter((w: string) => w.length >= 1).join("*")
        : rawInput;
      searchKeywords = [searchKeyword];
    }

    // 특허 파싱 헬퍼
    const parsePatentsFromXml = (searchText: string, orgName: string): KeywordSearchResult[] => {
      const patents: KeywordSearchResult[] = [];
      let itemMatches = [...searchText.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      if (itemMatches.length === 0) {
        itemMatches = [...searchText.matchAll(/<PatentUtilityInfo>([\s\S]*?)<\/PatentUtilityInfo>/g)];
      }

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
        const applicationDate = getField("applicationDate") || "";
        const openDate = getField("openDate") || "";
        const publicationDate = getField("publicationDate") || "";
        const registerDate = getField("registerDate") || "";
        const applicant = getField("applicant") || "";
        const astrtCont = getField("astrtCont") || "";
        const drawing = getField("bigDrawing") || getField("drawing") || "";

        let patentId = "";
        let displayNumber = "";

        if (registrationNumber && registrationNumber.length >= 7) {
          const cleanNum = registrationNumber.replace(/[^0-9]/g, "");
          if (cleanNum.length >= 9 && cleanNum.startsWith("10")) {
            displayNumber = `10-${cleanNum.slice(2, 9)}`;
          } else if (cleanNum.length >= 7) {
            displayNumber = `10-${cleanNum.slice(-7)}`;
          }
          patentId = displayNumber;
        } else if (applicationNumber && applicationNumber.length >= 7) {
          const cleanNum = applicationNumber.replace(/[^0-9]/g, "");
          if (cleanNum.length === 13 && cleanNum.startsWith("10")) {
            displayNumber = `10-${cleanNum.slice(2, 6)}-${cleanNum.slice(6)}`;
          } else if (cleanNum.length > 13 && cleanNum.startsWith("10")) {
            displayNumber = `10-${cleanNum.slice(2, 6)}-${cleanNum.slice(6, 13)}`;
          } else if (cleanNum.length >= 11) {
            displayNumber = `10-${cleanNum.slice(0, 4)}-${cleanNum.slice(4, 11)}`;
          } else {
            displayNumber = `10-${cleanNum}`;
          }
          patentId = displayNumber;
        }

        if (!patentId || !inventionTitle) continue;

        patents.push({
          patentId,
          title: inventionTitle,
          titleKo: inventionTitle,
          applicant,
          assignee: applicant,
          applicationDate: applicationDate ? formatDate(applicationDate) : undefined,
          publicationDate: openDate ? formatDate(openDate) : (publicationDate ? formatDate(publicationDate) : (registerDate ? formatDate(registerDate) : undefined)),
          applicationNumber,
          registrationNumber,
          snippet: astrtCont ? astrtCont.substring(0, 200) + (astrtCont.length > 200 ? "..." : "") : undefined,
          thumbnail: drawing || undefined,
          organizationName: orgName,
        });
      }
      return patents;
    };

    // Build search terms: try AND-combined first, then individual keywords as fallback
    const combinedKeyword = searchKeywords.length > 1
      ? searchKeywords.slice(0, 3).join("*")
      : searchKeywords[0];

    console.log(`Primary AND search: "${combinedKeyword}"`);

    // Helper: run parallel searches across all orgs for a given keyword
    const searchAllOrgs = async (kw: string): Promise<KeywordSearchResult[]> => {
      const promises: Promise<KeywordSearchResult[]>[] = [];
      for (const org of AGRI_ORGANIZATIONS) {
        // Title search
        promises.push((async () => {
          try {
            const url = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch");
            url.searchParams.set("ServiceKey", KIPRIS_API_KEY);
            url.searchParams.set("inventionTitle", kw);
            url.searchParams.set("applicant", org.id || org.name);
            url.searchParams.set("astrtCont", "");
            url.searchParams.set("pageNo", "1");
            url.searchParams.set("numOfRows", "100");
            url.searchParams.set("sortSpec", "AD");
            url.searchParams.set("descSort", "true");
            url.searchParams.set("patent", "true");
            url.searchParams.set("utility", "true");
            const res = await fetchWithRetry(url.toString(), {}, { retries: 1, timeoutMs: 12000 });
            const text = await res.text();
            if (res.ok && !text.includes("<successYN>N</successYN>")) {
              return parsePatentsFromXml(text, org.name);
            }
          } catch (e) {
            console.error(`Title search error for ${org.name}:`, e);
          }
          return [];
        })());
        // Abstract search
        promises.push((async () => {
          try {
            const url = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch");
            url.searchParams.set("ServiceKey", KIPRIS_API_KEY);
            url.searchParams.set("inventionTitle", "");
            url.searchParams.set("applicant", org.id || org.name);
            url.searchParams.set("astrtCont", kw);
            url.searchParams.set("pageNo", "1");
            url.searchParams.set("numOfRows", "100");
            url.searchParams.set("sortSpec", "AD");
            url.searchParams.set("descSort", "true");
            url.searchParams.set("patent", "true");
            url.searchParams.set("utility", "true");
            const res = await fetchWithRetry(url.toString(), {}, { retries: 1, timeoutMs: 12000 });
            const text = await res.text();
            if (res.ok && !text.includes("<successYN>N</successYN>")) {
              return parsePatentsFromXml(text, org.name);
            }
          } catch (e) {
            console.error(`Abstract search error for ${org.name}:`, e);
          }
          return [];
        })());
      }
      console.log(`Launching ${promises.length} parallel KIPRIS requests for "${kw}"...`);
      const results = await Promise.all(promises);
      return results.flat();
    };

    // Step 1: AND-combined search
    let allPatents = await searchAllOrgs(combinedKeyword);

    // Step 2: If AND yields too few results and we have multiple keywords, try top-2 AND
    if (allPatents.length < 5 && searchKeywords.length > 2) {
      const top2 = searchKeywords.slice(0, 2).join("*");
      console.log(`AND result too few (${allPatents.length}), fallback to top-2 AND: "${top2}"`);
      const fallbackResults = await searchAllOrgs(top2);
      allPatents = [...allPatents, ...fallbackResults];
    }

    // Step 3: If still too few, search with just the primary keyword
    if (allPatents.length < 5 && searchKeywords.length > 1) {
      const primary = searchKeywords[0];
      console.log(`Still too few (${allPatents.length}), fallback to primary keyword: "${primary}"`);
      const fallbackResults = await searchAllOrgs(primary);
      allPatents = [...allPatents, ...fallbackResults];
    }

    // 중복 제거 (patentId 기준)
    const uniquePatents = Array.from(
      new Map(allPatents.map(p => [p.patentId, p])).values()
    );

    // 상위 50건만 반환
    const topPatents = uniquePatents.slice(0, 50);

    console.log(`Total unique patents found: ${uniquePatents.length}, returning: ${topPatents.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        patents: topPatents, 
        keyword: keyword.trim(), 
        totalCount: uniquePatents.length,
        // Include AI-extracted info for natural language queries
        ...(isNLQuery ? { 
          isNaturalLanguage: true, 
          extractedKeywords: searchKeywords,
          intent: aiIntent 
        } : {})
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("search-patents error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// 날짜 포맷팅: 20231015 -> 2023.10.15
function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
}
