import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Sparkles, Leaf, Beaker, Wheat, Bug, Tractor, Apple, Microscope, Recycle, Droplet, Sun, Fish, Flower2, TreePine, Cog, Cpu, FlaskConical, Sprout, Bird, Dna, RefreshCw } from "lucide-react";

interface KeywordChip {
  label: string;
  icon: typeof Leaf;
  color: string;
  bg: string;
  keywords: string[];
}

const POOL: KeywordChip[] = [
  { label: "스마트팜", icon: Tractor, color: "hsl(158 64% 40%)", bg: "hsl(158 64% 40% / 0.08)", keywords: ["스마트팜", "정밀농업", "자동화"] },
  { label: "기능성 식품", icon: Apple, color: "hsl(0 70% 55%)", bg: "hsl(0 70% 55% / 0.08)", keywords: ["기능성", "식품", "건강"] },
  { label: "친환경 농약", icon: Leaf, color: "hsl(142 70% 40%)", bg: "hsl(142 70% 40% / 0.08)", keywords: ["친환경", "농약", "방제"] },
  { label: "발효·가공", icon: Beaker, color: "hsl(30 80% 50%)", bg: "hsl(30 80% 50% / 0.08)", keywords: ["발효", "가공"] },
  { label: "병해충 방제", icon: Bug, color: "hsl(280 50% 55%)", bg: "hsl(280 50% 55% / 0.08)", keywords: ["병해충", "방제"] },
  { label: "종자·육종", icon: Wheat, color: "hsl(45 85% 50%)", bg: "hsl(45 85% 50% / 0.08)", keywords: ["종자", "육종", "품종"] },
  { label: "바이오 소재", icon: Microscope, color: "hsl(200 70% 50%)", bg: "hsl(200 70% 50% / 0.08)", keywords: ["바이오", "소재"] },
  { label: "자원 순환", icon: Recycle, color: "hsl(172 56% 42%)", bg: "hsl(172 56% 42% / 0.08)", keywords: ["순환", "재활용", "부산물"] },
  { label: "관개·수처리", icon: Droplet, color: "hsl(210 75% 50%)", bg: "hsl(210 75% 50% / 0.08)", keywords: ["관개", "수처리", "용수"] },
  { label: "온실·시설원예", icon: Sun, color: "hsl(38 90% 55%)", bg: "hsl(38 90% 55% / 0.08)", keywords: ["온실", "시설원예", "재배"] },
  { label: "수산·양식", icon: Fish, color: "hsl(195 70% 45%)", bg: "hsl(195 70% 45% / 0.08)", keywords: ["수산", "양식", "어업"] },
  { label: "화훼·원예", icon: Flower2, color: "hsl(330 70% 60%)", bg: "hsl(330 70% 60% / 0.08)", keywords: ["화훼", "원예", "꽃"] },
  { label: "임업·산림", icon: TreePine, color: "hsl(150 50% 35%)", bg: "hsl(150 50% 35% / 0.08)", keywords: ["임업", "산림", "수목"] },
  { label: "농기계", icon: Cog, color: "hsl(220 15% 45%)", bg: "hsl(220 15% 45% / 0.08)", keywords: ["농기계", "트랙터", "수확기"] },
  { label: "AI·센서", icon: Cpu, color: "hsl(260 65% 55%)", bg: "hsl(260 65% 55% / 0.08)", keywords: ["인공지능", "센서", "IoT"] },
  { label: "비료·토양", icon: FlaskConical, color: "hsl(25 60% 45%)", bg: "hsl(25 60% 45% / 0.08)", keywords: ["비료", "토양", "양분"] },
  { label: "유기농업", icon: Sprout, color: "hsl(110 50% 40%)", bg: "hsl(110 50% 40% / 0.08)", keywords: ["유기농", "친환경 재배"] },
  { label: "축산", icon: Bird, color: "hsl(15 65% 50%)", bg: "hsl(15 65% 50% / 0.08)", keywords: ["축산", "사료", "가축"] },
  { label: "유전자·분자육종", icon: Dna, color: "hsl(290 60% 50%)", bg: "hsl(290 60% 50% / 0.08)", keywords: ["유전자", "분자육종", "마커"] },
];

const VISIBLE = 8;
const ROTATE_MS = 30_000;

function pickRandom(pool: KeywordChip[], n: number): KeywordChip[] {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

export function KeywordExplorer() {
  const navigate = useNavigate();
  const [chips, setChips] = useState<KeywordChip[]>(() => pickRandom(POOL, VISIBLE));

  useEffect(() => {
    const id = window.setInterval(() => {
      setChips(pickRandom(POOL, VISIBLE));
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  const handleClick = (keywords: string[]) => {
    navigate(`/search?keyword=${encodeURIComponent(keywords.join(" "))}`);
  };

  return (
    <section className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.1)" }}>
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-bold text-foreground tracking-tight">주제별 빠른 탐색</h3>
          <p className="text-[10.5px] text-muted-foreground/80">관심 분야 칩을 눌러 관련 특허를 찾아보세요 · 30초마다 자동 변경</p>
        </div>
        <button
          onClick={() => setChips(pickRandom(POOL, VISIBLE))}
          aria-label="키워드 새로고침"
          className="shrink-0 w-7 h-7 rounded-lg border border-border/40 bg-card text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors flex items-center justify-center"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        {chips.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.label}
              onClick={() => handleClick(cat.keywords)}
              className="group flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/40 bg-card hover:border-border/80 transition-all duration-300 hover:-translate-y-0.5 text-left animate-fade-up"
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
