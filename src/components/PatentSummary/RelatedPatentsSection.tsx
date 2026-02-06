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
      className="mt-6 glass-effect rounded-2xl border border-border/50 overflow-hidden animate-fade-up"
      style={{ animationDelay: "0.2s" }}
    >
      <div className="bg-secondary/30 border-b border-border/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
            <Link2 className="w-5 h-5 text-secondary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">유사 특허</h3>
            <p className="text-sm text-muted-foreground">{relatedPatents.length}건의 관련 특허</p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {relatedPatents.map((patent, index) => (
            <div
              key={patent.patentId || index}
              className="p-4 rounded-xl bg-muted/50 border border-border/30 hover:bg-muted/80 hover:border-primary/30 transition-all duration-200 group cursor-pointer"
              onClick={() => handlePatentClick(patent)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <Badge variant="secondary" className="text-xs shrink-0">
                  {patent.patentId?.replace("patent/", "").replace("/en", "") || "번호 없음"}
                </Badge>
                <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  클릭하여 요약서 생성 →
                </span>
              </div>
              <h4 className="font-medium text-sm text-foreground line-clamp-2 mb-2">{patent.title}</h4>
              {patent.snippet && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{patent.snippet}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
