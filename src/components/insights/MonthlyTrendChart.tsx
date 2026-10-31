import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendSnapshot } from "@/hooks/useFilingTrends";
import { fmtYmd, PROVISIONAL_MONTH_LABEL } from "./insightsExport";

const COMPLETE_FILL = "hsl(var(--primary) / 0.7)";
const PROVISIONAL_FILL = "hsl(var(--muted-foreground) / 0.3)";
const tick = (m: string) => `${m.slice(2, 4)}.${m.slice(4, 6)}`;

/** Last 24 months of filings; months the server marks provisional are drawn lighter. */
export function MonthlyTrendChart({ data }: { data: TrendSnapshot }) {
  const months = data.monthly;
  if (months.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">월별 출원 자료가 없어요.</p>;
  const hasProvisional = months.some((m) => m.provisional);

  return (
    <>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} margin={{ top: 12, right: 4, left: -22, bottom: 0 }}>
            <XAxis dataKey="month" tickFormatter={tick} minTickGap={14} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
              formatter={(v: number, _n, item) => [`${v}건${item?.payload?.provisional ? ` (${PROVISIONAL_MONTH_LABEL})` : ""}`, "출원"]}
              labelFormatter={(m: string) => `${m.slice(0, 4)}년 ${Number(m.slice(4, 6))}월`}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={22}>
              {months.map((m) => <Cell key={m.month} fill={m.provisional ? PROVISIONAL_FILL : COMPLETE_FILL} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="범례">
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COMPLETE_FILL }} />집계 완료</li>
        {hasProvisional && (
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: PROVISIONAL_FILL }} />{PROVISIONAL_MONTH_LABEL}</li>
        )}
      </ul>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {fmtYmd(data.disclosedThrough)}까지의 출원만 공개가 끝났어요. 그 뒤 출원은 아직 공개 중이라 수치가 앞으로 늘어나요.
      </p>
    </>
  );
}
