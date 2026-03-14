import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

interface PageLayoutProps {
  children: ReactNode;
  headerRight?: ReactNode;
  showFooterLogo?: boolean;
}

export function PageLayout({ children, headerRight, showFooterLogo = true }: PageLayoutProps) {
  const { settings } = useSiteSettings();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[140px]" style={{ background: 'radial-gradient(circle, hsl(239 84% 67% / 0.12) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-[550px] h-[550px] rounded-full blur-[140px]" style={{ background: 'radial-gradient(circle, hsl(280 68% 56% / 0.08) 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, hsl(262 83% 58% / 0.06) 0%, transparent 60%)' }} />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'linear-gradient(hsl(220 13% 91%) 1px, transparent 1px), linear-gradient(90deg, hsl(220 13% 91%) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
      </div>

      {/* Header */}
      <header className="w-full sticky top-0 z-50 backdrop-blur-2xl border-b" style={{ background: 'hsl(0 0% 100% / 0.85)', borderColor: 'hsl(220 13% 91% / 0.6)' }}>
        <div className="container mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md icon-bounce cursor-pointer" style={{ background: 'linear-gradient(135deg, hsl(239 84% 67%), hsl(262 83% 58%))' }}>
              <FileText className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-foreground tracking-tight leading-tight">
                {settings.header_title}
              </h1>
              <p className="text-[10px] text-muted-foreground hidden sm:block leading-tight">
                {settings.header_subtitle}
              </p>
            </div>
          </Link>
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="mt-auto relative z-10" style={{ borderTop: '1px solid hsl(220 13% 91% / 0.6)' }}>
        <div className="container mx-auto px-4 py-8 md:py-10 text-center">
          {showFooterLogo && (
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(239 84% 67%), hsl(262 83% 58%))' }}>
                <FileText className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-semibold text-foreground">{settings.header_title}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{settings.footer_line1}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{settings.footer_line2}</p>
          <nav className="mt-3 flex items-center justify-center gap-4 text-[11px] text-muted-foreground" aria-label="푸터 링크">
            <a href="https://www.nati.or.kr" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">NATI</a>
            <span className="text-border">|</span>
            <a href="https://www.kipris.or.kr" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">KIPRIS</a>
            <span className="text-border">|</span>
            <a href="https://www.rda.go.kr" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">농촌진흥청</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}