import { useState } from "react";
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
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-muted-foreground/60 tracking-wide">최근 검색</span>
        {history.length > 1 && (
          <button
            onClick={onClear}
            className="text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors duration-300"
          >
            전체삭제
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {history.slice(0, 6).map((item) => (
          <HistoryCard key={item.patentNumber} item={item} onSelect={onSelect} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}

function HistoryCard({
  item,
  onSelect,
  onRemove,
}: {
  item: SearchHistoryItem;
  onSelect: (item: SearchHistoryItem) => void;
  onRemove: (patentNumber: string) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const title = item.patentData?.title || item.patentData?.titleKo || "";
  const displayNum = item.patentData?.displayNumber || item.patentNumber;
  const thumbnailUrl = item.patentData?.representativeImage;
  const score = item.commercializationScore;

  return (
    <button
      onClick={() => onSelect(item)}
      className="group relative rounded-3xl border border-border/20 bg-card/70 backdrop-blur-lg hover:border-primary/15 transition-all duration-500 text-left overflow-hidden card-interactive btn-press"
      style={{ boxShadow: 'var(--shadow-card)' }}
      title={`${displayNum} ${title}`}
    >
      <button
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 text-muted-foreground hover:text-destructive z-10 bg-background/70 backdrop-blur-sm rounded-xl p-1"
        onClick={(e) => { e.stopPropagation(); onRemove(item.patentNumber); }}
      >
        <X className="w-3 h-3" />
      </button>
      {/* Score badge */}
      {score != null && (
        <span
          className="absolute top-2 left-2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-xl text-white backdrop-blur-sm"
          style={{
            background: score >= 80 ? 'hsl(158 64% 40% / 0.9)' : score >= 65 ? 'hsl(45 93% 47% / 0.9)' : 'hsl(0 84% 60% / 0.9)',
          }}
        >
          {score}점
        </span>
      )}
      <div className="w-full h-[100px] bg-muted/20 flex items-center justify-center overflow-hidden rounded-t-3xl">
        {thumbnailUrl && !imgError ? (
          <img
            src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(thumbnailUrl)}`}
            alt=""
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-2xl text-muted-foreground/20">📄</span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[11px] font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors duration-300 min-h-[30px]">
          {title || displayNum}
        </p>
        <p className="text-[10px] text-muted-foreground/50 mt-1 truncate">{displayNum}</p>
      </div>
    </button>
  );
}
