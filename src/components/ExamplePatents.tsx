import { useState, useMemo } from "react";
import { Beaker, ArrowUpRight } from "lucide-react";

interface ExamplePatentsProps {
  onSelect: (patentNumber: string) => void;
  isLoading: boolean;
}

const allExamples = [
  { number: "10-2023-0083397", label: "스마트 온실 IoT", emoji: "🌱" },
  { number: "10-2791393", label: "신규 보리 계통", emoji: "🌾" },
  { number: "10-2083668", label: "저항전분 다이어트 선식", emoji: "🍚" },
  { number: "10-2558387", label: "AI 병해충 진단", emoji: "🔬" },
  { number: "10-2568901", label: "스마트팜 양액제어", emoji: "💧" },
  { number: "10-2023-0145632", label: "농산물 품질 검사", emoji: "🍎" },
  { number: "10-2641258", label: "축산 악취 저감", emoji: "🐄" },
  { number: "10-2023-0012789", label: "드론 방제 시스템", emoji: "🚁" },
  { number: "10-2512347", label: "기능성 발효식품", emoji: "🧫" },
];

function shuffleAndPick<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function ExamplePatents({ onSelect, isLoading }: ExamplePatentsProps) {
  const [examples] = useState(() => shuffleAndPick(allExamples, 3));

  return (
    <div className="flex flex-col items-center gap-4 mt-8">
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 font-medium tracking-wide">
        <Beaker className="w-3 h-3" />
        이런 특허를 분석해 보세요
      </span>
      <div className="flex flex-wrap justify-center gap-2.5">
        {examples.map((ex) => (
          <button
            key={ex.number}
            onClick={() => !isLoading && onSelect(ex.number)}
            disabled={isLoading}
            className="group inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-medium border border-border/30 bg-card/70 backdrop-blur-md text-muted-foreground hover:text-foreground hover:border-primary/20 hover:bg-primary/5 transition-all duration-400 disabled:opacity-30 disabled:cursor-not-allowed btn-press"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <span className="text-sm">{ex.emoji}</span>
            <span>{ex.label}</span>
            <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all duration-300" />
          </button>
        ))}
      </div>
    </div>
  );
}
