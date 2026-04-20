import { type LucideIcon } from "lucide-react";

interface SectionCardProps {
  id?: string;
  icon: LucideIcon | string; // Lucide icon or emoji string
  iconHue?: string; // e.g. "var(--primary)" or "280 60% 55%"
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  printHidden?: boolean;
  noPadding?: boolean;
  delay?: string;
}

/**
 * Unified dashboard-style section card.
 * Provides consistent: top accent bar, header (icon chip + title + subtitle + actions), divider, content.
 */
export function SectionCard({
  id,
  icon: Icon,
  iconHue = "var(--primary)",
  title,
  subtitle,
  actions,
  children,
  className = "",
  printHidden = false,
  noPadding = false,
  delay,
}: SectionCardProps) {
  const isEmoji = typeof Icon === "string";
  const hueRef = iconHue.startsWith("var(") ? `hsl(${iconHue})` : `hsl(${iconHue})`;
  const accentBg = iconHue.startsWith("var(")
    ? `linear-gradient(90deg, hsl(${iconHue} / 0.5), hsl(${iconHue} / 0.15), transparent)`
    : `linear-gradient(90deg, hsl(${iconHue} / 0.5), hsl(${iconHue} / 0.15), transparent)`;
  const chipBg = iconHue.startsWith("var(") ? `hsl(${iconHue} / 0.08)` : `hsl(${iconHue} / 0.08)`;

  return (
    <section
      id={id}
      className={`relative rounded-2xl overflow-hidden animate-slide-in bg-card border border-border/30 scroll-mt-24 ${
        printHidden ? "print:hidden" : ""
      } ${className}`}
      style={{
        boxShadow: "0 1px 3px hsl(var(--foreground) / 0.03)",
        ...(delay ? { animationDelay: delay } : {}),
      }}
    >
      <div className="h-0.5" style={{ background: accentBg }} />

      <div className="px-4 py-3 sm:px-5 sm:py-3.5 md:px-6 md:py-4 flex items-center gap-2.5 border-b border-border/20">
        <div
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-base shrink-0"
          style={{ background: chipBg, color: hueRef }}
        >
          {isEmoji ? (
            <span className="text-base sm:text-lg leading-none">{Icon as string}</span>
          ) : (
            (() => {
              const I = Icon as LucideIcon;
              return <I className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />;
            })()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm sm:text-base text-foreground tracking-tight leading-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>

      <div className={noPadding ? "" : "px-4 py-4 sm:px-5 sm:py-5 md:px-6 md:py-5"}>{children}</div>
    </section>
  );
}
