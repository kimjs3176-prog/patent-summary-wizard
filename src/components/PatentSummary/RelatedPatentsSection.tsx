import { Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
      className="related-patents-section mt-6 glass-effect rounded-3xl overflow-hidden animate-slide-in border-t-[3px]"
      style={{ animationDelay: "0.2s", borderTopColor: 'hsl(220 70% 50%)' }}
    >
      <div className="border-b border-border/50 px-6 py-4" style={{ background: 'linear-gradient(135deg, hsl(220 50% 96%), hsl(230 40% 95%))' }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, hsl(220 70% 50%), hsl(240 60% 45%))', color: 'white' }}>
            🔗
          </div>
          <div>
            <h3 className="font-bold text-lg" style={{ color: 'hsl(220 60% 35%)' }}>유사 특허</h3>
            <p className="text-sm text-muted-foreground">{relatedPatents.length}건의 관련 특허</p>
          </div>
        </div>
      </div>

      <div className="p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {relatedPatents.map((patent, index) => (
            <div
              key={patent.patentId || index}
              className="p-5 rounded-2xl bg-secondary/30 border border-border/50 hover:bg-secondary/50 hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300 group cursor-pointer"
              onClick={() => handlePatentClick(patent)}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="px-2 py-1 text-xs rounded-lg bg-accent/20 text-accent font-medium">
                  {patent.patentId?.replace("patent/", "").replace("/en", "") || "번호 없음"}
                </span>
                <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  요약 →
                </span>
              </div>
              <h4 className="font-semibold text-sm text-foreground line-clamp-2 mb-2">{patent.title}</h4>
              {patent.snippet && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{patent.snippet}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                {patent.assignee && <span className="truncate max-w-[120px]">{patent.assignee}</span>}
                {patent.assignee && patent.publicationDate && <span>•</span>}
                {patent.publicationDate && <span>{patent.publicationDate}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
