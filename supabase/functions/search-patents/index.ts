import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
];

const AGRI_ORG_IDS = AGRI_ORGANIZATIONS.map(org => org.id);
const AGRI_ORG_NAMES = AGRI_ORGANIZATIONS.map(org => org.name);

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

    // Validate keyword: type, length, allowed characters
    if (!keyword || typeof keyword !== "string" || keyword.trim().length < 1) {
      return new Response(
        JSON.stringify({ success: false, error: "검색어를 1자 이상 입력해주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (keyword.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: "검색어는 100자 이내로 입력해주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow Korean, alphanumeric, spaces, hyphens
    if (!/^[\w\s가-힣ㄱ-ㅎㅏ-ㅣ\-(),.]+$/u.test(keyword.trim())) {
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

    console.log("Searching patents with keyword:", keyword);

    // 키워드를 공백으로 분리해서 AND 조건으로 결합 (e.g. "쌀 가공 기술" -> "쌀*가공*기술")
    const rawKeyword = keyword.trim();
    const words = rawKeyword.split(/\s+/).filter((w: string) => w.length > 0);
    // 2글자 이상 단어들만 추출하되, 전체가 1단어면 그대로 사용
    const searchKeyword = words.length > 1
      ? words.filter((w: string) => w.length >= 1).join("*")
      : rawKeyword;

    console.log("Processed search keyword:", searchKeyword);

    // 농업 기관별로 검색 수행
    const allPatents: KeywordSearchResult[] = [];

    for (const org of AGRI_ORGANIZATIONS) {
      try {
        // KIPRIS Plus API - 전체검색 (getAdvancedSearch)
        const searchUrl = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch");
        searchUrl.searchParams.set("ServiceKey", KIPRIS_API_KEY);
        searchUrl.searchParams.set("inventionTitle", searchKeyword);
        searchUrl.searchParams.set("applicant", org.id); // 출원인 코드로 필터링
        searchUrl.searchParams.set("astrtCont", "");
        searchUrl.searchParams.set("pageNo", "1");
        searchUrl.searchParams.set("numOfRows", "20");
        searchUrl.searchParams.set("sortSpec", "AD");
        searchUrl.searchParams.set("descSort", "true");
        searchUrl.searchParams.set("patent", "true");
        searchUrl.searchParams.set("utility", "true");

        console.log(`Searching patents for org: ${org.name} (${org.id})`);

        const searchResponse = await fetch(searchUrl.toString());
        const searchText = await searchResponse.text();
        
        if (!searchResponse.ok || searchText.includes("<successYN>N</successYN>")) {
          console.log(`No results or error for org: ${org.name}`);
          continue;
        }

        // Parse XML response
        let itemMatches = [...searchText.matchAll(/<item>([\s\S]*?)<\/item>/g)];
        if (itemMatches.length === 0) {
          itemMatches = [...searchText.matchAll(/<PatentUtilityInfo>([\s\S]*?)<\/PatentUtilityInfo>/g)];
        }
        
        console.log(`Found ${itemMatches.length} patents for ${org.name}`);
        
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
          
          // 특허 ID 생성 (등록번호 우선, 없으면 출원번호)
          let patentId = "";
          let displayNumber = "";
          
          if (registrationNumber && registrationNumber.length >= 7) {
            const cleanNum = registrationNumber.replace(/[^0-9]/g, "");
            if (cleanNum.length >= 9 && cleanNum.startsWith("10")) {
              const regNum = cleanNum.slice(2, 9);
              displayNumber = `10-${regNum}`;
            } else if (cleanNum.length >= 7) {
              displayNumber = `10-${cleanNum.slice(-7)}`;
            }
            patentId = displayNumber;
          } else if (applicationNumber && applicationNumber.length >= 7) {
            const cleanNum = applicationNumber.replace(/[^0-9]/g, "");
            if (cleanNum.length >= 13 && cleanNum.startsWith("10")) {
              const year = cleanNum.slice(2, 6);
              const num = cleanNum.slice(6);
              displayNumber = `10-${year}-${num}`;
            } else if (cleanNum.length >= 11) {
              displayNumber = `10-${cleanNum.slice(0, 4)}-${cleanNum.slice(4)}`;
            } else {
              displayNumber = `10-${cleanNum}`;
            }
            patentId = displayNumber;
          }
          
          if (!patentId || !inventionTitle) continue;
          
          allPatents.push({
            patentId,
            title: inventionTitle,
            titleKo: inventionTitle,
            applicant: applicant,
            assignee: applicant,
            applicationDate: applicationDate ? formatDate(applicationDate) : undefined,
            publicationDate: openDate ? formatDate(openDate) : (publicationDate ? formatDate(publicationDate) : (registerDate ? formatDate(registerDate) : undefined)),
            applicationNumber: applicationNumber,
            registrationNumber: registrationNumber,
            snippet: astrtCont ? astrtCont.substring(0, 150) + (astrtCont.length > 150 ? "..." : "") : undefined,
            thumbnail: drawing || undefined,
            organizationName: org.name,
          });
        }
      } catch (orgError) {
        console.error(`Error searching for org ${org.name}:`, orgError);
        continue;
      }
    }

    // 중복 제거 (patentId 기준)
    const uniquePatents = Array.from(
      new Map(allPatents.map(p => [p.patentId, p])).values()
    );

    // 상위 15건만 반환
    const topPatents = uniquePatents.slice(0, 15);

    console.log(`Total unique patents found: ${uniquePatents.length}, returning: ${topPatents.length}`);

    return new Response(
      JSON.stringify({ success: true, patents: topPatents, keyword: keyword.trim(), totalCount: uniquePatents.length }),
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
