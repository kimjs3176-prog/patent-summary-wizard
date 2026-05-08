import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import Compare from "./pages/Compare";
import Insights from "./pages/Insights";
import SearchResults from "./pages/SearchResults";
import SummarySample from "./pages/SummarySample";
import NotFound from "./pages/NotFound";
import { FloatingChatbot } from "./components/FloatingChatbot";
import { SplashScreen } from "./components/SplashScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";

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
  const [showSplash, setShowSplash] = useState(!alreadyShown);

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem("splash-shown", "1");
    setShowSplash(false);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
          <BrowserRouter>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/summary-sample" element={<SummarySample />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
            <FloatingChatbot />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;