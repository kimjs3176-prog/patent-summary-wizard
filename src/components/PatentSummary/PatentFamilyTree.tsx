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
  variant?: "default" | "toss";
}

interface TooltipState {
  x: number;
  y: number;
  patent: FamilyPatent;
}

export function PatentFamilyTree({ patentData, onPatentClick, variant = "default" }: PatentFamilyTreeProps) {
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
          // 현재 특허를 최상단으로 정렬 (시각적 차별화)
          const list: FamilyPatent[] = json.patents || [];
          list.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
          setPatents(list);
          if (!list.length) setError("동일 출원인의 다른 특허를 찾지 못했습니다.");
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
  }, [patentData?.assignee, patentData?.patentNumber, patentData?.displayNumber]);

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
    const isMobile = containerWidth < 640;
    const width = Math.max(containerWidth, isMobile ? containerWidth : 760);
    const margin = { top: 36, right: 30, bottom: 44, left: isMobile ? 78 : 116 };

    // Category color map
    const categories = Array.from(new Set(parsed.map((p) => p.ipcCategory || "기타")));
    const colorMap = new Map<string, string>();
    const palette = ["hsl(280 60% 55%)", "hsl(200 70% 50%)", "hsl(160 65% 45%)", "hsl(30 80% 55%)", "hsl(340 70% 55%)", "hsl(220 60% 55%)"];
    categories.forEach((c, i) => colorMap.set(c, palette[i % palette.length]));

    const minTs = d3.min(parsed, (d) => d.ts)!;
    const maxTs = d3.max(parsed, (d) => d.ts)!;
    const span = Math.max(maxTs - minTs, 1000 * 60 * 60 * 24 * 365); // ≥1 year span
    const xScale = d3.scaleTime()
      .domain([new Date(minTs - span * 0.06), new Date(maxTs + span * 0.06)])
      .range([margin.left, width - margin.right]);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Reusable defs: glow filter for current patent
    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "currentGlow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
    const merge = filter.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    const truncForWidth = (text: string, availPx: number) => {
      // ~6.2px per char at font-size 10
      const maxChars = Math.max(8, Math.floor(availPx / 6.2));
      return text.length > maxChars ? text.substring(0, maxChars - 1) + "…" : text;
    };

    if (swimlane) {
      // SWIM LANE: group rows by IPC category, each lane has multiple rows
      const grouped = new Map<string, typeof parsed>();
      categories.forEach((c) => grouped.set(c, []));
      parsed.forEach((p) => grouped.get(p.ipcCategory || "기타")!.push(p));

      const laneRowHeight = 28;
      const lanePadding = 20;
      const laneInfos: { category: string; items: typeof parsed; yStart: number; height: number }[] = [];
      let cursorY = margin.top;
      grouped.forEach((items, cat) => {
        if (!items.length) return;
        const h = items.length * laneRowHeight + 14;
        laneInfos.push({ category: cat, items, yStart: cursorY, height: h });
        cursorY += h + lanePadding;
      });
      const height = cursorY + margin.bottom;

      svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", height);

      // X axis
      const xAxisTop = d3.axisTop(xScale).ticks(Math.min(isMobile ? 5 : 8, Math.max(3, parsed.length))).tickFormat((d: any) => d3.timeFormat("%Y")(d));
      svg.append("g")
        .attr("transform", `translate(0,${margin.top - 6})`)
        .call(xAxisTop as any)
        .call((g) => g.select(".domain").remove())
        .call((g) => g.selectAll(".tick line").attr("stroke", "hsl(var(--border))").attr("stroke-opacity", 0.5))
        .call((g) => g.selectAll(".tick text").attr("fill", "hsl(var(--muted-foreground))").attr("font-size", 10).attr("font-weight", 600));

      // Vertical year grid
      svg.append("g")
        .selectAll("line")
        .data(xScale.ticks(isMobile ? 5 : 8))
        .join("line")
        .attr("x1", (d: any) => xScale(d))
        .attr("x2", (d: any) => xScale(d))
        .attr("y1", margin.top - 2)
        .attr("y2", height - margin.bottom + 4)
        .attr("stroke", "hsl(var(--border))")
        .attr("stroke-opacity", 0.2)
        .attr("stroke-dasharray", "2,3");

      // Render each lane
      laneInfos.forEach((lane) => {
        const color = colorMap.get(lane.category) || "hsl(var(--muted-foreground))";
        const laneG = svg.append("g");

        // Lane background with rounded corners
        laneG.append("rect")
          .attr("x", margin.left - 12)
          .attr("y", lane.yStart)
          .attr("width", width - margin.right - margin.left + 20)
          .attr("height", lane.height)
          .attr("rx", 10)
          .attr("fill", color)
          .attr("fill-opacity", 0.05)
          .attr("stroke", color)
          .attr("stroke-opacity", 0.22)
          .attr("stroke-width", 1);

        // Left accent bar
        laneG.append("rect")
          .attr("x", margin.left - 12)
          .attr("y", lane.yStart)
          .attr("width", 3)
          .attr("height", lane.height)
          .attr("rx", 1.5)
          .attr("fill", color);

        // Lane label (left)
        const labelX = margin.left - 18;
        laneG.append("text")
          .attr("x", labelX)
          .attr("y", lane.yStart + lane.height / 2 - 6)
          .attr("dy", "0.32em")
          .attr("text-anchor", "end")
          .attr("font-size", 11)
          .attr("font-weight", 700)
          .attr("fill", color)
          .text(truncForWidth(lane.category, margin.left - 28));
        laneG.append("text")
          .attr("x", labelX)
          .attr("y", lane.yStart + lane.height / 2 + 9)
          .attr("text-anchor", "end")
          .attr("font-size", 9)
          .attr("font-weight", 600)
          .attr("fill", "hsl(var(--muted-foreground))")
          .text(`${lane.items.length}건`);

        // Items in lane
        const rows = laneG
          .selectAll("g.lane-item")
          .data(lane.items)
          .join("g")
          .attr("class", "lane-item")
          .attr("transform", (_d, i) => `translate(0, ${lane.yStart + 12 + i * laneRowHeight + laneRowHeight / 2})`);

        // Halo for current patent
        rows.filter((d) => d.isCurrent).append("circle")
          .attr("cx", (d) => xScale(new Date(d.ts)))
          .attr("cy", 0)
          .attr("r", 11)
          .attr("fill", "hsl(var(--primary))")
          .attr("fill-opacity", 0.15)
          .style("pointer-events", "none");

        rows.append("circle")
          .attr("cx", (d) => xScale(new Date(d.ts)))
          .attr("cy", 0)
          .attr("r", (d) => (d.isCurrent ? 7 : 5))
          .attr("fill", (d) => (d.isCurrent ? "hsl(var(--primary))" : color))
          .attr("stroke", "hsl(var(--background))")
          .attr("stroke-width", 2)
          .attr("filter", (d) => (d.isCurrent ? "url(#currentGlow)" : null))
          .style("cursor", "pointer")
          .on("click", (_e, d) => { if (onPatentClick) onPatentClick(d.patentId); })
          .on("mouseenter", (e, d) => showTooltip(e, d.patentId))
          .on("mousemove", (e, d) => showTooltip(e, d.patentId))
          .on("mouseleave", () => hideTooltip());

        // Smart label placement: flip to left side if right side is too narrow
        rows.append("text")
          .attr("x", (d) => {
            const cx = xScale(new Date(d.ts));
            const rightAvail = width - margin.right - cx - 12;
            return rightAvail < 80 ? cx - 11 : cx + 11;
          })
          .attr("y", 0)
          .attr("dy", "0.32em")
          .attr("text-anchor", (d) => {
            const cx = xScale(new Date(d.ts));
            return (width - margin.right - cx - 12) < 80 ? "end" : "start";
          })
          .attr("font-size", 10.5)
          .attr("font-weight", (d) => (d.isCurrent ? 700 : 500))
          .attr("fill", (d) => (d.isCurrent ? "hsl(var(--primary))" : "hsl(var(--foreground) / 0.82)"))
          .text((d) => {
            const cx = xScale(new Date(d.ts));
            const rightAvail = width - margin.right - cx - 16;
            const leftAvail = cx - margin.left - 8;
            const avail = Math.max(rightAvail, leftAvail);
            const t = truncForWidth(d.title, Math.max(60, avail - 30));
            return `${t}  ·  ${d.year}`;
          })
          .style("pointer-events", "none");
      });
      return;
    }

    // FLAT TIMELINE
    const rowHeight = 32;
    const height = margin.top + margin.bottom + parsed.length * rowHeight;
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", height);

    // Alternating row stripes for readability
    svg.append("g").selectAll("rect.row-bg")
      .data(parsed)
      .join("rect")
      .attr("class", "row-bg")
      .attr("x", margin.left - 80)
      .attr("y", (_d, i) => margin.top + i * rowHeight)
      .attr("width", width - margin.right - margin.left + 80)
      .attr("height", rowHeight)
      .attr("fill", (_d, i) => i % 2 === 0 ? "hsl(var(--muted) / 0.25)" : "transparent");

    const xAxisTop = d3.axisTop(xScale).ticks(Math.min(isMobile ? 5 : 8, Math.max(3, parsed.length))).tickFormat((d: any) => d3.timeFormat("%Y")(d));
    svg.append("g")
      .attr("transform", `translate(0,${margin.top - 6})`)
      .call(xAxisTop as any)
      .call((g) => g.select(".domain").remove())
      .call((g) => g.selectAll(".tick line").attr("stroke", "hsl(var(--border))").attr("stroke-opacity", 0.5))
      .call((g) => g.selectAll(".tick text").attr("fill", "hsl(var(--muted-foreground))").attr("font-size", 10).attr("font-weight", 600));

    svg.append("g")
      .selectAll("line")
      .data(xScale.ticks(isMobile ? 5 : 8))
      .join("line")
      .attr("x1", (d: any) => xScale(d))
      .attr("x2", (d: any) => xScale(d))
      .attr("y1", margin.top - 2)
      .attr("y2", height - margin.bottom + 4)
      .attr("stroke", "hsl(var(--border))")
      .attr("stroke-opacity", 0.2)
      .attr("stroke-dasharray", "2,3");

    const rows = svg
      .append("g")
      .selectAll("g.row")
      .data(parsed)
      .join("g")
      .attr("class", "row")
      .attr("transform", (_d, i) => `translate(0, ${margin.top + i * rowHeight + rowHeight / 2})`);

    rows.append("line")
      .attr("x1", margin.left - 4)
      .attr("x2", (d) => xScale(new Date(d.ts)))
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", (d) => colorMap.get(d.ipcCategory || "기타") || "hsl(var(--border))")
      .attr("stroke-opacity", 0.35)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // Category chip on the left
    const chipPaddingX = 6;
    const chipH = 18;
    const chips = rows.append("g").attr("transform", `translate(${margin.left - 10}, 0)`);
    chips.append("rect")
      .attr("x", (d) => -(getCategoryChipWidth(d.ipcCategory || "기타", isMobile) + chipPaddingX * 2))
      .attr("y", -chipH / 2)
      .attr("width", (d) => getCategoryChipWidth(d.ipcCategory || "기타", isMobile) + chipPaddingX * 2)
      .attr("height", chipH)
      .attr("rx", 9)
      .attr("fill", (d) => colorMap.get(d.ipcCategory || "기타") || "hsl(var(--muted-foreground))")
      .attr("fill-opacity", 0.12)
      .attr("stroke", (d) => colorMap.get(d.ipcCategory || "기타") || "hsl(var(--muted-foreground))")
      .attr("stroke-opacity", 0.35);
    chips.append("text")
      .attr("x", -chipPaddingX)
      .attr("y", 0)
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .attr("font-size", 9.5)
      .attr("font-weight", 700)
      .attr("fill", (d) => colorMap.get(d.ipcCategory || "기타") || "hsl(var(--muted-foreground))")
      .text((d) => truncateCategoryLabel(d.ipcCategory || "기타", isMobile));

    // Halo for current patent
    rows.filter((d) => d.isCurrent).append("circle")
      .attr("cx", (d) => xScale(new Date(d.ts)))
      .attr("cy", 0)
      .attr("r", 12)
      .attr("fill", "hsl(var(--primary))")
      .attr("fill-opacity", 0.15)
      .style("pointer-events", "none");

    rows.append("circle")
      .attr("cx", (d) => xScale(new Date(d.ts)))
      .attr("cy", 0)
      .attr("r", (d) => (d.isCurrent ? 7.5 : 5.5))
      .attr("fill", (d) => (d.isCurrent ? "hsl(var(--primary))" : colorMap.get(d.ipcCategory || "기타") || "hsl(var(--muted-foreground))"))
      .attr("stroke", "hsl(var(--background))")
      .attr("stroke-width", 2)
      .attr("filter", (d) => (d.isCurrent ? "url(#currentGlow)" : null))
      .style("cursor", "pointer")
      .on("click", (_e, d) => { if (onPatentClick) onPatentClick(d.patentId); })
      .on("mouseenter", (e, d) => showTooltip(e, d.patentId))
      .on("mousemove", (e, d) => showTooltip(e, d.patentId))
      .on("mouseleave", () => hideTooltip());

    // Smart label placement: flip side based on available space
    rows.append("text")
      .attr("x", (d) => {
        const cx = xScale(new Date(d.ts));
        const rightAvail = width - margin.right - cx - 12;
        return rightAvail < 90 ? cx - 12 : cx + 12;
      })
      .attr("y", 0)
      .attr("dy", "0.32em")
      .attr("text-anchor", (d) => {
        const cx = xScale(new Date(d.ts));
        return (width - margin.right - cx - 12) < 90 ? "end" : "start";
      })
      .attr("font-size", 11)
      .attr("font-weight", (d) => (d.isCurrent ? 700 : 500))
      .attr("fill", (d) => (d.isCurrent ? "hsl(var(--primary))" : "hsl(var(--foreground) / 0.82)"))
      .text((d) => {
        const cx = xScale(new Date(d.ts));
        const rightAvail = width - margin.right - cx - 18;
        const leftAvail = cx - margin.left - 8;
        const avail = Math.max(rightAvail, leftAvail);
        const t = truncForWidth(d.title, Math.max(70, avail - 36));
        return `${t}  ·  ${d.year}`;
      })
      .style("pointer-events", "none");
  };

  // Helpers for category chip sizing
  function getCategoryChipWidth(label: string, isMobile: boolean): number {
    const truncated = truncateCategoryLabel(label, isMobile);
    return Math.min(isMobile ? 60 : 90, truncated.length * 6.5);
  }
  function truncateCategoryLabel(label: string, isMobile: boolean): string {
    const max = isMobile ? 5 : 9;
    return label.length > max ? label.substring(0, max - 1) + "…" : label;
  }

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
  const isToss = variant === "toss";

  return (
    <div className={isToss ? "" : "relative rounded-2xl overflow-hidden animate-slide-in bg-card border border-border/30"} style={isToss ? undefined : { boxShadow: '0 1px 3px hsl(var(--foreground) / 0.03)' }}>
      {!isToss && (
        <>
          <div className="h-0.5" style={{ background: 'linear-gradient(90deg, hsl(200 70% 50% / 0.5), hsl(200 50% 50% / 0.15), transparent)' }} />
          <div className="px-4 py-3 sm:px-5 sm:py-4 md:px-6 md:py-4 border-b border-border/20">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'hsl(200 70% 50% / 0.08)', color: 'hsl(200 70% 45%)' }}>
                <Network className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm sm:text-base text-foreground tracking-tight">특허 패밀리 트리</h3>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium truncate">
                  <span className="font-semibold">{patentData.assignee}</span>의 키워드 연관 특허 {totalPatents > 0 && `· 총 ${totalPatents}건`}
                  {topCategory && totalPatents > 0 && ` · 주력분야: ${topCategory[0]} (${topCategory[1]}건)`}
                </p>
              </div>
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
        </>
      )}

      <div className={isToss ? "" : "p-3 sm:p-4 md:p-5"}>
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
            {/* Legend with category chips */}
            <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground mb-3">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="font-semibold text-primary">현재 분석 특허</span>
              </div>
              {Object.entries(categoryStats).slice(0, 6).map(([cat, count]) => {
                const palette = ["hsl(280 60% 55%)", "hsl(200 70% 50%)", "hsl(160 65% 45%)", "hsl(30 80% 55%)", "hsl(340 70% 55%)", "hsl(220 60% 55%)"];
                const idx = Object.keys(categoryStats).indexOf(cat);
                const color = palette[idx % palette.length];
                return (
                  <div key={cat} className="flex items-center gap-1.5 px-2 py-1 rounded-md border" style={{ background: `${color.replace(')', ' / 0.08)')}`, borderColor: `${color.replace(')', ' / 0.25)')}` }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="font-semibold" style={{ color }}>{cat}</span>
                    <span className="text-muted-foreground/70">{count}</span>
                  </div>
                );
              })}
              <span className="text-muted-foreground/60">· 가로축: 등록/출원 연도</span>
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
