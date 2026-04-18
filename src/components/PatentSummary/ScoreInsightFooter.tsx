import { useEffect, useMemo, useState } from "react";
import { Star, Scale, BarChart2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CommercializationDetails } from "./TechnologyCommercializationScore";
import type { PatentData } from "./types";
import type { ScoreConfig } from "@/components/admin/ScoreTrlSettings";

interface Props {
  score: number;
  details: CommercializationDetails;
  patentData?: PatentData | null;
  scoreConfig: ScoreConfig;
}

function computeReliability(patentData?: PatentData | null) {
  if (!patentData) return { stars: 0, factors: [], summary: "데이터 부족" };
  const claimsCount = patentData.claims?.length || 0;
  const abstractLen = (patentData.abstract || "").length;
  const descLen = (patentData.description || "").length;
  const ipcCount = patentData.classifications?.length || 0;

  // 0-1 normalized signals
  const claimsSig = Math.min(claimsCount / 15, 1); // 15+ claims → full
  const abstractSig = Math.min(abstractLen / 600, 1); // 600+ chars → full
  const descSig = Math.min(descLen / 5000, 1); // 5000+ chars → full
  const ipcSig = Math.min(ipcCount / 5, 1);

  const score01 = (claimsSig * 0.35 + abstractSig * 0.2 + descSig * 0.3 + ipcSig * 0.15);
  const stars = Math.max(1, Math.round(score01 * 5));

  const factors = [
    { label: "청구항", value: `${claimsCount}건`, ok: claimsSig >= 0.4 },
    { label: "요약", value: `${abstractLen}자`, ok: abstractSig >= 0.4 },
    { label: "상세설명", value: descLen > 0 ? `${(descLen / 1000).toFixed(1)}k자` : "없음", ok: descSig >= 0.3 },
    { label: "IPC", value: `${ipcCount}개`, ok: ipcSig >= 0.4 },
  ];

  const summary =
    stars >= 4 ? "AI 분석에 충분한 데이터" : stars >= 3 ? "분석 데이터 양호" : stars >= 2 ? "데이터 다소 부족" : "데이터 매우 부족";

  return { stars, factors, summary };
}

export function ScoreInsightFooter({ score, details, patentData, scoreConfig }: Props) {
  const [benchmark, setBenchmark] = useState<{ avg: number; count: number; ipc: string } | null>(null);
  const [bmLoading, setBmLoading] = useState(false);

  const ipcSection = useMemo(() => {
    const c = patentData?.classifications?.[0]?.trim();
    return c ? c.slice(0, 4) : null;
  }, [patentData]);

  // Fetch benchmark: avg total_score for patents whose first classification starts with same IPC4
  useEffect(() => {
    if (!ipcSection || !patentData?.patentNumber) return;
    let cancelled = false;
    (async () => {
      setBmLoading(true);
      try {
        // Pull recent scores joined with cached patent data filtered by IPC prefix.
        // Use patent_data_cache to filter by classification, then average from patent_score_cache.
        const { data: dataRows } = await supabase
          .from("patent_data_cache")
          .select("patent_number, patent_data")
          .limit(500);
        if (!dataRows) return;
        const matching = dataRows
          .filter((r) => {
            const pd = r.patent_data as { classifications?: string[] } | null;
            const first = pd?.classifications?.[0]?.trim().slice(0, 4);
            return first === ipcSection && r.patent_number !== patentData.patentNumber;
          })
          .map((r) => r.patent_number);
        if (matching.length === 0) {
          if (!cancelled) setBenchmark({ avg: 0, count: 0, ipc: ipcSection });
          return;
        }
        const { data: scoreRows } = await supabase
          .from("patent_score_cache")
          .select("patent_number, total_score")
          .in("patent_number", matching);
        if (!scoreRows || scoreRows.length === 0) {
          if (!cancelled) setBenchmark({ avg: 0, count: 0, ipc: ipcSection });
          return;
        }
        const avg = scoreRows.reduce((s, r) => s + (r.total_score || 0), 0) / scoreRows.length;
        if (!cancelled) setBenchmark({ avg: Math.round(avg), count: scoreRows.length, ipc: ipcSection });
      } catch (e) {
        console.error("benchmark fetch failed", e);
      } finally {
        if (!cancelled) setBmLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ipcSection, patentData?.patentNumber]);

  const reliability = useMemo(() => computeReliability(patentData), [patentData]);

  const weights = scoreConfig.weights;
  const weightTotal = weights.technology + weights.market + weights.business || 100;
  const weightSegments = [
    { key: "tech", label: scoreConfig.subLabels.technology, w: weights.technology, score: details.technologyScore, color: "hsl(217 91% 60%)" },
    { key: "market", label: scoreConfig.subLabels.market, w: weights.market, score: details.marketScore, color: "hsl(160 84% 39%)" },
    { key: "biz", label: scoreConfig.subLabels.business, w: weights.business, score: details.businessScore, color: "hsl(25 90% 55%)" },
  ];

  const benchmarkDelta = benchmark && benchmark.count > 0 ? score - benchmark.avg : null;

  return (
    <div className="px-4 sm:px-6 pb-4">
      <div className="rounded-xl border border-border/40 bg-muted/20 p-3.5 sm:p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Info className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-[11px] font-bold text-foreground/70 tracking-tight">왜 이 점수인가?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. Weight contribution stack bar */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-1 mb-1.5">
              <Scale className="w-3 h-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground font-semibold">평가 가중치</p>
            </div>
            <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted/60">
              {weightSegments.map((s) => (
                <div
                  key={s.key}
                  title={`${s.label} ${Math.round((s.w / weightTotal) * 100)}%`}
                  className="h-full transition-all"
                  style={{
                    width: `${(s.w / weightTotal) * 100}%`,
                    background: s.color,
                  }}
                />
              ))}
            </div>
            <div className="mt-2 space-y-1">
              {weightSegments.map((s) => (
                <div key={s.key} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-sm" style={{ background: s.color }} />
                    <span className="text-muted-foreground">{s.label}</span>
                  </span>
                  <span className="tabular-nums text-foreground/70">
                    {Math.round((s.w / weightTotal) * 100)}% · {s.score}점
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. IPC benchmark */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-1 mb-1.5">
              <BarChart2 className="w-3 h-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground font-semibold">동일 IPC 평균 대비</p>
            </div>
            {!ipcSection ? (
              <p className="text-[11px] text-muted-foreground/70 mt-3">IPC 정보 없음</p>
            ) : bmLoading ? (
              <p className="text-[11px] text-muted-foreground/70 mt-3">분석 중…</p>
            ) : !benchmark || benchmark.count === 0 ? (
              <p className="text-[11px] text-muted-foreground/70 mt-3">
                <span className="font-mono text-foreground/60">{ipcSection}</span> 비교 데이터 부족
              </p>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-xl font-extrabold tabular-nums"
                    style={{
                      color:
                        benchmarkDelta! > 0
                          ? "hsl(160 84% 35%)"
                          : benchmarkDelta! < 0
                          ? "hsl(0 70% 50%)"
                          : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {benchmarkDelta! > 0 ? "+" : ""}
                    {benchmarkDelta}
                  </span>
                  <span className="text-[10px] text-muted-foreground">점</span>
                </div>
                <div className="relative h-1.5 mt-2 rounded-full bg-muted/60 overflow-hidden">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/20" />
                  <div
                    className="absolute inset-y-0 rounded-full"
                    style={{
                      left: benchmarkDelta! >= 0 ? "50%" : `${50 + (benchmarkDelta! / 50) * 50}%`,
                      width: `${Math.min(Math.abs(benchmarkDelta!) / 50, 0.5) * 100}%`,
                      background:
                        benchmarkDelta! >= 0 ? "hsl(160 84% 39% / 0.7)" : "hsl(0 70% 50% / 0.7)",
                    }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  <span className="font-mono">{benchmark.ipc}</span> 평균 {benchmark.avg}점 ({benchmark.count}건)
                </p>
              </>
            )}
          </div>

          {/* 3. Reliability stars */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-1 mb-1.5">
              <Star className="w-3 h-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground font-semibold">분석 신뢰도</p>
            </div>
            <div className="flex items-center gap-0.5 mb-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className="w-3.5 h-3.5"
                  fill={i <= reliability.stars ? "hsl(45 93% 55%)" : "transparent"}
                  stroke={i <= reliability.stars ? "hsl(45 93% 50%)" : "hsl(var(--muted-foreground) / 0.4)"}
                  strokeWidth={1.5}
                />
              ))}
              <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">{reliability.stars}/5</span>
            </div>
            <p className="text-[10px] text-foreground/65 mb-1.5">{reliability.summary}</p>
            <div className="flex flex-wrap gap-1">
              {reliability.factors.map((f) => (
                <span
                  key={f.label}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                    f.ok ? "bg-emerald-500/10 text-emerald-700" : "bg-muted/60 text-muted-foreground"
                  }`}
                  title={f.ok ? "충분" : "부족"}
                >
                  {f.label} {f.value}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
