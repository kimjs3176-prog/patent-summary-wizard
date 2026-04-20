import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Network, Loader2, AlertCircle } from "lucide-react";
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
  isCurrent?: boolean;
  children?: TreeNode[];
}

export function PatentFamilyTree({ patentData, onPatentClick }: PatentFamilyTreeProps) {
  const [patents, setPatents] = useState<FamilyPatent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // Build tree: root = assignee → children = IPC categories → leaves = patents
  useEffect(() => {
    if (!patents.length || !svgRef.current || !containerRef.current) return;

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

    // Links
    g.append("g")
      .attr("fill", "none")
      .attr("stroke", "hsl(var(--border))")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1.2)
      .selectAll("path")
      .data(hierarchy.links())
      .join("path")
      .attr("d", (d: any) => {
        return `M${d.source.y},${d.source.x}C${(d.source.y + d.target.y) / 2},${d.source.x} ${(d.source.y + d.target.y) / 2},${d.target.x} ${d.target.y},${d.target.x}`;
      });

    // Nodes
    const node = g
      .append("g")
      .selectAll("g")
      .data(hierarchy.descendants())
      .join("g")
      .attr("transform", (d: any) => `translate(${d.y},${d.x})`)
      .style("cursor", (d: any) => (d.data.patentId ? "pointer" : "default"))
      .on("click", (_e, d: any) => {
        if (d.data.patentId && onPatentClick) onPatentClick(d.data.patentId);
      });

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

    // Pulsing ring on current patent
    node
      .filter((d: any) => d.data.isCurrent)
      .append("circle")
      .attr("r", 7)
      .attr("fill", "none")
      .attr("stroke", "hsl(var(--primary))")
      .attr("stroke-width", 2)
      .attr("opacity", 0.5)
      .append("animate")
      .attr("attributeName", "r")
      .attr("values", "7;14;7")
      .attr("dur", "2s")
      .attr("repeatCount", "indefinite");

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
      .append("title")
      .text((d: any) => (d.data.title ? `${d.data.title}\n${d.data.patentId}${d.data.date ? "\n" + d.data.date : ""}` : d.data.name));
  }, [patents, patentData.assignee, onPatentClick]);

  if (!patentData?.assignee) return null;
  if (!loading && !patents.length && !error) return null;

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
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">
              {patentData.assignee}의 관련 특허 계보 {patents.length > 0 && `(${patents.length}건)`}
            </p>
          </div>
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
            <div className="flex items-center gap-3 mb-3 flex-wrap text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-foreground" /> 출원인</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'hsl(280 60% 55%)' }} /> 기술분야 (IPC)</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> 현재 분석 특허</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-card border border-border" /> 관련 특허 (클릭하여 분석)</div>
            </div>
            <div ref={containerRef} className="overflow-x-auto rounded-xl bg-muted/20 border border-border/20 p-2">
              <svg ref={svgRef} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
