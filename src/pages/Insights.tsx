import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BarChart3, Building2, FileText, Info, Layers, RefreshCw, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TECHNOLOGY_FIELDS } from "../../supabase/functions/_shared/technologyFields";
import type { TrendReport } from "../../supabase/functions/filing-trends/trendAggregation";

type TrendSnapshot = TrendReport & { insights: string[]; updatedAt: string; stale?: boolean };

const FIELD_META = Object.fromEntries(TECHNOLOGY_FIELDS.map((f) => [f.id, f])) as Record<string, typeof TECHNOLOGY_FIELDS[number]>;
const fmtDate = (d: string) => `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
const pct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n}%`);

function useFilingTrends() {
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

function Growth({ value, className = "" }: { value: number | null; className?: string }) {
  if (value === null) return <span className={`text-muted-foreground ${className}`}>—</span>;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${up ? "trend-up" : "trend-down"} ${className}`}>
      <Icon className="w-3.5 h-3.5" />{pct(value)}
    </span>
  );
}

function Sparkline({ values, tone }: { values: number[]; tone: string }) {
  const max = Math.max(1, ...values);
  const w = 72, h = 22;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - 2 - (v / max) * (h - 4)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={`technology-tile-${tone} shrink-0`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="hsl(var(--tile-ink))" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Kpi({ label, value, unit, sub, icon: Icon }: { label: string; value: string | number; unit?: string; sub?: React.ReactNode; icon: typeof Layers }) {
  return (
    <div className="trend-card rounded-2xl border border-border/60 bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="w-3.5 h-3.5 text-primary" />{label}</p>
      <p className="mt-1.5 text-2xl md:text-[28px] font-bold tabular-nums leading-tight text-foreground">
        {value}{unit && <span className="ml-0.5 text-sm font-medium text-muted-foreground">{unit}</span>}
      </p>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Card({ title, icon: Icon, action, children, className = "" }: { title: string; icon: typeof Layers; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`trend-card rounded-2xl border border-border/60 bg-card p-4 md:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-foreground"><Icon className="w-4 h-4 text-primary" />{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Insights() {
  const navigate = useNavigate();
  const { data, isPending, isError, error, refetch, isFetching } = useFilingTrends();
  const [sort, setSort] = useState<"count" | "growth">("count");

  const view = useMemo(() => {
    if (!data) return null;
    const y = data.completeYear;
    const latest = data.yearly.find((r) => r.year === y);
    const prev = data.yearly.find((r) => r.year === y - 1);
    const complete = data.yearly.filter((r) => !r.provisional);
    const completeTotal = complete.reduce((s, r) => s + r.count, 0);
    const growth = latest && prev && prev.count >= 5 ? Math.round(((latest.count - prev.count) / prev.count) * 100) : null;
    const top = [...data.fields].sort((a, b) => b.latest - a.latest)[0];
    const rising = [...data.fields].filter((f) => f.growth !== null && f.latest >= 10).sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))[0];
    const completeYears = complete.map((r) => String(r.year));
    return { y, latest, prev, complete, completeTotal, growth, top, rising, completeYears };
  }, [data]);

  const fieldRows = useMemo(() => {
    if (!data) return [];
    const rows = data.fields.filter((f) => f.latest + f.previous >= 3 && f.id !== "other");
    return rows.sort((a, b) => sort === "count" ? b.latest - a.latest : (b.growth ?? -999) - (a.growth ?? -999));
  }, [data, sort]);

  const maxInstitute = Math.max(1, ...(data?.institutes.map((i) => Math.max(i.latest, i.previous)) ?? [1]));
  const maxShare = Math.max(1, ...fieldRows.map((f) => f.share));

  const headerRight = (
    <Link to="/">
      <Button variant="outline" size="sm" className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 glossy-card gap-1 md:gap-2 btn-press font-medium">
        <ArrowLeft className="w-3 h-3 md:w-3.5 md:h-3.5" /><span className="hidden sm:inline">홈으로</span>
      </Button>
    </Link>
  );

  return (
    <PageLayout headerRight={headerRight}>
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 relative z-10">
        <section className="home-search-hero relative -mx-3 sm:-mx-4 md:-mx-6 mb-5 md:mb-7">
          <div className="max-w-6xl mx-auto px-5 md:px-6 py-6 md:py-8">
            <p className="home-hero-accent inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold"><BarChart3 className="w-4 h-4" /> 인사이트</p>
            <h1 className="mt-1.5 text-2xl md:text-[34px] font-extrabold leading-tight">농식품 특허 출원 동향</h1>
            <p className="home-hero-muted mt-2 text-sm md:text-base max-w-2xl leading-relaxed">
              농업 국가연구기관 6곳의 최근 특허·실용신안 출원을 기술 분야와 기관별로 정리했어요.
            </p>
            {data && (
              <p className="home-hero-muted mt-3 text-xs">
                집계 기간 {fmtDate(data.start)} ~ {fmtDate(data.end)} · 공개 출원 {data.total.toLocaleString()}건 · {new Date(data.updatedAt).toLocaleDateString("ko-KR")} 갱신
              </p>
            )}
          </div>
        </section>

        <div className="max-w-6xl mx-auto space-y-4 md:space-y-5">
          {isPending && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
              <Skeleton className="h-36 rounded-2xl" />
              <div className="grid lg:grid-cols-2 gap-4"><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>
              <p className="text-center text-sm text-muted-foreground">최신 출원 자료를 모으고 있어요. 처음에는 30초 정도 걸릴 수 있어요.</p>
            </>
          )}

          {isError && (
            <div className="trend-card rounded-2xl border border-border/60 bg-card p-8 text-center">
              <p className="font-semibold text-foreground">{(error as Error)?.message}</p>
              <Button variant="outline" className="mt-4 rounded-full gap-1.5" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} /> 다시 시도
              </Button>
            </div>
          )}

          {data && view && (
            <>
              {/* KPI */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi icon={FileText} label={`${view.y}년 출원`} value={view.latest?.count ?? 0} unit="건" sub={<>전년 대비 <Growth value={view.growth} /></>} />
                <Kpi icon={Layers} label={`최근 ${view.complete.length}년 누적`} value={view.completeTotal.toLocaleString()} unit="건" sub={`${view.complete[0]?.year}~${view.y}년`} />
                {view.top && (
                  <Kpi icon={BarChart3} label="출원 비중 1위 분야" value={FIELD_META[view.top.id]?.label ?? view.top.id} sub={`${view.y}년 ${view.top.latest}건 · 비중 ${view.top.share}%`} />
                )}
                {view.rising && (
                  <Kpi icon={TrendingUp} label="가장 크게 늘어난 분야" value={FIELD_META[view.rising.id]?.label ?? view.rising.id} sub={<>{view.y - 1}→{view.y}년 <Growth value={view.rising.growth} /></>} />
                )}
              </div>

              {/* AI summary */}
              {data.insights.length > 0 && (
                <Card title="한눈에 보는 동향" icon={Sparkles} action={<span className="text-[11px] text-muted-foreground">집계 수치만 사용해 AI가 정리</span>}>
                  <ul className="grid gap-2 md:grid-cols-2">
                    {data.insights.map((t) => (
                      <li key={t} className="trend-insight rounded-xl px-3.5 py-2.5 text-sm leading-relaxed text-foreground">{t}</li>
                    ))}
                  </ul>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 md:gap-5">
                {/* Yearly */}
                <Card title="연도별 출원 추이" icon={BarChart3}>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.yearly} margin={{ top: 16, right: 4, left: -22, bottom: 0 }}>
                        <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
                          formatter={(v: number, _n, item) => [`${v}건${item?.payload?.provisional ? " (공개 진행 중)" : ""}`, "출원"]}
                          labelFormatter={(l) => `${l}년`}
                        />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44} label={{ position: "top", fontSize: 11, fill: "hsl(var(--foreground))" }}>
                          {data.yearly.map((r) => (
                            <Cell key={r.year} fill={r.provisional ? "hsl(var(--muted-foreground) / 0.3)" : r.year === view.y ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.45)"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    특허는 출원 후 약 1년 6개월 뒤 공개돼요. 회색 막대({view.y + 1}년 이후)는 아직 공개 중인 잠정 수치라 앞으로 늘어나요.
                  </p>
                </Card>

                {/* Institutes */}
                <Card title="기관별 출원" icon={Building2} action={<span className="text-[11px] text-muted-foreground">{view.y - 1}년 / {view.y}년</span>}>
                  <ul className="space-y-3">
                    {data.institutes.map((i) => {
                      const g = i.previous >= 5 ? Math.round(((i.latest - i.previous) / i.previous) * 100) : null;
                      return (
                        <li key={i.id}>
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="font-semibold text-foreground truncate">{i.label}</span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              <b className="text-foreground text-sm">{i.latest}</b>건 <Growth value={g} className="ml-1 text-xs" />
                            </span>
                          </div>
                          <div className="mt-1.5 space-y-1">
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full trend-bar-prev" style={{ width: `${(i.previous / maxInstitute) * 100}%` }} /></div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(i.latest / maxInstitute) * 100}%` }} /></div>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">5년 누적 {i.total.toLocaleString()}건</p>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </div>

              {/* Fields */}
              <Card
                title="기술 분야별 동향"
                icon={Layers}
                action={
                  <div role="tablist" className="inline-flex rounded-full bg-muted p-0.5 text-xs">
                    {([["count", "출원 많은 순"], ["growth", "증가율 순"]] as const).map(([k, l]) => (
                      <button key={k} role="tab" aria-selected={sort === k} onClick={() => setSort(k)}
                        className={`rounded-full px-3 py-1 font-semibold transition-colors ${sort === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
                    ))}
                  </div>
                }
              >
                <div className="hidden md:grid grid-cols-[minmax(0,1.2fr)_90px_minmax(0,1fr)_80px_90px_24px] gap-3 px-2 pb-2 text-[11px] font-medium text-muted-foreground border-b border-border/60">
                  <span>분야</span><span>{view.completeYears[0]}~{view.y} 추이</span><span>{view.y}년 비중</span><span className="text-right">{view.y}년</span><span className="text-right">전년 대비</span><span />
                </div>
                <ul className="divide-y divide-border/50">
                  {fieldRows.map((f) => {
                    const meta = FIELD_META[f.id];
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/search?keyword=${encodeURIComponent(meta.label)}&field=${encodeURIComponent(meta.label)}&fieldId=${encodeURIComponent(f.id)}`)}
                          className="trend-row w-full grid grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(0,1.2fr)_90px_minmax(0,1fr)_80px_90px_24px] items-center gap-3 rounded-lg px-2 py-2.5 text-left"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className={`technology-tile-${meta.tone} trend-dot w-2.5 h-2.5 rounded-full shrink-0`} />
                            <span className="text-sm font-semibold text-foreground truncate">{meta.label}</span>
                          </span>
                          <span className="hidden md:block"><Sparkline values={view.completeYears.map((y) => f.byYear[y] ?? 0)} tone={meta.tone} /></span>
                          <span className="hidden md:flex items-center gap-2">
                            <span className="h-2 flex-1 rounded-full bg-muted overflow-hidden"><span className={`technology-tile-${meta.tone} trend-dot block h-full rounded-full`} style={{ width: `${(f.share / maxShare) * 100}%` }} /></span>
                            <span className="w-11 text-right text-xs tabular-nums text-muted-foreground">{f.share}%</span>
                          </span>
                          <span className="text-right text-sm font-bold tabular-nums text-foreground">{f.latest}<span className="text-xs font-normal text-muted-foreground">건</span></span>
                          <span className="text-right text-sm"><Growth value={f.growth} /></span>
                          <ArrowRight className="hidden md:block w-4 h-4 text-muted-foreground" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[11px] text-muted-foreground">전년 출원이 5건 미만인 분야는 증감률을 표시하지 않아요. 분야를 누르면 관련 특허를 볼 수 있어요.</p>
              </Card>

              {/* Recent */}
              <Card title="최근 공개된 출원" icon={FileText}>
                <ul className="grid gap-2 md:grid-cols-2">
                  {data.recent.map((r) => {
                    const meta = FIELD_META[r.field];
                    return (
                      <li key={r.number}>
                        <button type="button" onClick={() => navigate(`/?patent=${encodeURIComponent(r.number)}`)}
                          className="trend-row w-full rounded-xl border border-border/50 px-3.5 py-3 text-left">
                          <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className={`technology-tile-${meta?.tone ?? "other"} trend-chip rounded-md px-1.5 py-0.5 font-semibold`}>{meta?.label ?? "기타"}</span>
                            <span className="tabular-nums">{fmtDate(r.date)} 출원</span>
                          </span>
                          <span className="mt-1 block text-sm font-semibold leading-snug text-foreground line-clamp-2">{r.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground truncate">{r.applicant.replace(/\|/g, ", ")}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </>
          )}
        </div>
      </main>
    </PageLayout>
  );
}
