import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { KeywordExplorer } from "@/components/KeywordExplorer";
import { Skeleton } from "@/components/ui/skeleton";
import { trendHeadline, useFilingTrends } from "@/hooks/useFilingTrends";
import { TECHNOLOGY_FIELDS } from "../../supabase/functions/_shared/technologyFields";

const FIELD_META = Object.fromEntries(TECHNOLOGY_FIELDS.map((f) => [f.id, f])) as Record<string, typeof TECHNOLOGY_FIELDS[number]>;

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${value >= 0 ? "trend-up" : "trend-down"}`}>
      <Icon className="w-3.5 h-3.5" />{value > 0 ? "+" : ""}{value}%
    </span>
  );
}

function TrendSummary() {
  const navigate = useNavigate();
  const { data, isPending, isError } = useFilingTrends();

  if (isPending) return <Skeleton className="h-full min-h-[300px] rounded-2xl" />;
  if (isError || !data) {
    return (
      <div className="trend-card rounded-2xl border border-border/60 bg-card p-5 flex flex-col justify-center text-sm text-muted-foreground">
        출원 동향을 잠시 불러오지 못했어요.
        <Link to="/insights" className="mt-2 font-semibold text-primary">인사이트에서 다시 보기 →</Link>
      </div>
    );
  }

  const h = trendHeadline(data);
  const max = Math.max(1, ...h.complete.map((r) => r.count));
  const openField = (id: string) => {
    const label = FIELD_META[id]?.label ?? id;
    navigate(`/search?keyword=${encodeURIComponent(label)}&field=${encodeURIComponent(label)}&fieldId=${encodeURIComponent(id)}`);
  };
  const highlights = [
    h.top && { id: h.top.id, tag: "비중 1위", value: <span className="tabular-nums text-muted-foreground">{h.top.share}%</span> },
    h.rising && { id: h.rising.id, tag: "급증 분야", value: <Delta value={h.rising.growth} /> },
  ].filter(Boolean) as { id: string; tag: string; value: React.ReactNode }[];

  return (
    <div className="trend-card rounded-2xl border border-border/60 bg-card p-4 md:p-5 flex flex-col">
      <p className="text-xs font-medium text-muted-foreground">{h.y}년 출원 <span className="text-muted-foreground/70">(공개 완료 기준)</span></p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[32px] font-bold leading-none tabular-nums text-foreground">{h.latest?.count ?? 0}<span className="ml-0.5 text-sm font-medium text-muted-foreground">건</span></span>
        <span className="text-xs text-muted-foreground">전년 대비 <Delta value={h.growth} /></span>
      </div>

      {/* Mini yearly bars */}
      <div className="mt-4 flex items-end gap-1.5 h-20" aria-label="연도별 출원 건수">
        {h.complete.map((r) => (
          <div key={r.year} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${r.year}년 ${r.count}건`}>
            <span className="text-[10px] tabular-nums text-muted-foreground">{r.count}</span>
            <div className={`w-full rounded-t-md ${r.year === h.y ? "bg-primary" : "home-insight-bar"}`} style={{ height: `${Math.max(8, (r.count / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {h.complete.map((r) => <span key={r.year} className="flex-1 text-center text-[10px] tabular-nums text-muted-foreground">{String(r.year).slice(2)}년</span>)}
      </div>

      <ul className="mt-4 space-y-1.5">
        {highlights.map((x) => (
          <li key={x.tag}>
            <button type="button" onClick={() => openField(x.id)} className="trend-row w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm">
              <span className="flex items-center gap-2 min-w-0">
                <span className={`technology-tile-${FIELD_META[x.id]?.tone ?? "other"} trend-chip rounded-md px-1.5 py-0.5 text-[11px] font-semibold shrink-0`}>{x.tag}</span>
                <span className="font-semibold text-foreground truncate">{FIELD_META[x.id]?.label ?? x.id}</span>
              </span>
              <span className="flex items-center gap-1 text-xs shrink-0">{x.value}<ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /></span>
            </button>
          </li>
        ))}
      </ul>

      {data.insights[0] && <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-3">{data.insights[0]}</p>}

      <Link to="/insights" className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        출원 동향 상세보기 <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

/** Home "특허 인사이트": filing-trend highlights + technology keyword treemap. */
export function HomeInsights() {
  return (
    <section aria-labelledby="home-insights-heading" className="w-full">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="home-insights-heading" className="text-xl md:text-2xl font-bold text-foreground !tracking-normal">특허 인사이트</h2>
          <p className="mt-1 text-xs text-muted-foreground">농업 국가연구기관 6곳의 출원 동향과 주요 기술 키워드</p>
        </div>
        <Link to="/insights" className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:text-primary hover:border-primary/40 transition-colors">
          상세보기 <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)] gap-4 lg:gap-5 items-stretch">
        <TrendSummary />
        <div className="trend-card rounded-2xl border border-border/60 bg-card p-2.5 sm:p-3 md:p-4 min-w-0">
          <KeywordExplorer embedded />
        </div>
      </div>
    </section>
  );
}
