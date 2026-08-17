import { useQuery } from "@tanstack/react-query";
import { Users, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function todayKst(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

export function VisitorCounter({ className = "" }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ["visitor-counter"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_visits")
        .select("visit_date, visit_count");
      if (error) throw error;
      const rows = data ?? [];
      const total = rows.reduce((s, r) => s + (r.visit_count ?? 0), 0);
      const today = rows.find((r) => r.visit_date === todayKst())?.visit_count ?? 0;
      return { total, today };
    },
  });

  const fmt = (n?: number) => (n ?? 0).toLocaleString("ko-KR");

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3 py-1.5 ${className}`}>
      <span className="inline-flex items-center gap-1.5 text-[11px] md:text-xs text-muted-foreground">
        <CalendarDays className="w-3.5 h-3.5 text-primary/70" />
        오늘 <span className="font-semibold tabular-nums text-foreground/80">{fmt(data?.today)}</span>
      </span>
      <span className="w-px h-3 bg-border/60" />
      <span className="inline-flex items-center gap-1.5 text-[11px] md:text-xs text-muted-foreground">
        <Users className="w-3.5 h-3.5 text-primary/70" />
        누적 <span className="font-semibold tabular-nums text-foreground/80">{fmt(data?.total)}</span>
      </span>
    </div>
  );
}
