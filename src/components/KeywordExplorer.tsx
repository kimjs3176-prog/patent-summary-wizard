import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Sparkles, Leaf, Beaker, Wheat, Bug, Tractor, Apple, Microscope, Recycle, Droplet, Sun, Fish, Flower2, TreePine, Cog, Cpu, FlaskConical, Sprout, Bird, Dna, RefreshCw, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface KeywordChip {
  label: string;
  icon: typeof Leaf;
  color: string;
  bg: string;
  keywords: string[];
  trending?: boolean;
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
  { label: "화훼·원예", icon: Flower2, color: "hsl(330 70% 60%)", bg: "hsl(330 70% 60% / 0.08)", keywords: ["화훼", "원예", "꽃"] },
  { label: "농기계", icon: Cog, color: "hsl(220 15% 45%)", bg: "hsl(220 15% 45% / 0.08)", keywords: ["농기계", "트랙터", "수확기"] },
  { label: "AI·센서", icon: Cpu, color: "hsl(260 65% 55%)", bg: "hsl(260 65% 55% / 0.08)", keywords: ["인공지능", "센서", "IoT"] },
  { label: "비료·토양", icon: FlaskConical, color: "hsl(25 60% 45%)", bg: "hsl(25 60% 45% / 0.08)", keywords: ["비료", "토양", "양분"] },
  { label: "유기농업", icon: Sprout, color: "hsl(110 50% 40%)", bg: "hsl(110 50% 40% / 0.08)", keywords: ["유기농", "친환경 재배"] },
  { label: "축산", icon: Bird, color: "hsl(15 65% 50%)", bg: "hsl(15 65% 50% / 0.08)", keywords: ["축산", "사료", "가축"] },
  { label: "유전자·분자육종", icon: Dna, color: "hsl(290 60% 50%)", bg: "hsl(290 60% 50% / 0.08)", keywords: ["유전자", "분자육종", "마커"] },
];

// Topic detection rules: each rule maps regex → POOL label
const TOPIC_RULES: { pattern: RegExp; label: string }[] = [
  { pattern: /(스마트팜|정밀농업|자동화|복합환경|온실 ?제어|IoT|사물인터넷)/, label: "스마트팜" },
  { pattern: /(기능성|건강|개선용|예방|치료|조성물|항산화|항염|면역)/, label: "기능성 식품" },
  { pattern: /(농약|방제|살충|살균|제초)/, label: "친환경 농약" },
  { pattern: /(발효|효소|숙성|양조|증자|가공|추출)/, label: "발효·가공" },
  { pattern: /(병해충|해충|병원균|곰팡이|바이러스 병|무름병|뿌리혹병)/, label: "병해충 방제" },
  { pattern: /(종자|육종|품종|계통|신품종)/, label: "종자·육종" },
  { pattern: /(바이오|펩타이드|단백질|효소|미생물 ?소재)/, label: "바이오 소재" },
  { pattern: /(부산물|폐기물|재활용|순환|착즙박)/, label: "자원 순환" },
  { pattern: /(관개|수처리|용수|급수|양액)/, label: "관개·수처리" },
  { pattern: /(온실|시설원예|재배|육묘)/, label: "온실·시설원예" },
  { pattern: /(화훼|꽃|장미|국화|난)/, label: "화훼·원예" },
  { pattern: /(농기계|트랙터|수확기|이앙기|드론|살포기|탈모기|도계|콤바인)/, label: "농기계" },
  { pattern: /(인공지능|AI|머신러닝|딥러닝|센서|영상 ?분석)/, label: "AI·센서" },
  { pattern: /(비료|토양|양분|퇴비|시비)/, label: "비료·토양" },
  { pattern: /(유기농|친환경 ?재배|무농약)/, label: "유기농업" },
  { pattern: /(축산|사료|가축|돼지|소|닭|한우|젖소|양돈)/, label: "축산" },
  { pattern: /(유전자|SNP|분자 ?마커|마커|PCR|프라이머|게놈|DNA)/, label: "유전자·분자육종" },
  { pattern: /(쌀|벼|보리|밀|콩|옥수수|감자|고구마|도담쌀)/, label: "종자·육종" },
  { pattern: /(배추|무|양배추|고추|마늘|양파|당근|파)/, label: "종자·육종" },
  { pattern: /(인삼|홍삼|흑삼|도라지|삼채|삽주|황기|당귀|약용)/, label: "기능성 식품" },
  { pattern: /(쿠키|떡|빵|면|음료|스무디|선식|식이|식품)/, label: "기능성 식품" },
  { pattern: /(락토바실러스|유산균|프로바이오틱스|프리바이오틱스|균주)/, label: "바이오 소재" },
];

const VISIBLE = 8;
const ROTATE_MS = 30_000;

function detectTopics(titles: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const title of titles) {
    if (!title) continue;
    const matched = new Set<string>();
    for (const rule of TOPIC_RULES) {
      if (rule.pattern.test(title)) matched.add(rule.label);
    }
    for (const label of matched) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return counts;
}

function pickRandom(pool: KeywordChip[], n: number): KeywordChip[] {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

function buildChips(trendingLabels: string[]): KeywordChip[] {
  const byLabel = new Map(POOL.map((c) => [c.label, c]));
  const trendingChips: KeywordChip[] = [];
  for (const label of trendingLabels) {
    const c = byLabel.get(label);
    if (c && !trendingChips.find((t) => t.label === label)) {
      trendingChips.push({ ...c, trending: true });
    }
    if (trendingChips.length >= 4) break;
  }
  // Fill remaining slots with random non-trending
  const usedLabels = new Set(trendingChips.map((c) => c.label));
  const rest = POOL.filter((c) => !usedLabels.has(c.label));
  const fillers = pickRandom(rest, VISIBLE - trendingChips.length);
  return [...trendingChips, ...fillers];
}

export function KeywordExplorer() {
  const navigate = useNavigate();
  const [trendingLabels, setTrendingLabels] = useState<string[]>([]);
  const [chips, setChips] = useState<KeywordChip[]>(() => pickRandom(POOL, VISIBLE));

  // Fetch popular search titles and derive trending topics
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("patent_search_stats")
        .select("patent_title, search_count")
        .order("search_count", { ascending: false })
        .limit(50);
      if (cancelled || !data || data.length === 0) return;
      const titles = data.map((d) => d.patent_title ?? "");
      const counts = detectTopics(titles);
      const sorted = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label]) => label);
      setTrendingLabels(sorted);
      setChips(buildChips(sorted));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-rotate non-trending fillers every 30s
  useEffect(() => {
    const id = window.setInterval(() => {
      setChips(buildChips(trendingLabels));
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [trendingLabels]);

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
          <p className="text-[10.5px] text-muted-foreground/80">인기 검색 기반 자동 추천</p>
        </div>
        <button
          onClick={() => setChips(buildChips(trendingLabels))}
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
              className="group relative flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/40 bg-card hover:border-border/80 transition-all duration-300 hover:-translate-y-0.5 text-left animate-fade-up"
              style={{ boxShadow: "var(--shadow-2xs)" }}
            >
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                style={{ background: cat.bg, color: cat.color }}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span className="text-[12.5px] font-semibold text-foreground/85 group-hover:text-foreground truncate flex-1">
                {cat.label}
              </span>
              {cat.trending && (
                <span
                  className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                  style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
                  title="인기 검색 기반"
                >
                  <TrendingUp className="w-2.5 h-2.5" />
                  HOT
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
