import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry fetch with exponential backoff + per-attempt timeout.
// Without an AbortController, KIPRIS can hang the function for the full
// edge-runtime wall-clock budget on a stalled connection.
async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  initialDelay = 800,
  timeoutMs = 12000,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Fetch attempt ${attempt + 1}/${maxRetries} failed:`, lastError.message);

      const msg = lastError.message.toLowerCase();
      const isRetryable =
        msg.includes('connection reset') ||
        msg.includes('connection error') ||
        msg.includes('timeout') ||
        msg.includes('econnreset') ||
        msg.includes('abort') ||
        msg.includes('network');

      if (!isRetryable || attempt === maxRetries - 1) {
        throw lastError;
      }

      const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 400;
      console.log(`Retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}

interface PatentData {
  title?: string;
  titleKo?: string;
  abstract?: string;
  inventors?: string[];
  assignee?: string;
  applicant?: string;
  filingDate?: string;
  publicationDate?: string;
  registrationDate?: string;
  claims?: string[];
  patentNumber?: string;
  applicationNumber?: string;
  registrationNumber?: string;
  displayNumber?: string;
  searchType?: 'registration' | 'application';
  classifications?: string[];
  description?: string;
  representativeImage?: string;
  images?: string[];
}

interface RelatedPatent {
  patentId: string;
  title: string;
  assignee?: string;
  publicationDate?: string;
  snippet?: string;
  link?: string;
}

// 날짜 포맷팅: 20231015 -> 2023.10.15
function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
}

// 특허번호에서 검색용 번호 추출
function parsePatentNumber(input: string): { searchNumber: string; displayNumber: string; searchType: 'registration' | 'application' } {
  const trimmed = input.trim();

  // 등록번호 형식: 10-1234567 또는 20-1234567 (실용신안)
  const regMatch = trimmed.match(/^(10|20)-(\d{7})$/);
  if (regMatch) {
    return {
      searchNumber: `${regMatch[1]}${regMatch[2]}`,
      displayNumber: trimmed,
      searchType: 'registration'
    };
  }

  // 등록번호 형식 (6자리): 10-186227 -> 10-0186227
  const regMatch6 = trimmed.match(/^(10|20)-(\d{6})$/);
  if (regMatch6) {
    const paddedNum = regMatch6[2].padStart(7, '0');
    return {
      searchNumber: `${regMatch6[1]}${paddedNum}`,
      displayNumber: `${regMatch6[1]}-${paddedNum}`,
      searchType: 'registration'
    };
  }

  // 출원번호 형식: 10-2023-0123456 (standard 7-digit serial)
  const appMatch = trimmed.match(/^(10|20)-(\d{4})-(\d{7})$/);
  if (appMatch) {
    return {
      searchNumber: `${appMatch[1]}${appMatch[2]}${appMatch[3]}`,
      displayNumber: trimmed,
      searchType: 'application'
    };
  }

  // 출원번호 형식 (longer serial)
  const appMatchLong = trimmed.match(/^(10|20)-(\d{4})-(\d{7,})$/);
  if (appMatchLong) {
    const serial = appMatchLong[3].slice(0, 7);
    return {
      searchNumber: `${appMatchLong[1]}${appMatchLong[2]}${serial}`,
      displayNumber: `${appMatchLong[1]}-${appMatchLong[2]}-${serial}`,
      searchType: 'application'
    };
  }

  // 순수 7자리 숫자 (등록번호)
  const pureRegMatch = trimmed.match(/^(\d{7})$/);
  if (pureRegMatch) {
    return {
      searchNumber: `10${pureRegMatch[1]}`,
      displayNumber: `10-${pureRegMatch[1]}`,
      searchType: 'registration'
    };
  }
  
  // 기본값
  return {
    searchNumber: trimmed.replace(/-/g, ''),
    displayNumber: trimmed,
    searchType: 'application'
  };
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
    const { patentNumber } = body;

    if (!patentNumber || typeof patentNumber !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "특허 번호를 입력해주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Input validation: length and character restrictions
    const trimmedNumber = patentNumber.trim();
    if (trimmedNumber.length > 50 || !/^[0-9-]+$/.test(trimmedNumber)) {
      return new Response(
        JSON.stringify({ success: false, error: "유효하지 않은 특허 번호 형식입니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Supabase client 초기화
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sb = createClient(supabaseUrl, supabaseKey);

    // ★ 캐시 확인: patent_data_cache에서 먼저 조회 (7일 이내)
    const { data: cached } = await sb
      .from("patent_data_cache")
      .select("patent_data, related_patents, created_at")
      .eq("patent_number", trimmedNumber)
      .maybeSingle();

    if (cached) {
      const cacheAge = Date.now() - new Date(cached.created_at).getTime();
      const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7일
      if (cacheAge < CACHE_TTL) {
        console.log("Cache HIT for patent:", trimmedNumber);
        return new Response(
          JSON.stringify({ success: true, data: cached.patent_data, relatedPatents: cached.related_patents }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        console.log("Cache EXPIRED for patent:", trimmedNumber);
        // 만료된 캐시 삭제
        await sb.from("patent_data_cache").delete().eq("patent_number", trimmedNumber);
      }
    } else {
      console.log("Cache MISS for patent:", trimmedNumber);
    }

    // Try site_settings first, then env
    let KIPRIS_API_KEY = Deno.env.get("KIPRIS_API_KEY");
    try {
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

    const parsed = parsePatentNumber(patentNumber);
    console.log("Fetching patent from KIPRIS:", patentNumber, "->", parsed);

    let patentData: PatentData = {
      displayNumber: parsed.displayNumber,
      searchType: parsed.searchType,
    };

    // KIPRIS Plus API로 특허 검색
    // getAdvancedSearch API 사용하여 번호로 검색
    const searchUrl = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch");
    searchUrl.searchParams.set("ServiceKey", KIPRIS_API_KEY);
    searchUrl.searchParams.set("astrtCont", "");
    searchUrl.searchParams.set("inventionTitle", "");

    // 등록번호 또는 출원번호로 검색
    if (parsed.searchType === 'registration') {
      searchUrl.searchParams.set("registerNumber", parsed.searchNumber);
    } else {
      searchUrl.searchParams.set("applicationNumber", parsed.searchNumber);
    }

    searchUrl.searchParams.set("pageNo", "1");
    searchUrl.searchParams.set("numOfRows", "5");
    searchUrl.searchParams.set("patent", "true");
    searchUrl.searchParams.set("utility", "true");

    console.log("KIPRIS search URL:", searchUrl.toString().replace(KIPRIS_API_KEY, "***"));

    const searchResponse = await fetchWithRetry(searchUrl.toString());
    const searchText = await searchResponse.text();

    console.log("KIPRIS API response status:", searchResponse.status);
    console.log("KIPRIS API response preview:", searchText.substring(0, 1500));

    // Check for API error
    if (searchText.includes("<successYN>N</successYN>") ||
      searchText.includes("INVALID REQUEST") ||
      searchText.includes("<resultCode>10</resultCode>")) {
      const errorMsg = searchText.match(/<resultMsg>([^<]+)<\/resultMsg>/)?.[1] || "API 오류";
      console.error("[UPSTREAM] KIPRIS API error:", errorMsg);
      
      // Distinguish quota exceeded from other errors
      const isQuotaExceeded = errorMsg.includes("월") && (errorMsg.includes("호출") || errorMsg.includes("Exceeds"));
      const userMessage = isQuotaExceeded
        ? "KIPRIS API 월간 호출 한도를 초과했습니다. 다음 달에 다시 시도해주세요."
        : "외부 서비스 연동 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      
      return new Response(
        JSON.stringify({ success: false, error: userMessage }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse XML response - find all items (공개/등록 등 여러 건이 있을 수 있음)
    const allSearchItems = [...searchText.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const itemMatch = allSearchItems.length > 0 ? searchText.match(/<item>([\s\S]*?)<\/item>/) : null;

    // Small XML helpers (CDATA 우선)
    const getFieldFromXml = (xml: string, field: string): string | undefined => {
      const cdataMatch = xml.match(new RegExp(`<${field}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${field}>`, "i"));
      if (cdataMatch) return cdataMatch[1].trim();
      const simpleMatch = xml.match(new RegExp(`<${field}>([\\s\\S]*?)<\\/${field}>`, "i"));
      return simpleMatch ? simpleMatch[1].trim() : undefined;
    };

    const getFieldsFromXml = (xml: string, field: string): string[] => {
      const values: string[] = [];
      const reCdata = new RegExp(`<${field}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${field}>`, "gi");
      const reSimple = new RegExp(`<${field}>([\\s\\S]*?)<\\/${field}>`, "gi");
      for (const m of xml.matchAll(reCdata)) values.push((m[1] || "").trim());
      for (const m of xml.matchAll(reSimple)) values.push((m[1] || "").trim());
      return values.filter(v => v.length > 0);
    };

    if (itemMatch) {
      const itemXml = itemMatch[1];

      const applicationNumber = getFieldFromXml(itemXml, "applicationNumber") || "";
      const registrationNumber = getFieldFromXml(itemXml, "registerNumber") || "";

      // displayNumber 재설정
      if (registrationNumber && registrationNumber.length >= 7) {
        const cleanNum = registrationNumber.replace(/[^0-9]/g, "");
        if (cleanNum.length >= 9 && cleanNum.startsWith("10")) {
          patentData.displayNumber = `10-${cleanNum.slice(2, 9)}`;
        }
      } else if (applicationNumber && applicationNumber.length >= 11) {
        const cleanNum = applicationNumber.replace(/[^0-9]/g, "");
        if (cleanNum.startsWith("10")) {
          patentData.displayNumber = `10-${cleanNum.slice(2, 6)}-${cleanNum.slice(6)}`;
        }
      }

      // 발명자 정보 파싱 (inventorName 필드)
      const inventorName = getFieldFromXml(itemXml, "inventorName");
      const inventors: string[] = inventorName
        ? inventorName.split(/[,|]/).map(n => n.trim()).filter(n => n.length > 0)
        : [];

      patentData = {
        ...patentData,
        title: getFieldFromXml(itemXml, "inventionTitle"),
        titleKo: getFieldFromXml(itemXml, "inventionTitle"),
        abstract: getFieldFromXml(itemXml, "astrtCont"),
        applicant: getFieldFromXml(itemXml, "applicantName") || getFieldFromXml(itemXml, "applicant"),
        assignee: getFieldFromXml(itemXml, "applicantName") || getFieldFromXml(itemXml, "applicant"),
        inventors,
        filingDate: formatDate(getFieldFromXml(itemXml, "applicationDate") || ""),
        publicationDate: formatDate(getFieldFromXml(itemXml, "openDate") || getFieldFromXml(itemXml, "publicationDate") || ""),
        registrationDate: formatDate(getFieldFromXml(itemXml, "registerDate") || ""),
        applicationNumber,
        registrationNumber,
        classifications: getFieldFromXml(itemXml, "ipcNumber") ? [getFieldFromXml(itemXml, "ipcNumber")!] : [],
        // bigDrawing(고해상도) 우선, drawing(저해상도)은 fallback만
        representativeImage: getFieldFromXml(itemXml, "bigDrawing") || getFieldFromXml(itemXml, "drawing"),
        // 검색 결과의 모든 항목(공개/등록)에서 고해상도 도면 수집
        images: (() => {
          const collected: string[] = [];
          for (const si of allSearchItems) {
            const siXml = si[1];
            const big = getFieldFromXml(siXml, "bigDrawing");
            const small = getFieldFromXml(siXml, "drawing");
            const bestUrl = (big && big.startsWith("http")) ? big : (small && small.startsWith("http")) ? small : null;
            if (bestUrl && !collected.includes(bestUrl)) {
              collected.push(bestUrl);
            }
            if (collected.length >= 3) break;
          }
          // fallback: 현재 항목에서라도 1개는 확보
          if (collected.length === 0) {
            const big = getFieldFromXml(itemXml, "bigDrawing");
            const small = getFieldFromXml(itemXml, "drawing");
            const img = (big && big.startsWith("http")) ? big : (small && small.startsWith("http")) ? small : null;
            if (img) collected.push(img);
          }
          console.log("Search API drawings collected from all items:", collected.length);
          return collected;
        })(),
      };

      // 2차 상세 조회: 청구항(claims) 확보
      // getAdvancedSearch에는 청구항이 포함되지 않는 경우가 많아 별도 상세 API를 호출합니다.
      try {
        const detailUrl = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getBibliographyDetailInfoSearch");
        detailUrl.searchParams.set("ServiceKey", KIPRIS_API_KEY);
        // 상세 API는 일반적으로 applicationNumber 기반 조회가 안정적
        if (applicationNumber) {
          detailUrl.searchParams.set("applicationNumber", applicationNumber.replace(/[^0-9]/g, ""));
        } else {
          // fallback: 사용자가 입력한 번호를 그대로 정규화
          detailUrl.searchParams.set("applicationNumber", parsed.searchNumber.replace(/[^0-9]/g, ""));
        }

        console.log("KIPRIS detail URL:", detailUrl.toString().replace(KIPRIS_API_KEY, "***"));

        const detailRes = await fetchWithRetry(detailUrl.toString());
        const detailText = await detailRes.text();


        if (detailRes.ok && !detailText.includes("<successYN>N</successYN>")) {
          // 청구항 태그는 응답 포맷에 따라 claim / claimText 등으로 다를 수 있어 폭넓게 파싱
          const claimCandidates = [
            ...getFieldsFromXml(detailText, "claim"),
            ...getFieldsFromXml(detailText, "claimText"),
            ...getFieldsFromXml(detailText, "claimContents"),
          ];

          const cleaned = claimCandidates
            .map(c => c.replace(/\s+/g, " ").trim())
            .filter(c => c.length > 0);

          // 너무 긴 단일 문자열만 내려오는 경우, '청구항' 번호 패턴으로 분리 시도
          let claims: string[] = cleaned;
          if (claims.length === 1) {
            const one = claims[0];
            const split = one
              .split(/(?=(?:\s|^)(?:\d+\s*\)|\d+\.|\[청구항\s*\d+\]))/)
              .map(s => s.trim())
              .filter(Boolean);
            if (split.length > 1) claims = split;
          }

          if (claims.length > 0) {
            patentData.claims = claims.slice(0, 50);
          }

          // 발명자 정보: inventorInfoArray > inventorInfo > name 구조에서 추출
          const inventorMatches = [...detailText.matchAll(/<inventorInfo>([\s\S]*?)<\/inventorInfo>/g)];
          if (inventorMatches.length > 0) {
            const inventors: string[] = [];
            for (const m of inventorMatches) {
              const nameMatch = m[1].match(/<name>([^<]+)<\/name>/);
              if (nameMatch && nameMatch[1].trim()) {
                inventors.push(nameMatch[1].trim());
              }
            }
            if (inventors.length > 0) {
              patentData.inventors = inventors;
              console.log("Inventors extracted from detail API:", inventors.join(", "));
            }
          }

          // 상세 응답에서 모든 도면 수집
          const detailItems = [...detailText.matchAll(/<item>([\s\S]*?)<\/item>/g)];
          console.log("Detail API items found:", detailItems.length);
          
          const uniqueImages: string[] = [];
          // 기존 search API에서 수집한 이미지를 베이스로 시작
          if (patentData.images) {
            for (const img of patentData.images) {
              if (!uniqueImages.includes(img)) uniqueImages.push(img);
            }
          }
          
          for (const dItem of detailItems) {
            const dXml = dItem[1];
            const bigUrl = getFieldFromXml(dXml, "bigDrawing");
            const smallUrl = getFieldFromXml(dXml, "drawing");
            const bestUrl = (bigUrl && bigUrl.startsWith("http")) ? bigUrl : (smallUrl && smallUrl.startsWith("http")) ? smallUrl : null;
            if (bestUrl && !uniqueImages.includes(bestUrl)) {
              uniqueImages.push(bestUrl);
            }
            if (uniqueImages.length >= 3) break;
          }
          
          console.log("Combined unique drawings after detail API:", uniqueImages.length);
          
          if (uniqueImages.length > 0) {
            patentData.representativeImage = uniqueImages[0];
            patentData.images = uniqueImages;
          }
        } else {
          console.warn("Detail API returned error or empty payload");
        }
      } catch (detailErr) {
        console.error("Error fetching patent detail (claims):", detailErr);
      }


      // 3차: 도면이 1개 이하인 경우, 출원번호 기반 추가 검색으로 보충
      if ((patentData.images?.length || 0) < 2 && applicationNumber) {
        try {
          const suppUrl = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch");
          suppUrl.searchParams.set("ServiceKey", KIPRIS_API_KEY);
          suppUrl.searchParams.set("astrtCont", "");
          suppUrl.searchParams.set("inventionTitle", "");
          suppUrl.searchParams.set("applicationNumber", applicationNumber);
          suppUrl.searchParams.set("pageNo", "1");
          suppUrl.searchParams.set("numOfRows", "10");
          suppUrl.searchParams.set("patent", "true");
          suppUrl.searchParams.set("utility", "true");

          console.log("Supplementary drawing search by applicationNumber");
          const suppRes = await fetchWithRetry(suppUrl.toString());
          const suppText = await suppRes.text();

          if (suppRes.ok && !suppText.includes("<successYN>N</successYN>")) {
            const suppItems = [...suppText.matchAll(/<item>([\s\S]*?)<\/item>/g)];
            console.log("Supplementary search items found:", suppItems.length);

            const existingImages = patentData.images || [];
            for (const si of suppItems) {
              const siXml = si[1];
              const big = getFieldFromXml(siXml, "bigDrawing");
              const small = getFieldFromXml(siXml, "drawing");
              const bestUrl = (big && big.startsWith("http")) ? big : (small && small.startsWith("http")) ? small : null;
              if (bestUrl && !existingImages.includes(bestUrl)) {
                existingImages.push(bestUrl);
              }
              if (existingImages.length >= 3) break;
            }
            patentData.images = existingImages;
            if (existingImages.length > 0 && !patentData.representativeImage) {
              patentData.representativeImage = existingImages[0];
            }
            console.log("Total drawings after supplementary search:", existingImages.length);
          }
        } catch (suppErr) {
          console.error("Supplementary drawing search error:", suppErr);
        }
      }
    }

    if (!patentData.title) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "해당 번호의 특허를 찾을 수 없습니다. 등록번호 또는 출원번호를 확인해주세요."
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 출원인 필터링은 키워드 검색(search-patents)에서 이미 적용됨.
    // 개별 특허 조회는 검색 결과나 예시 특허를 통해 접근하므로 별도 제한하지 않음.

    patentData.patentNumber = patentData.displayNumber;

    console.log("Patent data fetched successfully:", patentData.title);

    // 관련 특허 검색 (제목 키워드 기반 + 농촌진흥청 출원인 필터)
    // 농촌진흥청 출원인 코드
    const RDA_APPLICANT_ID = "219980050314";
    
    let relatedPatents: RelatedPatent[] = [];
    
    if (patentData.title) {
      try {
        // 제목에서 핵심 키워드 추출 - 더 단순하게 핵심 단어 1-2개만 사용
        const words = patentData.title
          .replace(/[^\uAC00-\uD7A3a-zA-Z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 2 && w.length <= 8)
          // 조사, 일반적인 단어 제외
          .filter(w => !['우수한', '이를', '하는', '위한', '관한', '대한', '있는', '방법', '장치', '시스템'].includes(w));
        
        // 핵심 단어 1개로만 검색 (더 넓은 결과)
        const keyword = words.length > 0 ? words[0] : "";

        console.log("Related patents search keyword:", keyword);

        if (keyword) {
          // 농촌진흥청 특허만 검색 (applicant 파라미터로 필터링)
          const relatedUrl = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch");
          relatedUrl.searchParams.set("ServiceKey", KIPRIS_API_KEY);
          relatedUrl.searchParams.set("inventionTitle", keyword);
          relatedUrl.searchParams.set("applicant", RDA_APPLICANT_ID); // 농촌진흥청 출원인 코드로 필터링
          relatedUrl.searchParams.set("astrtCont", "");
          relatedUrl.searchParams.set("pageNo", "1");
          relatedUrl.searchParams.set("numOfRows", "20");
          relatedUrl.searchParams.set("sortSpec", "PD");
          relatedUrl.searchParams.set("descSort", "true");
          relatedUrl.searchParams.set("patent", "true");
          relatedUrl.searchParams.set("utility", "true");

          console.log("Related patents search URL (RDA only):", relatedUrl.toString().replace(KIPRIS_API_KEY, "***"));

          const relatedResponse = await fetchWithRetry(relatedUrl.toString());
          const relatedText = await relatedResponse.text();

          console.log("Related patents API response preview:", relatedText.substring(0, 500));

          if (relatedResponse.ok && !relatedText.includes("<successYN>N</successYN>")) {
            const itemMatches = [...relatedText.matchAll(/<item>([\s\S]*?)<\/item>/g)];
            
            console.log("Found", itemMatches.length, "related patent candidates from RDA");
            
            for (const match of itemMatches) {
              const itemXml = match[1];
              
              const getField = (field: string): string | undefined => {
                const cdataMatch = itemXml.match(new RegExp(`<${field}><!\\[CDATA\\[([^\\]]*?)\\]\\]><\\/${field}>`, 'i'));
                if (cdataMatch) return cdataMatch[1].trim();
                const simpleMatch = itemXml.match(new RegExp(`<${field}>([^<]*)<\\/${field}>`, 'i'));
                return simpleMatch ? simpleMatch[1].trim() : undefined;
              };

              const title = getField("inventionTitle");
              const appNum = getField("applicationNumber") || "";
              const regNum = getField("registerNumber") || "";
              const applicant = getField("applicantName") || getField("applicant") || "";
              
              // 현재 특허 제외
              if (appNum === patentData.applicationNumber || regNum === patentData.registrationNumber) {
                continue;
              }

              let relatedPatentId = "";
              if (regNum && regNum.length >= 7) {
                const cleanNum = regNum.replace(/[^0-9]/g, "");
                if (cleanNum.length >= 9 && cleanNum.startsWith("10")) {
                  relatedPatentId = `10-${cleanNum.slice(2, 9)}`;
                }
              } else if (appNum && appNum.length >= 11) {
                const cleanNum = appNum.replace(/[^0-9]/g, "");
                if (cleanNum.length >= 11 && cleanNum.startsWith("10")) {
                  relatedPatentId = `10-${cleanNum.slice(2, 6)}-${cleanNum.slice(6)}`;
                }
              }

              if (relatedPatentId && title) {
                relatedPatents.push({
                  patentId: relatedPatentId,
                  title: title,
                  assignee: applicant || "농촌진흥청",
                  publicationDate: formatDate(getField("openDate") || getField("registerDate") || ""),
                  snippet: getField("astrtCont")?.substring(0, 150),
                  link: `https://www.kipris.or.kr/khome/main.jsp?searchType=1&searchText=${appNum || regNum}`,
                });
              }

              if (relatedPatents.length >= 5) break;
            }
          }
        }
      } catch (relatedError) {
        console.error("Error fetching related patents:", relatedError);
      }
    }
    
    console.log("Final related patents count:", relatedPatents.length);

    // ★ 캐시 저장: KIPRIS에서 가져온 데이터를 DB에 저장
    try {
      await sb.from("patent_data_cache").upsert({
        patent_number: trimmedNumber,
        patent_data: patentData,
        related_patents: relatedPatents,
        created_at: new Date().toISOString(),
      }, { onConflict: "patent_number" });
      console.log("Patent data cached for:", trimmedNumber);
    } catch (cacheErr) {
      console.error("Failed to cache patent data:", cacheErr);
    }

    return new Response(
      JSON.stringify({ success: true, data: patentData, relatedPatents }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fetch-patent error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
