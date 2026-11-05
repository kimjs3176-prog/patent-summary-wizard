import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, Tablet, Type, X } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useFavoritePatents } from "@/hooks/useFavoritePatents";
import { isServiceActive, SERVICE_GROUP_LABEL, visibleServices, headerBadgeServices, type ServiceGroup, type ServiceItem } from "@/lib/services";
import { cn } from "@/lib/utils";

interface SiteNavProps {
  fontScaleLabel: string;
  fontScaled: boolean;
  onCycleFont: () => void;
  kioskEnabled: boolean;
  onToggleKiosk: () => void;
}

const GROUPS: ServiceGroup[] = ["find", "prepare", "mine"];

function useNavData() {
  const { settings } = useSiteSettings();
  const { favorites } = useFavoritePatents();
  const { pathname } = useLocation();
  const services = visibleServices(settings);
  const countFor = (s: ServiceItem) => (s.key === "favorites" && favorites.length > 0 ? favorites.length : null);
  return { services, pathname, countFor, favoriteCount: favorites.length };
}

/**
 * Desktop header menu: every service as a badge (icon + label in a tinted pill), no 더보기; the current page is the filled badge.
 * 홈 is left out because the logo already goes home. From lg to xl it wraps to a second header row; below lg the panel takes over.
 */
export function SiteNavLinks() {
  const { services, pathname, countFor } = useNavData();
  const links = services.filter((s) => s.key !== "home");
  const badge = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border h-8 px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";
  return (
    <nav aria-label="주 메뉴" className="hidden lg:flex items-center gap-1.5 min-w-0 order-last w-full pb-1 xl:pb-0 xl:order-none xl:w-auto">
      {links.map((s) => {
        const active = isServiceActive(s, pathname);
        const count = countFor(s);
        const Icon = s.icon;
        return (
          <Link
            key={s.key}
            to={s.to}
            title={s.description}
            aria-current={active ? "page" : undefined}
            className={cn(
              badge,
              active
                ? "bg-primary border-primary text-primary-foreground shadow-sm"
                : "bg-primary/[0.06] border-primary/20 text-foreground/80 hover:bg-primary/10 hover:border-primary/40 hover:text-primary",
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {s.label}
            {count != null && (
              <span className={cn("rounded-full px-1.5 text-[11px] leading-[18px]", active ? "bg-primary-foreground/20" : "bg-primary text-primary-foreground")}>{count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Menu button and side panel listing every service with a one-line description. Shown below lg. */
export function SiteNavPanel({ fontScaleLabel, fontScaled, onCycleFont, kioskEnabled, onToggleKiosk }: SiteNavProps) {
  const [open, setOpen] = useState(false);
  const { services, pathname, countFor, favoriteCount } = useNavData();
  const toggle = "flex-1 inline-flex items-center justify-center gap-2 rounded-xl border h-11 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label="전체 메뉴 열기"
        className="lg:hidden inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card h-8 md:h-9 px-3 text-xs md:text-sm font-semibold text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu className="w-4 h-4" aria-hidden="true" />
        <span>메뉴</span>
        {favoriteCount > 0 && <span className="rounded-full bg-primary text-primary-foreground text-[10px] leading-none px-1.5 py-1">{favoriteCount}</span>}
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-foreground/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed right-0 top-0 z-[60] flex h-full w-[88vw] max-w-sm flex-col border-l border-border bg-background shadow-[var(--shadow-card)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right focus:outline-none"
        >
          <div className="flex items-center justify-between px-5 h-14 border-b border-border/60 shrink-0">
            <DialogPrimitive.Title className="text-base font-bold text-foreground">전체 메뉴</DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label="메뉴 닫기" className="grid place-items-center w-9 h-9 rounded-full hover:bg-muted text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="w-5 h-5" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">이 사이트에서 이용할 수 있는 서비스 목록입니다.</DialogPrimitive.Description>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {GROUPS.map((g) => {
              const items = services.filter((s) => s.group === g);
              if (items.length === 0) return null;
              return (
                <section key={g} className="mb-3">
                  <h2 className="px-2 pt-2 pb-1.5 text-xs font-semibold text-muted-foreground">{SERVICE_GROUP_LABEL[g]}</h2>
                  <ul className="space-y-0.5">
                    {items.map((s) => {
                      const Icon = s.icon;
                      const active = isServiceActive(s, pathname);
                      const count = countFor(s);
                      return (
                        <li key={s.key}>
                          <Link
                            to={s.to}
                            onClick={() => setOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              active ? "bg-primary/10" : "hover:bg-muted",
                            )}
                          >
                            <span className={cn("grid place-items-center w-9 h-9 rounded-xl shrink-0", active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                              <Icon className="w-[18px] h-[18px]" />
                            </span>
                            <span className="min-w-0">
                              <span className={cn("block text-[15px] font-semibold", active ? "text-primary" : "text-foreground")}>
                                {s.title}{count != null && <span className="ml-1.5 text-primary">{count}</span>}
                              </span>
                              <span className="block text-[12.5px] text-muted-foreground leading-snug mt-0.5 break-keep">{s.description}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
          <div className="border-t border-border/60 px-4 py-4 shrink-0">
            <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">보기 설정</p>
            <div className="flex gap-2">
              <button type="button" onClick={onCycleFont} aria-label={`글자 크기 ${fontScaleLabel}, 눌러서 변경`} className={cn(toggle, fontScaled ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted")}>
                <Type className="w-4 h-4" /> 글자 {fontScaleLabel}
              </button>
              <button type="button" onClick={onToggleKiosk} aria-pressed={kioskEnabled} className={cn(toggle, kioskEnabled ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted")}>
                <Tablet className="w-4 h-4" /> 태블릿 모드
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
