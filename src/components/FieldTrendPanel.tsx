import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { KeywordSearchResult } from "@/components/PatentSummary/types";

/** Yearly filing trend for a technology field, derived from its related patents. */
export function FieldTrendPanel({ fieldName, results }: { fieldName: string; results: KeywordSearchResult[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    results.forEach(r => {
      const year = (r.publicationDate || "").replace(/\D/g, "").slice(0, 4);
      if (/^(19|20)\d{2}$/.test(year)) map.set(year, (map.get(year) || 0) + 1);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-10).map(([year, count]) => ({ year, count }));
  }, [results]);

  return (
    <section id="field-trend" aria-labelledby="field-trend-heading" className="mb-6 rounded-2xl border border-border bg-card p-4 md:p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 id="field-trend-heading" className="flex items-center gap-2 text-base font-bold text-foreground">
          <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />{fieldName} 출원 추이
        </h3>
        <a href="#field-patents" className="text-xs font-medium text-primary hover:underline">관련 특허 요약 보기 ↓</a>
      </div>
      {data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">출원 연도 정보가 있는 특허가 없습니다.</p>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip formatter={(v: number) => [`${v}건`, "출원"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">검색된 관련 특허 {results.length}건의 연도 기준 · 아래 특허를 누르면 AI 요약서로 이동합니다.</p>
    </section>
  );
}
