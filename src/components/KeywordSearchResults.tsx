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
    <div className="w-full max-w-3xl mx-auto">
      <div className="glass-effect rounded-3xl p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-lg">
              🔍
            </div>
            <div>
              <h3 className="font-bold text-foreground">
                '{keyword}' 검색 결과
              </h3>
              <span className="text-sm text-muted-foreground">
                {results.length}건의 특허를 찾았습니다
              </span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose} 
            className="gap-1 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          >
            <X className="w-4 h-4" />
            닫기
          </Button>
        </div>

        <div className="grid gap-4">
          {results.map((patent) => (
            <button
              key={patent.patentId}
              onClick={() => handlePatentClick(patent.patentId)}
              disabled={isLoading}
              className="w-full p-5 rounded-2xl bg-secondary/30 border border-border/50 hover:border-primary/50 hover:bg-secondary/50 hover:-translate-y-0.5 transition-all duration-300 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex gap-4">
                {patent.thumbnail && (
                  <div className="flex-shrink-0">
                    <img
                      src={patent.thumbnail}
                      alt=""
                      className="w-20 h-20 object-contain rounded-xl bg-muted/50"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                    {patent.titleKo || patent.title}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="px-2 py-1 text-xs rounded-lg bg-accent/20 text-accent">
                      {patent.patentId}
                    </span>
                    {patent.assignee && (
                      <span className="px-2 py-1 text-xs rounded-lg bg-muted text-muted-foreground">
                        {patent.assignee}
                      </span>
                    )}
                    {patent.publicationDate && (
                      <span className="px-2 py-1 text-xs rounded-lg bg-muted text-muted-foreground">
                        {patent.publicationDate}
                      </span>
                    )}
                  </div>
                  {patent.snippet && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {patent.snippet}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 self-center">
                  <span className="text-sm text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    요약 →
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}