import { Link2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RelatedPatent } from "./types";

interface RelatedPatentsSectionProps {
  relatedPatents: RelatedPatent[];
}

export function RelatedPatentsSection({ relatedPatents }: RelatedPatentsSectionProps) {
  if (relatedPatents.length === 0) return null;

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
              className="p-4 rounded-xl bg-muted/50 border border-border/30 hover:bg-muted/80 hover:border-primary/30 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <Badge variant="secondary" className="text-xs shrink-0">
                  {patent.patentId?.replace("patent/", "").replace("/en", "") || "번호 없음"}
                </Badge>
                {patent.link && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => window.open(patent.link, "_blank")}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                )}
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
