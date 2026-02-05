 import { useState } from "react";
 import { Search, FileText, Loader2 } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { toast } from "sonner";
 import { KeywordSearchResult } from "@/components/PatentSummary/types";
 
 interface KeywordSearchProps {
   onPatentSelect: (patentId: string) => void;
   isLoading: boolean;
 }
 
 export function KeywordSearch({ onPatentSelect, isLoading }: KeywordSearchProps) {
   const [searchResults, setSearchResults] = useState<KeywordSearchResult[]>([]);
   const [isSearching, setIsSearching] = useState(false);
   const [searchedKeyword, setSearchedKeyword] = useState("");
 
   const handleKeywordSearch = async (keyword: string) => {
     if (!keyword.trim()) return;
     
     setIsSearching(true);
     setSearchedKeyword(keyword);
     
     try {
       const response = await fetch(
         `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-patents`,
         {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
             Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
           },
           body: JSON.stringify({ keyword }),
         }
       );
 
       const result = await response.json();
 
       if (result.success && result.patents) {
         setSearchResults(result.patents);
         if (result.patents.length === 0) {
           toast.info("검색 결과가 없습니다. 다른 키워드로 검색해보세요.");
         }
       } else {
         toast.error(result.error || "검색에 실패했습니다.");
         setSearchResults([]);
       }
     } catch (error) {
       console.error("Keyword search error:", error);
       toast.error("검색 중 오류가 발생했습니다.");
       setSearchResults([]);
     } finally {
       setIsSearching(false);
     }
   };
 
   const handlePatentClick = (patentId: string) => {
     // Convert patent ID to Korean format for the summary generator
     let koreanFormat = patentId;
     if (patentId.startsWith("KR10") && patentId.length === 11) {
       // Registration: KR101234567 -> 10-1234567
       koreanFormat = `10-${patentId.slice(4)}`;
     } else if (patentId.startsWith("KR10") && patentId.length > 11) {
       // Application: KR1020230123456 -> 10-2023-0123456
       const num = patentId.slice(4);
       koreanFormat = `10-${num.slice(0, 4)}-${num.slice(4)}`;
     }
     onPatentSelect(koreanFormat);
     setSearchResults([]); // Clear results after selection
     setSearchedKeyword("");
   };
 
   if (searchResults.length === 0 && !isSearching) {
     return null;
   }
 
   return (
     <div className="w-full max-w-2xl mx-auto mt-6 animate-fade-up">
       {isSearching ? (
         <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
           <Loader2 className="w-5 h-5 animate-spin" />
           <span>'{searchedKeyword}' 관련 특허를 검색 중...</span>
         </div>
       ) : (
         <div className="space-y-3">
           <div className="flex items-center gap-2 mb-4">
             <Search className="w-4 h-4 text-muted-foreground" />
             <span className="text-sm text-muted-foreground">
               '{searchedKeyword}' 검색 결과 ({searchResults.length}건)
             </span>
             <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => {
                 setSearchResults([]);
                 setSearchedKeyword("");
               }}
               className="ml-auto text-xs"
             >
               닫기
             </Button>
           </div>
           
           <div className="grid gap-3">
             {searchResults.map((patent) => (
               <button
                 key={patent.patentId}
                 onClick={() => handlePatentClick(patent.patentId)}
                 disabled={isLoading}
                 className="w-full p-4 rounded-xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-md transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <div className="flex gap-3">
                   {patent.thumbnail && (
                     <img 
                       src={patent.thumbnail} 
                       alt="" 
                       className="w-16 h-16 object-contain rounded-lg bg-muted flex-shrink-0"
                       onError={(e) => {
                         e.currentTarget.style.display = 'none';
                       }}
                     />
                   )}
                   <div className="flex-1 min-w-0">
                     <div className="flex items-start gap-2">
                       <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                       <div className="flex-1 min-w-0">
                         <p className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                           {patent.titleKo || patent.title}
                         </p>
                         <p className="text-xs text-muted-foreground mt-1">
                           {patent.patentId}
                           {patent.assignee && ` • ${patent.assignee}`}
                           {patent.publicationDate && ` • ${patent.publicationDate}`}
                         </p>
                         {patent.snippet && (
                           <p className="text-sm text-foreground/70 mt-2 line-clamp-2">
                             {patent.snippet}
                           </p>
                         )}
                       </div>
                     </div>
                   </div>
                 </div>
               </button>
             ))}
           </div>
         </div>
       )}
     </div>
   );
 }
 
 // Export the search function for use in PatentInput
 export { type KeywordSearchResult };