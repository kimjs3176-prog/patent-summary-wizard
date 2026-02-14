import { History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchHistoryItem } from "@/hooks/useSearchHistory";

interface SearchHistoryProps {
  history: SearchHistoryItem[];
  onSelect: (item: SearchHistoryItem) => void;
  onRemove: (patentNumber: string) => void;
  onClear: () => void;
}

export function SearchHistory({
  history,
  onSelect,
  onRemove,
  onClear,
}: SearchHistoryProps) {
  if (history.length === 0) return null;

  return (
    <div className="w-full lg:max-w-xs">
      <div className="bg-card/90 backdrop-blur-sm rounded-2xl p-4 md:p-5 border border-border/60 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <History className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-bold text-foreground">최근 검색</span>
          </div>
          {history.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/10 h-6 px-2 rounded-lg"
            >
              전체삭제
            </Button>
          )}
        </div>
        <div className="space-y-1">
          {history.slice(0, 5).map((item, idx) => {
            const title =
              item.patentData?.title || item.patentData?.titleKo || "";
            const displayNum =
              item.patentData?.displayNumber || item.patentNumber;
            return (
              <button
                key={item.patentNumber}
                onClick={() => onSelect(item)}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-primary/5 transition-all duration-200 group flex items-start gap-2.5"
                title={`${displayNum} ${title}`}
              >
                <span
                  className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                    idx === 0
                      ? "bg-primary/15 text-primary"
                      : idx === 1
                      ? "bg-accent/12 text-accent"
                      : "bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                    {title || displayNum}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {displayNum}
                  </p>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0 mt-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.patentNumber);
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
