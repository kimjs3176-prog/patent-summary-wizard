import { Beaker } from "lucide-react";

interface ExamplePatentsProps {
  onSelect: (patentNumber: string) => void;
  isLoading: boolean;
}

const examples = [
  { number: "10-2023-0083397", label: "스마트 온실 IoT", emoji: "🌱" },
  { number: "10-2791393", label: "신규 보리 계통", emoji: "🌾" },
  { number: "10-2083668", label: "저항전분 다이어트 선식", emoji: "🍚" },
];

export function ExamplePatents({ onSelect, isLoading }: ExamplePatentsProps) {
  return (
    <div className="flex flex-col items-center gap-3 mt-6">
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 font-medium">
        <Beaker className="w-3 h-3" />
        이런 특허를 분석해 보세요
      </span>
      <div className="flex flex-wrap justify-center gap-2">
        {examples.map((ex) => (
          <button
            key={ex.number}
            onClick={() => !isLoading && onSelect(ex.number)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border border-border/40 bg-card/60 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed btn-press"
          >
            <span>{ex.emoji}</span>
            {ex.label}
          </button>
        ))}
      </div>
    </div>
  );
}
