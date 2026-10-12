import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
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

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const total = data.reduce((s, d) => s + d.count, 0);
    const max = Math.max(...data.map(d => d.count));
    const last = data[data.length - 1];
    const prev = data.length > 1 ? data[data.length - 2] : null;
    const delta = prev && prev.count > 0 ? Math.round(((last.count - prev.count) / prev.count) * 100) : null;
    return { total, max, lastYear: last.year, delta };
  }, [data]);

  return (
    <section id="field-trend" aria-labelledby="field-trend-heading" className="mb-5 rounded-2xl border border-border bg-card px-4 py-3 md:px-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 id="field-trend-heading" className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />{fieldName} 출원 추이
        </h3>
        <a href="#field-patents" className="text-xs font-medium text-primary hover:underline">관련 특허 요약 보기 ↓</a>
      </div>

      {data.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">출원 연도 정보가 있는 특허가 없습니다.</p>
      ) : (
        <div className="mt-2 flex items-stretch gap-4">
          {/* 요약 수치 */}
          {stats && (
            <div className="flex w-24 shrink-0 flex-col justify-center gap-2 border-r border-border/60 pr-3">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground">누적</p>
                <p className="text-lg font-bold tabular-nums text-foreground leading-tight">{stats.total}<span className="text-[11px] font-medium text-muted-foreground">건</span></p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground">{stats.lastYear}년</p>
                <p className="flex items-center gap-1 text-sm font-semibold tabular-nums text-foreground">
                  {stats.delta === null ? <Minus className="h-3.5 w-3.5 text-muted-foreground" /> :
                   stats.delta >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-primary" /> :
                   <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                  {stats.delta === null ? "—" : `${stats.delta > 0 ? "+" : ""}${stats.delta}%`}
                </p>
              </div>
            </div>
          )}

          {/* 차트 */}
          <div className="h-32 min-w-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 6, right: 4, left: -26, bottom: 0 }}>
                <defs>
                  <linearGradient id="fieldTrendBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [`${v}건`, "출원"]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12, boxShadow: "0 4px 12px hsl(var(--foreground) / 0.08)" }}
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                />
                <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={36}>
                  {data.map((d, i) => (
                    <Cell key={d.year} fill="url(#fieldTrendBar)" opacity={0.45 + (0.55 * (i + 1)) / data.length} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={{ r: 2.5, fill: "hsl(var(--primary))" }} activeDot={{ r: 3.5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <p className="mt-1.5 text-[10px] text-muted-foreground">검색된 관련 특허 {results.length}건의 연도 기준 · 아래 특허를 누르면 AI 요약서로 이동합니다.</p>
    </section>
  );
}
