import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
const Admin = lazy(() => import("./pages/Admin"));
const Compare = lazy(() => import("./pages/Compare"));
const Insights = lazy(() => import("./pages/Insights"));
const SearchResults = lazy(() => import("./pages/SearchResults"));
const SummarySample = lazy(() => import("./pages/SummarySample"));
const TechVideos = lazy(() => import("./pages/TechVideos"));
const NotFound = lazy(() => import("./pages/NotFound"));
import { FloatingChatbot } from "./components/FloatingChatbot";
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

const App = () => {
  const alreadyShown = sessionStorage.getItem("splash-shown") === "1";
  const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  const [showSplash, setShowSplash] = useState(!alreadyShown && !isAdminRoute);

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem("splash-shown", "1");
    setShowSplash(false);
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;
    if (sessionStorage.getItem("visit-tracked") === "1") return;
    sessionStorage.setItem("visit-tracked", "1");
    void supabase.rpc("increment_daily_visit").then(() => {}, () => {});
  }, [isAdminRoute]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
          <BrowserRouter>
            <ErrorBoundary>
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/summary-sample" element={<SummarySample />} />
                <Route path="/tech-videos" element={<TechVideos />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </ErrorBoundary>
            <FloatingChatbot />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;