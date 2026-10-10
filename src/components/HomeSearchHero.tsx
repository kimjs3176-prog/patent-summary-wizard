import { AiHeroAnimation } from "@/components/AiHeroAnimation";
import { PatentInput } from "@/components/PatentInput";
import type { KeywordSearchResult } from "@/components/PatentSummary/types";

interface HomeSearchHeroProps {
  onSubmit: (patentNumber: string) => void;
  onKeywordSearch: (results: KeywordSearchResult[], keyword: string) => void;
  isLoading: boolean;
  description: string;
  placeholder: string;
}

export function HomeSearchHero({ onSubmit, onKeywordSearch, isLoading, description, placeholder }: HomeSearchHeroProps) {
  return (
    <section className="home-search-hero relative -mx-3 sm:-mx-4 md:-mx-6 mb-5 md:mb-6" aria-labelledby="home-title">
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden opacity-25 pointer-events-none motion-reduce:hidden">
        <AiHeroAnimation />
      </div>
      <div className="relative max-w-5xl mx-auto px-5 md:px-0 py-7 md:py-9">
        <h1 id="home-title" className="text-[30px] md:text-[44px] font-extrabold leading-tight tracking-normal">
          Agri IP <span className="home-hero-accent">Summary</span> <span className="text-lg md:text-2xl font-semibold">(AIS)</span>
        </h1>
        <p className="home-hero-accent mt-2 text-sm md:text-base font-medium">농업기술 특허를 한눈에, AI로 쉽게</p>
        <p className="home-hero-muted mt-2 text-sm leading-relaxed max-w-2xl">{description}</p>
        <div className="home-search-surface relative mt-5 md:mt-6 max-w-2xl rounded-xl bg-card p-1.5 text-card-foreground">
          <PatentInput onSubmit={onSubmit} isLoading={isLoading} onKeywordSearch={onKeywordSearch} placeholder={placeholder} />
        </div>
        <div className="home-hero-muted mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <span>농업분야 국가연구기관 보유 특허</span>
          <span>KIPRIS 실시간 연동</span>
          <span>Gemini AI 분석</span>
        </div>
      </div>
    </section>
  );
}