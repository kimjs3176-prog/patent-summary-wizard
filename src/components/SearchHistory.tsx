import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchHistoryItem } from "@/hooks/useSearchHistory";

interface SearchHistoryProps {
  history: SearchHistoryItem[];
  onSelect: (item: SearchHistoryItem) => void;
  onRemove: (patentNumber: string) => void;
  onClear: () => void;
}

export function SearchHistory({ history, onSelect, onRemove, onClear }: SearchHistoryProps) {
  if (history.length === 0) return null;

  return (
    <div className="p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">최근 검색</span>
        </div>
        {history.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-[11px] text-muted-foreground hover:text-foreground h-7 px-2.5 rounded-lg"
          >
            전체삭제
          </Button>
        )}
      </div>
      <div className="space-y-0.5">
        {history.slice(0, 5).map((item, idx) => {
          const title = item.patentData?.title || item.patentData?.titleKo || "";
          const displayNum = item.patentData?.displayNumber || item.patentNumber;
          return (
            <button
              key={item.patentNumber}
              onClick={() => onSelect(item)}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-background/80 transition-colors group flex items-start gap-2.5"
              title={`${displayNum} ${title}`}
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-md bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground mt-0.5">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                  {title || displayNum}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{displayNum}</p>
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0 mt-0.5"
                onClick={(e) => { e.stopPropagation(); onRemove(item.patentNumber); }}
              >
                <X className="w-3 h-3" />
              </button>
            </button>
          );
        })}
      </div>
    </div>
  );
}
