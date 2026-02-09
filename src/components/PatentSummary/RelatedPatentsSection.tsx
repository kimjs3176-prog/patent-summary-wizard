import { RelatedPatent } from "./types";

interface RelatedPatentsSectionProps {
  relatedPatents: RelatedPatent[];
  onPatentClick?: (patentNumber: string) => void;
}

export function RelatedPatentsSection({ relatedPatents, onPatentClick }: RelatedPatentsSectionProps) {
  if (relatedPatents.length === 0) return null;

  const handlePatentClick = (patent: RelatedPatent) => {
    // Extract patent number from patentId or use it directly
    let patentNumber = patent.patentId || "";
    
    // Clean up the patent number format (remove "patent/" prefix and "/en" suffix)
    patentNumber = patentNumber
      .replace("patent/", "")
      .replace("/en", "")
      .replace("/ko", "")
      .trim();
    
    if (patentNumber && onPatentClick) {
      onPatentClick(patentNumber);
    }
  };

  return (
    <div
      className="mt-6 glass-effect rounded-3xl overflow-hidden animate-slide-in"
      style={{ animationDelay: "0.2s" }}
    >
      <div className="bg-gradient-to-r from-secondary/50 to-secondary/30 border-b border-border/50 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl shadow-lg">
              🔗
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">유사 특허</h3>
              <p className="text-sm text-muted-foreground">Related Patents</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-accent/20 rounded-full border border-accent/30">
            <span className="text-lg">📑</span>
            <span className="text-foreground font-bold">{relatedPatents.length}</span>
            <span className="text-muted-foreground text-sm">건</span>
          </div>
        </div>
      </div>

      <div className="p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {relatedPatents.map((patent, index) => (
            <div
              key={patent.patentId || index}
              className="relative p-5 rounded-2xl bg-gradient-to-br from-secondary/40 to-secondary/20 border border-border/50 hover:border-primary/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group cursor-pointer overflow-hidden"
              onClick={() => handlePatentClick(patent)}
            >
              {/* Index Badge */}
              <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{index + 1}</span>
              </div>
              
              {/* Patent Number Badge */}
              <div className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-accent/20 text-accent font-medium mb-3">
                <span>🔢</span>
                <span>{patent.patentId?.replace("patent/", "").replace("/en", "") || "번호 없음"}</span>
              </div>
              
              {/* Title */}
              <h4 className="font-semibold text-sm text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                {patent.title}
              </h4>
              
              {/* Snippet */}
              {patent.snippet && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{patent.snippet}</p>
              )}
              
              {/* Meta Info */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground/70 pt-3 border-t border-border/30">
                {patent.assignee && (
                  <span className="flex items-center gap-1 truncate max-w-[120px]">
                    <span>🏢</span>
                    <span>{patent.assignee}</span>
                  </span>
                )}
                {patent.publicationDate && (
                  <span className="flex items-center gap-1">
                    <span>📅</span>
                    <span>{patent.publicationDate}</span>
                  </span>
                )}
              </div>
              
              {/* Hover Action */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                <span>요약 보기</span>
                <span>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
