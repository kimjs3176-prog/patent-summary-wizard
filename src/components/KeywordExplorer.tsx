import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, RefreshCw, Utensils, Dna, Sprout, HeartPulse, Sparkles, Leaf, Tractor, Fish, Bug, Recycle, Shovel, Cpu, Shapes } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { layoutTechnologyFields, TECHNOLOGY_TILE_CLASSES } from "@/lib/technologyTreemap";
import { TECHNOLOGY_FIELDS, type TechnologyStats, type TechnologyFieldId } from "../../supabase/functions/_shared/technologyFields";

const FIELD_ICONS = { food: Utensils, bio: Dna, breeding: Sprout, health: HeartPulse, cosmetics: Sparkles, crop: Leaf, machine: Tractor, livestock: Fish, protection: Bug, environment: Recycle, fertilizer: Shovel, digital: Cpu, other: Shapes };

export function KeywordExplorer() {
  const navigate = useNavigate();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ["technology-field-stats", "v2"],
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
  const height = width < 640 ? 500 : 360;
  const nodes = data && width ? layoutTechnologyFields(data.fields, width, height) : [];
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
          <div className="h-[500px] md:h-[360px] grid grid-cols-3 grid-rows-2 gap-1.5" aria-busy="true" aria-label="출원 통계 불러오는 중">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="bg-muted rounded-md animate-pulse motion-reduce:animate-none" />)}
          </div>
        ) : isError ? (
          <div className="min-h-40 flex flex-col items-center justify-center gap-3 bg-muted/50 rounded-md">
            <p className="text-sm text-muted-foreground">출원 통계를 불러오지 못했습니다.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw />다시 시도</Button>
          </div>
        ) : data?.total === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">해당 기간의 출원 정보가 없습니다.</p>
        ) : (
          <div className="relative" style={{ height }}>
            {nodes.map(node => {
              const compact = node.width < 145 || node.height < 115;
              const tiny = node.width < 85 || node.height < 55;
              const Icon = FIELD_ICONS[node.id as TechnologyFieldId];
              return (
                <Button key={node.id} variant="ghost"
                  title={`${node.label} · ${node.count.toLocaleString()}건 · 대표 IPC 기준`}
                  aria-label={`${node.label} ${node.count.toLocaleString()}건, 관련 특허 검색`}
                  onClick={() => navigate(`/search?keyword=${encodeURIComponent(node.keyword ?? "농업")}`)}
                  className={`technology-tile ${TECHNOLOGY_TILE_CLASSES[node.id]} group absolute flex-col !whitespace-normal !tracking-normal overflow-hidden hover:scale-100 active:scale-100 focus-visible:z-10 ${tiny ? "rounded-lg p-1 gap-0.5 justify-center" : compact ? "rounded-xl p-2 gap-1 justify-center" : "rounded-2xl p-5 items-start justify-start gap-2"}`}
                  style={{ left: node.x, top: node.y, width: node.width, height: node.height }}>
                  {!compact && Icon && <div className="flex w-full items-center justify-between mb-1"><Icon className="h-6 w-6" strokeWidth={1.5} /><ArrowUpRight className="h-4 w-4 opacity-40 group-hover:opacity-100" /></div>}
                  {node.width >= 55 && node.height >= 42 ? <>
                    <span className={`w-full leading-snug ${tiny ? "text-[11px] text-center break-words" : compact ? "text-xs text-center break-words" : "text-base md:text-lg text-left break-words"} font-bold`}>{node.label}</span>
                    <span className={`inline-flex shrink-0 items-baseline tabular-nums leading-none ${tiny ? "text-[10px]" : compact ? "text-xs" : "mt-auto text-3xl font-semibold"}`}>{node.count.toLocaleString()}<span className={compact ? "" : "ml-1 text-xs font-medium opacity-70"}>건</span></span>
                  </> : node.height >= 24 && node.width >= 24 && Icon ? <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} /> : null}
                </Button>
              );
            })}
          </div>
        )}
      </div>
      {data && <div className="mt-3 flex flex-wrap justify-between gap-1 text-[11px] text-muted-foreground"><span>{date(data.start)}–{date(data.end)} · KIPRIS 출원정보</span><span>대표 IPC 기준 · {new Date(data.updatedAt).toLocaleDateString("ko-KR")} 갱신</span></div>}
      {data && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{data.fields.filter(field => field.count === 0 || nodes.some(node => node.id === field.id && (node.width < 85 || node.height < 55))).map(field => { const definition = TECHNOLOGY_FIELDS.find(item => item.id === field.id); return <Button key={field.id} variant="link" size="sm" className="h-7 px-0 text-xs text-muted-foreground" onClick={() => navigate(`/search?keyword=${encodeURIComponent(definition?.keyword ?? "농업")}`)}>{definition?.label} · {field.count.toLocaleString()}건<ArrowUpRight /></Button>; })}</div>}
    </section>
  );
}
