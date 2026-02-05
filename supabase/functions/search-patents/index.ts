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
   publicationDate?: string;
   snippet?: string;
   thumbnail?: string;
 }
 
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
 
     const SERPAPI_API_KEY = Deno.env.get("SERPAPI_API_KEY");
     if (!SERPAPI_API_KEY) {
       return new Response(
         JSON.stringify({ success: false, error: "검색 API 키가 설정되지 않았습니다." }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     console.log("Searching patents with keyword:", keyword);
 
     // Search Korean patents with the keyword
     const searchUrl = new URL("https://serpapi.com/search.json");
     searchUrl.searchParams.set("engine", "google_patents");
     searchUrl.searchParams.set("q", `${keyword.trim()} country:KR`);
     searchUrl.searchParams.set("api_key", SERPAPI_API_KEY);
     searchUrl.searchParams.set("num", "10");
 
     const searchResponse = await fetch(searchUrl.toString());
     const searchData = await searchResponse.json();
 
     if (!searchResponse.ok) {
       console.error("SerpApi search error:", searchData);
       return new Response(
         JSON.stringify({ success: false, error: "특허 검색에 실패했습니다." }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const organicResults = searchData.organic_results || [];
 
     // Map results to KeywordSearchResult interface
     const patents: KeywordSearchResult[] = organicResults.map((result: any) => ({
       patentId: result.patent_id || "",
       title: result.title || "제목 없음",
       titleKo: result.title, // Will be Korean if available from Google Patents
       assignee: result.assignee,
       publicationDate: result.publication_date,
       snippet: result.snippet,
       thumbnail: result.thumbnail,
     }));
 
     console.log(`Found ${patents.length} patents for keyword: ${keyword}`);
 
     return new Response(
       JSON.stringify({ success: true, patents, keyword: keyword.trim() }),
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