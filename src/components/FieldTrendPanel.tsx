import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { KeywordSearchResult } from "@/components/PatentSummary/types";
import { useFilingTrends } from "@/hooks/useFilingTrends";
import { fieldSnapshotTrend, resultYearCounts } from "@/components/insights/fieldTrend";

function Delta({ value }: { value: number | null }) {
  return (
    <p className="flex items-center gap-1 text-sm font-semibold tabular-nums text-foreground">
      {value === null ? <Minus className="h-3.5 w-3.5 text-muted-foreground" /> :
       value >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-primary" /> :
       <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
      {value === null ? "—" : `${value > 0 ? "+" : ""}${value}%`}
    </p>
  );
}

/**
 * Yearly filing trend for a technology field. Uses the shared filing-trends snapshot
 * (same numbers as the Insights page) when it covers the field; otherwise falls back to
 * the publication years of the current search results, labelled as such.
 */
export function FieldTrendPanel({ fieldName, results }: { fieldName: string; results: KeywordSearchResult[] }) {
  const [searchParams] = useSearchParams();
  const fieldId = searchParams.get("fieldId") || "";
  const { data: snapshot } = useFilingTrends();
  const official = useMemo(() => (snapshot ? fieldSnapshotTrend(snapshot, fieldId, fieldName) : null), [snapshot, fieldId, fieldName]);
  const local = useMemo(() => resultYearCounts(results), [results]);

  const data = official ? official.years : local.years.map((d) => ({ ...d, provisional: false }));

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
          <div className="flex w-24 shrink-0 flex-col justify-center gap-2 border-r border-border/60 pr-3">
            {official ? (
              <>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground">{official.completeYear}년 출원</p>
                  <p className="text-lg font-bold tabular-nums text-foreground leading-tight">{official.latest}<span className="text-[11px] font-medium text-muted-foreground">건</span></p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground">전년 대비</p>
                  <Delta value={official.growth} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground">누적</p>
                  <p className="text-lg font-bold tabular-nums text-foreground leading-tight">{local.total}<span className="text-[11px] font-medium text-muted-foreground">건</span></p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground">{local.lastYear}년</p>
                  <Delta value={local.delta} />
                </div>
              </>
            )}
          </div>

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
                  formatter={(v: number, _n, item) => [`${v}건${item?.payload?.provisional ? " (공개 진행 중)" : ""}`, "출원"]}
                  labelFormatter={(l) => `${l}년`}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12, boxShadow: "0 4px 12px hsl(var(--foreground) / 0.08)" }}
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                />
                <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={36}>
                  {data.map((d, i) => (
                    <Cell
                      key={d.year}
                      fill={d.provisional ? "hsl(var(--muted-foreground) / 0.3)" : "url(#fieldTrendBar)"}
                      opacity={official ? 1 : 0.45 + (0.55 * (i + 1)) / data.length}
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey={official ? "completeCount" : "count"}
                  stroke="hsl(var(--primary))" strokeWidth={1.5}
                  dot={{ r: 2.5, fill: "hsl(var(--primary))" }} activeDot={{ r: 3.5 }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {official ? (
        <div className="mt-1.5 space-y-0.5 text-[10px] leading-relaxed text-muted-foreground">
          <p>
            농업 국가연구기관 6곳 출원 통계 기준({official.firstYear}~{official.lastYear}년, <Link to="/insights" className="text-primary hover:underline">출원 동향</Link>과 같은 수치) · 회색 막대는 공개 진행 중인 잠정 수치예요.
          </p>
          {local.years.length > 0 && (
            <p>이번 검색 결과 기준: 관련 특허 {results.length}건 중 공개일이 있는 {local.total}건 ({local.years[0].year}~{local.lastYear}년)</p>
          )}
        </div>
      ) : (
        <p className="mt-1.5 text-[10px] text-muted-foreground">이번 검색 결과 기준: 검색된 관련 특허 {results.length}건의 공개 연도 · 아래 특허를 누르면 AI 요약서로 이동합니다.</p>
      )}
    </section>
  );
}
