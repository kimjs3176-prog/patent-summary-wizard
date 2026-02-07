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
    <div className="glass-effect rounded-3xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">최근 검색 기록</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-primary hover:bg-primary/10"
        >
          전체 삭제
        </Button>
      </div>
      
      <div className="space-y-3">
        {history.map((item) => (
          <div
            key={item.patentNumber}
            className="group flex items-center gap-3 p-4 rounded-2xl bg-secondary/30 border border-border/50 hover:border-primary/30 hover:bg-secondary/50 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
            onClick={() => onSelect(item)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-accent">
                  {item.patentData?.displayNumber || item.patentNumber}
                </span>
                {item.patentData?.searchType === 'application' && (
                  <span className="px-2 py-0.5 text-[10px] bg-primary/20 text-primary rounded-full">
                    출원
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate mt-1">
                {item.patentData?.titleKo || item.patentData?.title || "제목 없음"}
              </p>
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground/60">
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
              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
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
    </div>
  );
}
