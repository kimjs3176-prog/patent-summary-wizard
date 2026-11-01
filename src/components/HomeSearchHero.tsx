import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Compass, FileSignature, ListFilter, MessagesSquare, Search, Sparkles } from "lucide-react";
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
  /** Shows the 출원도우미 link next to the mode tabs (site setting feature_filing). */
  showFiling?: boolean;
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

export function HomeSearchHero({ onSubmit, onKeywordSearch, isLoading, description, placeholder, showFiling = false }: HomeSearchHeroProps) {
  const [mode, setMode] = useState<Mode>("search");
  // While the patent assistant is open the hero becomes a compact chat stage: the intro copy folds away
  // and the conversation is sized to the viewport, so the composer never drops below the fold.
  const [chatOpen, setChatOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const handleChatOpenChange = useCallback((open: boolean) => setChatOpen(open), []);
  // The search box unmounts when the finder tab is chosen, so only treat the chat as open on the search tab.
  const compact = chatOpen && mode === "search";
  useEffect(() => {
    if (!compact) return;
    const el = sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 64; // keep clear of the sticky header
    if (Math.abs(window.scrollY - top) > 8) window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [compact]);
  const tabs: { key: Mode; label: string; icon: typeof Search }[] = [
    { key: "search", label: "통합검색", icon: Search },
    { key: "finder", label: "나만의 특허찾기", icon: Compass },
  ];
  return (
    <section ref={sectionRef} data-chat-open={compact || undefined} className="home-search-hero relative -mx-3 sm:-mx-4 md:-mx-6 mb-5 md:mb-6" aria-labelledby="home-title">
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden opacity-25 pointer-events-none motion-reduce:hidden">
        <AiHeroAnimation />
      </div>
      <div className={`relative max-w-5xl mx-auto px-5 md:px-0 transition-[padding] duration-300 ${compact ? "py-4 md:py-5" : "py-7 md:py-9"}`}>
        <h1 id="home-title" className={`font-extrabold leading-tight tracking-normal transition-[font-size] duration-300 ${compact ? "text-xl md:text-2xl" : "text-[30px] md:text-[44px]"}`}>
          Agri IP Summary <span className={`home-hero-muted font-semibold ${compact ? "text-sm md:text-base" : "text-lg md:text-2xl"}`}>(AIS)</span>
        </h1>
        {!compact && (
          <>
            <p className="home-hero-accent mt-2 text-sm md:text-base font-medium">농업기술 특허를 한눈에, AI로 쉽게</p>
            <p className="home-hero-muted mt-2 text-sm leading-relaxed max-w-2xl">{description}</p>
          </>
        )}

        <div className={`flex flex-wrap items-center gap-2 ${compact ? "mt-3" : "mt-5 md:mt-6"}`}>
        <div role="tablist" aria-label="검색 방식" className="home-mode-tabs inline-flex rounded-full p-1 gap-1">
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
        {/* 출원도우미 opens another page, so it sits beside the tabs as a link rather than as a third tab. */}
        {showFiling && (
          <Link
            to="/filing"
            title="출원도우미: 아이디어부터 명세서·해외 출원까지"
            className="home-filing-link inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs md:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--home-hero-accent))]"
          >
            <FileSignature className="w-3.5 h-3.5" />
            출원도우미
          </Link>
        )}
        </div>

        {/* The search box classifies each entry itself; questions open the conversation in place. */}
        {mode === "search" ? (
          <SmartSearchBox
            onSubmit={onSubmit}
            onKeywordSearch={onKeywordSearch}
            isLoading={isLoading}
            placeholder={placeholder}
            // The results page runs the search itself; fetching here too doubled the AI call and the wait.
            skipKeywordFetch
            onChatOpenChange={handleChatOpenChange}
            resumeClassName="home-hero-accent"
            frame={(content, chatOpen) => (
              // The conversation needs room: widen the card to the hero's content width while it is open
              // so the dark band does not stretch around a narrow, tall box.
              <div className={`home-search-surface relative mt-3 rounded-xl bg-card p-1.5 text-card-foreground transition-[max-width] duration-300 ${chatOpen ? "max-w-4xl" : "max-w-2xl"}`}>{content}</div>
            )}
          />
        ) : (
          <div className="home-search-surface relative mt-3 max-w-2xl rounded-xl bg-card p-1.5 text-card-foreground">
            <FinderQuickForm />
          </div>
        )}
        {!compact && (
          // How the one search box treats each kind of entry (see queryIntent), so visitors know they can just ask.
          <ul aria-label="검색창 사용법" className="home-hero-muted mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs md:text-[13px]">
            <li className="inline-flex items-center gap-1.5"><Search className="w-3.5 h-3.5 home-hero-accent" aria-hidden="true" />단어를 넣으면 넓게 찾아요</li>
            <li className="inline-flex items-center gap-1.5"><ListFilter className="w-3.5 h-3.5 home-hero-accent" aria-hidden="true" />문장으로 쓰면 꼭 맞는 것만 골라요</li>
            <li className="inline-flex items-center gap-1.5"><MessagesSquare className="w-3.5 h-3.5 home-hero-accent" aria-hidden="true" />물어보면 AI가 대화로 답해요</li>
          </ul>
        )}
      </div>
    </section>
  );
}
