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

// 농업 관련 검색 키워드 (무작위 선택)
const AGRI_KEYWORDS = ["농업", "작물", "재배", "토양", "비료", "수확", "병해충", "축산", "양봉", "온실", "관개", "육종"];

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

    console.log("Fetching RDA (농촌진흥청) latest patents...");

    // 무작위 농업 키워드 2개 선택
    const shuffledKeywords = [...AGRI_KEYWORDS].sort(() => Math.random() - 0.5);
    const selectedKeywords = shuffledKeywords.slice(0, 2);
    
    const allRdaPatents: RdaPatent[] = [];

    // 각 키워드로 검색하여 농촌진흥청 특허 수집
    for (const keyword of selectedKeywords) {
      const searchUrl = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch");
      searchUrl.searchParams.set("ServiceKey", KIPRIS_API_KEY);
      searchUrl.searchParams.set("inventionTitle", keyword);
      searchUrl.searchParams.set("astrtCont", "");
      searchUrl.searchParams.set("pageNo", "1");
      searchUrl.searchParams.set("numOfRows", "30");
      searchUrl.searchParams.set("sortSpec", "AD"); // 출원일 기준
      searchUrl.searchParams.set("descSort", "true"); // 최신순
      searchUrl.searchParams.set("patent", "true");
      searchUrl.searchParams.set("utility", "true");

      console.log(`Searching with keyword: ${keyword}`);

      try {
        const searchResponse = await fetchWithRetry(searchUrl.toString());
        const searchText = await searchResponse.text();

        if (searchText.includes("<successYN>N</successYN>") || 
            searchText.includes("INVALID REQUEST")) {
          console.warn(`Search failed for keyword: ${keyword}`);
          continue;
        }

        const itemMatches = [...searchText.matchAll(/<item>([\s\S]*?)<\/item>/g)];
        console.log(`Found ${itemMatches.length} items for keyword: ${keyword}`);

        // XML 필드 추출 헬퍼
        const getField = (xml: string, field: string): string | undefined => {
          const cdataMatch = xml.match(new RegExp(`<${field}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${field}>`, "i"));
          if (cdataMatch) return cdataMatch[1].trim();
          const simpleMatch = xml.match(new RegExp(`<${field}>([\\s\\S]*?)<\\/${field}>`, "i"));
          return simpleMatch ? simpleMatch[1].trim() : undefined;
        };

        for (const match of itemMatches) {
          const itemXml = match[1];
          const applicant = getField(itemXml, "applicantName") || "";

          // 농촌진흥청 특허인지 확인
          const isRda = RDA_KEYWORDS.some(k => applicant.includes(k));
          if (!isRda) continue;

          const applicationNumber = getField(itemXml, "applicationNumber") || "";
          const registrationNumber = getField(itemXml, "registerNumber") || "";
          const inventionTitle = getField(itemXml, "inventionTitle") || "";
          const applicationDate = getField(itemXml, "applicationDate") || "";
          const drawing = getField(itemXml, "bigDrawing") || getField(itemXml, "drawing") || "";

          // 특허 ID 생성
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

          // 중복 체크
          if (allRdaPatents.some(p => p.patentId === patentId)) continue;

          allRdaPatents.push({
            patentId,
            title: inventionTitle,
            applicant: applicant,
            applicationDate: formatDate(applicationDate),
            thumbnail: drawing || undefined,
          });
        }
      } catch (err) {
        console.error(`Error searching keyword ${keyword}:`, err);
      }
    }

    console.log(`Total RDA patents found: ${allRdaPatents.length}`);

    // 무작위로 6개 선택
    const shuffled = allRdaPatents.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 6);

    console.log(`Returning ${selected.length} random RDA patents`);

    return new Response(
      JSON.stringify({ success: true, patents: selected }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("rda-latest-patents error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "알 수 없는 오류" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
