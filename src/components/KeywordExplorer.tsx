import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { layoutTechnologyFields } from "@/lib/technologyTreemap";
import { TECHNOLOGY_FIELDS, type TechnologyStats } from "../../supabase/functions/_shared/technologyFields";

export function KeywordExplorer() {
  const navigate = useNavigate();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ["technology-field-stats"],
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
  const height = width < 640 ? 350 : 320;
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
          <div className="h-[350px] md:h-80 grid grid-cols-3 grid-rows-2 gap-1" aria-busy="true" aria-label="출원 통계 불러오는 중">
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
          <div className="relative overflow-hidden rounded-md" style={{ height }}>
            {nodes.map(node => {
              const compact = node.width < 125 || node.height < 80;
              const tiny = node.width < 65 || node.height < 38;
              return (
                <Button key={node.id} variant="ghost"
                  title={`${node.label} · ${node.count.toLocaleString()}건 · 대표 IPC 기준`}
                  aria-label={`${node.label} ${node.count.toLocaleString()}건, 관련 특허 검색`}
                  onClick={() => navigate(`/search?keyword=${encodeURIComponent(node.keyword ?? "농업")}`)}
                  className={`technology-tile technology-tile-${node.tone} absolute flex-col gap-1 rounded-[4px] p-1.5 !whitespace-normal !tracking-normal overflow-hidden hover:scale-100 active:scale-100 hover:brightness-95 focus-visible:z-10`}
                  style={{ left: node.x, top: node.y, width: node.width, height: node.height }}>
                  {!tiny && <span className={`w-full leading-snug text-center break-words ${compact ? "text-xs" : "text-base md:text-lg"} font-bold`}>{node.label}</span>}
                  {!tiny && <span className={`tabular-nums font-medium ${compact ? "text-[11px]" : "text-sm md:text-base"}`}>{node.count.toLocaleString()}건</span>}
                </Button>
              );
            })}
          </div>
        )}
      </div>
      {data && <div className="mt-3 flex flex-wrap justify-between gap-1 text-[11px] text-muted-foreground"><span>{date(data.start)}–{date(data.end)} · KIPRIS 출원정보</span><span>대표 IPC 기준 · {new Date(data.updatedAt).toLocaleDateString("ko-KR")} 갱신</span></div>}
      {data && data.fields.some(field => field.count === 0) && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{data.fields.filter(field => field.count === 0).map(field => { const definition = TECHNOLOGY_FIELDS.find(item => item.id === field.id); return <Button key={field.id} variant="link" size="sm" className="h-7 px-0 text-xs text-muted-foreground" onClick={() => navigate(`/search?keyword=${encodeURIComponent(definition?.keyword ?? "농업")}`)}>{definition?.label} · 0건<ArrowUpRight /></Button>; })}</div>}
    </section>
  );
}
