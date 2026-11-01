import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { trendHeadline, useFilingTrends, type TrendSnapshot } from "@/hooks/useFilingTrends";
import { TECHNOLOGY_FIELDS } from "../../supabase/functions/_shared/technologyFields";

const FIELD_META = Object.fromEntries(TECHNOLOGY_FIELDS.map((f) => [f.id, f])) as Record<string, typeof TECHNOLOGY_FIELDS[number]>;
const RANK_LIMIT = 10;
const MOBILE_LIMIT = 5;

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${value >= 0 ? "trend-up" : "trend-down"}`}>
      <Icon className="w-3.5 h-3.5" />{value > 0 ? "+" : ""}{value}%
    </span>
  );
}

function Sparkline({ values, tone }: { values: number[]; tone: string }) {
  const max = Math.max(1, ...values);
  const w = 48, h = 18;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - 2 - (v / max) * (h - 4)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={`technology-tile-${tone} shrink-0`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="hsl(var(--tile-ink))" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function useFieldSearch() {
  const navigate = useNavigate();
  return (id: string) => {
    const label = FIELD_META[id]?.label ?? id;
    navigate(`/search?keyword=${encodeURIComponent(label)}&field=${encodeURIComponent(label)}&fieldId=${encodeURIComponent(id)}`);
  };
}

/** Yearly filing trend as a line chart with labelled points. */
function TrendLine({ rows, highlight }: { rows: { year: number; count: number }[]; highlight: number }) {
  const W = 240, H = 96, px = 14, top = 18, bottom = 18;
  const max = Math.max(1, ...rows.map((r) => r.count));
  const min = Math.min(...rows.map((r) => r.count), max);
  const span = Math.max(1, max - min);
  const pts = rows.map((r, i) => ({
    ...r,
    x: px + (i / Math.max(1, rows.length - 1)) * (W - px * 2),
    y: top + (1 - (r.count - min) / span) * (H - top - bottom),
  }));
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = pts.length ? `${pts[0].x},${H - bottom} ${line} ${pts[pts.length - 1].x},${H - bottom}` : "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full max-w-[360px] mx-auto h-auto" role="img" aria-label="연도별 출원 건수 추이">
      <polygon points={area} fill="hsl(var(--primary) / 0.1)" />
      <polyline points={line} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => (
        <g key={p.year}>
          <circle cx={p.x} cy={p.y} r={p.year === highlight ? 4 : 2.5} fill={p.year === highlight ? "hsl(var(--primary))" : "hsl(var(--card))"} stroke="hsl(var(--primary))" strokeWidth={1.5} />
          <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="9" className="fill-muted-foreground tabular-nums">{p.count}</text>
          <text x={p.x} y={H - 4} textAnchor="middle" fontSize="9" className="fill-muted-foreground tabular-nums">{String(p.year).slice(2)}년</text>
        </g>
      ))}
    </svg>
  );
}

/** Left card: headline count, yearly trend line and one verified AI sentence. */
function TrendSummary({ data }: { data: TrendSnapshot }) {
  const h = trendHeadline(data);
  const max = Math.max(1, ...h.complete.map((r) => r.count));
  return (
    <div className="trend-card rounded-2xl border border-border/60 bg-card p-4 md:p-5 flex flex-col">
      <p className="text-xs font-medium text-muted-foreground">{h.y}년 출원 <span className="text-muted-foreground">(공개 완료 기준)</span></p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[32px] font-bold leading-none tabular-nums text-foreground">{h.latest?.count ?? 0}<span className="ml-0.5 text-sm font-medium text-muted-foreground">건</span></span>
        <span className="text-xs text-muted-foreground">전년 대비 <Delta value={h.growth} /></span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">최근 {h.complete.length}년 누적 <span className="font-semibold tabular-nums text-foreground">{h.completeTotal.toLocaleString()}건</span></p>

      <TrendLine rows={h.complete} highlight={h.y} />

      {data.insights[0] && <p className="trend-insight mt-4 rounded-r-lg px-3 py-2 text-xs leading-relaxed text-foreground/80 line-clamp-3">{data.insights[0]}</p>}

      <Link to="/insights" className="mt-auto pt-4 self-start text-sm font-semibold text-primary underline-offset-4 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        출원 동향 상세보기
      </Link>
    </div>
  );
}

/** Right card: compact field ranking (same snapshot as the Insights page); rows open the field search. */
function FieldRanking({ data }: { data: TrendSnapshot }) {
  const openField = useFieldSearch();
  const [sort, setSort] = useState<"count" | "growth">("count");
  const [expanded, setExpanded] = useState(false);
  const h = trendHeadline(data);

  const rows = useMemo(() => {
    const list = data.fields.filter((f) => f.latest > 0);
    const sorted = sort === "count"
      ? [...list].sort((a, b) => b.latest - a.latest)
      : [...list].filter((f) => f.growth !== null).sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0) || b.latest - a.latest);
    return sorted.slice(0, RANK_LIMIT);
  }, [data, sort]);
  const maxShare = Math.max(1, ...rows.map((f) => f.share));
  const years = h.completeYears;

  return (
    <div className="trend-card rounded-2xl border border-border/60 bg-card p-4 md:p-5 min-w-0 flex flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-bold text-foreground !tracking-normal">기술분야별 출원</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{h.y}년 기준 상위 {rows.length}개 분야예요. 누르면 관련 특허를 검색해요.</p>
        </div>
        <div role="tablist" aria-label="정렬" className="inline-flex rounded-full bg-muted p-0.5 text-xs">
          {([["count", "출원 많은 순"], ["growth", "증가율 순"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={sort === k} onClick={() => setSort(k)}
              className={`whitespace-nowrap rounded-full px-3 py-1 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sort === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
      </div>

      <ol className="flex flex-col">
        {rows.map((f, i) => {
          const meta = FIELD_META[f.id];
          const tone = meta?.tone ?? "other";
          const badge = f.id === h.top?.id ? "비중 1위" : f.id === h.rising?.id ? "급증" : null;
          return (
            <li key={f.id} className={`border-b border-border/50 ${i >= MOBILE_LIMIT && !expanded ? "hidden md:block" : ""}`}>
              <button type="button" onClick={() => openField(f.id)}
                title={`${meta?.label} ${years[0]}~${h.y}년 추이`}
                className="trend-row group w-full grid grid-cols-[18px_minmax(0,1fr)_48px_auto_56px_14px] items-center gap-2 rounded-lg px-1.5 py-1.5 text-left">
                <span className="text-xs font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex items-center gap-2">
                  <span className="w-16 sm:w-20 shrink-0 text-sm font-semibold text-foreground truncate">{meta?.label ?? f.id}</span>
                  {badge && <span className={`technology-tile-${tone} trend-chip hidden sm:inline rounded px-1 py-px text-[11px] font-semibold shrink-0`}>{badge}</span>}
                  <span className="h-1 flex-1 min-w-[24px] rounded-full bg-muted overflow-hidden"><span className={`technology-tile-${tone} trend-dot block h-full rounded-full`} style={{ width: `${(f.share / maxShare) * 100}%` }} /></span>
                  <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{f.share}%</span>
                </span>
                <Sparkline values={years.map((y) => f.byYear[y] ?? 0)} tone={tone} />
                <span className="text-right text-sm font-bold tabular-nums text-foreground">{f.latest}<span className="text-[11px] font-normal text-muted-foreground">건</span></span>
                <span className="text-right text-xs"><Delta value={f.growth} /></span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                {/* The visible row text is the accessible name; this only adds what the row does. */}
                <span className="sr-only">{h.y}년 출원, 관련 특허 검색</span>
              </button>
            </li>
          );
        })}
      </ol>

      {rows.length > MOBILE_LIMIT && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="md:hidden mt-2 inline-flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
          {expanded ? "접기" : `${rows.length - MOBILE_LIMIT}개 분야 더 보기`}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
      <p className="mt-auto pt-3 text-[11px] text-muted-foreground">추이선은 {years[0]}~{h.y}년, 증감률은 전년 대비이며 전년 5건 미만 분야는 표시하지 않아요. 분야는 대표 IPC 기준이에요.</p>
    </div>
  );
}

/** Home "특허 인사이트": filing-trend summary + field ranking from one snapshot. */
export function HomeInsights() {
  const { data, isPending, isError } = useFilingTrends();

  return (
    <section aria-labelledby="home-insights-heading" className="w-full">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="home-insights-heading" className="text-xl md:text-2xl font-bold text-foreground !tracking-normal">특허 인사이트</h2>
          <p className="mt-1 text-xs text-muted-foreground">농업 국가연구기관 6곳의 출원 동향과 기술분야별 순위</p>
        </div>
        <Link to="/insights" className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:text-primary hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          상세보기
        </Link>
      </div>
      {isPending ? (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 md:gap-5">
          <Skeleton className="h-[300px] rounded-2xl" />
          <Skeleton className="h-[300px] rounded-2xl" />
        </div>
      ) : isError || !data ? (
        <div className="trend-card rounded-2xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">
          출원 동향을 잠시 불러오지 못했어요.
          <Link to="/insights" className="ml-2 font-semibold text-primary">인사이트에서 다시 보기</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 md:gap-5 items-stretch">
          <TrendSummary data={data} />
          <FieldRanking data={data} />
        </div>
      )}
    </section>
  );
}
