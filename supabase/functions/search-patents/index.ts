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
  isRDA?: boolean; // 농촌진흥청 여부
}

// 농촌진흥청 출원인 식별자
const RDA_APPLICANT_ID = "219980050314";
const RDA_APPLICANT_NAME = "농촌진흥청";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { keyword } = await req.json();

    if (!keyword || keyword.trim().length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: "검색어를 2자 이상 입력해주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const KIPRIS_API_KEY = Deno.env.get("KIPRIS_API_KEY");
    if (!KIPRIS_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "KIPRIS API 키가 설정되지 않았습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Searching patents with keyword:", keyword);

    // KIPRIS Plus API - 전체검색 (getAdvancedSearch)
    // 문서: https://plus.kipris.or.kr/portal/popup/DBII_000000000000001/SC002/ADI_0000000000002944/apiDescriptionSearch.do
    // 파라미터: word, inventionTitle, applicant, pageNo, numOfRows, sortSpec, descSort, patent, utility
    const searchUrl = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch");
    searchUrl.searchParams.set("ServiceKey", KIPRIS_API_KEY);
    searchUrl.searchParams.set("inventionTitle", keyword.trim()); // 발명명칭 검색
    searchUrl.searchParams.set("astrtCont", ""); // 초록 (빈값)
    searchUrl.searchParams.set("pageNo", "1");
    searchUrl.searchParams.set("numOfRows", "30");
    searchUrl.searchParams.set("sortSpec", "AD");
    searchUrl.searchParams.set("descSort", "true");
    searchUrl.searchParams.set("patent", "true");
    searchUrl.searchParams.set("utility", "true");

    console.log("KIPRIS API URL:", searchUrl.toString().replace(KIPRIS_API_KEY, "***"));

    const searchResponse = await fetch(searchUrl.toString());
    const searchText = await searchResponse.text();
    
    console.log("KIPRIS API response status:", searchResponse.status);
    console.log("KIPRIS API response preview:", searchText.substring(0, 1500));

    // Check for API error response
    if (searchText.includes("<successYN>N</successYN>") || 
        searchText.includes("INVALID REQUEST") ||
        searchText.includes("503 Service") ||
        searchText.includes("<resultCode>10</resultCode>")) {
      const errorMsg = searchText.match(/<resultMsg>([^<]+)<\/resultMsg>/)?.[1] || "API 응답 오류";
      console.error("KIPRIS API error:", errorMsg);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "KIPRIS API 연결에 문제가 있습니다. API 키와 서비스 구독 상태를 확인해주세요. (오류: " + errorMsg + ")" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!searchResponse.ok) {
      console.error("KIPRIS API error:", searchText);
      return new Response(
        JSON.stringify({ success: false, error: "KIPRIS 특허 검색에 실패했습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse XML response
    const patents: KeywordSearchResult[] = [];
    
    // KIPRIS API 응답의 items 태그 내 item 추출
    let itemMatches = [...searchText.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    if (itemMatches.length === 0) {
      // PatentUtilityInfo 태그도 시도
      itemMatches = [...searchText.matchAll(/<PatentUtilityInfo>([\s\S]*?)<\/PatentUtilityInfo>/g)];
    }
    
    console.log("Found", itemMatches.length, "patent items in response");
    
    for (const match of itemMatches) {
      const itemXml = match[1];
      
      // Extract fields from XML
      const getField = (field: string): string | undefined => {
        // Try CDATA format first
        const cdataMatch = itemXml.match(new RegExp(`<${field}><!\\[CDATA\\[([^\\]]*?)\\]\\]><\\/${field}>`, 'i'));
        if (cdataMatch) return cdataMatch[1].trim();
        // Then try simple format
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
      const drawing = getField("drawing") || "";
      
      // 농촌진흥청 출원 여부 확인
      const isRDA = applicant.includes(RDA_APPLICANT_ID) || 
                    applicant.includes("농촌진흥청") ||
                    applicant.includes(RDA_APPLICANT_NAME);
      
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
      
      patents.push({
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
        isRDA,
      });
    }

    // 농촌진흥청 특허를 우선 정렬
    patents.sort((a, b) => {
      if (a.isRDA && !b.isRDA) return -1;
      if (!a.isRDA && b.isRDA) return 1;
      return 0;
    });

    // 상위 15건만 반환
    const topPatents = patents.slice(0, 15);

    console.log(`Found ${patents.length} patents for keyword: ${keyword} (RDA: ${patents.filter(p => p.isRDA).length})`);

    return new Response(
      JSON.stringify({ success: true, patents: topPatents, keyword: keyword.trim(), totalCount: patents.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("search-patents error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "알 수 없는 오류" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// 날짜 포맷팅: 20231015 -> 2023.10.15
function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
}
