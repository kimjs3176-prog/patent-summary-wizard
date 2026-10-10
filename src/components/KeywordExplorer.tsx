import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, RefreshCw, ChevronLeft, ChevronRight, Pause, Play, Utensils, Dna, Sprout, HeartPulse, Sparkles, Leaf, Tractor, Fish, Bug, Recycle, Shovel, Cpu, Shapes } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { layoutTechnologyFields, groupTechnologyFields, TECHNOLOGY_TILE_CLASSES } from "@/lib/technologyTreemap";
import { TECHNOLOGY_FIELDS, type TechnologyStats } from "../../supabase/functions/_shared/technologyFields";

const FIELD_ICONS = { food: Utensils, bio: Dna, breeding: Sprout, health: HeartPulse, cosmetics: Sparkles, crop: Leaf, machine: Tractor, livestock: Fish, protection: Bug, environment: Recycle, fertilizer: Shovel, digital: Cpu, other: Shapes };

export function KeywordExplorer() {
  const navigate = useNavigate();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [activeGroup, setActiveGroup] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
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
  const height = width < 640 ? 380 : 300;
  const groups = groupTechnologyFields(data?.fields ?? [], width < 640 ? 4 : 6);
  const current = activeGroup % Math.max(groups.length, 1);
  const visibleFields = groups[current] ?? [];
  const groupTotal = visibleFields.reduce((sum, field) => sum + field.count, 0);
  const nodes = width && groupTotal ? layoutTechnologyFields(visibleFields, width, height) : [];
  const move = (direction: number) => setActiveGroup(value => (value + direction + groups.length) % Math.max(groups.length, 1));
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (paused || interacting || reducedMotion || groups.length < 2) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActiveGroup(value => (value + 1) % groups.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [paused, interacting, reducedMotion, groups.length]);
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
      <div ref={container} className="w-full" onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
        onFocusCapture={() => setInteracting(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false); }}>
        {isPending ? (
          <div className="h-[380px] md:h-[300px] grid grid-cols-3 grid-rows-2 gap-1.5" aria-busy="true" aria-label="출원 통계 불러오는 중">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="bg-muted rounded-md animate-pulse motion-reduce:animate-none" />)}
          </div>
        ) : isError ? (
          <div className="min-h-40 flex flex-col items-center justify-center gap-3 bg-muted/50 rounded-md">
            <p className="text-sm text-muted-foreground">출원 통계를 불러오지 못했습니다.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw />다시 시도</Button>
          </div>
        ) : groupTotal === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1" style={{ height }}>
            {visibleFields.map(field => {
              const definition = TECHNOLOGY_FIELDS.find(item => item.id === field.id);
              return <Button key={field.id} variant="ghost" className={`technology-tile ${TECHNOLOGY_TILE_CLASSES[field.id]} h-full rounded-2xl flex-col gap-3 !whitespace-normal`}
                aria-label={`${definition?.label} 0건, 관련 특허 검색`} onClick={() => navigate(`/search?keyword=${encodeURIComponent(definition?.keyword ?? "농업")}`)}>
                <span className="text-base font-bold">{definition?.label}</span><span className="text-lg tabular-nums">0건</span>
              </Button>;
            })}
          </div>
        ) : (
          <div className="relative" style={{ height }}>
            {nodes.map(node => {
              const compact = node.width < 145 || node.height < 115;
              const tiny = node.width < 85 || node.height < 55;
              const definition = TECHNOLOGY_FIELDS.find(field => field.id === node.id);
              const Icon = FIELD_ICONS[definition?.tone ?? "other"];
              return (
                <Button key={node.id} variant="ghost"
                  title={`${node.label} · ${node.count.toLocaleString()}건 · 대표 IPC 기준`}
                  aria-label={`${node.label} ${node.count.toLocaleString()}건, 관련 특허 검색`}
                  onClick={() => navigate(`/search?keyword=${encodeURIComponent(node.keyword ?? "농업")}`)}
                  className={`technology-tile ${TECHNOLOGY_TILE_CLASSES[node.id]} group absolute flex-col !whitespace-normal !tracking-normal overflow-hidden hover:scale-100 active:scale-100 focus-visible:z-10 ${tiny ? "rounded-lg p-1 gap-0.5 justify-center" : compact ? "rounded-xl p-2 gap-1 justify-center" : "rounded-2xl p-5 items-start justify-start gap-2"}`}
                  style={{ left: node.x, top: node.y, width: node.width, height: node.height }}>
                  {!compact && Icon && <div className="flex w-full items-center justify-between mb-1"><Icon className="h-6 w-6" strokeWidth={1.5} /><ArrowUpRight className="h-4 w-4 opacity-40 group-hover:opacity-100" /></div>}
                  <span className={`w-full leading-snug ${compact ? "text-sm text-center break-words" : "text-base md:text-lg text-left break-words"} font-bold`}>{node.label}</span>
                  <span className={`shrink-0 tabular-nums leading-normal ${compact ? "text-base" : "mt-auto text-3xl font-semibold"}`}>{node.count.toLocaleString()}<span className={compact ? "" : "ml-1 text-xs font-medium opacity-70"}>건</span></span>
                </Button>
              );
            })}
          </div>
        )}
      </div>
      {data && <div className="mt-3 flex flex-wrap justify-between gap-1 text-[11px] text-muted-foreground"><span>{date(data.start)}–{date(data.end)} · KIPRIS 출원정보</span><span>대표 IPC 기준 · {new Date(data.updatedAt).toLocaleDateString("ko-KR")} 갱신</span></div>}
      {groups.length > 1 && <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1" aria-label="기술분야 카드 페이지">
          {groups.map((group, index) => <Button key={index} variant={current === index ? "secondary" : "ghost"} size="icon" className="h-8 w-8 tabular-nums"
            aria-label={`${index + 1}번째 분야 그룹`} aria-current={current === index ? "page" : undefined}
            title={group.map(field => TECHNOLOGY_FIELDS.find(item => item.id === field.id)?.label).join(", ")}
            onClick={() => setActiveGroup(index)}>{index + 1}</Button>)}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="이전 분야" title="이전 분야" onClick={() => move(-1)}><ChevronLeft /></Button>
          {!reducedMotion && <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={paused ? "분야 순환 재생" : "분야 순환 일시정지"} title={paused ? "분야 순환 재생" : "분야 순환 일시정지"} onClick={() => setPaused(value => !value)}>{paused ? <Play /> : <Pause />}</Button>}
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="다음 분야" title="다음 분야" onClick={() => move(1)}><ChevronRight /></Button>
        </div>
      </div>}

    </section>
  );
}
