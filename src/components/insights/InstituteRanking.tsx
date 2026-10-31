import { useMemo } from "react";
import type { TrendSnapshot } from "@/hooks/useFilingTrends";
import { Growth } from "./Growth";
import { fmtYmd, instituteRows } from "./insightsExport";

const COLS = "grid-cols-[20px_minmax(0,1fr)_auto] md:grid-cols-[24px_minmax(0,1.2fr)_minmax(0,1.6fr)_64px_64px_72px]";

/** Ranked institutes: period total as a bar, complete year vs. the year before. */
export function InstituteRanking({ data }: { data: TrendSnapshot }) {
  const rows = useMemo(() => instituteRows(data), [data]);
  const y = data.completeYear;
  const max = Math.max(1, ...rows.map((r) => r.total));

  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">기관별 출원 자료가 없어요.</p>;

  return (
    <>
      <div className={`hidden md:grid ${COLS} gap-3 px-2 pb-2 text-[11px] font-medium text-muted-foreground border-b border-border/60`}>
        <span>#</span><span>기관</span><span>집계 기간 누적</span>
        <span className="text-right">{y}년</span><span className="text-right">{y - 1}년</span><span className="text-right">전년 대비</span>
      </div>
      <ol className="[&>li]:border-b [&>li]:border-border/50">
        {rows.map((r) => (
          <li key={r.id} className={`grid ${COLS} items-center gap-x-3 gap-y-1.5 px-2 py-2.5`}>
            <span className="text-xs font-bold tabular-nums text-muted-foreground">{r.rank}</span>
            <span className="text-sm font-semibold text-foreground truncate">{r.label}</span>
            <span className="row-start-2 col-start-2 col-span-2 md:row-start-auto md:col-start-auto md:col-span-1 flex items-center gap-2">
              <span className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                <span className="block h-full rounded-full bg-primary/70" style={{ width: `${(r.total / max) * 100}%` }} />
              </span>
              <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground md:w-14">
                {r.total.toLocaleString()}건<span className="md:hidden"> · {y - 1}년 {r.previous}건</span>
              </span>
            </span>
            <span className="col-start-3 row-start-1 md:col-start-auto md:row-start-auto flex items-center justify-end gap-2 text-right md:contents">
              <span className="text-sm font-bold tabular-nums text-foreground md:text-right">
                <span className="md:hidden text-[11px] font-normal text-muted-foreground">{y}년 </span>{r.latest}<span className="text-xs font-normal text-muted-foreground">건</span>
              </span>
              <span className="hidden md:block text-right text-sm tabular-nums text-muted-foreground">{r.previous}건</span>
              <span className="text-right text-sm"><Growth value={r.growth} /></span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        막대는 집계 기간({fmtYmd(data.start)}~{fmtYmd(data.end)}) 전체 출원이고, 연도 비교는 공개가 끝난 {y}년과 {y - 1}년만 사용해요. 전년 출원이 5건 미만이면 증감률을 표시하지 않아요.
      </p>
    </>
  );
}
