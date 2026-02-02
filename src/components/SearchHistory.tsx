import { History, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchHistoryItem } from "@/hooks/useSearchHistory";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface SearchHistoryProps {
  history: SearchHistoryItem[];
  onSelect: (item: SearchHistoryItem) => void;
  onRemove: (patentNumber: string) => void;
  onClear: () => void;
}

export function SearchHistory({ history, onSelect, onRemove, onClear }: SearchHistoryProps) {
  if (history.length === 0) {
    return null;
  }

  return (
    <Card className="p-6 bg-card/50 border-border/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <History className="w-4 h-4" />
          <span className="text-sm font-medium">최근 검색 기록</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          전체 삭제
        </Button>
      </div>
      
      <div className="space-y-2">
        {history.map((item) => (
          <div
            key={item.patentNumber}
            className="group flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/30 hover:border-primary/30 hover:bg-accent/5 transition-all cursor-pointer"
            onClick={() => onSelect(item)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-primary">
                  {item.patentData?.displayNumber || item.patentNumber}
                </span>
                {item.patentData?.searchType === 'application' && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-accent/10 text-accent rounded">
                    출원
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {item.patentData?.titleKo || item.patentData?.title || "제목 없음"}
              </p>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground/70">
                <Clock className="w-3 h-3" />
                <span>
                  {formatDistanceToNow(new Date(item.searchedAt), { 
                    addSuffix: true, 
                    locale: ko 
                  })}
                </span>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item.patentNumber);
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
