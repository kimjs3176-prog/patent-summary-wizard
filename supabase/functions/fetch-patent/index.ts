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
  displayNumber?: string; // Formatted display number (10-XXXXXXX or 10-YYYY-XXXXXXX)
  searchType?: 'registration' | 'application'; // What type of search was performed
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

    const SERPAPI_API_KEY = Deno.env.get("SERPAPI_API_KEY");
    if (!SERPAPI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "SerpApi API 키가 설정되지 않았습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format patent number for Google Patents
    // Korean patent formats:
    // - Registration: 10-1234567 -> KR101234567
    // - Application: 10-2023-0123456 -> KR1020230123456
    let formattedPatentId = patentNumber.trim();
    let searchType: 'registration' | 'application' = 'registration';
    let displayNumber = patentNumber.trim();
    
    // Detect and convert Korean patent number format
    if (formattedPatentId.match(/^10-\d{4}-\d+$/)) {
      // Application number format: 10-2023-0123456 -> KR1020230123456
      searchType = 'application';
      const parts = formattedPatentId.split("-");
      formattedPatentId = `KR10${parts[1]}${parts[2]}`;
      displayNumber = patentNumber.trim(); // Keep original format for application
    } else if (formattedPatentId.match(/^10-\d{7}$/)) {
      // Registration number format: 10-1234567 -> KR101234567
      searchType = 'registration';
      formattedPatentId = `KR10${formattedPatentId.replace("10-", "")}`;
      displayNumber = patentNumber.trim();
    } else if (formattedPatentId.match(/^\d{7}$/)) {
      // Just 7 digits (registration without prefix): 1234567 -> KR101234567
      searchType = 'registration';
      formattedPatentId = `KR10${formattedPatentId}`;
      displayNumber = `10-${formattedPatentId.slice(-7)}`;
    } else if (formattedPatentId.match(/^KR10\d{7}$/)) {
      // Already formatted registration: KR101234567
      searchType = 'registration';
      displayNumber = `10-${formattedPatentId.slice(4)}`;
    } else if (formattedPatentId.match(/^KR10\d{11,}$/)) {
      // Already formatted application: KR1020230123456
      searchType = 'application';
      const num = formattedPatentId.slice(4);
      displayNumber = `10-${num.slice(0, 4)}-${num.slice(4)}`;
    } else if (!formattedPatentId.startsWith("KR")) {
      // Add KR prefix if not present
      const cleanNum = formattedPatentId.replace(/-/g, "");
      formattedPatentId = `KR${cleanNum}`;
      if (cleanNum.length > 7) {
        searchType = 'application';
      }
    }

    console.log("Fetching patent:", formattedPatentId);

    // Use SerpApi Google Patents endpoint
    const searchUrl = new URL("https://serpapi.com/search.json");
    searchUrl.searchParams.set("engine", "google_patents");
    searchUrl.searchParams.set("q", formattedPatentId);
    searchUrl.searchParams.set("api_key", SERPAPI_API_KEY);

    const searchResponse = await fetch(searchUrl.toString());
    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      console.error("SerpApi search error:", searchData);
      return new Response(
        JSON.stringify({ success: false, error: "특허 검색에 실패했습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if we found any patents
    const organicResults = searchData.organic_results || [];
    
    if (organicResults.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "해당 번호의 특허를 찾을 수 없습니다. 등록번호를 확인해주세요." 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the first matching result
    const firstResult = organicResults[0];
    
    // Try to get detailed patent info if patent_id is available
    let patentData: PatentData = {
      title: firstResult.title,
      titleKo: firstResult.title, // Will be updated from details if available
      abstract: firstResult.snippet,
      patentNumber: firstResult.patent_id || patentNumber,
      displayNumber: displayNumber,
      searchType: searchType,
      assignee: firstResult.assignee,
      filingDate: firstResult.filing_date,
      publicationDate: firstResult.publication_date,
      inventors: firstResult.inventor ? [firstResult.inventor] : [],
      representativeImage: firstResult.thumbnail,
    };

    // If we have a patent_id, try to get more details
    if (firstResult.patent_id) {
      try {
        const detailUrl = new URL("https://serpapi.com/search.json");
        detailUrl.searchParams.set("engine", "google_patents_details");
        detailUrl.searchParams.set("patent_id", firstResult.patent_id);
        detailUrl.searchParams.set("api_key", SERPAPI_API_KEY);

        const detailResponse = await fetch(detailUrl.toString());
        
        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          
          // Extract images from detail data
          const images: string[] = [];
          if (detailData.images && Array.isArray(detailData.images)) {
            images.push(...detailData.images.slice(0, 5));
          }
          
          // Extract detailed information
          // Try to get Korean title from localized_titles or keep existing
          let titleKo = patentData.titleKo;
          if (detailData.localized_titles) {
            const koTitle = detailData.localized_titles.find((t: any) => t.language === 'ko' || t.lang === 'ko');
            if (koTitle) {
              titleKo = koTitle.text || koTitle.title || titleKo;
            }
          }
          // If title contains Korean characters, use it
          if (detailData.title && /[가-힣]/.test(detailData.title)) {
            titleKo = detailData.title;
          }
          
          patentData = {
            ...patentData,
            title: detailData.title || patentData.title,
            titleKo: titleKo || detailData.title || patentData.title,
            abstract: detailData.abstract || patentData.abstract,
            inventors: detailData.inventors?.map((inv: any) => inv.name || inv) || patentData.inventors,
            assignee: detailData.assignee?.name || detailData.assignee || patentData.assignee,
            filingDate: detailData.filing_date || patentData.filingDate,
            publicationDate: detailData.publication_date || patentData.publicationDate,
            claims: detailData.claims?.map((c: any) => c.text || c) || [],
            applicationNumber: detailData.application_number,
            classifications: detailData.classifications?.map((c: any) => c.code || c) || [],
            description: detailData.description,
            representativeImage: images[0] || patentData.representativeImage,
            images: images,
          };
        }
      } catch (detailError) {
        console.error("Error fetching patent details:", detailError);
        // Continue with basic info if detail fetch fails
      }
    }

    console.log("Patent data fetched successfully");

    // Fetch related patents based on title or classifications
    let relatedPatents: RelatedPatent[] = [];
    
    if (patentData.title || (patentData.classifications && patentData.classifications.length > 0)) {
      try {
        // Extract keywords from title for related search
        const searchQuery = patentData.classifications?.[0] || 
          patentData.title?.split(' ').slice(0, 3).join(' ') || 
          formattedPatentId;
        
        const relatedUrl = new URL("https://serpapi.com/search.json");
        relatedUrl.searchParams.set("engine", "google_patents");
        relatedUrl.searchParams.set("q", `${searchQuery} country:KR`);
        relatedUrl.searchParams.set("api_key", SERPAPI_API_KEY);
        relatedUrl.searchParams.set("num", "6");

        const relatedResponse = await fetch(relatedUrl.toString());
        
        if (relatedResponse.ok) {
          const relatedData = await relatedResponse.json();
          const relatedResults = relatedData.organic_results || [];
          
          // Filter out the current patent and map to RelatedPatent interface
          relatedPatents = relatedResults
            .filter((r: any) => r.patent_id !== firstResult.patent_id)
            .slice(0, 5)
            .map((r: any) => ({
              patentId: r.patent_id || "",
              title: r.title || "제목 없음",
              assignee: r.assignee,
              publicationDate: r.publication_date,
              snippet: r.snippet,
              link: r.patent_id ? `https://patents.google.com/patent/${r.patent_id}` : undefined,
            }));
        }
      } catch (relatedError) {
        console.error("Error fetching related patents:", relatedError);
        // Continue without related patents
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
