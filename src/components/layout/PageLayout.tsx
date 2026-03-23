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
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[160px]" style={{ background: 'radial-gradient(circle, hsl(152 76% 36% / 0.07) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-[450px] h-[450px] rounded-full blur-[160px]" style={{ background: 'radial-gradient(circle, hsl(168 72% 40% / 0.05) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: 'linear-gradient(hsl(220 13% 91%) 1px, transparent 1px), linear-gradient(90deg, hsl(220 13% 91%) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
      </div>

      {/* Header */}
      <header className="w-full sticky top-0 z-50 backdrop-blur-2xl border-b border-border/40" style={{ background: 'hsl(0 0% 100% / 0.88)' }}>
        <div className="container mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm icon-bounce cursor-pointer" style={{ background: 'var(--gradient-accent)' }}>
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-foreground tracking-tight leading-tight">
                {settings.header_title}
              </h1>
              <p className="text-[10px] text-muted-foreground/70 hidden sm:block leading-tight">
                {settings.header_subtitle}
              </p>
            </div>
          </Link>
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="mt-auto relative z-10 border-t border-border/30">
        <div className="container mx-auto px-4 py-10 md:py-12 text-center">
          {showFooterLogo && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'var(--gradient-accent)' }}>
                <FileText className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="text-xs font-semibold text-foreground">{settings.header_title}</span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground/60">{settings.footer_line1}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">{settings.footer_line2}</p>
        </div>
      </footer>
    </div>
  );
}
