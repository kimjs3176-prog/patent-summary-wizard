import { useMemo, useState } from "react";
import { TrendingUp, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { FavoritePatent } from "@/hooks/useFavoritePatents";

interface PatentTrendChartProps {
  patents: FavoritePatent[];
}

type ViewMode = "year" | "ipc" | "assignee";

export function PatentTrendChart({ patents }: PatentTrendChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("year");

  const yearData = useMemo(() => {
    const map = new Map<string, number>();
    patents.forEach((p) => {
      const date = p.patentData.filingDate || p.patentData.publicationDate;
      if (!date) return;
      const year = date.slice(0, 4);
      if (year && /^\d{4}$/.test(year)) {
        map.set(year, (map.get(year) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, count]) => ({ name: year, value: count }));
  }, [patents]);

  const ipcData = useMemo(() => {
    const map = new Map<string, number>();
    patents.forEach((p) => {
      (p.patentData.classifications || []).forEach((c) => {
        const section = c.trim().slice(0, 4); // e.g. A01B
        if (section) map.set(section, (map.get(section) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [patents]);

  const assigneeData = useMemo(() => {
    const map = new Map<string, number>();
    patents.forEach((p) => {
      const assignee = p.patentData.assignee?.trim();
      if (assignee) map.set(assignee, (map.get(assignee) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, value]) => ({ name: name.length > 12 ? name.slice(0, 12) + "…" : name, value }));
  }, [patents]);

  const data = viewMode === "year" ? yearData : viewMode === "ipc" ? ipcData : assigneeData;

  const COLORS = [
    "hsl(158, 64%, 40%)",
    "hsl(220, 70%, 55%)",
    "hsl(45, 93%, 47%)",
    "hsl(350, 65%, 55%)",
    "hsl(280, 60%, 55%)",
    "hsl(190, 70%, 45%)",
  ];

  if (patents.length < 2) return null;

  return (
    <section className="mt-8 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4.5 h-4.5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">시계열 트렌드</h3>
        </div>
        <div className="flex gap-1">
          {([
            ["year", "연도별"],
            ["ipc", "IPC"],
            ["assignee", "출원인"],
          ] as [ViewMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-[11px] rounded-lg font-medium transition-all ${
                viewMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
          데이터가 부족합니다
        </div>
      ) : (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-4" style={{ boxShadow: '0 1px 3px hsl(var(--foreground) / 0.03)' }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={viewMode === "assignee" ? -20 : 0}
                textAnchor={viewMode === "assignee" ? "end" : "middle"}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid hsl(var(--border) / 0.5)",
                  background: "hsl(var(--card))",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px hsl(var(--foreground) / 0.08)",
                }}
                formatter={(value: number) => [`${value}건`, viewMode === "year" ? "출원 수" : "특허 수"]}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
