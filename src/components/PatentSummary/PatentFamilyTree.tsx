import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Network, Loader2, AlertCircle, Layers } from "lucide-react";
import { PatentData } from "./types";

interface FamilyPatent {
  patentId: string;
  title: string;
  applicationDate?: string;
  registrationDate?: string;
  ipc?: string;
  ipcCategory?: string;
  isCurrent: boolean;
}

interface PatentFamilyTreeProps {
  patentData: PatentData;
  onPatentClick?: (patentNumber: string) => void;
}

interface TreeNode {
  name: string;
  patentId?: string;
  title?: string;
  date?: string;
  ipc?: string;
  ipcCategory?: string;
  isCurrent?: boolean;
  children?: TreeNode[];
}

interface TooltipState {
  x: number;
  y: number;
  patent: FamilyPatent;
}

export function PatentFamilyTree({ patentData, onPatentClick }: PatentFamilyTreeProps) {
  const [patents, setPatents] = useState<FamilyPatent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swimlane, setSwimlane] = useState<boolean>(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const run = async () => {
      if (!patentData?.assignee) return;
      setLoading(true);
      setError(null);
      setPatents([]);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/patent-family-tree`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              assignee: patentData.assignee,
              currentPatentNumber: patentData.displayNumber || patentData.patentNumber,
              currentPatentTitle: patentData.titleKo || patentData.title,
            }),
          }
        );
        const json = await res.json();
        if (json.success) {
          setPatents(json.patents || []);
          if (!json.patents?.length) setError("동일 출원인의 다른 특허를 찾지 못했습니다.");
        } else {
          setError(json.error || "패밀리 트리 로딩 실패");
        }
      } catch (e) {
        console.error(e);
        setError("패밀리 트리 조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [patentData?.assignee, patentData?.patentNumber]);

  // Render timeline visualization (D3 SVG)
  useEffect(() => {
    if (!patents.length || !svgRef.current || !containerRef.current) return;
    setTooltip(null);
    renderTimeline();
  }, [patents, swimlane, patentData.assignee]);

  const findPatent = (patentId: string) => patents.find((p) => p.patentId === patentId);

  const showTooltip = (e: any, patentId: string) => {
    const p = findPatent(patentId);
    if (!p || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      patent: p,
    });
  };
  const hideTooltip = () => setTooltip(null);

  const renderTree = () => {
    if (!svgRef.current || !containerRef.current) return;

    const grouped = new Map<string, FamilyPatent[]>();
    patents.forEach((p) => {
      const cat = p.ipcCategory || "기타";
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(p);
    });

    const root: TreeNode = {
      name: patentData.assignee || "출원인",
      children: Array.from(grouped.entries()).map(([category, ps]) => ({
        name: `${category} (${ps.length})`,
        children: ps.map((p) => ({
          name: p.title.length > 28 ? p.title.substring(0, 26) + "…" : p.title,
          patentId: p.patentId,
          title: p.title,
          date: p.registrationDate || p.applicationDate,
          ipc: p.ipc,
          ipcCategory: p.ipcCategory,
          isCurrent: p.isCurrent,
        })),
      })),
    };

    const containerWidth = containerRef.current.clientWidth;
    const totalLeaves = patents.length;
    const height = Math.max(420, totalLeaves * 26 + 80);
    const width = Math.max(containerWidth, 720);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", height);

    const g = svg.append("g").attr("transform", `translate(160, 20)`);

    const hierarchy = d3.hierarchy<TreeNode>(root);
    const treeLayout = d3.tree<TreeNode>().size([height - 40, width - 320]);
    treeLayout(hierarchy);

    g.append("g")
      .attr("fill", "none")
      .attr("stroke", "hsl(var(--border))")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1.2)
      .selectAll("path")
      .data(hierarchy.links())
      .join("path")
      .attr("d", (d: any) => `M${d.source.y},${d.source.x}C${(d.source.y + d.target.y) / 2},${d.source.x} ${(d.source.y + d.target.y) / 2},${d.target.x} ${d.target.y},${d.target.x}`);

    const node = g
      .append("g")
      .selectAll("g")
      .data(hierarchy.descendants())
      .join("g")
      .attr("transform", (d: any) => `translate(${d.y},${d.x})`)
      .style("cursor", (d: any) => (d.data.patentId ? "pointer" : "default"))
      .on("click", (_e, d: any) => {
        if (d.data.patentId && onPatentClick) onPatentClick(d.data.patentId);
      })
      .on("mouseenter", (e, d: any) => {
        if (d.data.patentId) showTooltip(e, d.data.patentId);
      })
      .on("mousemove", (e, d: any) => {
        if (d.data.patentId) showTooltip(e, d.data.patentId);
      })
      .on("mouseleave", () => hideTooltip());

    node
      .append("circle")
      .attr("r", (d: any) => (d.data.isCurrent ? 7 : d.depth === 0 ? 8 : d.depth === 1 ? 6 : 4.5))
      .attr("fill", (d: any) => {
        if (d.data.isCurrent) return "hsl(var(--primary))";
        if (d.depth === 0) return "hsl(var(--foreground))";
        if (d.depth === 1) return "hsl(280 60% 55%)";
        return "hsl(var(--card))";
      })
      .attr("stroke", (d: any) => {
        if (d.data.isCurrent) return "hsl(var(--primary))";
        if (d.depth === 0) return "hsl(var(--foreground))";
        if (d.depth === 1) return "hsl(280 60% 55%)";
        return "hsl(var(--border))";
      })
      .attr("stroke-width", (d: any) => (d.data.isCurrent ? 3 : 1.5));

    node
      .append("text")
      .attr("dy", "0.32em")
      .attr("x", (d: any) => (d.children ? -10 : 10))
      .attr("text-anchor", (d: any) => (d.children ? "end" : "start"))
      .attr("font-size", (d: any) => (d.depth === 0 ? 13 : d.depth === 1 ? 11 : 10))
      .attr("font-weight", (d: any) => (d.data.isCurrent ? 700 : d.depth <= 1 ? 600 : 400))
      .attr("fill", (d: any) => {
        if (d.data.isCurrent) return "hsl(var(--primary))";
        if (d.depth === 0) return "hsl(var(--foreground))";
        if (d.depth === 1) return "hsl(280 60% 40%)";
        return "hsl(var(--foreground) / 0.7)";
      })
      .text((d: any) => d.data.name)
      .style("pointer-events", "none");
  };

  const renderTimeline = () => {
    if (!svgRef.current || !containerRef.current) return;

    const parsed = patents
      .map((p) => {
        const d = p.registrationDate || p.applicationDate || "";
        const t = d ? new Date(d.replace(/\./g, "-")).getTime() : 0;
        return { ...p, ts: t, year: d ? d.substring(0, 4) : "?" };
      })
      .filter((p) => p.ts > 0)
      .sort((a, b) => b.ts - a.ts);

    if (parsed.length === 0) {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      svg.attr("width", "100%").attr("height", 100);
      svg.append("text")
        .attr("x", "50%")
        .attr("y", 50)
        .attr("text-anchor", "middle")
        .attr("fill", "hsl(var(--muted-foreground))")
        .attr("font-size", 12)
        .text("타임라인 표시를 위한 날짜 데이터가 부족합니다.");
      return;
    }

    const containerWidth = containerRef.current.clientWidth;
    const width = Math.max(containerWidth, 720);
    const margin = { top: 30, right: 40, bottom: 40, left: 110 };

    // Category color map
    const categories = Array.from(new Set(parsed.map((p) => p.ipcCategory || "기타")));
    const colorMap = new Map<string, string>();
    const palette = ["hsl(280 60% 55%)", "hsl(200 70% 50%)", "hsl(160 65% 45%)", "hsl(30 80% 55%)", "hsl(340 70% 55%)", "hsl(220 60% 55%)"];
    categories.forEach((c, i) => colorMap.set(c, palette[i % palette.length]));

    const minTs = d3.min(parsed, (d) => d.ts)!;
    const maxTs = d3.max(parsed, (d) => d.ts)!;
    const xScale = d3.scaleTime()
      .domain([new Date(minTs - (maxTs - minTs) * 0.05), new Date(maxTs + (maxTs - minTs) * 0.05)])
      .range([margin.left, width - margin.right]);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (swimlane) {
      // SWIM LANE: group rows by IPC category, each lane has multiple rows
      const grouped = new Map<string, typeof parsed>();
      categories.forEach((c) => grouped.set(c, []));
      parsed.forEach((p) => grouped.get(p.ipcCategory || "기타")!.push(p));

      const laneRowHeight = 24;
      const lanePadding = 18;
      const laneInfos: { category: string; items: typeof parsed; yStart: number; height: number }[] = [];
      let cursorY = margin.top;
      grouped.forEach((items, cat) => {
        if (!items.length) return;
        const h = items.length * laneRowHeight + 12;
        laneInfos.push({ category: cat, items, yStart: cursorY, height: h });
        cursorY += h + lanePadding;
      });
      const height = cursorY + margin.bottom;

      svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", height);

      // X axis
      const xAxis = d3.axisBottom(xScale).ticks(Math.min(8, parsed.length)).tickFormat((d: any) => d3.timeFormat("%Y")(d));
      svg.append("g")
        .attr("transform", `translate(0,${margin.top - 8})`)
        .call(xAxis as any)
        .call((g) => g.select(".domain").attr("stroke", "hsl(var(--border))"))
        .call((g) => g.selectAll(".tick line").attr("stroke", "hsl(var(--border))"))
        .call((g) => g.selectAll(".tick text").attr("fill", "hsl(var(--muted-foreground))").attr("font-size", 10));

      // Vertical year grid
      svg.append("g")
        .selectAll("line")
        .data(xScale.ticks(8))
        .join("line")
        .attr("x1", (d: any) => xScale(d))
        .attr("x2", (d: any) => xScale(d))
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom)
        .attr("stroke", "hsl(var(--border))")
        .attr("stroke-opacity", 0.25)
        .attr("stroke-dasharray", "2,3");

      // Render each lane
      laneInfos.forEach((lane) => {
        const color = colorMap.get(lane.category) || "hsl(var(--muted-foreground))";
        const laneG = svg.append("g");

        // Lane background
        laneG.append("rect")
          .attr("x", margin.left - 8)
          .attr("y", lane.yStart)
          .attr("width", width - margin.right - margin.left + 16)
          .attr("height", lane.height)
          .attr("rx", 8)
          .attr("fill", color)
          .attr("fill-opacity", 0.04)
          .attr("stroke", color)
          .attr("stroke-opacity", 0.18)
          .attr("stroke-width", 1);

        // Lane label (left)
        laneG.append("text")
          .attr("x", margin.left - 16)
          .attr("y", lane.yStart + lane.height / 2)
          .attr("dy", "0.32em")
          .attr("text-anchor", "end")
          .attr("font-size", 10)
          .attr("font-weight", 700)
          .attr("fill", color)
          .text(`${lane.category}`);
        laneG.append("text")
          .attr("x", margin.left - 16)
          .attr("y", lane.yStart + lane.height / 2 + 13)
          .attr("text-anchor", "end")
          .attr("font-size", 9)
          .attr("fill", "hsl(var(--muted-foreground))")
          .text(`${lane.items.length}건`);

        // Items in lane
        const rows = laneG
          .selectAll("g.lane-item")
          .data(lane.items)
          .join("g")
          .attr("class", "lane-item")
          .attr("transform", (_d, i) => `translate(0, ${lane.yStart + 10 + i * laneRowHeight + laneRowHeight / 2})`);

        rows.append("circle")
          .attr("cx", (d) => xScale(new Date(d.ts)))
          .attr("cy", 0)
          .attr("r", (d) => (d.isCurrent ? 6.5 : 4.5))
          .attr("fill", (d) => (d.isCurrent ? "hsl(var(--primary))" : color))
          .attr("stroke", (d) => (d.isCurrent ? "hsl(var(--primary))" : "hsl(var(--background))"))
          .attr("stroke-width", (d) => (d.isCurrent ? 3 : 2))
          .style("cursor", "pointer")
          .on("click", (_e, d) => { if (onPatentClick) onPatentClick(d.patentId); })
          .on("mouseenter", (e, d) => showTooltip(e, d.patentId))
          .on("mousemove", (e, d) => showTooltip(e, d.patentId))
          .on("mouseleave", () => hideTooltip());

        rows.append("text")
          .attr("x", (d) => xScale(new Date(d.ts)) + 9)
          .attr("y", 0)
          .attr("dy", "0.32em")
          .attr("font-size", 10)
          .attr("font-weight", (d) => (d.isCurrent ? 700 : 400))
          .attr("fill", (d) => (d.isCurrent ? "hsl(var(--primary))" : "hsl(var(--foreground) / 0.78)"))
          .text((d) => {
            const t = d.title.length > 30 ? d.title.substring(0, 28) + "…" : d.title;
            return `${t}  ·  ${d.year}`;
          })
          .style("pointer-events", "none");
      });
      return;
    }

    // FLAT TIMELINE (original)
    const rowHeight = 28;
    const height = margin.top + margin.bottom + parsed.length * rowHeight;
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", height);

    const xAxis = d3.axisBottom(xScale).ticks(Math.min(8, parsed.length)).tickFormat((d: any) => d3.timeFormat("%Y")(d));
    svg.append("g")
      .attr("transform", `translate(0,${margin.top - 8})`)
      .call(xAxis as any)
      .call((g) => g.select(".domain").attr("stroke", "hsl(var(--border))"))
      .call((g) => g.selectAll(".tick line").attr("stroke", "hsl(var(--border))"))
      .call((g) => g.selectAll(".tick text").attr("fill", "hsl(var(--muted-foreground))").attr("font-size", 10));

    svg.append("g")
      .selectAll("line")
      .data(xScale.ticks(8))
      .join("line")
      .attr("x1", (d: any) => xScale(d))
      .attr("x2", (d: any) => xScale(d))
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom)
      .attr("stroke", "hsl(var(--border))")
      .attr("stroke-opacity", 0.3)
      .attr("stroke-dasharray", "2,3");

    const rows = svg
      .append("g")
      .selectAll("g.row")
      .data(parsed)
      .join("g")
      .attr("class", "row")
      .attr("transform", (_d, i) => `translate(0, ${margin.top + i * rowHeight + rowHeight / 2})`);

    rows.append("line")
      .attr("x1", margin.left - 60)
      .attr("x2", (d) => xScale(new Date(d.ts)))
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", "hsl(var(--border))")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1);

    rows.append("text")
      .attr("x", margin.left - 70)
      .attr("y", 0)
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .attr("font-size", 9)
      .attr("font-weight", 600)
      .attr("fill", (d) => colorMap.get(d.ipcCategory || "기타") || "hsl(var(--muted-foreground))")
      .text((d) => d.ipcCategory || "기타");

    rows.append("circle")
      .attr("cx", (d) => xScale(new Date(d.ts)))
      .attr("cy", 0)
      .attr("r", (d) => (d.isCurrent ? 7 : 5))
      .attr("fill", (d) => (d.isCurrent ? "hsl(var(--primary))" : colorMap.get(d.ipcCategory || "기타") || "hsl(var(--muted-foreground))"))
      .attr("stroke", (d) => (d.isCurrent ? "hsl(var(--primary))" : "hsl(var(--background))"))
      .attr("stroke-width", (d) => (d.isCurrent ? 3 : 2))
      .style("cursor", "pointer")
      .on("click", (_e, d) => { if (onPatentClick) onPatentClick(d.patentId); })
      .on("mouseenter", (e, d) => showTooltip(e, d.patentId))
      .on("mousemove", (e, d) => showTooltip(e, d.patentId))
      .on("mouseleave", () => hideTooltip());

    rows.append("text")
      .attr("x", (d) => xScale(new Date(d.ts)) + 10)
      .attr("y", 0)
      .attr("dy", "0.32em")
      .attr("font-size", 10)
      .attr("font-weight", (d) => (d.isCurrent ? 700 : 400))
      .attr("fill", (d) => (d.isCurrent ? "hsl(var(--primary))" : "hsl(var(--foreground) / 0.75)"))
      .text((d) => {
        const t = d.title.length > 32 ? d.title.substring(0, 30) + "…" : d.title;
        return `${t}  ·  ${d.year}`;
      })
      .style("pointer-events", "none");
  };

  if (!patentData?.assignee) return null;
  if (!loading && !patents.length && !error) return null;

  // Stats summary
  const totalPatents = patents.length;
  const categoryStats = patents.reduce((acc, p) => {
    const c = p.ipcCategory || "기타";
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topCategory = Object.entries(categoryStats).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="relative rounded-2xl overflow-hidden animate-slide-in bg-card border border-border/30" style={{ boxShadow: '0 1px 3px hsl(var(--foreground) / 0.03)' }}>
      <div className="h-0.5" style={{ background: 'linear-gradient(90deg, hsl(200 70% 50% / 0.5), hsl(200 50% 50% / 0.15), transparent)' }} />

      <div className="px-4 py-3 sm:px-5 sm:py-4 md:px-6 md:py-4 border-b border-border/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'hsl(200 70% 50% / 0.08)', color: 'hsl(200 70% 45%)' }}>
            <Network className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm sm:text-base text-foreground tracking-tight">특허 패밀리 트리</h3>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium truncate">
              <span className="font-semibold">{patentData.assignee}</span>의 관련 특허 계보 {totalPatents > 0 && `· 총 ${totalPatents}건`}
              {topCategory && totalPatents > 0 && ` · 주력분야: ${topCategory[0]} (${topCategory[1]}건)`}
            </p>
          </div>
          {/* Swim lane toggle */}
          {patents.length > 0 && (
            <button
              onClick={() => setSwimlane((s) => !s)}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors shrink-0 ${swimlane ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/40 border-border/30 text-muted-foreground hover:text-foreground"}`}
            >
              <Layers className="w-3 h-3" /> Swim Lane {swimlane ? "ON" : "OFF"}
            </button>
          )}
        </div>
      </div>

      <div className="p-3 sm:p-4 md:p-5">
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'hsl(200 70% 50%)' }} />
            <p className="text-xs sm:text-sm text-muted-foreground">동일 출원인의 특허를 조회 중...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/40 border border-border/30">
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        {patents.length > 0 && !loading && (
          <>
            <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground mb-3">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> 현재 분석 특허</div>
              <span>· 색상 = IPC 기술분야 · 가로축 = 등록/출원 연도</span>
            </div>
            <div ref={containerRef} className="relative overflow-x-auto rounded-xl bg-muted/20 border border-border/20 p-2">
              <svg ref={svgRef} />
              {tooltip && (
                <div
                  className="absolute z-10 pointer-events-none p-2.5 rounded-lg bg-card border border-border shadow-lg max-w-[280px]"
                  style={{
                    left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth || 800) - 290),
                    top: tooltip.y + 12,
                  }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
                    {tooltip.patent.isCurrent ? "현재 분석 특허" : tooltip.patent.ipcCategory || "관련 특허"}
                  </div>
                  <div className="text-[12px] font-bold text-foreground mb-1.5 leading-snug">{tooltip.patent.title}</div>
                  <div className="space-y-0.5 text-[10px] text-muted-foreground">
                    <div><span className="font-semibold text-foreground/70">번호:</span> {tooltip.patent.patentId}</div>
                    {tooltip.patent.ipc && <div><span className="font-semibold text-foreground/70">IPC:</span> {tooltip.patent.ipc}</div>}
                    {tooltip.patent.registrationDate && <div><span className="font-semibold text-foreground/70">등록:</span> {tooltip.patent.registrationDate}</div>}
                    {tooltip.patent.applicationDate && <div><span className="font-semibold text-foreground/70">출원:</span> {tooltip.patent.applicationDate}</div>}
                  </div>
                  <div className="text-[9px] text-primary mt-1.5 font-semibold">클릭하여 분석 →</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
