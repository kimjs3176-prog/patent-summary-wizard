import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RdaPatent {
  patentId: string;
  title: string;
  applicant: string;
  applicationDate: string;
  thumbnail?: string;
}

// 농촌진흥청 관련 출원인 식별
const RDA_KEYWORDS = ["농촌진흥청", "농촌진흥청장"];

// 카테고리별 검색 키워드
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "식품·가공": ["식품", "가공", "발효", "저장"],
  "기능성·바이오": ["기능성", "추출물", "유용성분", "바이오"],
  "작물·재배": ["작물", "재배", "육종", "종자"],
  "농기계·스마트팜": ["농기계", "스마트팜", "자동화", "센서"],
  "축산·수산": ["축산", "사료", "양식", "수산"],
  "병해충·환경": ["병해충", "방제", "토양", "환경"],
};

// 날짜 포맷팅: 20231015 -> 2023.10.15
function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
}

// Retry fetch with exponential backoff
async function fetchWithRetry(url: string, maxRetries = 3, initialDelay = 1000): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Fetch attempt ${attempt + 1}/${maxRetries} failed:`, lastError.message);
      
      const isRetryable = lastError.message.includes('Connection reset') ||
                          lastError.message.includes('connection error') ||
                          lastError.message.includes('timeout');
      
      if (!isRetryable || attempt === maxRetries - 1) {
        throw lastError;
      }
      
      const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Fetch failed after retries');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const KIPRIS_API_KEY = Deno.env.get("KIPRIS_API_KEY");
    if (!KIPRIS_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "KIPRIS API 키가 설정되지 않았습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching RDA patents by categories...");

    // 카테고리별로 특허 수집
    const categoryResults: Record<string, RdaPatent[]> = {};

    // 무작위로 3개 카테고리 선택
    const categoryEntries = Object.entries(CATEGORY_KEYWORDS);
    const shuffledCategories = [...categoryEntries].sort(() => Math.random() - 0.5);
    const selectedCategories = shuffledCategories.slice(0, 3);

    for (const [category, keywords] of selectedCategories) {
      const categoryPatents: RdaPatent[] = [];
      // 카테고리에서 키워드 1개 무작위 선택
      const keyword = keywords[Math.floor(Math.random() * keywords.length)];

      const searchUrl = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch");
      searchUrl.searchParams.set("ServiceKey", KIPRIS_API_KEY);
      searchUrl.searchParams.set("inventionTitle", keyword);
      searchUrl.searchParams.set("astrtCont", "");
      searchUrl.searchParams.set("pageNo", "1");
      searchUrl.searchParams.set("numOfRows", "30");
      searchUrl.searchParams.set("sortSpec", "AD");
      searchUrl.searchParams.set("descSort", "true");
      searchUrl.searchParams.set("patent", "true");
      searchUrl.searchParams.set("utility", "true");

      console.log(`[${category}] Searching keyword: ${keyword}`);

      try {
        const searchResponse = await fetchWithRetry(searchUrl.toString());
        const searchText = await searchResponse.text();

        if (searchText.includes("<successYN>N</successYN>") || searchText.includes("INVALID REQUEST")) {
          console.warn(`Search failed for keyword: ${keyword}`);
          continue;
        }

        const itemMatches = [...searchText.matchAll(/<item>([\s\S]*?)<\/item>/g)];

        const getField = (xml: string, field: string): string | undefined => {
          const cdataMatch = xml.match(new RegExp(`<${field}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${field}>`, "i"));
          if (cdataMatch) return cdataMatch[1].trim();
          const simpleMatch = xml.match(new RegExp(`<${field}>([\\s\\S]*?)<\\/${field}>`, "i"));
          return simpleMatch ? simpleMatch[1].trim() : undefined;
        };

        for (const match of itemMatches) {
          const itemXml = match[1];
          const applicant = getField(itemXml, "applicantName") || "";
          const isRda = RDA_KEYWORDS.some(k => applicant.includes(k));
          if (!isRda) continue;

          const applicationNumber = getField(itemXml, "applicationNumber") || "";
          const registrationNumber = getField(itemXml, "registerNumber") || "";
          const inventionTitle = getField(itemXml, "inventionTitle") || "";
          const applicationDate = getField(itemXml, "applicationDate") || "";
          const drawing = getField(itemXml, "bigDrawing") || getField(itemXml, "drawing") || "";

          let patentId = "";
          if (registrationNumber && registrationNumber.length >= 7) {
            const cleanNum = registrationNumber.replace(/[^0-9]/g, "");
            if (cleanNum.length >= 9 && cleanNum.startsWith("10")) {
              patentId = `10-${cleanNum.slice(2, 9)}`;
            }
          } else if (applicationNumber && applicationNumber.length >= 7) {
            const cleanNum = applicationNumber.replace(/[^0-9]/g, "");
            if (cleanNum.length >= 11 && cleanNum.startsWith("10")) {
              patentId = `10-${cleanNum.slice(2, 6)}-${cleanNum.slice(6)}`;
            }
          }

          if (!patentId || !inventionTitle) continue;
          if (categoryPatents.some(p => p.patentId === patentId)) continue;

          categoryPatents.push({
            patentId,
            title: inventionTitle,
            applicant,
            applicationDate: formatDate(applicationDate),
            thumbnail: drawing || undefined,
          });
        }
      } catch (err) {
        console.error(`Error searching keyword ${keyword}:`, err);
      }

      // 카테고리당 최대 3개 무작위 선택
      const shuffled = categoryPatents.sort(() => Math.random() - 0.5);
      categoryResults[category] = shuffled.slice(0, 3);
      console.log(`[${category}] Selected ${categoryResults[category].length} patents`);
    }

    // 빈 카테고리 제거
    const filteredResults: Record<string, RdaPatent[]> = {};
    for (const [cat, pats] of Object.entries(categoryResults)) {
      if (pats.length > 0) filteredResults[cat] = pats;
    }

    console.log(`Returning ${Object.keys(filteredResults).length} categories`);

    return new Response(
      JSON.stringify({ success: true, categories: filteredResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("rda-latest-patents error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
