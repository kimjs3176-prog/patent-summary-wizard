import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Search, ArrowLeft, Loader2, ChevronLeft, ChevronRight, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { KeywordSearchResult } from "@/components/PatentSummary/types";
import { PageLayout } from "@/components/layout/PageLayout";
import { PatentInput } from "@/components/PatentInput";
import { safeFetch } from "@/lib/safeFetch";

const ITEMS_PER_PAGE = 12;

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const keyword = searchParams.get("keyword") || "";
  const [results, setResults] = useState<KeywordSearchResult[]>([]);
  const [trademarks, setTrademarks] = useState<KeywordSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);
  const [aiIntent, setAiIntent] = useState("");

  const [searchError, setSearchError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [corrected, setCorrected] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);

  const fetchSuggestions = async (kw: string, isCancelled: () => boolean) => {
    setSuggestLoading(true);
    try {
      const res = await safeFetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-keywords`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ keyword: kw }),
        timeoutMs: 20000,
        retries: 0,
      });
      const data = await res.json().catch(() => ({}));
      if (isCancelled()) return;
      if (data?.success) {
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setCorrected(typeof data.corrected === "string" ? data.corrected : "");
      }
    } catch {
      /* suggestions are optional */
    } finally {
      if (!isCancelled()) setSuggestLoading(false);
    }
  };

  useEffect(() => {
    if (!keyword) return;
    let cancelled = false;
    const isCancelled = () => cancelled;
    setCurrentPage(1);
    setSearchError("");
    setSuggestions([]);
    setCorrected("");
    setResults([]);
    setTrademarks([]);
    const doSearch = async () => {
      setIsLoading(true);
      try {
        const response = await safeFetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-patents`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ keyword }),
            timeoutMs: 45000,
            retries: 2,
          }
        );
        const result = await response.json().catch(() => ({ success: false, error: "응답 형식이 올바르지 않습니다." }));
        if (cancelled) return;
        if (result.success && Array.isArray(result.patents)) {
          setResults(result.patents);
          setTrademarks(Array.isArray(result.trademarks) ? result.trademarks : []);
          setTotalCount(result.totalCount || result.patents.length);
          setExtractedKeywords(result.extractedKeywords || []);
          setAiIntent(result.intent || "");
          if (result.patents.length === 0 && (!Array.isArray(result.trademarks) || result.trademarks.length === 0)) fetchSuggestions(keyword, isCancelled);
        } else {
          setSearchError(
            response.status === 429
              ? "요청이 많아 잠시 쉬어가고 있습니다. 잠시 후 다시 시도해 주세요."
              : result.error || "검색에 실패했습니다.",
          );
        }
      } catch {
        if (!cancelled) setSearchError("네트워크 연결이 불안정합니다. 다시 시도해 주세요.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    doSearch();
    return () => {
      cancelled = true;
    };
  }, [keyword, retryNonce]);

  const searchFor = (kw: string) => navigate(`/search?keyword=${encodeURIComponent(kw)}`);

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const paginatedResults = results.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePatentClick = (patentId: string) => {
    navigate(`/?patent=${encodeURIComponent(patentId)}`);
  };

  const proxyUrl = (url: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(url)}`;

  const headerRight = (
    <Link to="/">
      <Button variant="outline" size="sm" className="rounded-full text-xs h-8 px-4 gap-2 font-medium border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all">
        <ArrowLeft className="w-3.5 h-3.5" />
        메인으로
      </Button>
    </Link>
  );

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <PageLayout headerRight={headerRight} showFooterLogo={false}>
      <main className="container mx-auto px-4 md:px-6 py-10 md:py-14 relative z-10">
        {/* Persistent sticky search bar */}
        <div className="sticky top-2 z-30 mb-6">
          <div className="max-w-3xl mx-auto rounded-2xl bg-background/85 backdrop-blur-md p-1.5">
            <PatentInput
              onSubmit={(patentNumber) => navigate(`/?patent=${encodeURIComponent(patentNumber)}`)}
              isLoading={isLoading}
              onKeywordSearch={(_r, kw) => navigate(`/search?keyword=${encodeURIComponent(kw)}`)}
              skipKeywordFetch
            />
          </div>
        </div>
        {/* Search header */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="flex items-center gap-4 mb-1">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md" style={{ background: 'var(--gradient-accent)' }}>
              <Search className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                  '{keyword}'
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  <Sparkles className="w-3 h-3" />
                  검색 결과
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {isLoading ? "AI가 검색어를 분석하고 특허를 찾고 있습니다..." : `총 ${totalCount}건의 특허 발견 · ${results.length}건 표시`}
              </p>
              {!isLoading && extractedKeywords.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground/70">AI 추출 키워드:</span>
                  {extractedKeywords.map((kw, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary/10 text-primary border border-primary/15">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--gradient-accent)' }}>
              <Loader2 className="w-6 h-6 animate-spin text-primary-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground mb-1">검색 중</p>
              <p className="text-xs text-muted-foreground">'{keyword}' 관련 특허를 찾고 있습니다</p>
            </div>
          </div>
        )}

        {/* Results */}
        {!isLoading && paginatedResults.length > 0 && (
          <>
            <div className="max-w-5xl mx-auto grid gap-3 sm:grid-cols-1 md:grid-cols-2">
              {paginatedResults.map((patent, idx) => (
                <button
                  key={patent.patentId}
                  onClick={() => handlePatentClick(patent.patentId)}
                  className="w-full h-full p-5 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 text-left group flex flex-col"
                  style={{ boxShadow: 'var(--shadow-xs)' }}
                >
                  <div className="flex gap-4 flex-1">
                    {/* Rank badge */}
                    <div className="flex-shrink-0 self-start">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        (currentPage - 1) * ITEMS_PER_PAGE + idx < 3 
                          ? 'text-primary-foreground' 
                          : 'bg-secondary text-muted-foreground'
                      }`} style={(currentPage - 1) * ITEMS_PER_PAGE + idx < 3 ? { background: 'var(--gradient-accent)' } : undefined}>
                        {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                      </span>
                    </div>

                    {patent.thumbnail && (
                      <div className="flex-shrink-0">
                        <img
                          src={proxyUrl(patent.thumbnail)}
                          alt=""
                          className="w-16 h-16 object-contain rounded-xl bg-secondary/50 border border-border/30"
                          onError={(e) => {
                            (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2 leading-snug">
                        {patent.titleKo || patent.title}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          {patent.patentId}
                        </span>
                        {patent.assignee && (
                          <span className="px-2 py-0.5 text-[11px] rounded-md font-medium bg-secondary text-muted-foreground border border-border/50">
                            {patent.assignee}
                          </span>
                        )}
                        {patent.publicationDate && (
                          <span className="px-2 py-0.5 text-[11px] rounded-md font-medium bg-secondary text-muted-foreground border border-border/50">
                            {patent.publicationDate}
                          </span>
                        )}
                      </div>
                      {patent.inventors && (
                        <div className="flex items-center gap-1.5 mb-2 text-[11px] text-muted-foreground">
                          <User className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate" title={patent.inventors}>
                            대표 발명자: <span className="font-medium text-foreground/80">{patent.inventors.split(/[|,;]/)[0].trim()}</span>
                            {patent.inventors.split(/[|,;]/).length > 1 && (
                              <span className="text-muted-foreground/70"> 외 {patent.inventors.split(/[|,;]/).length - 1}명</span>
                            )}
                          </span>
                        </div>
                      )}
                      {patent.snippet && (
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                          {patent.snippet}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-end">
                    <span className="text-xs text-primary font-semibold opacity-60 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      AI 요약 보기 →
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="max-w-5xl mx-auto mt-10 flex items-center justify-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-9 w-9 p-0 rounded-xl border-border/60"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {getPageNumbers()[0] > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      className="h-9 w-9 p-0 rounded-xl text-xs border-border/60"
                    >
                      1
                    </Button>
                    {getPageNumbers()[0] > 2 && (
                      <span className="px-1 text-muted-foreground text-xs">…</span>
                    )}
                  </>
                )}

                {getPageNumbers().map((page) => (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className={`h-9 w-9 p-0 rounded-xl text-xs font-semibold ${
                      page === currentPage ? "" : "border-border/60"
                    }`}
                    style={page === currentPage ? { background: 'var(--gradient-accent)' } : undefined}
                  >
                    {page}
                  </Button>
                ))}

                {getPageNumbers()[getPageNumbers().length - 1] < totalPages && (
                  <>
                    {getPageNumbers()[getPageNumbers().length - 1] < totalPages - 1 && (
                      <span className="px-1 text-muted-foreground text-xs">…</span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                      className="h-9 w-9 p-0 rounded-xl text-xs border-border/60"
                    >
                      {totalPages}
                    </Button>
                  </>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="h-9 w-9 p-0 rounded-xl border-border/60"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Page info */}
            <p className="text-center text-xs text-muted-foreground mt-3">
              {results.length}건 중 {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, results.length)}건 표시
            </p>
          </>
        )}

        {/* Trademark results */}
        {!isLoading && trademarks.length > 0 && (
          <div className="max-w-5xl mx-auto mt-12">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                상표
              </span>
              <h3 className="text-lg font-bold text-foreground">관련 상표 {trademarks.length}건</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {trademarks.map((tm) => (
                <button
                  key={tm.patentId}
                  onClick={() => toast.info("상표는 AI 요약서를 지원하지 않습니다. 특허·실용신안만 요약할 수 있습니다.")}
                  className="w-full p-4 rounded-2xl bg-card border border-border/50 hover:border-amber-500/40 hover:shadow-md transition-all duration-200 text-left group flex gap-4"
                  style={{ boxShadow: 'var(--shadow-xs)' }}
                >
                  {tm.thumbnail && (
                    <img
                      src={proxyUrl(tm.thumbnail)}
                      alt=""
                      className="w-14 h-14 object-contain rounded-xl bg-secondary/50 border border-border/30 flex-shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground line-clamp-1 mb-1.5">{tm.titleKo || tm.title}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 text-[11px] rounded-md font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        {tm.registrationNumber ? "등록" : "출원"} · {tm.patentId}
                      </span>
                      {tm.assignee && (
                        <span className="px-2 py-0.5 text-[11px] rounded-md font-medium bg-secondary text-muted-foreground border border-border/50">
                          {tm.assignee}
                        </span>
                      )}
                      {tm.publicationDate && (
                        <span className="px-2 py-0.5 text-[11px] rounded-md font-medium bg-secondary text-muted-foreground border border-border/50">
                          {tm.publicationDate}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {!isLoading && searchError && keyword && (
          <div className="text-center py-20">
            <p className="text-foreground font-semibold mb-1">검색을 완료하지 못했습니다</p>
            <p className="text-sm text-muted-foreground mb-5">{searchError}</p>
            <Button onClick={() => setRetryNonce((n) => n + 1)} className="rounded-full px-6">
              다시 시도
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !searchError && results.length === 0 && trademarks.length === 0 && keyword && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-secondary border border-border/50">
              <Search className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-foreground font-semibold mb-1">‘{keyword}’ 검색 결과가 없습니다</p>
            {corrected && (
              <p className="text-sm text-muted-foreground mb-2">
                혹시{" "}
                <button onClick={() => searchFor(corrected)} className="font-semibold text-primary underline underline-offset-2">
                  {corrected}
                </button>
                을(를) 찾으셨나요?
              </p>
            )}
            <p className="text-sm text-muted-foreground mb-4">아래 비슷한 표현으로 다시 검색해 보세요</p>
            <div className="flex flex-wrap justify-center gap-2 mb-6 min-h-9 max-w-xl mx-auto">
              {suggestLoading && (
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> 추천 검색어를 찾는 중...
                </span>
              )}
              {!suggestLoading &&
                suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => searchFor(s)}
                    className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    {s}
                  </button>
                ))}
            </div>
            <Link to="/">
              <Button variant="outline" className="rounded-full px-6 gap-2 border-border/60 hover:border-primary/40">
                <ArrowLeft className="w-3.5 h-3.5" />
                메인으로 돌아가기
              </Button>
            </Link>
          </div>
        )}
      </main>
    </PageLayout>
  );
}
