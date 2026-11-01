import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Live count of active 잠재기술 rows; null until loaded (callers then show no number instead of a stale one). */
export function usePotentialCount(): number | null {
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
