import { useNavigate } from "react-router-dom";
import { Sparkles, Leaf, Beaker, Wheat, Bug, Tractor, Apple, Microscope, Recycle } from "lucide-react";

interface KeywordChip {
  label: string;
  icon: typeof Leaf;
  color: string;
  bg: string;
  keywords: string[];
}

const CATEGORIES: KeywordChip[] = [
  { label: "스마트팜", icon: Tractor, color: "hsl(158 64% 40%)", bg: "hsl(158 64% 40% / 0.08)", keywords: ["스마트팜", "정밀농업", "자동화"] },
  { label: "기능성 식품", icon: Apple, color: "hsl(0 70% 55%)", bg: "hsl(0 70% 55% / 0.08)", keywords: ["기능성", "식품", "건강"] },
  { label: "친환경 농약", icon: Leaf, color: "hsl(142 70% 40%)", bg: "hsl(142 70% 40% / 0.08)", keywords: ["친환경", "농약", "방제"] },
  { label: "발효·가공", icon: Beaker, color: "hsl(30 80% 50%)", bg: "hsl(30 80% 50% / 0.08)", keywords: ["발효", "가공"] },
  { label: "병해충 방제", icon: Bug, color: "hsl(280 50% 55%)", bg: "hsl(280 50% 55% / 0.08)", keywords: ["병해충", "방제"] },
  { label: "종자·육종", icon: Wheat, color: "hsl(45 85% 50%)", bg: "hsl(45 85% 50% / 0.08)", keywords: ["종자", "육종", "품종"] },
  { label: "바이오 소재", icon: Microscope, color: "hsl(200 70% 50%)", bg: "hsl(200 70% 50% / 0.08)", keywords: ["바이오", "소재"] },
  { label: "자원 순환", icon: Recycle, color: "hsl(172 56% 42%)", bg: "hsl(172 56% 42% / 0.08)", keywords: ["순환", "재활용", "부산물"] },
];

export function KeywordExplorer() {
  const navigate = useNavigate();

  const handleClick = (keywords: string[]) => {
    navigate(`/search?keyword=${encodeURIComponent(keywords.join(" "))}`);
  };

  return (
    <section className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.1)" }}>
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-foreground tracking-tight">주제별 빠른 탐색</h3>
          <p className="text-[10.5px] text-muted-foreground/80">관심 분야 칩을 눌러 관련 특허를 찾아보세요</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.label}
              onClick={() => handleClick(cat.keywords)}
              className="group flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/40 bg-card hover:border-border/80 transition-all duration-300 hover:-translate-y-0.5 text-left"
              style={{ boxShadow: "var(--shadow-2xs)" }}
            >
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                style={{ background: cat.bg, color: cat.color }}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span className="text-[12.5px] font-semibold text-foreground/85 group-hover:text-foreground truncate">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
