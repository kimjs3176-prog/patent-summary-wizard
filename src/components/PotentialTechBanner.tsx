import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gift, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Live count of active 잠재기술 rows; null until loaded (the banner then shows no number instead of a stale one). */
function usePotentialCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("potential_patents")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .then(({ count: n, error }) => {
        if (cancelled || error || typeof n !== "number") return;
        setCount(n);
      }, () => undefined);
    return () => { cancelled = true; };
  }, []);
  return count;
}

export function PotentialTechBanner() {
  const count = usePotentialCount();
  return (
    <Link
      to="/potential"
      className="group block rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-4 md:px-6 md:py-5 transition-colors hover:bg-primary/[0.1] btn-press"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-3 md:gap-4">
        <span className="shrink-0 grid place-items-center w-10 h-10 md:w-11 md:h-11 rounded-xl bg-primary/12 text-primary">
          <Gift className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] md:text-lg font-bold text-foreground break-keep">
            잠재기술 무상기술이전 특허{count != null ? ` ${count.toLocaleString()}건` : ""}
          </p>
          <p className="mt-1 text-[12px] md:text-[13px] text-muted-foreground leading-snug break-keep">
            미활용 특허를 기술력 등급과 함께 확인하고, AI 요약으로 바로 검토하세요.
          </p>
        </div>
        <ArrowRight className="shrink-0 w-4 h-4 md:w-5 md:h-5 text-primary transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
