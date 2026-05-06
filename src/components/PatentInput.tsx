import { useState, useEffect, useRef, useMemo } from "react";
import { Search, FileText, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { KeywordSearchResult } from "@/components/PatentSummary/types";
import { safeFetch } from "@/lib/safeFetch";

interface PatentInputProps {
  onSubmit: (patentNumber: string) => void;
  isLoading: boolean;
  onKeywordSearch?: (results: KeywordSearchResult[], keyword: string) => void;
  placeholder?: string;
  helperText?: string;
  helperTexts?: string[];
  skipKeywordFetch?: boolean;
}

export function PatentInput({ onSubmit, isLoading, onKeywordSearch, placeholder, helperText, helperTexts, skipKeywordFetch }: PatentInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isSearchingKeyword, setIsSearchingKeyword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const isPatentNumber = (value: string): boolean => {
    const trimmed = value.trim();
    return trimmed.match(/^10-\d+/) !== null || trimmed.match(/^KR\d+/i) !== null || trimmed.match(/^\d{7,}$/) !== null;
  };

  const handleKeywordSearch = async (keyword: string) => {
    if (!keyword.trim() || keyword.trim().length < 1) {
      toast.error("검색어를 1자 이상 입력해주세요.");
      return;
    }
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
    const value = inputValue.trim();
    if (!value) return;
    if (isPatentNumber(value)) {
      onSubmit(value);
    } else {
      handleKeywordSearch(value);
    }
  };

  const isProcessing = isLoading || isSearchingKeyword;

  return (
    <div className="w-full max-w-2xl mx-auto">
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
            <ScrollingPlaceholder text={placeholder || "해결하고 싶은 문제, 관심 키워드 또는 특허번호를 입력하세요"} />
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
        </div>
        
      </form>
    </div>
  );
}

function ScrollingPlaceholder({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

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
  }, [text]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-y-0 left-11 md:left-13 right-16 sm:right-36 flex items-center overflow-hidden pointer-events-none z-[5]"
    >
      <span
        ref={textRef}
        className={`text-sm sm:text-[15px] text-muted-foreground/40 whitespace-nowrap ${shouldScroll ? 'animate-marquee-placeholder' : ''}`}
      >
        {text}
      </span>
    </div>
  );
}
