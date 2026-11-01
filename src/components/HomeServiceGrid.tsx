import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useFavoritePatents } from "@/hooks/useFavoritePatents";
import { usePotentialCount } from "@/hooks/usePotentialCount";
import { visibleServices, type ServiceKey } from "@/lib/services";

/** Home "서비스 바로가기": every service beyond the search box as a card, with a live figure where one exists. */
export function HomeServiceGrid() {
  const { settings } = useSiteSettings();
  const { favorites } = useFavoritePatents();
  const potential = usePotentialCount();
  const cards = visibleServices(settings).filter((s) => s.homeCard);
  const stat: Partial<Record<ServiceKey, string>> = {
    potential: potential != null ? `${potential.toLocaleString()}건` : undefined,
    favorites: favorites.length > 0 ? `${favorites.length}건 담음` : undefined,
  };

  return (
    <section aria-labelledby="home-services-title">
      <div className="mb-3 md:mb-4">
        <h2 id="home-services-title" className="text-xl md:text-[26px] font-bold text-foreground leading-tight">서비스 바로가기</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">검색 말고도 이런 일을 할 수 있어요.</p>
      </div>
      <ul className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-3">
        {cards.map((s) => {
          const Icon = s.icon;
          const figure = stat[s.key];
          return (
            <li key={s.key} className="min-w-0">
              <Link
                to={s.to}
                className="group flex h-full flex-col rounded-2xl border border-border/70 bg-card p-3.5 md:p-4 transition-[box-shadow,border-color,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring btn-press"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-primary/10 text-primary shrink-0">
                    <Icon className="w-5 h-5" />
                  </span>
                  {figure ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11.5px] font-semibold text-primary whitespace-nowrap">{figure}</span>
                  ) : (
                    <ArrowRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                  )}
                </div>
                <p className="mt-3 text-[15px] md:text-base font-bold text-foreground break-keep">{s.title}</p>
                <p className="mt-1 text-[12.5px] md:text-[13px] text-muted-foreground leading-snug break-keep">{s.description}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
