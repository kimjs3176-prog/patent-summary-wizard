import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// 특허번호에서 KIPRIS 검색용 번호 추출
function parsePatentNumber(input: string): { applicationNumber?: string; registrationNumber?: string; displayNumber: string; searchType: 'registration' | 'application' } {
  const trimmed = input.trim();
  
  // 등록번호 형식: 10-1234567
  const regMatch = trimmed.match(/^10-(\d{7})$/);
  if (regMatch) {
    return {
      registrationNumber: `10${regMatch[1]}00`,
      displayNumber: trimmed,
      searchType: 'registration'
    };
  }
  
  // 등록번호 형식 (6자리): 10-186227 -> 10-0186227
  const regMatch6 = trimmed.match(/^10-(\d{6})$/);
  if (regMatch6) {
    const paddedNum = regMatch6[1].padStart(7, '0');
    return {
      registrationNumber: `10${paddedNum}00`,
      displayNumber: `10-${paddedNum}`,
      searchType: 'registration'
    };
  }
  
  // 출원번호 형식: 10-2023-0123456
  const appMatch = trimmed.match(/^10-(\d{4})-(\d{7})$/);
  if (appMatch) {
    return {
      applicationNumber: `10${appMatch[1]}${appMatch[2]}`,
      displayNumber: trimmed,
      searchType: 'application'
    };
  }
  
  // 순수 7자리 숫자 (등록번호)
  const pureRegMatch = trimmed.match(/^(\d{7})$/);
  if (pureRegMatch) {
    return {
      registrationNumber: `10${pureRegMatch[1]}00`,
      displayNumber: `10-${pureRegMatch[1]}`,
      searchType: 'registration'
    };
  }
  
  // 순수 6자리 숫자 (등록번호, 앞자리 0 생략)
  const pureRegMatch6 = trimmed.match(/^(\d{6})$/);
  if (pureRegMatch6) {
    const paddedNum = pureRegMatch6[1].padStart(7, '0');
    return {
      registrationNumber: `10${paddedNum}00`,
      displayNumber: `10-${paddedNum}`,
      searchType: 'registration'
    };
  }
  
  // 기본값
  return {
    applicationNumber: trimmed.replace(/-/g, ''),
    displayNumber: trimmed,
    searchType: 'application'
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patentNumber } = await req.json();

    if (!patentNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "특허 번호를 입력해주세요." }),
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

    const parsed = parsePatentNumber(patentNumber);
    console.log("Fetching patent:", patentNumber, "->", parsed);

    let patentData: PatentData = {
      displayNumber: parsed.displayNumber,
      searchType: parsed.searchType,
    };

    // KIPRIS API로 특허 상세정보 조회
    // 1. 먼저 출원번호로 상세정보 조회 시도
    let detailData: string | null = null;
    let applicationNo = parsed.applicationNumber;

    // 등록번호로 검색하는 경우, 먼저 등록번호로 출원번호를 찾아야 함
    if (parsed.searchType === 'registration' && parsed.registrationNumber) {
      // 등록번호로 검색하여 출원번호 찾기
      const searchUrl = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/freeSearchInfo");
      searchUrl.searchParams.set("accessKey", KIPRIS_API_KEY);
      searchUrl.searchParams.set("freeSearchWord", parsed.displayNumber.replace(/-/g, ''));
      searchUrl.searchParams.set("docsStart", "1");
      searchUrl.searchParams.set("docsCount", "5");

      console.log("Searching by registration number...");
      const searchResponse = await fetch(searchUrl.toString());
      const searchText = await searchResponse.text();

      // 검색 결과에서 출원번호 추출
      const appNumMatch = searchText.match(/<applicationNumber><!?\[?C?D?A?T?A?\[?([^\]<]+)\]?\]?<\/applicationNumber>/);
      if (appNumMatch) {
        applicationNo = appNumMatch[1].trim();
        console.log("Found application number:", applicationNo);
      }
    }

    // 출원번호로 상세정보 조회
    if (applicationNo) {
      const detailUrl = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getBibliographyDetailInfoSearch");
      detailUrl.searchParams.set("accessKey", KIPRIS_API_KEY);
      detailUrl.searchParams.set("applicationNumber", applicationNo);

      console.log("Fetching detail info for:", applicationNo);
      const detailResponse = await fetch(detailUrl.toString());
      detailData = await detailResponse.text();
      
      if (detailResponse.ok && detailData) {
        // XML에서 필드 추출 헬퍼
        const getField = (xml: string, field: string): string | undefined => {
          const cdataMatch = xml.match(new RegExp(`<${field}><!\\[CDATA\\[([^\\]]*?)\\]\\]><\\/${field}>`));
          if (cdataMatch) return cdataMatch[1].trim();
          const simpleMatch = xml.match(new RegExp(`<${field}>([^<]*)<\\/${field}>`));
          return simpleMatch ? simpleMatch[1].trim() : undefined;
        };

        const getFields = (xml: string, field: string): string[] => {
          const results: string[] = [];
          const regex = new RegExp(`<${field}><!?\\[?C?D?A?T?A?\\[?([^\\]<]+)\\]?\\]?<\\/${field}>`, 'g');
          let match;
          while ((match = regex.exec(xml)) !== null) {
            if (match[1].trim()) results.push(match[1].trim());
          }
          return results;
        };

        patentData = {
          ...patentData,
          title: getField(detailData, "inventionTitle") || getField(detailData, "inventionName"),
          titleKo: getField(detailData, "inventionTitle") || getField(detailData, "inventionName"),
          abstract: getField(detailData, "astrtCont") || getField(detailData, "abstract"),
          applicant: getField(detailData, "applicant"),
          assignee: getField(detailData, "applicant"),
          inventors: getFields(detailData, "inventor"),
          filingDate: formatDate(getField(detailData, "applicationDate") || ""),
          publicationDate: formatDate(getField(detailData, "openDate") || getField(detailData, "publicDate") || ""),
          registrationDate: formatDate(getField(detailData, "registerDate") || ""),
          applicationNumber: getField(detailData, "applicationNumber"),
          registrationNumber: getField(detailData, "registrationNumber"),
          classifications: getFields(detailData, "ipcNumber"),
        };
      }
    }

    // 상세정보가 없으면 키워드 검색으로 기본 정보 조회
    if (!patentData.title) {
      const searchUrl = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/freeSearchInfo");
      searchUrl.searchParams.set("accessKey", KIPRIS_API_KEY);
      searchUrl.searchParams.set("freeSearchWord", patentNumber.replace(/-/g, ''));
      searchUrl.searchParams.set("docsStart", "1");
      searchUrl.searchParams.set("docsCount", "5");

      console.log("Falling back to keyword search...");
      const searchResponse = await fetch(searchUrl.toString());
      const searchText = await searchResponse.text();

      const getField = (xml: string, field: string): string | undefined => {
        const cdataMatch = xml.match(new RegExp(`<${field}><!\\[CDATA\\[([^\\]]*?)\\]\\]><\\/${field}>`));
        if (cdataMatch) return cdataMatch[1].trim();
        const simpleMatch = xml.match(new RegExp(`<${field}>([^<]*)<\\/${field}>`));
        return simpleMatch ? simpleMatch[1].trim() : undefined;
      };

      // 첫 번째 결과 사용
      const itemMatch = searchText.match(/<PatentUtilityInfo>([\s\S]*?)<\/PatentUtilityInfo>/);
      if (itemMatch) {
        const itemXml = itemMatch[1];
        patentData = {
          ...patentData,
          title: getField(itemXml, "inventionTitle"),
          titleKo: getField(itemXml, "inventionTitle"),
          applicant: getField(itemXml, "applicant"),
          assignee: getField(itemXml, "applicant"),
          filingDate: formatDate(getField(itemXml, "applicationDate") || ""),
          publicationDate: formatDate(getField(itemXml, "openDate") || ""),
          applicationNumber: getField(itemXml, "applicationNumber"),
          registrationNumber: getField(itemXml, "registrationNumber"),
        };
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

    // displayNumber 재설정 (조회된 데이터 기반)
    if (patentData.registrationNumber && patentData.searchType === 'registration') {
      const regNum = patentData.registrationNumber.replace(/^10/, '').slice(0, 7);
      patentData.displayNumber = `10-${regNum}`;
    } else if (patentData.applicationNumber) {
      const appNum = patentData.applicationNumber.replace(/^10/, '');
      if (appNum.length >= 11) {
        patentData.displayNumber = `10-${appNum.slice(0, 4)}-${appNum.slice(4)}`;
      }
    }

    patentData.patentNumber = patentData.displayNumber;

    console.log("Patent data fetched successfully:", patentData.title);

    // 관련 특허 검색 (제목 키워드 기반)
    let relatedPatents: RelatedPatent[] = [];
    
    if (patentData.title) {
      try {
        // 제목에서 주요 키워드 추출 (2-3단어)
        const keywords = patentData.title
          .replace(/[^\uAC00-\uD7A3a-zA-Z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 2)
          .slice(0, 2)
          .join(' ');

        if (keywords) {
          const relatedUrl = new URL("http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/freeSearchInfo");
          relatedUrl.searchParams.set("accessKey", KIPRIS_API_KEY);
          relatedUrl.searchParams.set("freeSearchWord", keywords);
          relatedUrl.searchParams.set("docsStart", "1");
          relatedUrl.searchParams.set("docsCount", "10");
          relatedUrl.searchParams.set("sortSpec", "AD");
          relatedUrl.searchParams.set("descSort", "true");

          const relatedResponse = await fetch(relatedUrl.toString());
          const relatedText = await relatedResponse.text();

          if (relatedResponse.ok) {
            const itemMatches = relatedText.matchAll(/<PatentUtilityInfo>([\s\S]*?)<\/PatentUtilityInfo>/g);
            
            for (const match of itemMatches) {
              const itemXml = match[1];
              
              const getField = (field: string): string | undefined => {
                const cdataMatch = itemXml.match(new RegExp(`<${field}><!\\[CDATA\\[([^\\]]*?)\\]\\]><\\/${field}>`));
                if (cdataMatch) return cdataMatch[1].trim();
                const simpleMatch = itemXml.match(new RegExp(`<${field}>([^<]*)<\\/${field}>`));
                return simpleMatch ? simpleMatch[1].trim() : undefined;
              };

              const title = getField("inventionTitle");
              const appNum = getField("applicationNumber") || "";
              const regNum = getField("registrationNumber") || "";
              
              // 현재 특허 제외
              if (appNum === patentData.applicationNumber || regNum === patentData.registrationNumber) {
                continue;
              }

              let relatedPatentId = "";
              if (regNum && regNum.length > 0) {
                const num = regNum.replace(/^10/, '').slice(0, 7);
                relatedPatentId = `10-${num}`;
              } else if (appNum && appNum.length > 0) {
                const num = appNum.replace(/^10/, '');
                if (num.length >= 11) {
                  relatedPatentId = `10-${num.slice(0, 4)}-${num.slice(4)}`;
                }
              }

              if (relatedPatentId && title) {
                relatedPatents.push({
                  patentId: relatedPatentId,
                  title: title,
                  assignee: getField("applicant"),
                  publicationDate: formatDate(getField("openDate") || getField("registerDate") || ""),
                  link: `https://www.kipris.or.kr/khome/main.jsp?searchType=1&searchText=${appNum}`,
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

    return new Response(
      JSON.stringify({ success: true, data: patentData, relatedPatents }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fetch-patent error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "알 수 없는 오류" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
