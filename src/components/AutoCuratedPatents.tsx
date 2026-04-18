import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Award, Layers, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CuratedItem {
  patentNumber: string;
  title: string;
  assignee?: string;
  totalScore: number;
  ipc: string;
  ipcSection: string;
}

const SCORE_BANDS = [
  { min: 90, color: "hsl(158, 64%, 40%)" },
  { min: 80, color: "hsl(190, 70%, 45%)" },
  { min: 70, color: "hsl(45, 93%, 47%)" },
  { min: 60, color: "hsl(25, 90%, 55%)" },
  { min: 0, color: "hsl(350, 65%, 55%)" },
];

function bandColor(score: number) {
  return SCORE_BANDS.find((b) => score >= b.min)?.color || SCORE_BANDS[SCORE_BANDS.length - 1].color;
}

export function AutoCuratedPatents() {
  const [items, setItems] = useState<CuratedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: scoreRows, error: scoreErr } = await supabase
          .from("patent_score_cache")
          .select("patent_number, total_score")
          .order("total_score", { ascending: false })
          .limit(80);
        if (scoreErr) throw scoreErr;
        if (!scoreRows || scoreRows.length === 0) {
          if (!cancelled) {
            setItems([]);
            setLoading(false);
          }
          return;
        }

        const dedup = new Map<string, any>();
        scoreRows.forEach((r) => {
          if (!dedup.has(r.patent_number)) {
            dedup.set(r.patent_number, r);
          }
        });
        const candidates = Array.from(dedup.values());

        const { data: dataRows } = await supabase
          .from("patent_data_cache")
          .select("patent_number, patent_data")
          .in(
            "patent_number",
            candidates.map((c) => c.patent_number)
          );

        const dataMap = new Map<string, any>();
        (dataRows || []).forEach((r) => {
          dataMap.set(r.patent_number, r.patent_data);
        });

        const enriched: CuratedItem[] = candidates
          .map((c) => {
            const pd = dataMap.get(c.patent_number);
            if (!pd) return null;
            const ipc = pd.classifications?.[0]?.trim() || "";
            const ipcSection = ipc.slice(0, 4) || "ETC";
            return {
              patentNumber: c.patent_number,
              title: pd.titleKo || pd.title || c.patent_number,
              assignee: pd.assignee,
              totalScore: c.total_score,
              ipc,
              ipcSection,
            } as CuratedItem;
          })
          .filter((x): x is CuratedItem => x !== null)
          .sort((a, b) => b.totalScore - a.totalScore);

        const picked: CuratedItem[] = [];
        const ipcCount = new Map<string, number>();
        for (const item of enriched) {
          const c = ipcCount.get(item.ipcSection) || 0;
          if (c >= 2) continue;
          picked.push(item);
          ipcCount.set(item.ipcSection, c + 1);
          if (picked.length >= 6) break;
        }
        if (picked.length < 6) {
          for (const item of enriched) {
            if (picked.find((p) => p.patentNumber === item.patentNumber)) continue;
            picked.push(item);
            if (picked.length >= 6) break;
          }
        }

        if (!cancelled) {
          setItems(picked);
          setLoading(false);
        }
      } catch (e) {
        console.error("Auto-curation failed:", e);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/50 p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> 추천 특허 큐레이션 중…
      </div>
    );
  }

  if (items.length === 0) return null;

  const ipcSections = Array.from(new Set(items.map((i) => i.ipcSection)));

  return (
    <section className="mt-4">
      <div
        className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent p-4 sm:p-5"
        style={{ boxShadow: "0 1px 3px hsl(var(--foreground) / 0.03)" }}
      >
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">AI 추천 특허</h3>
              <p className="text-[10px] text-muted-foreground">점수 상위 + IPC 분야 다양성 기반 자동 큐레이션</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Layers className="w-3 h-3" />
            <span>{ipcSections.length}개 분야</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {items.map((item, idx) => {
            const color = bandColor(item.totalScore);
            return (
              <Link
                key={item.patentNumber}
                to={`/?patent=${encodeURIComponent(item.patentNumber)}`}
                className="group relative rounded-xl border border-border/40 bg-card p-3 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ background: color }}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground truncate">{item.patentNumber}</span>
                  </div>
                  <span
                    className="flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: `${color}15`, color }}
                  >
                    <Award className="w-2.5 h-2.5" />
                    {item.totalScore}
                  </span>
                </div>

                <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug mb-1.5">{item.title}</p>

                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-muted-foreground truncate">{item.assignee || "출원인 정보 없음"}</span>
                  {item.ipcSection && (
                    <span className="font-mono text-muted-foreground/70 shrink-0 px-1 py-0.5 rounded bg-muted/50">
                      {item.ipcSection}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
