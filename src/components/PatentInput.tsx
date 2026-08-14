import { useState, useEffect, useRef, useMemo } from "react";
import { Search, FileText, ArrowRight, Sparkles, History, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { KeywordSearchResult } from "@/components/PatentSummary/types";
import { safeFetch } from "@/lib/safeFetch";
import { parseIpNumber, IP_KIND_LABEL } from "@/lib/ipNumber";

interface PatentInputProps {
  onSubmit: (patentNumber: string) => void;
  isLoading: boolean;
  onKeywordSearch?: (results: KeywordSearchResult[], keyword: string) => void;
  placeholder?: string;
  helperText?: string;
  helperTexts?: string[];
  skipKeywordFetch?: boolean;
  suggestions?: string[];
}

const RECENT_KEYWORDS_KEY = "recent-keyword-searches";
const DEFAULT_SUGGESTIONS = [
  "스마트팜", "기능성 식품", "친환경 농약", "발효", "병해충 방제",
  "종자 육종", "바이오 소재", "수처리", "온실 재배", "농기계",
  "AI 센서", "비료 토양", "유기농", "축산", "유전자 분자육종",
];

// Placeholder examples are randomly generated each session from these pools.
const PLACEHOLDER_INTROS = [
  "해결하고 싶은 문제, 관심 키워드 또는 특허번호를 입력해 보세요",
  "특허번호 · 자연어 문장 · 핵심 키워드 무엇이든 검색해 보세요",
  "찾고 싶은 농식품 기술을 자유롭게 입력해 보세요",
];

const PLACEHOLDER_NUMBER_SAMPLES = [
  "예) 10-2920574 · 10-2022-1213421 등 특허/출원번호로 즉시 분석",
  "예) KR10-2456789 처럼 등록·출원번호를 그대로 붙여넣어 보세요",
  "예) '10-2024-0012345' 출원번호 입력 시 AI가 바로 요약해 드려요",
];

const PLACEHOLDER_NL_SAMPLES = [
  "예) '딸기 병해충 친환경 방제' 처럼 자연어로도 검색돼요",
  "예) '온실 토마토 수확 자동화' 같은 문장으로 탐색해 보세요",
  "예) '한우 사료 효율 개선 미생물' 처럼 풀어 써도 OK",
  "예) '기후변화 대응 벼 품종' 한 줄로 관련 특허를 찾아드려요",
];

// Topic pool — combined into rotating "예) A, B, C" hints
const PLACEHOLDER_TOPIC_POOL = [
  "기능성 발효 음료", "항산화 추출물", "프로바이오틱스", "유산균 발효",
  "스마트팜 환경 제어", "토양 수분 센서", "AI 작황 예측", "드론 방제",
  "친환경 비료", "미생물 제제", "작물 생장 촉진", "병해충 저항성",
  "가축 사료 첨가제", "축산 악취 저감", "동물 백신", "유전자 분자육종",
  "신선도 유지 포장재", "콜드체인 물류", "식품 건조 공정", "동결건조 분말",
  "곤충 단백질", "대체 단백", "푸드테크 소재", "기능성 펩타이드",
  "양봉 꿀벌 면역", "해충 페로몬 트랩", "수경재배 양액", "버섯 종균 배양",
  "쌀 가공 식품", "전통 발효식품", "김치 유산균", "장류 숙성",
  "농업용 로봇", "수확 자동화", "농기계 자율주행", "스마트 관수",
  "토양 미생물", "탄소 저감 농법", "기후변화 대응 품종", "내건성 작물",
  "축산 분뇨 자원화", "바이오차", "유기 농업", "친환경 포장",
];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generatePlaceholderExamples(count = 8): string[] {
  const intro = PLACEHOLDER_INTROS[Math.floor(Math.random() * PLACEHOLDER_INTROS.length)];
  const numberHint = PLACEHOLDER_NUMBER_SAMPLES[Math.floor(Math.random() * PLACEHOLDER_NUMBER_SAMPLES.length)];
  const nlHint = PLACEHOLDER_NL_SAMPLES[Math.floor(Math.random() * PLACEHOLDER_NL_SAMPLES.length)];

  // Build topic-based hints by combining 3 random topics each
  const topics = shuffle(PLACEHOLDER_TOPIC_POOL);
  const topicHints: string[] = [];
  for (let i = 0; i + 2 < topics.length && topicHints.length < count; i += 3) {
    topicHints.push(`예) ${topics[i]}, ${topics[i + 1]}, ${topics[i + 2]}`);
  }

  const rest = shuffle(topicHints).slice(0, Math.max(0, count - 3));
  return [intro, numberHint, nlHint, ...rest];
}

export function PatentInput({ onSubmit, isLoading, onKeywordSearch, placeholder, helperText, helperTexts, skipKeywordFetch, suggestions }: PatentInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isSearchingKeyword, setIsSearchingKeyword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [recentKeywords, setRecentKeywords] = useState<string[]>([]);
  const [recentPatents, setRecentPatents] = useState<{ patentNumber: string; title?: string }[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Regenerate randomized placeholder examples on mount and every 60s
  const [placeholderExamples, setPlaceholderExamples] = useState<string[]>(() => generatePlaceholderExamples(8));
  useEffect(() => {
    const id = window.setInterval(() => setPlaceholderExamples(generatePlaceholderExamples(8)), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Load recent searches from localStorage
  const loadRecents = () => {
    try {
      const kw = localStorage.getItem(RECENT_KEYWORDS_KEY);
      if (kw) {
        const parsed = JSON.parse(kw);
        if (Array.isArray(parsed)) setRecentKeywords(parsed.slice(0, 8));
      }
    } catch { /* ignore */ }
    try {
      const ph = localStorage.getItem("patent-search-history");
      if (ph) {
        const parsed = JSON.parse(ph);
        if (Array.isArray(parsed)) {
          setRecentPatents(parsed.slice(0, 5).map((it: { patentNumber: string; patentData?: { titleKo?: string; title?: string } }) => ({
            patentNumber: it.patentNumber,
            title: it.patentData?.titleKo || it.patentData?.title,
          })));
        }
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { loadRecents(); }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const saveRecentKeyword = (kw: string) => {
    try {
      const cur = JSON.parse(localStorage.getItem(RECENT_KEYWORDS_KEY) || "[]");
      const arr = Array.isArray(cur) ? cur : [];
      const filtered = [kw, ...arr.filter((k: string) => k !== kw)].slice(0, 12);
      localStorage.setItem(RECENT_KEYWORDS_KEY, JSON.stringify(filtered));
      setRecentKeywords(filtered.slice(0, 8));
    } catch { /* ignore */ }
  };

  const removeRecentKeyword = (kw: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const cur = JSON.parse(localStorage.getItem(RECENT_KEYWORDS_KEY) || "[]");
      const arr = Array.isArray(cur) ? cur : [];
      const filtered = arr.filter((k: string) => k !== kw);
      localStorage.setItem(RECENT_KEYWORDS_KEY, JSON.stringify(filtered));
      setRecentKeywords(filtered.slice(0, 8));
    } catch { /* ignore */ }
  };

  const effectiveSuggestions = suggestions && suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS;

  const filteredRecents = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    if (!q) return recentKeywords;
    return recentKeywords.filter(k => k.toLowerCase().includes(q));
  }, [inputValue, recentKeywords]);

  const filteredSuggestions = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    const list = effectiveSuggestions.filter(k => !recentKeywords.includes(k));
    if (!q) return list.slice(0, 8);
    return list.filter(k => k.toLowerCase().includes(q)).slice(0, 8);
  }, [inputValue, effectiveSuggestions, recentKeywords]);

  const filteredRecentPatents = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    if (!q) return recentPatents.slice(0, 3);
    return recentPatents.filter(p =>
      p.patentNumber.toLowerCase().includes(q) || (p.title || "").toLowerCase().includes(q)
    ).slice(0, 3);
  }, [inputValue, recentPatents]);

  const showDropdown = isFocused && (filteredRecents.length > 0 || filteredSuggestions.length > 0 || filteredRecentPatents.length > 0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  /** 번호 형태로 인식되면(지원 여부와 무관) true */
  const isPatentNumber = (value: string): boolean => parseIpNumber(value) !== null;

  /** 번호면 직접 조회, 미지원 권리는 안내, 그 외에는 AI 키워드 검색 */
  const routeQuery = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const ip = parseIpNumber(value);
    if (!ip) {
      handleKeywordSearch(value);
      return;
    }
    if (!ip.supported) {
      toast.error(`${IP_KIND_LABEL[ip.kind]} 번호는 지원하지 않습니다. 특허·실용신안 번호를 입력해 주세요.`);
      return;
    }
    onSubmit(ip.normalized);
  };

  const handleKeywordSearch = async (keyword: string) => {
    if (!keyword.trim() || keyword.trim().length < 1) {
      toast.error("검색어를 1자 이상 입력해주세요.");
      return;
    }
    saveRecentKeyword(keyword.trim());
    if (skipKeywordFetch) {
      onKeywordSearch?.([], keyword);
      return;
    }
    setIsSearchingKeyword(true);
    try {
      const response = await safeFetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-patents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({ keyword }),
        timeoutMs: 45000,
        retries: 1,
      });
      const result = await response.json().catch(() => ({ success: false, error: "응답 형식이 올바르지 않습니다." }));
      if (result.success && result.patents) {
        if (result.patents.length === 0) {
          toast.info("검색 결과가 없습니다. 다른 키워드로 검색해보세요.");
        } else {
          toast.success(`'${keyword}' 관련 특허 ${result.patents.length}건을 찾았습니다.`);
          onKeywordSearch?.(result.patents, keyword);
        }
      } else {
        toast.error(result.error || "검색에 실패했습니다.");
      }
    } catch (error) {
      console.error("Keyword search error:", error);
      const msg = error instanceof Error ? error.message.toLowerCase() : "";
      if (msg.includes("abort") || msg.includes("timeout")) {
        toast.error("검색 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.");
      } else {
        toast.error("네트워크 오류로 검색에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setIsSearchingKeyword(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    routeQuery(inputValue);
  };

  const submitKeyword = (kw: string) => {
    setInputValue(kw);
    setIsFocused(false);
    routeQuery(kw);
  };

  const isProcessing = isLoading || isSearchingKeyword;

  return (
    <div className="w-full max-w-2xl mx-auto" ref={wrapperRef}>
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="relative group">
          <div
            className="absolute -inset-[2px] rounded-[1.15rem] transition-all duration-400 pointer-events-none"
            style={{
              background: isFocused ? 'linear-gradient(135deg, hsl(158 64% 40% / 0.25), hsl(184 48% 44% / 0.15))' : 'transparent',
              opacity: isFocused ? 1 : 0,
            }}
          />
          <div className="absolute inset-y-0 left-0 pl-3.5 md:pl-5 flex items-center pointer-events-none z-10">
            <FileText className={`h-[18px] w-[18px] md:h-5 md:w-5 transition-colors duration-300 ${isFocused ? 'text-primary' : 'text-muted-foreground/40'}`} />
          </div>
          {/* Scrolling placeholder for long text */}
          {!inputValue && !isFocused && (
            <ScrollingPlaceholder
              texts={(() => {
                const list = (helperTexts && helperTexts.length > 0) ? helperTexts : placeholderExamples;
                return list.map((t) => t.trim()).filter(Boolean);
              })()}
            />
          )}
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            className="relative w-full h-14 md:h-14 pl-11 md:pl-13 pr-16 sm:pr-36 text-sm sm:text-[15px] bg-card border border-border/40 rounded-2xl text-foreground outline-none transition-all duration-400 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
            style={{
              boxShadow: isFocused ? 'var(--shadow-glow)' : 'var(--shadow-glossy)',
            }}
            disabled={isProcessing}
            placeholder={isFocused ? (placeholder || "해결하고 싶은 문제, 관심 키워드 또는 특허번호를 입력하세요") : ""}
            onFocus={() => { setIsFocused(true); }}
            onBlur={() => { setIsFocused(false); }}
          />
          <div className="absolute inset-y-0 right-1.5 md:right-2.5 flex items-center">
            <button
              type="submit"
              disabled={!inputValue.trim() || isProcessing}
              className="h-10 md:h-11 px-3.5 md:px-5 text-sm font-semibold rounded-xl transition-all duration-400 disabled:opacity-25 disabled:cursor-not-allowed flex items-center gap-1.5 md:gap-2 btn-press"
              style={{
                background: inputValue.trim() && !isProcessing ? 'var(--gradient-accent)' : 'hsl(var(--muted))',
                color: inputValue.trim() && !isProcessing ? 'white' : 'hsl(var(--muted-foreground))',
                boxShadow: inputValue.trim() && !isProcessing ? '0 4px 16px hsl(158 64% 40% / 0.25)' : 'none',
              }}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  <span className="hidden sm:inline">{isSearchingKeyword ? "검색 중" : "분석 중"}</span>
                </>
              ) : (
                <>
                  {inputValue.trim() && !isPatentNumber(inputValue.trim()) ? (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span className="hidden sm:inline">AI 검색</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span className="hidden sm:inline">분석</span>
                    </>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />
                </>
              )}
            </button>
          </div>
          {showDropdown && (
            <div
              className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-border/40 bg-card overflow-hidden animate-fade-in"
              style={{ boxShadow: 'var(--shadow-glow)' }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="max-h-[360px] overflow-y-auto py-1.5">
                {filteredRecents.length > 0 && (
                  <div className="px-1.5 pb-1">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      <History className="w-3 h-3" /> 최근 검색어
                    </div>
                    {filteredRecents.map((kw) => (
                      <button
                        key={`r-${kw}`}
                        type="button"
                        onClick={() => submitKeyword(kw)}
                        className="group/item w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm text-foreground hover:bg-muted/60 transition-colors"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Search className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                          <span className="truncate">{kw}</span>
                        </span>
                        <span
                          role="button"
                          aria-label="삭제"
                          onClick={(e) => removeRecentKeyword(kw, e)}
                          className="opacity-0 group-hover/item:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {filteredRecentPatents.length > 0 && (
                  <div className="px-1.5 pb-1 border-t border-border/30 pt-1.5">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      <FileText className="w-3 h-3" /> 최근 본 특허
                    </div>
                    {filteredRecentPatents.map((p) => (
                      <button
                        key={`p-${p.patentNumber}`}
                        type="button"
                        onClick={() => submitKeyword(p.patentNumber)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm hover:bg-muted/60 transition-colors text-left"
                      >
                        <FileText className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                        <span className="truncate flex-1 text-foreground">{p.title || p.patentNumber}</span>
                        <span className="text-[11px] text-muted-foreground font-mono flex-shrink-0">{p.patentNumber}</span>
                      </button>
                    ))}
                  </div>
                )}
                {filteredSuggestions.length > 0 && (
                  <div className="px-1.5 pb-1 border-t border-border/30 pt-1.5">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      <TrendingUp className="w-3 h-3" /> 추천 키워드
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-2 py-1">
                      {filteredSuggestions.map((kw) => (
                        <button
                          key={`s-${kw}`}
                          type="button"
                          onClick={() => submitKeyword(kw)}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-muted/60 text-foreground/80 hover:bg-primary/10 hover:text-primary border border-border/40 hover:border-primary/30 transition-colors"
                        >
                          {kw}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
      </form>
    </div>
  );
}

function ScrollingPlaceholder({ texts }: { texts: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [index, setIndex] = useState(0);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [phase, setPhase] = useState<"in" | "out">("in");

  const safeTexts = texts.length > 0 ? texts : [""];
  const current = safeTexts[index % safeTexts.length];

  // Rotate through phrases with a brief fade-out/in
  useEffect(() => {
    if (safeTexts.length <= 1) return;
    const visible = 3500;
    const fade = 280;
    const t1 = window.setTimeout(() => setPhase("out"), visible);
    const t2 = window.setTimeout(() => {
      setIndex((i) => (i + 1) % safeTexts.length);
      setPhase("in");
    }, visible + fade);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [index, safeTexts.length]);

  // Measure overflow; if a single phrase is too long, marquee-scroll it
  useEffect(() => {
    const check = () => {
      if (containerRef.current && textRef.current) {
        const overflow = textRef.current.scrollWidth - containerRef.current.clientWidth;
        if (overflow > 0) {
          setShouldScroll(true);
          textRef.current.style.setProperty('--marquee-distance', `-${overflow + 12}px`);
        } else {
          setShouldScroll(false);
        }
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [current]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-y-0 left-11 md:left-13 right-16 sm:right-36 flex items-center overflow-hidden pointer-events-none z-[5]"
    >
      <span
        ref={textRef}
        className={`text-sm sm:text-[15px] text-muted-foreground/40 whitespace-nowrap transition-all duration-300 ease-out ${shouldScroll ? 'animate-marquee-placeholder' : ''}`}
        style={{
          opacity: phase === "in" ? 1 : 0,
          transform: phase === "in" ? "translateY(0)" : "translateY(-4px)",
        }}
      >
        {current}
      </span>
    </div>
  );
}
