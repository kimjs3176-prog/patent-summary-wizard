import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { FileText, Tablet } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { useKioskMode } from "@/hooks/useKioskMode";
import { KioskKeyboard } from "@/components/KioskKeyboard";

interface PageLayoutProps {
  children: ReactNode;
  headerRight?: ReactNode;
  showFooterLogo?: boolean;
}

export function PageLayout({ children, headerRight, showFooterLogo = true }: PageLayoutProps) {
  const { settings, isLoading } = useSiteSettings();
  const { enabled: kioskEnabled, toggle: toggleKiosk } = useKioskMode();

  const forceRefresh = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
      }
    } finally {
      const sep = window.location.search ? "&" : "?";
      window.location.replace(
        window.location.pathname + window.location.search + sep + "_swreset=" + Date.now() + window.location.hash
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-2xl animate-pulse bg-muted" />
          <Skeleton className="h-3 w-28 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[200px] animate-float" style={{ background: 'radial-gradient(circle, hsl(158 64% 40% / 0.06) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full blur-[200px]" style={{ background: 'radial-gradient(circle, hsl(172 56% 42% / 0.04) 0%, transparent 70%)', animationDelay: '3s' }} />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full blur-[180px] animate-float" style={{ background: 'radial-gradient(circle, hsl(184 48% 44% / 0.03) 0%, transparent 70%)', animationDelay: '1.5s' }} />
      </div>

      {/* Header — Toss-style clean */}
      <header className="w-full sticky top-0 z-50 backdrop-blur-3xl border-b border-border/30" style={{ background: 'hsl(var(--background) / 0.85)' }}>
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-2 md:py-3.5 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 md:gap-3 min-w-0 group flex-shrink-0">
            <div className="w-7 h-7 md:w-9 md:h-9 rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm transition-all duration-400 group-hover:shadow-md group-hover:scale-105" style={{ background: 'var(--gradient-accent)' }}>
              <FileText className="w-3 h-3 md:w-4 md:h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-[13px] md:text-[15px] text-foreground tracking-tight leading-tight truncate max-w-[160px] sm:max-w-none">
                {settings.header_title}
              </h1>
              <p className="text-[10px] md:text-[11px] text-muted-foreground/60 hidden sm:block leading-tight tracking-wide">
                {settings.header_subtitle}
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={toggleKiosk}
              aria-pressed={kioskEnabled}
              title={kioskEnabled ? "태블릿 모드 끄기" : "태블릿 모드 켜기 (터치 키보드)"}
              className={`inline-flex items-center gap-1.5 rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-3 font-medium border transition-all ${
                kioskEnabled
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-foreground border-border/60 hover:bg-accent/30"
              }`}
            >
              <Tablet className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span className="hidden sm:inline">태블릿</span>
            </button>
            {headerRight}
          </div>
        </div>
      </header>

      <div style={{ paddingBottom: kioskEnabled ? "340px" : undefined }}>
        {children}
      </div>

      {/* Footer — generous spacing, readable text */}
      <footer className="mt-auto relative z-10 border-t border-border/20">
        <div className="container mx-auto px-3 sm:px-4 py-6 md:py-16 text-center">
          {showFooterLogo && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg md:rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-accent)' }}>
                <FileText className="w-3 h-3 md:w-3.5 md:h-3.5 text-white" />
              </div>
              <span className="text-xs md:text-sm font-semibold text-foreground tracking-tight">{settings.header_title}</span>
            </div>
          )}
          <p className="text-[11px] md:text-xs text-muted-foreground/50 leading-relaxed">{settings.footer_line1}</p>
          <p className="text-[11px] md:text-xs text-muted-foreground/50 mt-1">{settings.footer_line2}</p>
          <p className="text-[11px] md:text-xs text-muted-foreground/60 mt-3">오류신고/이용문의: <a href="mailto:kimjs1408@koat.or.kr" className="underline hover:text-foreground/70 transition-colors">kimjs1408@koat.or.kr</a></p>
          <p className="text-[10.5px] md:text-[11px] text-muted-foreground/50 mt-2">
            화면이 이전 버전으로 보이나요?{" "}
            <button
              type="button"
              onClick={forceRefresh}
              className="underline hover:text-foreground/70 transition-colors font-medium"
            >
              캐시 초기화 후 새로고침
            </button>
          </p>
        </div>
      </footer>
      <KioskKeyboard />
    </div>
  );
}
