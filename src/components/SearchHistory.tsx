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
      className="group relative rounded-2xl border border-border/30 bg-card/80 backdrop-blur-sm hover:border-foreground/15 hover:shadow-md transition-all duration-300 text-left overflow-hidden card-interactive btn-press"
      style={{ boxShadow: 'var(--shadow-glossy)' }}
      title={`${displayNum} ${title}`}
    >
      <button
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive z-10 bg-background/80 rounded-full p-0.5"
        onClick={(e) => { e.stopPropagation(); onRemove(item.patentNumber); }}
      >
        <X className="w-3 h-3" />
      </button>
      {/* Score badge */}
      {score != null && (
        <span
          className="absolute top-1.5 left-1.5 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white"
          style={{
            background: score >= 80 ? 'hsl(152 76% 36%)' : score >= 65 ? 'hsl(45 93% 47%)' : 'hsl(0 84% 60%)',
          }}
        >
          {score}점
        </span>
      )}
      <div className="w-full h-[100px] bg-muted/30 flex items-center justify-center overflow-hidden">
        {thumbnailUrl && !imgError ? (
          <img
            src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(thumbnailUrl)}`}
            alt=""
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
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
}