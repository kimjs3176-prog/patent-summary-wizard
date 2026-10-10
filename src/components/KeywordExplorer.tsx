import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, RefreshCw, Utensils, Dna, Sprout, HeartPulse, Sparkles, Leaf, Tractor, Fish, Bug, Recycle, Shovel, Cpu, Shapes } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { layoutTechnologyFields, TECHNOLOGY_TILE_CLASSES } from "@/lib/technologyTreemap";
import { TECHNOLOGY_FIELDS, type TechnologyStats } from "../../supabase/functions/_shared/technologyFields";

const FIELD_ICONS = { food: Utensils, bio: Dna, breeding: Sprout, health: HeartPulse, cosmetics: Sparkles, crop: Leaf, machine: Tractor, livestock: Fish, protection: Bug, environment: Recycle, fertilizer: Shovel, digital: Cpu, other: Shapes };

export function KeywordExplorer() {
  const navigate = useNavigate();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ["technology-field-stats", "v3"],
    queryFn: async (): Promise<TechnologyStats> => {
      const { data, error } = await supabase.functions.invoke("technology-field-stats", { body: {} });
      if (error || !data?.success) throw new Error("통계 조회 실패");
      return data;
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const height = width < 640 ? 520 : 480;
  const fields = data?.fields ?? [];
  const positiveFields = [...fields].sort((a, b) => b.count - a.count).filter(field => field.count > 0);
  const zeroFields = fields.filter(field => field.count === 0);
  // Treemap keeps at least the top 12 fields; anything whose share drops below
  // 1.5% becomes a uniform card so its label stays readable.
  const positiveTotal = positiveFields.reduce((sum, field) => sum + field.count, 0);
  const mainFields = positiveFields.filter((field, index) => index < 12 || field.count >= positiveTotal * 0.015);
  const tailFields = positiveFields.filter(field => !mainFields.includes(field));
  // Compress area ratios (power scale) so dominant fields don't crowd out the rest.
  const layoutFields = mainFields.map(field => ({ ...field, count: Math.round(Math.pow(field.count, 0.6) * 100) }));
  const realCounts = new Map(fields.map(field => [field.id, field.count]));
  const nodes = width && mainFields.length ? layoutTechnologyFields(layoutFields, width, height) : [];
  const date = (value: string) => `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;

  return (
    <section aria-labelledby="technology-keywords-heading" className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 id="technology-keywords-heading" className="text-xl md:text-2xl font-bold text-foreground !tracking-normal">주요 키워드</h2>
          <p className="mt-1 text-xs text-muted-foreground">최근 3년 기술분야별 출원{data ? ` · ${data.total.toLocaleString()}건` : ""}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="출원 통계 새로고침" title="출원 통계 새로고침" onClick={() => refetch()} disabled={isFetching} className="h-8 w-8">
          <RefreshCw className={isFetching ? "animate-spin motion-reduce:animate-none" : ""} />
        </Button>
      </div>
      <div ref={container} className="w-full">
        {isPending ? (
          <div className="grid grid-cols-3 grid-rows-4 gap-1.5" style={{ height }} aria-busy="true" aria-label="출원 통계 불러오는 중">
            {Array.from({ length: 12 }, (_, i) => <div key={i} className="bg-muted rounded-md animate-pulse motion-reduce:animate-none" />)}
          </div>
        ) : isError ? (
          <div className="min-h-40 flex flex-col items-center justify-center gap-3 bg-muted/50 rounded-md">
            <p className="text-sm text-muted-foreground">출원 통계를 불러오지 못했습니다.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw />다시 시도</Button>
          </div>
        ) : (
          <>
            {mainFields.length > 0 && (
              <div className="relative" style={{ height }}>
                {nodes.map(node => {
                  const compact = node.width < 160 || node.height < 110;
                  const definition = TECHNOLOGY_FIELDS.find(field => field.id === node.id);
                  const Icon = FIELD_ICONS[definition?.tone ?? "other"];
                  const count = realCounts.get(node.id) ?? node.count;
                  return (
                    <Button key={node.id} variant="ghost"
                      title={`${node.label} · ${count.toLocaleString()}건 · 대표 IPC 기준`}
                      aria-label={`${node.label} ${count.toLocaleString()}건, 관련 특허 검색`}
                      onClick={() => navigate(`/search?keyword=${encodeURIComponent(node.keyword ?? "농업")}`)}
                      className={`technology-tile ${TECHNOLOGY_TILE_CLASSES[node.id]} group absolute flex-col !whitespace-normal !tracking-normal overflow-hidden hover:scale-100 active:scale-100 focus-visible:z-10 ${compact ? "rounded-lg p-1.5 gap-0.5 justify-center" : "rounded-2xl p-4 items-start justify-start gap-2"}`}
                      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}>
                      {!compact && Icon && <div className="flex w-full items-center justify-between mb-1"><Icon className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.5} /><ArrowUpRight className="h-4 w-4 opacity-40 group-hover:opacity-100" /></div>}
                      <span className={`w-full font-bold tracking-tight leading-tight break-words ${compact ? "text-[11px] text-center" : "text-sm md:text-base text-left"}`}>{node.label}</span>
                      <span className={`shrink-0 font-semibold tabular-nums leading-normal ${compact ? "text-xs" : "mt-auto text-2xl md:text-3xl"}`}>{count.toLocaleString()}<span className={compact ? "" : "ml-1 text-xs font-medium opacity-70"}>건</span></span>
                    </Button>
                  );
                })}
              </div>
            )}
            {tailFields.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5" role="list" aria-label="출원 건수가 적은 분야">
                {tailFields.map(field => {
                  const definition = TECHNOLOGY_FIELDS.find(item => item.id === field.id);
                  return (
                    <Button key={field.id} variant="ghost" role="listitem"
                      className={`technology-tile ${TECHNOLOGY_TILE_CLASSES[field.id]} h-9 px-3 rounded-full gap-1.5`}
                      aria-label={`${definition?.label} ${field.count}건, 관련 특허 검색`}
                      onClick={() => navigate(`/search?keyword=${encodeURIComponent(definition?.keyword ?? "농업")}`)}>
                      <span className="text-xs font-bold tracking-tight">{definition?.label}</span><span className="text-xs font-semibold tabular-nums opacity-70">{field.count}건</span>
                    </Button>
                  );
                })}
              </div>
            )}
            {zeroFields.length > 0 && (
              <div className={(tailFields.length ? "mt-1.5" : "") + " flex flex-wrap gap-1.5"} role="list" aria-label="출원 건수가 없는 분야">
                {zeroFields.map(field => {
                  const definition = TECHNOLOGY_FIELDS.find(item => item.id === field.id);
                  return (
                    <Button key={field.id} variant="ghost" role="listitem"
                      className={`technology-tile ${TECHNOLOGY_TILE_CLASSES[field.id]} h-9 px-3 rounded-full gap-1.5`}
                      aria-label={`${definition?.label} 0건, 관련 특허 검색`}
                      onClick={() => navigate(`/search?keyword=${encodeURIComponent(definition?.keyword ?? "농업")}`)}>
                      <span className="text-xs font-bold tracking-tight">{definition?.label}</span><span className="text-xs font-semibold tabular-nums opacity-70">0건</span>
                    </Button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      {data && <div className="mt-3 flex flex-wrap justify-between gap-1 text-[11px] text-muted-foreground"><span>{date(data.start)}–{date(data.end)} · KIPRIS 출원정보</span><span>대표 IPC 기준 · {new Date(data.updatedAt).toLocaleDateString("ko-KR")} 갱신</span></div>}
    </section>
  );
}
