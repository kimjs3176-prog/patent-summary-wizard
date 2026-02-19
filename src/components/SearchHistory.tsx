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
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold text-muted-foreground">최근 검색</span>
        {history.length > 1 && (
          <button
            onClick={onClear}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            전체삭제
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {history.slice(0, 6).map((item) => {
          const title = item.patentData?.title || item.patentData?.titleKo || "";
          const displayNum = item.patentData?.displayNumber || item.patentNumber;
          const thumbnailUrl = item.patentData?.representativeImage;

          return (
            <button
              key={item.patentNumber}
              onClick={() => onSelect(item)}
              className="group relative p-3 rounded-xl bg-secondary/50 border border-border/50 hover:border-foreground/20 hover:bg-secondary transition-all duration-200 text-left"
              title={`${displayNum} ${title}`}
            >
              <button
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive z-10"
                onClick={(e) => { e.stopPropagation(); onRemove(item.patentNumber); }}
              >
                <X className="w-3 h-3" />
              </button>
              {thumbnailUrl ? (
                <img
                  src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(thumbnailUrl)}`}
                  alt=""
                  className="w-full aspect-square rounded-lg object-cover bg-muted mb-2"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <div className="w-full aspect-square rounded-lg bg-muted/50 mb-2 flex items-center justify-center">
                  <span className="text-lg text-muted-foreground/40">📄</span>
                </div>
              )}
              <p className="text-[11px] font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                {title || displayNum}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{displayNum}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
