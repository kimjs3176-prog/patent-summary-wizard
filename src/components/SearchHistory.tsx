import { X } from "lucide-react";
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
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground">최근 검색</span>
        {history.length > 1 && (
          <button
            onClick={onClear}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            전체삭제
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {history.slice(0, 6).map((item) => {
          const title = item.patentData?.title || item.patentData?.titleKo || "";
          const displayNum = item.patentData?.displayNumber || item.patentNumber;
          const thumbnailUrl = item.patentData?.representativeImage;

          return (
            <button
              key={item.patentNumber}
              onClick={() => onSelect(item)}
              className="group relative flex-shrink-0 w-[130px] rounded-2xl border border-border/60 bg-background hover:border-foreground/20 hover:shadow-sm transition-all duration-200 text-left overflow-hidden"
              title={`${displayNum} ${title}`}
            >
              <button
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive z-10 bg-background/80 rounded-full p-0.5"
                onClick={(e) => { e.stopPropagation(); onRemove(item.patentNumber); }}
              >
                <X className="w-3 h-3" />
              </button>
              <div className="w-full h-[100px] bg-muted/30 flex items-center justify-center overflow-hidden">
                {thumbnailUrl ? (
                  <img
                    src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(thumbnailUrl)}`}
                    alt=""
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                      (e.currentTarget.parentElement as HTMLElement).innerHTML = '<span class="text-2xl text-muted-foreground/30">📄</span>';
                    }}
                  />
                ) : (
                  <span className="text-2xl text-muted-foreground/30">📄</span>
                )}
              </div>
              <div className="px-2.5 py-2">
                <p className="text-[11px] font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors min-h-[30px]">
                  {title || displayNum}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 truncate">{displayNum}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
