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
  onClear
}: SearchHistoryProps) {
  if (history.length === 0) {
    return null;
  }
  return <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">최근검색</span>
        </div>
        {history.length > 1 && <Button variant="ghost" size="sm" onClick={onClear} className="text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/10 h-5 px-2">
            전체삭제
          </Button>}
      </div>
      <div className="flex-wrap gap-2 flex-row flex items-center justify-center">
        {history.slice(0, 6).map(item => {
        const title = item.patentData?.title || item.patentData?.titleKo || "";
        const shortTitle = title.length > 20 ? title.slice(0, 20) + "…" : title;
        const displayNum = item.patentData?.displayNumber || item.patentNumber;
        return <div key={item.patentNumber} className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/40 border border-border/50 hover:border-primary/40 hover:bg-secondary/60 cursor-pointer transition-all duration-200 text-xs max-w-[280px]" onClick={() => onSelect(item)} title={`${displayNum} ${title}`}>
              <span className="font-mono text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
                {displayNum}
              </span>
              {shortTitle && <span className="text-muted-foreground/70 group-hover:text-foreground/80 transition-colors truncate">
                  {shortTitle}
                </span>}
              <button className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary ml-0.5 flex-shrink-0" onClick={e => {
            e.stopPropagation();
            onRemove(item.patentNumber);
          }}>
                <X className="w-3 h-3" />
              </button>
            </div>;
      })}
      </div>
    </div>;
}