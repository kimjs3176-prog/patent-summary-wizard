import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Skeleton } from "@/components/ui/skeleton";

interface PageLayoutProps {
  children: ReactNode;
  headerRight?: ReactNode;
  showFooterLogo?: boolean;
}

export function PageLayout({ children, headerRight, showFooterLogo = true }: PageLayoutProps) {
  const { settings, isLoading } = useSiteSettings();

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
      {/* 2026 Ambient background — softer, more organic blobs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[200px] animate-float" style={{ background: 'radial-gradient(circle, hsl(158 64% 40% / 0.06) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full blur-[200px]" style={{ background: 'radial-gradient(circle, hsl(172 56% 42% / 0.04) 0%, transparent 70%)', animationDelay: '3s' }} />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full blur-[180px] animate-float" style={{ background: 'radial-gradient(circle, hsl(184 48% 44% / 0.03) 0%, transparent 70%)', animationDelay: '1.5s' }} />
      </div>

      {/* 2026 Header — frosted glass with refined presence */}
      <header className="w-full sticky top-0 z-50 backdrop-blur-3xl border-b border-border/30" style={{ background: 'hsl(60 5% 98% / 0.82)' }}>
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-2.5 md:py-3.5 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 md:gap-3 min-w-0 group flex-shrink-0">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm transition-all duration-400 group-hover:shadow-md group-hover:scale-105" style={{ background: 'var(--gradient-accent)' }}>
              <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-xs md:text-sm text-foreground tracking-tight leading-tight truncate max-w-[120px] sm:max-w-none">
                {settings.header_title}
              </h1>
              <p className="text-[9px] md:text-[10px] text-muted-foreground/60 hidden sm:block leading-tight tracking-wide">
                {settings.header_subtitle}
              </p>
            </div>
          </Link>
          {headerRight && <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">{headerRight}</div>}
        </div>
      </header>

      {children}

      {/* 2026 Footer — clean, generous spacing */}
      <footer className="mt-auto relative z-10 border-t border-border/20">
        <div className="container mx-auto px-3 sm:px-4 py-8 md:py-16 text-center">
          {showFooterLogo && (
            <div className="flex items-center justify-center gap-2.5 mb-4">
              <div className="w-6 h-6 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-accent)' }}>
                <FileText className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-semibold text-foreground tracking-tight">{settings.header_title}</span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground/50 leading-relaxed">{settings.footer_line1}</p>
          <p className="text-[11px] text-muted-foreground/50 mt-1">{settings.footer_line2}</p>
        </div>
      </footer>
    </div>
  );
}
