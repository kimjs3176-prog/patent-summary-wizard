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
  filingDate?: string;
  publicationDate?: string;
  claims?: string[];
  patentNumber?: string;
  applicationNumber?: string;
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

// Parse XML text content helper
function getXmlText(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

// Parse multiple XML elements
function getXmlTexts(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'gi');
  const matches = [...xml.matchAll(regex)];
  return matches.map(m => m[1].trim()).filter(Boolean);
}

// Parse XML items (for nested structures)
function getXmlItems(xml: string, itemTag: string): string[] {
  const regex = new RegExp(`<${itemTag}[^>]*>([\\s\\S]*?)</${itemTag}>`, 'gi');
  const matches = [...xml.matchAll(regex)];
  return matches.map(m => m[1]);
}

// Format Korean patent number for KIPRIS API
function formatPatentNumber(patentNumber: string): { formattedNumber: string; searchType: 'registration' | 'application'; displayNumber: string } {
  const cleaned = patentNumber.trim();
  let searchType: 'registration' | 'application' = 'registration';
  let displayNumber = cleaned;
  let formattedNumber = '';

  // Check for application number format: 10-2023-0123456 or 1020230123456
  if (cleaned.match(/^10-\d{4}-\d{7}$/)) {
    // Application number format: 10-2023-0123456
    searchType = 'application';
    formattedNumber = cleaned.replace(/-/g, '');
    displayNumber = cleaned;
  } else if (cleaned.match(/^10\d{4}\d{7}$/)) {
    // Application number without dashes: 1020230123456
    searchType = 'application';
    formattedNumber = cleaned;
    displayNumber = `10-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.match(/^10-\d{7}$/)) {
    // Registration number format: 10-1234567
    searchType = 'registration';
    formattedNumber = cleaned.replace(/-/g, '');
    displayNumber = cleaned;
  } else if (cleaned.match(/^\d{7}$/)) {
    // Just 7 digits (registration without prefix): 1234567
    searchType = 'registration';
    formattedNumber = `10${cleaned}`;
    displayNumber = `10-${cleaned}`;
  } else if (cleaned.match(/^10\d{7}$/)) {
    // 8 digits starting with 10: 101234567
    searchType = 'registration';
    formattedNumber = cleaned;
    displayNumber = `10-${cleaned.slice(2)}`;
  } else {
    // Default: treat as registration, remove dashes
    formattedNumber = cleaned.replace(/-/g, '');
    if (!formattedNumber.startsWith('10')) {
      formattedNumber = `10${formattedNumber}`;
    }
    displayNumber = cleaned;
  }

  return { formattedNumber, searchType, displayNumber };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patentNumber } = await req.json();

    if (!patentNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "특허 등록번호를 입력해주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let KIPRIS_API_KEY = Deno.env.get("KIPRIS_API_KEY");
    if (!KIPRIS_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "KIPRIS API 키가 설정되지 않았습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Decode URL-encoded API key if needed
    try {
      KIPRIS_API_KEY = decodeURIComponent(KIPRIS_API_KEY);
    } catch {
      // Already decoded, use as-is
    }

    const { formattedNumber, searchType, displayNumber } = formatPatentNumber(patentNumber);
    console.log("Fetching patent from KIPRIS:", formattedNumber, "type:", searchType);

    // Step 1: Search for patent using keyword/free search (more universally accessible)
    // Try the newer kipo-api endpoint first, then fall back to openapi/rest
    const encodedKey = encodeURIComponent(KIPRIS_API_KEY);
    
    // Use patent bibliographic search with the patent number
    let searchUrl = `http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch?registrationNumber=${formattedNumber}&ServiceKey=${encodedKey}&numOfRows=1`;
    
    console.log("Trying kipo-api search...");
    let searchResponse = await fetch(searchUrl);
    let searchXml = await searchResponse.text();
    console.log("Search response (kipo-api):", searchXml.substring(0, 500));
    
    // If kipo-api fails, try the openapi/rest endpoint
    if (searchXml.includes('<resultCode>') && !searchXml.includes('<resultCode>00</resultCode>')) {
      console.log("kipo-api failed, trying openapi/rest...");
      
      if (searchType === 'registration') {
        searchUrl = `http://plus.kipris.or.kr/openapi/rest/patUtiModInfoSearchSevice/registrationNumberSearchInfo?registrationNumber=${formattedNumber}&accessKey=${encodedKey}`;
      } else {
        searchUrl = `http://plus.kipris.or.kr/openapi/rest/patUtiModInfoSearchSevice/applicationNumberSearchInfo?applicationNumber=${formattedNumber}&accessKey=${encodedKey}`;
      }
      
      console.log("Search URL:", searchUrl);
      searchResponse = await fetch(searchUrl);
      searchXml = await searchResponse.text();
      console.log("Search response (openapi):", searchXml.substring(0, 500));
    }

    // Check for errors
    if (searchXml.includes('<errMsg>') || searchXml.includes('<resultCode>E</resultCode>')) {
      const errorMsg = getXmlText(searchXml, 'errMsg') || '특허 정보를 조회할 수 없습니다.';
      console.error("KIPRIS API error:", errorMsg);
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse search results
    const items = getXmlItems(searchXml, 'PatentUtilityInfo');
    if (items.length === 0) {
      // Try alternative search - free search with the number
      const freeSearchUrl = `http://plus.kipris.or.kr/openapi/rest/patUtiModInfoSearchSevice/freeSearchInfo?word=${formattedNumber}&accessKey=${KIPRIS_API_KEY}&numOfRows=1`;
      console.log("Trying free search:", freeSearchUrl);
      
      const freeSearchResponse = await fetch(freeSearchUrl);
      const freeSearchXml = await freeSearchResponse.text();
      console.log("Free search response:", freeSearchXml.substring(0, 500));
      
      const freeItems = getXmlItems(freeSearchXml, 'PatentUtilityInfo');
      if (freeItems.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "해당 번호의 특허를 찾을 수 없습니다. 등록번호를 확인해주세요." 
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      items.push(...freeItems);
    }

    const firstItem = items[0];
    
    // Extract basic info from search result
    const applicationNumber = getXmlText(firstItem, 'ApplicationNumber') || getXmlText(firstItem, 'applicationNumber');
    const registrationNumber = getXmlText(firstItem, 'RegistrationNumber') || getXmlText(firstItem, 'registrationNumber');
    const inventionName = getXmlText(firstItem, 'InventionName') || getXmlText(firstItem, 'inventionName');
    const abstractText = getXmlText(firstItem, 'Abstract') || getXmlText(firstItem, 'abstract') || getXmlText(firstItem, 'astrtCont');
    
    // Step 2: Get detailed bibliographic information
    const applicationNum = applicationNumber || formattedNumber;
    const biblioUrl = `http://plus.kipris.or.kr/openapi/rest/patUtiModInfoSearchSevice/biblioSearchInfo?applicationNumber=${applicationNum}&accessKey=${KIPRIS_API_KEY}`;
    
    console.log("Fetching biblio info:", biblioUrl);
    const biblioResponse = await fetch(biblioUrl);
    const biblioXml = await biblioResponse.text();
    console.log("Biblio response:", biblioXml.substring(0, 500));

    // Parse bibliographic details
    const biblioItems = getXmlItems(biblioXml, 'BiblioSummaryInfo') || getXmlItems(biblioXml, 'PatentUtilityInfo');
    const biblioItem = biblioItems[0] || firstItem;
    
    // Extract detailed information
    const applicantName = getXmlText(biblioItem, 'Applicant') || getXmlText(biblioItem, 'applicantName') || 
                          getXmlText(biblioItem, 'ApplicantName') || getXmlText(firstItem, 'Applicant');
    const inventorNames = getXmlTexts(biblioItem, 'InventorName') || getXmlTexts(biblioItem, 'inventorName') || 
                          getXmlTexts(firstItem, 'InventorName');
    const applicationDate = getXmlText(biblioItem, 'ApplicationDate') || getXmlText(biblioItem, 'applicationDate') ||
                           getXmlText(firstItem, 'ApplicationDate');
    const publicationDate = getXmlText(biblioItem, 'PublicationDate') || getXmlText(biblioItem, 'publicationDate') ||
                           getXmlText(biblioItem, 'OpenDate') || getXmlText(firstItem, 'OpenDate');
    const registrationDate = getXmlText(biblioItem, 'RegistrationDate') || getXmlText(biblioItem, 'registrationDate');
    
    // Get IPC classifications
    const ipcCodes = getXmlTexts(biblioItem, 'IpcCode') || getXmlTexts(biblioItem, 'ipcCode') ||
                     getXmlTexts(firstItem, 'IpcCode');

    // Step 3: Try to get representative image
    let representativeImage: string | undefined;
    try {
      const imageUrl = `http://plus.kipris.or.kr/openapi/rest/patUtiModInfoSearchSevice/patentRepresentativeImageInfo?applicationNumber=${applicationNum}&accessKey=${KIPRIS_API_KEY}`;
      const imageResponse = await fetch(imageUrl);
      const imageXml = await imageResponse.text();
      
      const imagePath = getXmlText(imageXml, 'LargeImage') || getXmlText(imageXml, 'largeImage') ||
                       getXmlText(imageXml, 'SmallImage') || getXmlText(imageXml, 'smallImage') ||
                       getXmlText(imageXml, 'ImagePath') || getXmlText(imageXml, 'imagePath');
      
      if (imagePath && imagePath.startsWith('http')) {
        representativeImage = imagePath;
      }
    } catch (imageError) {
      console.error("Error fetching representative image:", imageError);
    }

    // Step 4: Try to get claims
    const claims: string[] = [];
    try {
      const claimUrl = `http://plus.kipris.or.kr/openapi/rest/patUtiModInfoSearchSevice/claimSearchInfo?applicationNumber=${applicationNum}&accessKey=${KIPRIS_API_KEY}`;
      const claimResponse = await fetch(claimUrl);
      const claimXml = await claimResponse.text();
      
      const claimTexts = getXmlTexts(claimXml, 'Claim') || getXmlTexts(claimXml, 'claim') ||
                        getXmlTexts(claimXml, 'ClaimScope');
      claims.push(...claimTexts.slice(0, 10));
    } catch (claimError) {
      console.error("Error fetching claims:", claimError);
    }

    // Format dates for display
    const formatDate = (dateStr: string): string => {
      if (!dateStr || dateStr.length < 8) return dateStr;
      // Convert YYYYMMDD to YYYY.MM.DD
      return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
    };

    const patentData: PatentData = {
      title: inventionName,
      titleKo: inventionName,
      abstract: abstractText,
      inventors: inventorNames.length > 0 ? inventorNames : undefined,
      assignee: applicantName,
      filingDate: formatDate(applicationDate),
      publicationDate: formatDate(publicationDate || registrationDate),
      claims: claims.length > 0 ? claims : undefined,
      patentNumber: registrationNumber || applicationNumber,
      applicationNumber: applicationNumber,
      displayNumber: displayNumber,
      searchType: searchType,
      classifications: ipcCodes.length > 0 ? ipcCodes : undefined,
      representativeImage: representativeImage,
    };

    console.log("Patent data fetched successfully:", patentData.title);

    // Step 5: Fetch related patents based on IPC or title keywords
    let relatedPatents: RelatedPatent[] = [];
    
    try {
      // Search for related patents using IPC code or keywords from title
      const searchQuery = (ipcCodes.length > 0 ? ipcCodes[0].split('/')[0] : '') ||
                          (inventionName ? inventionName.split(' ').slice(0, 2).join(' ') : '');
      
      if (searchQuery) {
        const relatedUrl = `http://plus.kipris.or.kr/openapi/rest/patUtiModInfoSearchSevice/freeSearchInfo?word=${encodeURIComponent(searchQuery)}&accessKey=${KIPRIS_API_KEY}&numOfRows=6`;
        
        const relatedResponse = await fetch(relatedUrl);
        const relatedXml = await relatedResponse.text();
        
        const relatedItems = getXmlItems(relatedXml, 'PatentUtilityInfo');
        
        relatedPatents = relatedItems
          .filter(item => {
            const itemRegNum = getXmlText(item, 'RegistrationNumber') || getXmlText(item, 'registrationNumber');
            const itemAppNum = getXmlText(item, 'ApplicationNumber') || getXmlText(item, 'applicationNumber');
            // Filter out the current patent
            return itemRegNum !== registrationNumber && itemAppNum !== applicationNumber;
          })
          .slice(0, 5)
          .map(item => {
            const itemAppNum = getXmlText(item, 'ApplicationNumber') || getXmlText(item, 'applicationNumber');
            const itemRegNum = getXmlText(item, 'RegistrationNumber') || getXmlText(item, 'registrationNumber');
            const itemTitle = getXmlText(item, 'InventionName') || getXmlText(item, 'inventionName') || '제목 없음';
            const itemApplicant = getXmlText(item, 'Applicant') || getXmlText(item, 'applicantName');
            const itemOpenDate = getXmlText(item, 'OpenDate') || getXmlText(item, 'PublicationDate');
            const itemAbstract = getXmlText(item, 'Abstract') || getXmlText(item, 'abstract');
            
            return {
              patentId: itemRegNum || itemAppNum || '',
              title: itemTitle,
              assignee: itemApplicant,
              publicationDate: formatDate(itemOpenDate),
              snippet: itemAbstract ? itemAbstract.substring(0, 200) + '...' : undefined,
              link: `https://www.kipris.or.kr/khome/main.jsp`,
            };
          });
      }
    } catch (relatedError) {
      console.error("Error fetching related patents:", relatedError);
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
