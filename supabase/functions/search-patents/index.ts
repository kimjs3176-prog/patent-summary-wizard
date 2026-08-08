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
  inventors?: string;
  organizationName?: string;
}

// 거절/소멸/취하/포기 등 권리가 유효하지 않은 상태는 검색결과에서 제외
const EXCLUDED_STATUS = /(거절|소멸|취하|포기|무효)/;

// 농업 관련 공공기관 출원인 코드 (id가 있는 기관만 포함 - KIPRIS는 출원인 코드 검색이 가장 정확)
const AGRI_ORGANIZATIONS = [
  { id: "219980050314", name: "농촌진흥청" },
  { id: "219981064455", name: "농림축산검역본부" },
  { id: "219999001749", name: "국립농산물품질관리원" },
  { id: "220040383104", name: "국립종자원" },
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
        model: "google/gemini-3.1-flash-lite",
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

/**
 * Use AI to refine an arbitrary search input:
 *  - typo correction (e.g. "딸기 저장기간" -> "딸기 저장")
 *  - synonym expansion (e.g. "스마트팜" -> ["스마트팜","지능형 농장","스마트 농업"])
 *  - classify keywords into MUST (AND) and SHOULD (OR)
 * Returns a list of recommended KIPRIS query strings (each uses `*` for AND inside).
 */
async function recommendQueriesWithAI(
  rawInput: string,
  baseKeywords: string[],
): Promise<{ must: string[]; should: string[]; queries: string[]; corrected?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  // Conservative fallback: just use base keywords, no synonyms.
  const fallback = () => {
    const must = baseKeywords.slice(0, 2).filter(Boolean);
    const should = baseKeywords.slice(2, 4).filter(Boolean);
    const queries: string[] = [];
    if (must.length > 1) queries.push(must.join("*"));
    for (const k of [...must, ...should]) queries.push(k);
    return { must, should, queries: Array.from(new Set(queries)) };
  };
  if (!LOVABLE_API_KEY) return fallback();

  try {
    const response = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a KIPRIS (Korean Patent DB) query optimizer for agricultural patents.
Given a user's raw Korean search input and pre-extracted candidate keywords, output an optimized search plan.

Tasks:
1. Typo correction: fix obvious Korean typos / spacing (e.g. "병해중" -> "병해충", "스마트팜자동화" -> "스마트팜 자동화").
2. Normalize: drop particles, verb endings, generic words ("기간","방법","시스템" alone is usually too generic).
3. Classify keywords:
   - "must": 1-2 core concepts that MUST appear (typically the crop / target object, the core technique).
   - "should": 1-3 synonyms or alternative expressions that BROADEN recall (e.g. "스마트팜" <-> "지능형 농장" <-> "스마트 농업"; "병해충" <-> "해충"; "저장" <-> "보관" <-> "저장성").
4. Each keyword: 1-3 Korean characters/words, no particles, no punctuation, no English unless it's a standard term.
5. Output ONLY JSON: {"corrected":"<corrected raw input>","must":["..."],"should":["..."]}
   - must: 1-2 items
   - should: 0-3 items (synonyms / alternative spellings of must items, NOT new unrelated topics)`,
          },
          {
            role: "user",
            content: `원문: "${rawInput}"
추출된 키워드 후보: [${baseKeywords.join(", ")}]`,
          },
        ],
        temperature: 0.2,
        max_tokens: 250,
      }),
    }, 7000);

    if (!response.ok) {
      console.error("AI query refine failed:", response.status);
      return fallback();
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback();
    const parsed = JSON.parse(jsonMatch[0]);
    const must: string[] = Array.isArray(parsed.must)
      ? parsed.must.filter((x: unknown) => typeof x === "string" && x.trim().length > 0).slice(0, 2)
      : [];
    const should: string[] = Array.isArray(parsed.should)
      ? parsed.should.filter((x: unknown) => typeof x === "string" && x.trim().length > 0).slice(0, 3)
      : [];
    const corrected: string | undefined =
      typeof parsed.corrected === "string" && parsed.corrected.trim().length > 0
        ? parsed.corrected.trim()
        : undefined;

    if (must.length === 0) return fallback();

    // Build query list:
    //  1) AND of all must keywords (most precise)
    //  2) For each should-synonym: replace the last must term with the synonym -> AND combined
    //     (treats `should` as alternatives to broaden recall)
    //  3) Each must keyword alone (recall safety net)
    const queries: string[] = [];
    if (must.length > 1) queries.push(must.join("*"));
    if (must.length === 1) queries.push(must[0]);
    for (const syn of should) {
      if (must.length > 1) {
        queries.push([...must.slice(0, -1), syn].join("*"));
      } else {
        queries.push(syn);
      }
    }
    for (const k of must) if (!queries.includes(k)) queries.push(k);

    const uniq = Array.from(new Set(queries.map(q => q.trim()).filter(Boolean))).slice(0, 6);
    console.log(`AI refined queries: must=[${must.join(",")}] should=[${should.join(",")}] -> ${uniq.join(" | ")}`);
    return { must, should, queries: uniq, corrected };
  } catch (e) {
    console.error("AI query refine error:", e);
    return fallback();
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

    // === In-memory short-term cache (per-instance) ===
    // Reduces KIPRIS load and latency for repeated searches within a few minutes.
    const cacheKey = keyword.trim().toLowerCase();
    const cached = SEARCH_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) {
      console.log(`Search cache HIT: "${cacheKey}" (age ${Math.round((Date.now()-cached.at)/1000)}s)`);
      return new Response(JSON.stringify(cached.payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine if this is a natural language query and extract keywords
    const rawInput = keyword.trim();
    let searchKeywords: string[] = [];
    let isNLQuery = false;
    let aiIntent = "";

    // ▼ Perf: the AI planning (keyword extraction + query refinement) runs in the
    // background while stage-1 KIPRIS search fires immediately on the raw input.
    // Previously these two AI calls ran sequentially *before* any network search,
    // adding up to ~15s of dead time to every query.
    const planPromise: Promise<{ queries: string[]; corrected?: string }> = (async () => {
      if (isNaturalLanguageQuery(rawInput)) {
        isNLQuery = true;
        const extraction = await extractKeywordsWithAI(rawInput);
        searchKeywords = extraction.keywords;
        aiIntent = extraction.originalIntent;
      } else {
        const words = rawInput.split(/\s+/).filter((w: string) => w.length > 0);
        searchKeywords = words.length > 0 ? words : [rawInput];
      }

      const refined = await recommendQueriesWithAI(rawInput, searchKeywords);
      let recommendedQueries = refined.queries;
      if (!recommendedQueries || recommendedQueries.length === 0) {
        const fb: string[] = [];
        if (searchKeywords.length > 1) fb.push(searchKeywords.join("*"));
        for (const k of searchKeywords) fb.push(k);
        recommendedQueries = Array.from(new Set(fb));
      }
      return { queries: recommendedQueries, corrected: refined.corrected };
    })().catch(() => ({ queries: [rawInput] as string[], corrected: undefined }));

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
        const inventors = getField("inventorName") || getField("inventor") || "";
        const registerStatus = getField("registerStatus") || getField("registrationStatus") || "";

        // 거절/소멸 등 무효 상태 특허 제외
        if (registerStatus && EXCLUDED_STATUS.test(registerStatus)) continue;

        let patentId = "";
        let displayNumber = "";

        if (registrationNumber && registrationNumber.length >= 7) {
          const cleanNum = registrationNumber.replace(/[^0-9]/g, "");
          // Preserve original prefix: 10 = 특허, 20 = 실용신안
          const prefix = (cleanNum.length >= 9 && (cleanNum.startsWith("10") || cleanNum.startsWith("20")))
            ? cleanNum.slice(0, 2)
            : "10";
          if (cleanNum.length >= 9 && (cleanNum.startsWith("10") || cleanNum.startsWith("20"))) {
            displayNumber = `${prefix}-${cleanNum.slice(2, 9)}`;
          } else if (cleanNum.length >= 7) {
            displayNumber = `${prefix}-${cleanNum.slice(-7)}`;
          }
          patentId = displayNumber;
        } else if (applicationNumber && applicationNumber.length >= 7) {
          const cleanNum = applicationNumber.replace(/[^0-9]/g, "");
          const prefix = (cleanNum.startsWith("10") || cleanNum.startsWith("20"))
            ? cleanNum.slice(0, 2)
            : "10";
          if (cleanNum.length === 13 && (cleanNum.startsWith("10") || cleanNum.startsWith("20"))) {
            displayNumber = `${prefix}-${cleanNum.slice(2, 6)}-${cleanNum.slice(6)}`;
          } else if (cleanNum.length > 13 && (cleanNum.startsWith("10") || cleanNum.startsWith("20"))) {
            displayNumber = `${prefix}-${cleanNum.slice(2, 6)}-${cleanNum.slice(6, 13)}`;
          } else if (cleanNum.length >= 11) {
            displayNumber = `${prefix}-${cleanNum.slice(0, 4)}-${cleanNum.slice(4, 11)}`;
          } else {
            displayNumber = `${prefix}-${cleanNum}`;
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
          inventors: inventors || undefined,
          organizationName: orgName,
        });
      }
      return patents;
    };

    // Final query set comes from the AI recommender (already deduped, ordered by precision)
    // Always include the raw input as a safety-net query so single-token searches
    // (e.g. "새싹보리") aren't accidentally split into an over-restrictive AND query
    // (e.g. "새싹*보리") that misses titles containing the compound term verbatim.
    const safetyNet: string[] = [];
    const rawTrim = rawInput.trim();
    if (rawTrim && !recommendedQueries.includes(rawTrim)) safetyNet.push(rawTrim);
    if (correctedInput && correctedInput !== rawTrim && !recommendedQueries.includes(correctedInput)) {
      safetyNet.push(correctedInput);
    }
    const uniqueQueries = Array.from(new Set([...safetyNet, ...recommendedQueries])).slice(0, 6);
    console.log(`Final KIPRIS queries: [${uniqueQueries.join(" | ")}]`);

    // KIPRIS 단일 요청 (title 또는 abstract 검색)
    const kiprisSearch = async (
      kw: string,
      org: { id: string; name: string },
      field: "title" | "abstract" | "inventor"
    ): Promise<KeywordSearchResult[]> => {
      try {
        const url = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch");
        url.searchParams.set("ServiceKey", KIPRIS_API_KEY);
        url.searchParams.set("inventionTitle", field === "title" ? kw : "");
        url.searchParams.set("astrtCont", field === "abstract" ? kw : "");
        url.searchParams.set("inventors", field === "inventor" ? kw : "");
        // Use the organization NAME (not the applicant-code) for the applicant filter.
        // KIPRIS's applicant-code lookup silently misses some filings that are recorded
        // under legal-name variants like "대한민국(농촌진흥청장)" (e.g. 10-2012-0131498),
        // whereas the name-based match reliably covers all variants.
        url.searchParams.set("applicant", org.name);
        url.searchParams.set("pageNo", "1");
        url.searchParams.set("numOfRows", "50");
        url.searchParams.set("sortSpec", "AD");
        url.searchParams.set("descSort", "true");
        url.searchParams.set("patent", "true");
        url.searchParams.set("utility", "true");
        const res = await fetchWithRetry(url.toString(), {}, { retries: 1, timeoutMs: 12000, baseDelay: 500 });
        const text = await res.text();
        if (res.ok && !text.includes("<successYN>N</successYN>")) {
          const parsed = parsePatentsFromXml(text, org.name);
          if (parsed.length > 0) {
            console.log(`✓ ${field}/${org.name}/"${kw}": ${parsed.length} hits`);
          }
          return parsed;
        }
      } catch (e) {
        console.error(`✗ ${field}/${org.name}/"${kw}":`, e instanceof Error ? e.message : e);
      }
      return [];
    };

    // ▼ Stability/Perf: tiered fan-out with early termination
    // 1) Title search for the top query across all orgs (parallel)
    // 2) If insufficient, broaden to remaining queries (title-only)
    // 3) If still insufficient, fall back to abstract on the top query
    // This caps worst-case requests well below the previous N×6×2 pattern.
    const EARLY_EXIT_HITS = 20;
    const MAX_QUERIES = 5;
    const queriesToTry = uniqueQueries.slice(0, MAX_QUERIES);
    const allPatents: KeywordSearchResult[] = [];
    const seenIds = new Set<string>();
    const collect = (arr: KeywordSearchResult[]) => {
      for (const p of arr) {
        if (!seenIds.has(p.patentId)) {
          seenIds.add(p.patentId);
          allPatents.push(p);
        }
      }
    };

    // Stage 1: top query × all orgs (title)
    if (queriesToTry.length > 0) {
      const stage1 = await Promise.all(
        AGRI_ORGANIZATIONS.map(org => kiprisSearch(queriesToTry[0], org, "title")),
      );
      stage1.forEach(collect);
    }

    // Stage 1b: inventor-name search — if the raw input looks like a Korean personal name
    // (2-4 hangul chars, or space-separated hangul names), also query the `inventors` field.
    const isPersonName = (s: string): boolean => {
      const t = s.trim();
      if (!t) return false;
      // Restrict to common Korean surnames to avoid misclassifying substance/noun
      // keywords like "전통주", "발효주", "청국장" as inventor names.
      const SURNAMES = new Set([
        "김","이","박","최","정","강","조","윤","장","임","한","오","서","신","권",
        "황","안","송","전","홍","유","고","문","양","손","배","백","허","남","심",
        "노","하","곽","성","차","주","우","구","민","진","지","엄","채","원","천",
        "방","공","현","함","변","염","여","추","도","소","석","선","설","마","길",
        "연","위","표","명","기","반","라","왕","금","옥","육","인","맹","제","모"
      ]);
      const isKoreanName = (p: string) =>
        /^[가-힣]{2,4}$/.test(p) && SURNAMES.has(p[0]);
      if (isKoreanName(t)) return true;
      const parts = t.split(/[\s,]+/).filter(Boolean);
      if (parts.length >= 2 && parts.length <= 5 && parts.every(isKoreanName)) return true;
      return false;
    };
    if (isPersonName(rawInput)) {
      console.log(`Detected person name, running inventor search: "${rawInput}"`);
      const stageInv = await Promise.all(
        AGRI_ORGANIZATIONS.map(org => kiprisSearch(rawInput, org, "inventor")),
      );
      stageInv.forEach(collect);
    }

    // Stage 2: remaining queries × all orgs (title), batched 4-at-a-time
    if (allPatents.length < EARLY_EXIT_HITS && queriesToTry.length > 1) {
      const tasks: Array<() => Promise<KeywordSearchResult[]>> = [];
      for (const q of queriesToTry.slice(1)) {
        for (const org of AGRI_ORGANIZATIONS) {
          tasks.push(() => kiprisSearch(q, org, "title"));
        }
      }
      for (let i = 0; i < tasks.length && allPatents.length < EARLY_EXIT_HITS; i += 4) {
        const batch = await Promise.all(tasks.slice(i, i + 4).map(fn => fn()));
        batch.forEach(collect);
      }
    }

    // Stage 3: abstract search — title alone misses many filings where the keyword
    // only appears in the abstract/claims. Run for the top 2 queries whenever we
    // haven't already saturated results.
    if (allPatents.length < EARLY_EXIT_HITS && queriesToTry.length > 0) {
      const absQueries = queriesToTry.slice(0, 2);
      const tasks: Array<() => Promise<KeywordSearchResult[]>> = [];
      for (const q of absQueries) {
        for (const org of AGRI_ORGANIZATIONS) {
          tasks.push(() => kiprisSearch(q, org, "abstract"));
        }
      }
      for (let i = 0; i < tasks.length && allPatents.length < EARLY_EXIT_HITS; i += 4) {
        const batch = await Promise.all(tasks.slice(i, i + 4).map(fn => fn()));
        batch.forEach(collect);
      }
    }

    // Exclude patents that have exceeded the 20-year term from application date
    // (patents expire 20 years after filing; those are no longer enforceable).
    const now = Date.now();
    const TWENTY_YEARS_MS = 20 * 365.25 * 24 * 60 * 60 * 1000;
    const parseKrDate = (s?: string): number | null => {
      if (!s) return null;
      const digits = s.replace(/[^0-9]/g, "");
      if (digits.length < 8) return null;
      const y = Number(digits.slice(0, 4));
      const m = Number(digits.slice(4, 6)) - 1;
      const d = Number(digits.slice(6, 8));
      if (!y || Number.isNaN(m) || !d) return null;
      const t = Date.UTC(y, m, d);
      return Number.isFinite(t) ? t : null;
    };
    const activePatents = allPatents.filter((p) => {
      // Prefer explicit application date; fall back to applicationNumber year (YYYY in positions 2-6 of 13-digit AN).
      let appMs = parseKrDate(p.applicationDate);
      if (appMs === null && p.applicationNumber) {
        const digits = p.applicationNumber.replace(/[^0-9]/g, "");
        if (digits.length >= 6) {
          const y = Number(digits.slice(2, 6));
          if (y >= 1970 && y <= 2100) appMs = Date.UTC(y, 0, 1);
        }
      }
      if (appMs === null) return true; // unknown date -> keep
      return now - appMs < TWENTY_YEARS_MS;
    });
    const expiredCount = allPatents.length - activePatents.length;
    if (expiredCount > 0) {
      console.log(`Filtered ${expiredCount} expired (>20y) patents`);
    }

    // ── Relevance filter ──────────────────────────────────────────────
    // Broadened queries (synonyms, abstract fallback, single-term safety nets)
    // can surface patents that have nothing to do with the user's input
    // (e.g. "무알콜" matching an abstract that merely mentions "알코올").
    // Score every hit against the original input and drop the non-matches.
    const normalize = (s: string) =>
      (s || "")
        .toLowerCase()
        .replace(/[\s·・.,()\[\]{}<>"'`~!?:;/\\|-]/g, "")
        // spelling variants
        .replace(/알코올/g, "알콜")
        // "무알콜" 계열만 동일어 처리 (의학용어 "비알콜성"은 별개 개념이므로 제외)
        .replace(/논알콜|무알콜성/g, "무알콜");

    const coreTerms = Array.from(
      new Set(
        [rawInput, correctedInput || "", ...refined.must]
          .map(t => normalize(t))
          .filter(t => t.length >= 2),
      ),
    );
    const synTerms = Array.from(
      new Set(refined.should.map(t => normalize(t)).filter(t => t.length >= 2 && !coreTerms.includes(t))),
    );

    const rawNorm = normalize(correctedInput || rawInput);

    // 검색 의도를 좁히지 못하는 일반 특허 상용어 (가중치 축소용)
    const GENERIC_TERMS = [
      "제조방법", "제조", "방법", "조성물", "용도", "이용", "장치", "시스템",
      "물질", "성분", "기술", "개발", "제품", "사용", "포함", "관한",
    ].map(t => normalize(t));

    const countOcc = (hay: string, needle: string): number => {
      if (!needle) return 0;
      let n = 0, i = 0;
      while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
      return n;
    };

    // ── IDF 가중치: 후보 전체에 흔한 단어는 변별력이 없으므로 감점 ─────────
    const docsFor = (t: string) =>
      activePatents.reduce((n, p) => {
        const hay = normalize(`${p.titleKo || p.title || ""} ${p.snippet || ""}`);
        return hay.includes(t) ? n + 1 : n;
      }, 0);
    const N = Math.max(activePatents.length, 1);
    const weightOf = new Map<string, number>();
    for (const t of [...coreTerms, ...synTerms]) {
      const df = Math.max(docsFor(t), 1);
      // 흔할수록 0에 수렴, 희소할수록 1에 수렴
      let w = Math.log(N / df) / Math.log(N + 1);
      w = Math.max(0.15, Math.min(1, w));
      if (GENERIC_TERMS.includes(t)) w *= 0.35;
      if (t.length <= 2) w *= 0.8; // 2글자 단어는 다른 낱말에 우연히 포함되기 쉬움
      weightOf.set(t, w);
    }

    const scoreOf = (p: KeywordSearchResult): number => {
      const title = normalize(p.titleKo || p.title || "");
      const abs = normalize(p.snippet || "");
      let best = 0;
      let titleHits = 0;
      let absHits = 0;
      let weighted = 0;
      for (const t of coreTerms) {
        const w = weightOf.get(t) ?? 0.5;
        if (title.includes(t)) {
          titleHits++;
          weighted += w;
          best = Math.max(best, 3);
        } else if (abs.includes(t)) {
          absHits++;
          weighted += w * 0.4;
          best = Math.max(best, 2);
        }
      }
      if (best === 0) {
        for (const t of synTerms) {
          if (title.includes(t)) best = Math.max(best, 1.5);
          else if (abs.includes(t)) best = Math.max(best, 1);
        }
        return best;
      }

      // ── Fine-grained ranking within the same tier ────────────────────
      let bonus = 0;
      // 입력어 원문이 제목에 그대로 등장하면 가장 강한 신호
      if (rawNorm && title.includes(rawNorm)) {
        bonus += 0.8;
        // 제목 앞쪽에 등장할수록 주제어일 가능성이 높음
        const pos = title.indexOf(rawNorm) / Math.max(title.length, 1);
        bonus += (1 - pos) * 0.3;
      }
      // 핵심어 커버리지(여러 핵심어가 동시에 걸릴수록 정합)
      if (coreTerms.length > 0) {
        bonus += ((titleHits + absHits * 0.4) / coreTerms.length) * 0.6;
      }
      // 변별력 있는(희소한) 핵심어에 걸린 경우 가산
      if (coreTerms.length > 0) {
        bonus += Math.min(weighted / coreTerms.length, 1) * 0.5;
      }
      // 보조어(동의어)까지 함께 걸리면 주제 정합성이 높음
      let synHits = 0;
      for (const t of synTerms) if (title.includes(t) || abs.includes(t)) synHits++;
      if (synTerms.length > 0) bonus += Math.min(synHits / synTerms.length, 1) * 0.3;
      // 초록 내 반복 언급 = 주제로 다루고 있음 (스치듯 1회 언급과 구분)
      let absFreq = 0;
      for (const t of coreTerms) absFreq += countOcc(abs, t);
      bonus += Math.min(absFreq, 5) * 0.06;
      // 제목이 짧고 핵심어가 차지하는 비중이 클수록 초점이 명확
      if (titleHits > 0 && title.length > 0 && rawNorm) {
        bonus += Math.min(rawNorm.length / title.length, 0.5) * 0.4;
      }
      // 제목/초록이 비어 신뢰할 수 없는 레코드는 소폭 감점
      if (!title || !abs) bonus -= 0.3;
      return best + Math.max(-0.3, Math.min(bonus, 1.9));
    };

    let relevant = activePatents;
    if (coreTerms.length > 0 || synTerms.length > 0) {
      const scored = activePatents
        .map(p => ({ p, s: scoreOf(p) }))
        // 동의어가 초록에만 스치듯 등장하는 경우(1점)는 오탐이 많아 제외
        .filter(x => x.s >= 1.5)
        .sort((a, b) => b.s - a.s);
      if (scored.length > 0) {
        // If any result matches a core term, discard synonym-only matches.
        const hasCore = scored.some(x => x.s >= 2);
        let kept = scored.filter(x => (hasCore ? x.s >= 2 : true));
        // 상위 결과 대비 지나치게 낮은 점수(=약한 매칭)는 신뢰도가 낮아 제외
        if (kept.length > 0) {
          const topScore = kept[0].s;
          if (topScore >= 3) {
            const floor = Math.max(2, topScore - 1.6);
            const strong = kept.filter(x => x.s >= floor);
            // 과도한 축소 방지: 최소 5건은 유지
            if (strong.length >= Math.min(5, kept.length)) kept = strong;
          }
        }
        relevant = kept.map(x => x.p);
      } else {
        relevant = [];
      }
      const dropped = activePatents.length - relevant.length;
      if (dropped > 0) console.log(`Relevance filter dropped ${dropped} unrelated patents`);
    }

    const topPatents = relevant.slice(0, 100);
    console.log(`Total unique patents: ${relevant.length} (of ${allPatents.length}), returning: ${topPatents.length}`);

    const payload = {
      success: true,
      patents: topPatents,
      keyword: keyword.trim(),
      totalCount: relevant.length,
      expiredExcluded: expiredCount,
      recommendedQueries: uniqueQueries,
      ...(correctedInput && correctedInput !== rawInput ? { correctedInput } : {}),
      mustKeywords: refined.must,
      shouldKeywords: refined.should,
      ...(isNLQuery ? {
        isNaturalLanguage: true,
        extractedKeywords: searchKeywords,
        intent: aiIntent,
      } : {}),
    };

    // Cache only successful, non-empty responses
    if (topPatents.length > 0) {
      SEARCH_CACHE.set(cacheKey, { at: Date.now(), payload });
      // Bound cache size to avoid memory growth
      if (SEARCH_CACHE.size > 200) {
        const oldestKey = SEARCH_CACHE.keys().next().value;
        if (oldestKey) SEARCH_CACHE.delete(oldestKey);
      }
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("search-patents error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Per-instance LRU-ish cache for search responses (15 minutes)
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const SEARCH_CACHE = new Map<string, { at: number; payload: unknown }>();

// 날짜 포맷팅: 20231015 -> 2023.10.15
function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
}
