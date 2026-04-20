import { useEffect, useMemo, useState } from "react";
import { GitCompare, Loader2, CheckCircle2, MinusCircle, AlertCircle, Sparkles } from "lucide-react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip as RTooltip } from "recharts";
import { PatentData } from "./types";

type Strength = "strong" | "medium" | "weak";

interface ComparisonRow {
  axis: string;
  current: string;
  currentStrength: Strength;
  competitors: string[];
  competitorStrengths: Strength[];
  advantage: "current" | "competitor" | "neutral";
}

interface CompetitorMeta {
  patentId: string;
  title: string;
  assignee?: string;
  similarityScore: number;
}

interface ComparisonResult {
  rows: ComparisonRow[];
  summary: string;
  competitors: CompetitorMeta[];
}

interface AiRecommendedPatent {
  patentId: string;
  title: string;
  assignee?: string;
  publicationDate?: string;
  snippet?: string;
  thumbnail?: string;
  relevanceGroup: number;
}

interface CompetitorComparisonTableProps {
  patentData: PatentData;
  onPatentClick?: (patentNumber: string) => void;
}

// Strength → dot count
function StrengthDots({ s }: { s: Strength }) {
  const count = s === "strong" ? 3 : s === "medium" ? 2 : 1;
  const color = s === "strong" ? "hsl(280 60% 55%)" : s === "medium" ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground) / 0.4)";
  return (
    <span className="inline-flex items-center gap-0.5 ml-1.5 align-middle">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 rounded-full inline-block"
          style={{ background: i < count ? color : "hsl(var(--border))" }}
        />
      ))}
    </span>
  );
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.substring(0, n - 1) + "…" : s;
}

export function CompetitorComparisonTable({ patentData, onPatentClick }: CompetitorComparisonTableProps) {
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strengthScore = (s: Strength) => (s === "strong" ? 3 : s === "medium" ? 2 : 1);

  const radarData = useMemo(() => {
    if (!result?.rows?.length) return [];
    return result.rows.map((row) => {
      const compScores = row.competitorStrengths.map(strengthScore);
      const compAvg = compScores.length ? compScores.reduce((a, b) => a + b, 0) / compScores.length : 0;
      return {
        axis: row.axis,
        current: strengthScore(row.currentStrength),
        competitorAvg: Number(compAvg.toFixed(2)),
      };
    });
  }, [result]);

  useEffect(() => {
    const run = async () => {
      if (!patentData?.title && !patentData?.titleKo) return;
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        // Step 1: Get top similar patents via existing recommend function
        const recRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recommend-similar-patents`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              title: patentData.titleKo || patentData.title || "",
              abstract: patentData.abstract || "",
              classifications: patentData.classifications || [],
              patentNumber: patentData.patentNumber || patentData.displayNumber || "",
            }),
          }
        );
        const recJson = await recRes.json();
        if (!recJson.success || !recJson.patents?.length) {
          setError("비교할 유사 특허를 찾지 못했습니다.");
          setLoading(false);
          return;
        }

        // Filter out the current patent (deduplicate)
        const currentNum = (patentData.patentNumber || patentData.displayNumber || patentData.applicationNumber || "").replace(/[^0-9]/g, "");
        const filteredCompetitors = (recJson.patents as AiRecommendedPatent[]).filter((p) => {
          const pn = (p.patentId || "").replace(/[^0-9]/g, "");
          if (!pn || !currentNum) return true;
          return !(pn.includes(currentNum) || currentNum.includes(pn));
        });

        const top3 = filteredCompetitors.slice(0, 3);
        if (top3.length === 0) {
          setError("동일 특허가 아닌 유사 특허를 찾지 못했습니다.");
          setLoading(false);
          return;
        }

        // Step 2: Generate comparison table
        const cmpRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compare-patents`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              currentPatent: patentData,
              competitorPatents: top3,
            }),
          }
        );
        const cmpJson = await cmpRes.json();
        if (cmpJson.success) {
          setResult({
            rows: cmpJson.rows || [],
            summary: cmpJson.summary || "",
            competitors: cmpJson.competitors || [],
          });
        } else {
          setError(cmpJson.error || "비교 분석 실패");
        }
      } catch (e) {
        console.error(e);
        setError("비교 분석 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [patentData?.patentNumber, patentData?.displayNumber]);

  if (!loading && !result && !error) return null;

  const currentTitle = truncate(patentData.titleKo || patentData.title || "분석 대상", 24);
  const competitorCount = result?.competitors.length || 0;
  // Build dynamic column widths
  const colCount = competitorCount + 1; // +1 for axis column

  return (
    <div className="relative rounded-2xl overflow-hidden animate-slide-in bg-card border border-border/30" style={{ boxShadow: '0 1px 3px hsl(var(--foreground) / 0.03)' }}>
      <div className="h-0.5" style={{ background: 'linear-gradient(90deg, hsl(280 60% 55% / 0.5), hsl(280 40% 55% / 0.15), transparent)' }} />

      <div className="px-4 py-3 sm:px-5 sm:py-4 md:px-6 md:py-4 border-b border-border/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'hsl(280 60% 55% / 0.08)', color: 'hsl(280 60% 50%)' }}>
            <GitCompare className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm sm:text-base text-foreground tracking-tight">경쟁 특허 비교 분석</h3>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">AI가 유사 특허와 5개 축으로 차별점을 비교</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 md:p-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'hsl(280 60% 55%)' }} />
            <p className="text-xs sm:text-sm text-muted-foreground">유사 특허 검색 + 차별점 분석 중...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/40 border border-border/30">
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            {/* Competitor header cards with similarity % */}
            <div className={`grid gap-2 grid-cols-2 ${colCount === 4 ? 'sm:grid-cols-4' : colCount === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              <div className="p-2.5 rounded-xl border-2 text-center" style={{ borderColor: 'hsl(var(--primary) / 0.4)', background: 'hsl(var(--primary) / 0.04)' }}>
                <div className="text-[9px] font-bold uppercase tracking-wider text-primary mb-1">분석 대상</div>
                <div className="text-[11px] font-bold text-foreground line-clamp-2 leading-tight" title={patentData.titleKo || patentData.title}>{currentTitle}</div>
                <div className="text-[9px] text-muted-foreground mt-1 truncate">{patentData.displayNumber || patentData.patentNumber}</div>
              </div>
              {result.competitors.map((c, i) => {
                const simColor = c.similarityScore >= 80 ? 'hsl(280 60% 55%)' : c.similarityScore >= 60 ? 'hsl(280 50% 65%)' : 'hsl(var(--muted-foreground))';
                return (
                  <button
                    key={i}
                    onClick={() => onPatentClick?.(c.patentId)}
                    className="p-2.5 rounded-xl border bg-muted/40 border-border/30 text-center hover:border-primary/40 hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">유사도</span>
                      <span className="text-[10px] font-bold" style={{ color: simColor }}>{c.similarityScore}%</span>
                    </div>
                    <div className="text-[11px] font-bold text-foreground/85 line-clamp-2 leading-tight text-left" title={c.title}>{truncate(c.title, 26)}</div>
                    <div className="text-[9px] text-muted-foreground mt-1 truncate text-left">{c.patentId}</div>
                  </button>
                );
              })}
            </div>

            {/* Strength Radar Chart: current vs competitor average */}
            {radarData.length >= 3 && (
              <div className="rounded-xl border border-border/30 bg-muted/20 p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div>
                    <div className="text-[11px] font-bold text-foreground tracking-tight">차별점 강도 레이더</div>
                    <div className="text-[10px] text-muted-foreground">강(3) · 중(2) · 약(1) 점수 기준 · 분석대상 vs 경쟁 평균</div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> 분석대상</div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'hsl(280 60% 55%)' }} /> 경쟁 평균</div>
                  </div>
                </div>
                <div className="w-full h-[240px] sm:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                      <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <PolarAngleAxis
                        dataKey="axis"
                        tick={{ fontSize: 10, fontWeight: 600, fill: 'hsl(var(--foreground) / 0.75)' }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 3]}
                        tickCount={4}
                        tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                      />
                      <Radar
                        name="분석대상"
                        dataKey="current"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.28}
                        strokeWidth={2}
                        dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                      />
                      <Radar
                        name="경쟁 평균"
                        dataKey="competitorAvg"
                        stroke="hsl(280 60% 55%)"
                        fill="hsl(280 60% 55%)"
                        fillOpacity={0.15}
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        dot={{ r: 3, fill: 'hsl(280 60% 55%)' }}
                      />
                      <RTooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                        formatter={(value: any) => {
                          const v = Number(value);
                          const label = v >= 2.5 ? '강' : v >= 1.5 ? '중' : '약';
                          return [`${value} (${label})`, ''];
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Comparison table */}
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-[12px] sm:text-[13px] border-separate border-spacing-0 min-w-[640px]">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 rounded-l-lg w-[110px]">평가 축</th>
                    <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-primary bg-primary/[0.06]">
                      <div className="line-clamp-1" title={patentData.titleKo || patentData.title}>{truncate(patentData.titleKo || patentData.title || "분석 대상", 18)}</div>
                    </th>
                    {result.competitors.map((c, i) => (
                      <th key={i} className={`text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 ${i === result.competitors.length - 1 ? 'rounded-r-lg' : ''}`}>
                        <div className="line-clamp-1" title={c.title}>{truncate(c.title, 18)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => {
                    const advIcon = row.advantage === "current"
                      ? <CheckCircle2 className="w-3 h-3 inline text-primary" />
                      : row.advantage === "competitor"
                      ? <MinusCircle className="w-3 h-3 inline text-orange-500" />
                      : null;
                    return (
                      <tr key={i} className="border-b border-border/20 last:border-0">
                        <td className="py-3 px-3 font-semibold text-foreground/80 align-top">
                          <div className="flex items-center gap-1.5">{row.axis}{advIcon}</div>
                        </td>
                        <td className={`py-3 px-3 align-top ${row.advantage === 'current' ? 'bg-primary/[0.05] font-medium text-foreground' : 'text-foreground/70'}`}>
                          <div className="flex items-start">
                            <span className="flex-1">{row.current}</span>
                            <StrengthDots s={row.currentStrength} />
                          </div>
                        </td>
                        {result.competitors.map((_, idx) => (
                          <td key={idx} className="py-3 px-3 align-top text-foreground/60">
                            <div className="flex items-start">
                              <span className="flex-1">{row.competitors[idx] || "—"}</span>
                              {row.competitors[idx] && <StrengthDots s={row.competitorStrengths[idx] || "medium"} />}
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground px-1">
              <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-primary" /> 분석대상 우위</div>
              <div className="flex items-center gap-1"><MinusCircle className="w-3 h-3 text-orange-500" /> 경쟁 우위</div>
              <div className="flex items-center gap-1"><StrengthDots s="strong" /> 강</div>
              <div className="flex items-center gap-1"><StrengthDots s="medium" /> 중</div>
              <div className="flex items-center gap-1"><StrengthDots s="weak" /> 약</div>
            </div>

            {/* AI Summary */}
            {result.summary && (
              <div className="p-3 sm:p-3.5 rounded-xl bg-[hsl(280,60%,55%,0.05)] border-l-4 border-l-[hsl(280,60%,55%)]">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'hsl(280 60% 55%)' }} />
                  <p className="text-[12px] sm:text-[13px] text-foreground/80 leading-[1.7]">
                    <span className="font-bold text-foreground">AI 분석:</span> {result.summary}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
