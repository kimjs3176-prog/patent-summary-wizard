import { useEffect, useState } from "react";
import { type LucideIcon } from "lucide-react";

export interface SectionNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SectionNavProps {
  items: SectionNavItem[];
}

/**
 * Sticky pill navigation that scrolls active section into view.
 * Uses IntersectionObserver to highlight the current section.
 */
export function SectionNav({ items }: SectionNavProps) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id || "");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const timers: number[] = [];

    // Defer observation slightly so target sections exist
    const setup = window.setTimeout(() => {
      const obs = new IntersectionObserver(
        (entries) => {
          // Pick the topmost intersecting entry
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (visible[0]) setActiveId(visible[0].target.id);
        },
        { rootMargin: "-30% 0px -55% 0px", threshold: 0 }
      );
      items.forEach((it) => {
        const el = document.getElementById(it.id);
        if (el) obs.observe(el);
      });
      observers.push(obs);
    }, 300);
    timers.push(setup);

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      observers.forEach((o) => o.disconnect());
    };
  }, [items]);

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const offset = 80; // sticky header offset
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <div className="sticky top-2 z-30 mb-4 print:hidden">
      <div className="rounded-2xl bg-card/95 backdrop-blur border border-border/40 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5 scrollbar-hide">
          {items.map((it) => {
            const Icon = it.icon;
            const isActive = activeId === it.id;
            return (
              <button
                key={it.id}
                onClick={() => handleClick(it.id)}
                className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                {it.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
