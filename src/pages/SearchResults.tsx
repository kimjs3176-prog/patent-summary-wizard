import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Search, ArrowLeft, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { KeywordSearchResult } from "@/components/PatentSummary/types";
import { PageLayout } from "@/components/layout/PageLayout";

const ITEMS_PER_PAGE = 10;

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const keyword = searchParams.get("keyword") || "";
  const [results, setResults] = useState<KeywordSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!keyword) return;
    setCurrentPage(1);
    const doSearch = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-patents`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ keyword }),
          }
        );
        const result = await response.json();
        if (result.success && result.patents) {
          setResults(result.patents);
          setTotalCount(result.totalCount || result.patents.length);
          if (result.patents.length === 0) toast.info("검색 결과가 없습니다.");
        } else {
          toast.error(result.error || "검색에 실패했습니다.");
        }
      } catch {
        toast.error("검색 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };
    doSearch();
  }, [keyword]);

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
      <Button variant="outline" size="sm" className="rounded-full text-xs h-8 px-4 gap-2 font-medium">
        <ArrowLeft className="w-3.5 h-3.5" />
        메인으로
      </Button>
    </Link>
  );

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <PageLayout headerRight={headerRight} showFooterLogo={false}>
      <main className="container mx-auto px-4 md:px-6 py-8 md:py-12 relative z-10">
        {/* Search header */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg shadow-md" style={{ background: 'linear-gradient(135deg, hsl(239 84% 67%), hsl(262 83% 58%))', color: 'white' }}>
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                '{keyword}' 검색 결과
              </h2>
              <p className="text-sm text-muted-foreground">
                {isLoading ? "검색 중..." : `${totalCount}건의 특허를 찾았습니다 (${results.length}건 표시)`}
              </p>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">'{keyword}' 관련 특허를 검색 중...</p>
          </div>
        )}

        {!isLoading && paginatedResults.length > 0 && (
          <>
            <div className="max-w-3xl mx-auto grid gap-4">
              {paginatedResults.map((patent) => (
                <button
                  key={patent.patentId}
                  onClick={() => handlePatentClick(patent.patentId)}
                  className="w-full p-5 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 text-left group surface-elevated"
                >
                  <div className="flex gap-4">
                    {patent.thumbnail && (
                      <div className="flex-shrink-0">
                        <img
                          src={proxyUrl(patent.thumbnail)}
                          alt=""
                          className="w-24 h-24 object-contain rounded-xl bg-muted/50 border border-border/30"
                          onError={(e) => {
                            (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2.5 leading-snug">
                        {patent.titleKo || patent.title}
                      </p>
                      <div className="flex flex-wrap gap-2 mb-2.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: 'hsl(239 84% 97%)', color: 'hsl(239 84% 40%)', border: '1px solid hsl(239 60% 88%)' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(239 84% 67%)' }} />
                          {patent.patentId}
                        </span>
                        {patent.assignee && (
                          <span className="px-2.5 py-1 text-xs rounded-lg font-medium bg-secondary text-secondary-foreground border border-border">
                            {patent.assignee}
                          </span>
                        )}
                        {patent.publicationDate && (
                          <span className="px-2.5 py-1 text-xs rounded-lg font-medium bg-secondary text-secondary-foreground border border-border">
                            {patent.publicationDate}
                          </span>
                        )}
                      </div>
                      {patent.snippet && (
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {patent.snippet}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 self-center">
                      <span className="text-sm text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        요약 →
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="max-w-3xl mx-auto mt-8 flex items-center justify-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-9 w-9 p-0 rounded-xl"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {getPageNumbers()[0] > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      className="h-9 w-9 p-0 rounded-xl text-xs"
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
                      page === currentPage ? "bg-primary text-primary-foreground" : ""
                    }`}
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
                      className="h-9 w-9 p-0 rounded-xl text-xs"
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
                  className="h-9 w-9 p-0 rounded-xl"
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

        {!isLoading && results.length === 0 && keyword && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">검색 결과가 없습니다.</p>
            <Link to="/">
              <Button variant="outline" className="mt-4">메인으로 돌아가기</Button>
            </Link>
          </div>
        )}
      </main>
    </PageLayout>
  );
}
