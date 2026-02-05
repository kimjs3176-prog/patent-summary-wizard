 import { FileText, X } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { KeywordSearchResult } from "@/components/PatentSummary/types";
 
 interface KeywordSearchResultsProps {
   results: KeywordSearchResult[];
   keyword: string;
   onPatentSelect: (patentId: string) => void;
   onClose: () => void;
   isLoading: boolean;
 }
 
 export function KeywordSearchResults({
   results,
   keyword,
   onPatentSelect,
   onClose,
   isLoading,
 }: KeywordSearchResultsProps) {
   if (results.length === 0) {
     return null;
   }
 
   const handlePatentClick = (patentId: string) => {
    // Extract actual patent ID from path format (e.g., "patent/KR20190132335A/ko" -> "KR20190132335A")
    let actualPatentId = patentId;
    if (patentId.includes("/")) {
      const parts = patentId.split("/");
      // Find the part that looks like a patent ID (starts with KR)
      actualPatentId = parts.find(p => p.startsWith("KR")) || parts[1] || patentId;
    }
    
    // Just pass the clean patent ID (e.g., KR20190132335A) to the handler
    // The fetch-patent function will handle the conversion
    onPatentSelect(actualPatentId);
   };
 
   return (
     <div className="w-full max-w-3xl mx-auto animate-fade-up">
       <div className="flex items-center justify-between mb-4">
         <div className="flex items-center gap-2">
           <FileText className="w-5 h-5 text-primary" />
           <h3 className="font-semibold text-foreground">
             '{keyword}' 검색 결과
           </h3>
           <span className="text-sm text-muted-foreground">
             ({results.length}건)
           </span>
         </div>
         <Button variant="ghost" size="sm" onClick={onClose} className="gap-1">
           <X className="w-4 h-4" />
           닫기
         </Button>
       </div>
 
       <div className="grid gap-3">
         {results.map((patent) => (
           <button
             key={patent.patentId}
             onClick={() => handlePatentClick(patent.patentId)}
             disabled={isLoading}
             className="w-full p-4 rounded-xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <div className="flex gap-4">
               {patent.thumbnail && (
                 <div className="flex-shrink-0">
                   <img
                     src={patent.thumbnail}
                     alt=""
                     className="w-20 h-20 object-contain rounded-lg bg-muted"
                     onError={(e) => {
                       e.currentTarget.style.display = "none";
                     }}
                   />
                 </div>
               )}
               <div className="flex-1 min-w-0">
                 <p className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1">
                   {patent.titleKo || patent.title}
                 </p>
                 <p className="text-xs text-muted-foreground">
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
               <div className="flex-shrink-0 self-center">
                 <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                   요약 보기 →
                 </span>
               </div>
             </div>
           </button>
         ))}
       </div>
     </div>
   );
 }