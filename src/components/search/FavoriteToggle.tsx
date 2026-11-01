import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  active: boolean;
  onToggle: () => void;
  title: string;
  /** Show the 담기/담김 label next to the heart. */
  showLabel?: boolean;
  className?: string;
}

/** Heart toggle for list cards. Always rendered as its own button (never nested inside another button). */
export function FavoriteToggle({ active, onToggle, title, showLabel, className }: Props) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={active}
      aria-label={active ? `관심특허에서 빼기: ${title}` : `관심특허에 담기: ${title}`}
      title={active ? "관심특허에서 빼기" : "관심특허에 담기"}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        showLabel ? "h-8 px-3 text-xs font-semibold" : "h-9 w-9",
        active
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-border/60 bg-card text-muted-foreground hover:text-destructive hover:border-destructive/30",
        className,
      )}
    >
      <Heart className={cn("w-4 h-4", active && "fill-current")} aria-hidden="true" />
      {showLabel && (active ? "담김" : "담기")}
    </button>
  );
}
