import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Index from "./pages/Index";
const Admin = lazy(() => import("./pages/Admin"));
const Compare = lazy(() => import("./pages/Compare"));
const Insights = lazy(() => import("./pages/Insights"));
const SearchResults = lazy(() => import("./pages/SearchResults"));
const Batch = lazy(() => import("./pages/Batch"));
const SummarySample = lazy(() => import("./pages/SummarySample"));
const TechVideos = lazy(() => import("./pages/TechVideos"));
const PotentialTech = lazy(() => import("./pages/PotentialTech"));
const PatentFinder = lazy(() => import("./pages/PatentFinder"));
const Filing = lazy(() => import("./pages/Filing"));
const NotFound = lazy(() => import("./pages/NotFound"));
import { SplashScreen } from "./components/SplashScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { supabase } from "./integrations/supabase/client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: (failureCount, error) => {
        // Don't retry on client errors (4xx); retry transient/network up to 2 times.
        const msg = error instanceof Error ? error.message.toLowerCase() : "";
        if (msg.includes("400") || msg.includes("401") || msg.includes("403") || msg.includes("404")) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Scroll to top when the page (path) changes — keeps header navigation predictable.
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
};

const readSplashShown = () => {
  try { return sessionStorage.getItem("splash-shown") === "1"; } catch { return true; }
};

const App = () => {
  const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  const [showSplash, setShowSplash] = useState(() => !readSplashShown() && !isAdminRoute);

  // Mark the intro as seen as soon as it starts, so a reload mid-intro doesn't replay it.
  useEffect(() => {
    if (!showSplash) return;
    try { sessionStorage.setItem("splash-shown", "1"); } catch { /* ignore */ }
  }, [showSplash]);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  // No intro this visit: make sure the static boot background from index.html is gone.
  useEffect(() => {
    if (showSplash) return;
    document.getElementById("boot-splash")?.remove();
    document.documentElement.removeAttribute("data-splash");
  }, [showSplash]);

  useEffect(() => {
    if (isAdminRoute) return;
    try {
      if (sessionStorage.getItem("visit-tracked") === "1") return;
      sessionStorage.setItem("visit-tracked", "1");
    } catch {
      // storage blocked (private mode / quota): count the visit anyway, once per load
    }
    void supabase.rpc("increment_daily_visit").then(() => {}, () => {});
  }, [isAdminRoute]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Sonner />
          {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
          <BrowserRouter>
            <ScrollToTop />
            <ErrorBoundary>
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/batch" element={<Batch />} />
                {/* 예전 목록 다운로드 주소 → 통합된 일괄조회·목록 다운로드(조건 모드) */}
                <Route path="/export" element={<Navigate to="/batch?mode=criteria" replace />} />
                <Route path="/finder" element={<PatentFinder />} />
                <Route path="/filing" element={<Filing />} />
                <Route path="/summary-sample" element={<SummarySample />} />
                <Route path="/tech-videos" element={<TechVideos />} />
                <Route path="/potential" element={<PotentialTech />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;