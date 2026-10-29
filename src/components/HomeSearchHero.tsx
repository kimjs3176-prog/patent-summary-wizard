import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Search, Sparkles } from "lucide-react";
import { AiHeroAnimation } from "@/components/AiHeroAnimation";
import { SmartSearchBox } from "@/components/SmartSearchBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KeywordSearchResult } from "@/components/PatentSummary/types";

interface HomeSearchHeroProps {
  onSubmit: (patentNumber: string) => void;
  onKeywordSearch: (results: KeywordSearchResult[], keyword: string) => void;
  isLoading: boolean;
  description: string;
  placeholder: string;
}

type Mode = "search" | "finder";

function FinderQuickForm() {
  const navigate = useNavigate();
  const [industry, setIndustry] = useState("");
  const [item, setItem] = useState("");
  const go = (run: boolean) => {
    const q = new URLSearchParams();
    if (industry.trim()) q.set("industry", industry.trim());
    if (item.trim()) q.set("item", item.trim());
    if (run && industry.trim() && item.trim()) q.set("run", "1");
    navigate(`/finder${q.toString() ? `?${q}` : ""}`);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); go(true); }} className="p-1.5 sm:p-2">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-2">
        <Input aria-label="업종" value={industry} maxLength={60} onChange={(e) => setIndustry(e.target.value)} placeholder="업종 (예: 식품가공)" className="h-11 rounded-lg" />
        <Input aria-label="아이템" value={item} maxLength={120} onChange={(e) => setItem(e.target.value)} placeholder="아이템 (예: 저당 딸기잼)" className="h-11 rounded-lg" />
        <Button type="submit" disabled={!industry.trim() || !item.trim()} className="h-11 rounded-lg gap-1.5 font-semibold btn-press">
          <Sparkles className="w-4 h-4" /> 추천받기
        </Button>
      </div>
      <button type="button" onClick={() => go(false)} className="mt-2 px-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        도입 목적, 보유 설비, 기술 완성도까지 상세 설정하기
      </button>
    </form>
  );
}

export function HomeSearchHero({ onSubmit, onKeywordSearch, isLoading, description, placeholder }: HomeSearchHeroProps) {
  const [mode, setMode] = useState<Mode>("search");
  const tabs: { key: Mode; label: string; icon: typeof Search }[] = [
    { key: "search", label: "통합검색", icon: Search },
    { key: "finder", label: "나만의 특허찾기", icon: Compass },
  ];
  return (
    <section className="home-search-hero relative -mx-3 sm:-mx-4 md:-mx-6 mb-5 md:mb-6" aria-labelledby="home-title">
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden opacity-25 pointer-events-none motion-reduce:hidden">
        <AiHeroAnimation />
      </div>
      <div className="relative max-w-5xl mx-auto px-5 md:px-0 py-7 md:py-9">
        <h1 id="home-title" className="text-[30px] md:text-[44px] font-extrabold leading-tight tracking-normal">
          Agri IP Summary <span className="home-hero-muted text-lg md:text-2xl font-semibold">(AIS)</span>
        </h1>
        <p className="home-hero-accent mt-2 text-sm md:text-base font-medium">농업기술 특허를 한눈에, AI로 쉽게</p>
        <p className="home-hero-muted mt-2 text-sm leading-relaxed max-w-2xl">{description}</p>

        <div role="tablist" aria-label="검색 방식" className="home-mode-tabs mt-5 md:mt-6 inline-flex rounded-full p-1 gap-1">
          {tabs.map((t) => {
            const active = mode === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMode(t.key)}
                className={`home-mode-tab inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs md:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--home-hero-accent))] ${active ? "home-mode-tab-active" : ""}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* The search box classifies each entry itself; questions open the conversation in place. */}
        {mode === "search" ? (
          <SmartSearchBox
            onSubmit={onSubmit}
            onKeywordSearch={onKeywordSearch}
            isLoading={isLoading}
            placeholder={placeholder}
            resumeClassName="home-hero-accent"
            frame={(content) => (
              <div className="home-search-surface relative mt-3 max-w-2xl rounded-xl bg-card p-1.5 text-card-foreground">{content}</div>
            )}
          />
        ) : (
          <div className="home-search-surface relative mt-3 max-w-2xl rounded-xl bg-card p-1.5 text-card-foreground">
            <FinderQuickForm />
          </div>
        )}
        <div className="home-hero-muted mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <span>농업분야 국가연구기관 보유 특허</span>
          <span>KIPRIS 실시간 연동</span>
          <span>Gemini AI 분석</span>
        </div>
      </div>
    </section>
  );
}
