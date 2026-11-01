import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Search, ArrowLeft, Loader2, ChevronLeft, ChevronRight, Sparkles, User, FileSignature, Info } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { filingEnabled } from "@/lib/filing";
import { parseIpNumber } from "@/lib/ipNumber";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { SmartSearchBox } from "@/components/SmartSearchBox";
import { safeFetch } from "@/lib/safeFetch";
// Charts (recharts) are only needed for field searches; keep them out of every /search visit.
const FieldTrendPanel = lazy(() => import("@/components/FieldTrendPanel").then((m) => ({ default: m.FieldTrendPanel })));
import { SearchFilterBar } from "@/components/search/SearchFilterBar";
import { FavoriteToggle } from "@/components/search/FavoriteToggle";
import { useCardFavorites } from "@/components/search/useCardFavorites";
import {
  applySearchFilters, EMPTY_SEARCH_FILTERS, parseFilterParams, writeFilterParams,
  type SearchFilterState, type SearchResultRow,
} from "@/components/search/searchFilters";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const ITEMS_PER_PAGE = 12;

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  // 에이프(출원지원)가 여는 /search?q=출원번호|키워드&from=agri-ip : 번호면 요약으로, 아니면 키워드 검색으로
  const rawQ = (searchParams.get("q") || "").trim();
  const keyword = searchParams.get("keyword") || (rawQ && !parseIpNumber(rawQ) ? rawQ : "");
  const { settings } = useSiteSettings();
  useDocumentTitle(keyword ? `'${keyword}' 검색 결과` : searchParams.get("field") ? `'${searchParams.get("field")}' 분야 특허` : "검색 결과");
  useEffect(() => {
    if (rawQ && parseIpNumber(rawQ)) navigate(`/?patent=${encodeURIComponent(rawQ)}${searchParams.get("from") === "agri-ip" ? "&from=agri-ip" : ""}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawQ]);
  const fieldName = searchParams.get("field") || "";
  const fieldId = searchParams.get("fieldId") || "";
  const [results, setResults] = useState<SearchResultRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);
  const [aiIntent, setAiIntent] = useState("");
  // Sentence searches: how many retrieved patents the strict concept filter dropped (server-reported).
  const [droppedByRelevance, setDroppedByRelevance] = useState(0);
  const filters = useMemo(() => parseFilterParams(searchParams), [searchParams]);
  const filtered = useMemo(() => applySearchFilters(results, filters), [results, filters]);
  const favorites = useCardFavorites();

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
    setDroppedByRelevance(0);
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
            body: JSON.stringify(fieldId ? { keyword, fieldId } : { keyword }),
            timeoutMs: 45000,
            retries: 2,
          }
        );
        const result = await response.json().catch(() => ({ success: false, error: "응답 형식이 올바르지 않습니다." }));
        if (cancelled) return;
        if (result.success && Array.isArray(result.patents)) {
          setResults(result.patents);
          setTotalCount(result.totalCount || result.patents.length);
          setExtractedKeywords(result.extractedKeywords || []);
          setAiIntent(result.intent || "");
          setDroppedByRelevance(
            result.isNaturalLanguage && typeof result.droppedByRelevance === "number" && result.droppedByRelevance > 0
              ? Math.round(result.droppedByRelevance)
              : 0,
          );
          if (result.patents.length === 0) fetchSuggestions(keyword, isCancelled);
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
  }, [keyword, fieldId, retryNonce]);

  const searchFor = (kw: string) => navigate(`/search?keyword=${encodeURIComponent(kw)}`);

  // Filters live in the URL (replace, so the back button still leaves the page) and restart paging.
  const updateFilters = (next: SearchFilterState) => {
    setCurrentPage(1);
    setSearchParams(writeFilterParams(searchParams, next), { replace: true });
  };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedResults = filtered.slice(
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
    <>
    {filingEnabled(settings) && keyword && (
      <Button asChild variant="outline" size="sm" className="rounded-full text-xs h-8 px-3 sm:px-4 gap-2 font-medium border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all">
        <Link to={`/filing?kw=${encodeURIComponent(keyword)}`} aria-label="이 키워드로 출원 준비" title="이 키워드로 출원지원에서 아이디어·명칭 초안을 시작합니다">
          <FileSignature className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">이 키워드로 출원 준비</span>
        </Link>
      </Button>
    )}
    <Button asChild variant="outline" size="sm" className="rounded-full text-xs h-8 px-3 sm:px-4 gap-2 font-medium border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all">
      <Link to="/" aria-label="메인으로">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">메인으로</span>
      </Link>
    </Button>
    </>
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
        <h1 className="sr-only">{keyword ? `'${keyword}' 검색 결과` : "특허 검색 결과"}</h1>
        {/* Persistent sticky search bar */}
        {/* Same classification as home: questions open the assistant here, keywords/sentences search. */}
        <SmartSearchBox
          onSubmit={(patentNumber) => navigate(`/?patent=${encodeURIComponent(patentNumber)}`)}
          isLoading={isLoading}
          onKeywordSearch={(_r, kw) => navigate(`/search?keyword=${encodeURIComponent(kw)}`)}
          skipKeywordFetch
          frame={(content, chatOpen) => (
            // The conversation is tall, so it scrolls with the page instead of sticking over the results.
            <div className={chatOpen ? "relative z-30 mb-6" : "sticky top-2 z-30 mb-6"}>
              <div className={`max-w-3xl mx-auto rounded-2xl p-1.5 ${chatOpen ? "border bg-card shadow-[var(--shadow-card)]" : "bg-background/85 backdrop-blur-md"}`}>
                {content}
              </div>
            </div>
          )}
          resumeClassName="text-primary mt-0"
          resumeRowClassName="max-w-2xl mx-auto -mt-4 mb-6 px-2"
        />
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
                  <span className="text-xs text-muted-foreground">AI 추출 키워드:</span>
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

        {fieldName && !isLoading && results.length > 0 && (
          <Suspense fallback={null}>
            <FieldTrendPanel fieldName={fieldName} results={results} />
          </Suspense>
        )}
        <div id="field-patents" className="scroll-mt-24" />

        {!isLoading && droppedByRelevance > 0 && results.length > 0 && (
          <p className="max-w-5xl mx-auto mb-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <span>문장 검색은 핵심 개념이 제목에 함께 나오는 특허만 보여 드려요. 관련성이 약한 {droppedByRelevance}건은 제외했습니다.</span>
          </p>
        )}

        {!isLoading && results.length > 0 && (
          <SearchFilterBar results={results} state={filters} onChange={updateFilters} filteredCount={filtered.length} />
        )}

        {/* Filters exclude everything */}
        {!isLoading && results.length > 0 && filtered.length === 0 && (
          <div className="max-w-5xl mx-auto text-center py-14 rounded-2xl border border-dashed border-border bg-card/60">
            <p className="text-foreground font-semibold mb-1">필터 조건에 맞는 특허가 없습니다</p>
            <p className="text-sm text-muted-foreground mb-4">연도·기관·등록 여부 조건을 넓혀 보세요.</p>
            <Button variant="outline" onClick={() => updateFilters(EMPTY_SEARCH_FILTERS)} className="rounded-full px-5">
              필터 초기화
            </Button>
          </div>
        )}

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
                <div key={patent.patentId} className="relative h-full">
                <button
                  onClick={() => handlePatentClick(patent.patentId)}
                  className={`w-full h-full p-5 ${favorites.enabled ? "pr-14" : ""} rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 text-left group flex flex-col`}
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
                          width={64}
                          height={64}
                          loading="lazy"
                          decoding="async"
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
                              <span className="text-muted-foreground"> 외 {patent.inventors.split(/[|,;]/).length - 1}명</span>
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
                    <span className="text-xs text-primary font-semibold whitespace-nowrap">
                      AI 요약 보기 →
                    </span>
                  </div>
                </button>
                {favorites.enabled && (
                  <FavoriteToggle
                    className="absolute top-3.5 right-3.5"
                    active={favorites.isFavorite(patent.patentId)}
                    title={patent.titleKo || patent.title}
                    onToggle={() => favorites.toggle({
                      patentNumber: patent.patentId,
                      title: patent.title,
                      titleKo: patent.titleKo,
                      assignee: patent.assignee || patent.applicant || patent.organizationName,
                      applicationNumber: patent.applicationNumber,
                      registrationNumber: patent.registrationNumber,
                      applicationDate: patent.applicationDate,
                      publicationDate: patent.publicationDate,
                      representativeImage: patent.thumbnail,
                    })}
                  />
                )}
                </div>
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
                  aria-label="이전 페이지"
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
                    aria-current={page === currentPage ? "page" : undefined}
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
                  aria-label="다음 페이지"
                  className="h-9 w-9 p-0 rounded-xl border-border/60"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Page info */}
            <p className="text-center text-xs text-muted-foreground mt-3">
              {filtered.length}건 중 {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}건 표시
            </p>
          </>
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
        {!isLoading && !searchError && results.length === 0 && keyword && (
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
            <Button asChild variant="outline" className="rounded-full px-6 gap-2 border-border/60 hover:border-primary/40">
              <Link to="/">
                <ArrowLeft className="w-3.5 h-3.5" />
                메인으로 돌아가기
              </Link>
            </Button>
          </div>
        )}
      </main>
    </PageLayout>
  );
}
