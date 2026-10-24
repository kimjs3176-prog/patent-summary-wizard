import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrendReport } from "../../supabase/functions/filing-trends/trendAggregation";

export type TrendSnapshot = TrendReport & { insights: string[]; updatedAt: string; stale?: boolean };

/** Agri-food filing trend snapshot shared by the home insight card and the Insights page. */
export function useFilingTrends() {
  return useQuery({
    queryKey: ["filing-trends", "v1"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("filing-trends", { body: {} });
      if (error || !data?.success) throw new Error(data?.error || "출원 동향을 불러오지 못했습니다.");
      return data as TrendSnapshot;
    },
    staleTime: 60 * 60 * 1000,
  });
}

/** Headline figures derived from a snapshot (latest fully disclosed year vs. the year before). */
export function trendHeadline(data: TrendSnapshot) {
  const y = data.completeYear;
  const latest = data.yearly.find((r) => r.year === y);
  const prev = data.yearly.find((r) => r.year === y - 1);
  const complete = data.yearly.filter((r) => !r.provisional);
  const completeTotal = complete.reduce((s, r) => s + r.count, 0);
  const growth = latest && prev && prev.count >= 5 ? Math.round(((latest.count - prev.count) / prev.count) * 100) : null;
  const top = [...data.fields].sort((a, b) => b.latest - a.latest)[0];
  const rising = [...data.fields].filter((f) => f.growth !== null && f.latest >= 10).sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))[0];
  return { y, latest, prev, complete, completeTotal, growth, top, rising, completeYears: complete.map((r) => String(r.year)) };
}
