import { useEffect, useMemo, useState } from "react";
import { GitCompare, Loader2, CheckCircle2, MinusCircle, AlertCircle, Sparkles, ChevronDown, ChevronUp, Trophy, Brain } from "lucide-react";
import { PatentData, RelatedPatent } from "./types";
import { safeFetch } from "@/lib/safeFetch";

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
  relatedPatents?: RelatedPatent[];
  onPatentClick?: (patentNumber: string) => void;
  variant?: "default" | "toss";
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

export function CompetitorComparisonTable({ patentData, relatedPatents = [], onPatentClick, variant = "default" }: CompetitorComparisonTableProps) {
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<"idle" | "search" | "compare">("idle");
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (i: number) =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

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
      setStage("search");
      setError(null);
      setResult(null);

      const callRecommend = async (overrideTitle?: string, overrideAbstract?: string) => {
        const res = await safeFetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recommend-similar-patents`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              title: overrideTitle ?? (patentData.titleKo || patentData.title || ""),
              abstract: overrideAbstract ?? (patentData.abstract || ""),
              classifications: patentData.classifications || [],
              patentNumber: patentData.patentNumber || patentData.displayNumber || "",
            }),
            timeoutMs: 30000,
            retries: 1,
          }
        );
        return res.json().catch(() => ({ success: false, patents: [] }));
      };

      const dedupeCurrent = (list: AiRecommendedPatent[]) => {
        const currentNum = (patentData.patentNumber || patentData.displayNumber || patentData.applicationNumber || "").replace(/[^0-9]/g, "");
        return list.filter((p) => {
          const pn = (p.patentId || "").replace(/[^0-9]/g, "");
          if (!pn || !currentNum) return true;
          return !(pn.includes(currentNum) || currentNum.includes(pn));
        });
      };

      try {
        // Step 1a: Standard similar-patent search
        let recJson = await callRecommend();
        let competitors: AiRecommendedPatent[] = recJson.success ? (recJson.patents || []) : [];
        let filtered = dedupeCurrent(competitors);

        // Step 1b: Keyword fallback — extract simple title tokens and retry with looser query
        if (filtered.length === 0) {
          const stop = new Set(["방법", "장치", "시스템", "기술", "이용", "위한", "관한", "관련", "포함", "제공", "그리고", "또는", "있는", "되는", "사용", "통해", "통한", "및", "을", "를", "의"]);
          const tokens = (patentData.titleKo || patentData.title || "")
            .replace(/[\[\](),.·\-/]/g, " ")
            .split(/\s+/)
            .map((t) => t.trim())
            .filter((t) => t.length >= 2 && !stop.has(t));
          if (tokens.length) {
            // Try with the 2-3 most distinctive (longest) tokens, fall back to any single keyword
            const sorted = [...tokens].sort((a, b) => b.length - a.length);
            const looseTitle = sorted.slice(0, 3).join(" ");
            recJson = await callRecommend(looseTitle, "");
            competitors = recJson.success ? (recJson.patents || []) : [];
            filtered = dedupeCurrent(competitors);

            // Last resort: try just the single longest keyword
            if (filtered.length === 0 && sorted[0]) {
              recJson = await callRecommend(sorted[0], "");
              competitors = recJson.success ? (recJson.patents || []) : [];
              filtered = dedupeCurrent(competitors);
            }
          }
        }

        if (filtered.length === 0) {
          filtered = dedupeCurrent(relatedPatents.map((p, i) => ({
            patentId: p.patentId,
            title: p.title,
            assignee: p.assignee,
            publicationDate: p.publicationDate,
            snippet: p.snippet,
            relevanceGroup: i,
          })));
        }

        if (filtered.length === 0) {
          setError("비교 가능한 유사 특허를 찾지 못했습니다.");
          setLoading(false);
          return;
        }

        const top3 = filtered.slice(0, 3);

        // Step 2: Generate comparison table
        setStage("compare");
        const cmpRes = await safeFetch(
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
            timeoutMs: 45000,
            retries: 1,
          }
        );
        const cmpJson = await cmpRes.json().catch(() => ({ success: false, error: "응답 형식이 올바르지 않습니다." }));
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
        const msg = e instanceof Error ? e.message.toLowerCase() : "";
        if (msg.includes("abort") || msg.includes("timeout")) {
          setError("네트워크가 지연되어 비교 분석을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        } else {
          setError("비교 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        }
      } finally {
        setLoading(false);
        setStage("idle");
      }
    };
    run();
  }, [patentData?.patentNumber, patentData?.displayNumber, relatedPatents]);

  // Aggregate: who wins the most axes? (must be before any early return — Rules of Hooks)
  const wins = useMemo(() => {
    if (!result?.rows) return { current: 0, competitor: 0, neutral: 0 };
    return result.rows.reduce(
      (acc, r) => {
        if (r.advantage === "current") acc.current += 1;
        else if (r.advantage === "competitor") acc.competitor += 1;
        else acc.neutral += 1;
        return acc;
      },
      { current: 0, competitor: 0, neutral: 0 }
    );
  }, [result]);

  const overallVerdict = useMemo(() => {
    if (!result?.rows?.length) return null;
    const total = result.rows.length;
    if (wins.current > wins.competitor) return { label: "분석 대상 우위", tone: "primary" as const, ratio: wins.current / total };
    if (wins.competitor > wins.current) return { label: "경쟁 특허 우위", tone: "warn" as const, ratio: wins.competitor / total };
    return { label: "비등한 경쟁 구도", tone: "neutral" as const, ratio: 0.5 };
  }, [result, wins]);

  if (!loading && !result && !error) return null;

  const currentTitle = truncate(patentData.titleKo || patentData.title || "분석 대상", 24);
  const competitorCount = result?.competitors.length || 0;
  const colCount = competitorCount + 1;
  const isToss = variant === "toss";

  return (
    <div className={isToss ? "" : "relative rounded-2xl overflow-hidden animate-slide-in bg-card border border-border/30"} style={isToss ? undefined : { boxShadow: '0 1px 3px hsl(var(--foreground) / 0.03)' }}>
      {!isToss && (
        <>
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
        </>
      )}

      <div className={isToss ? "" : "p-4 sm:p-5 md:p-6"}>
        {loading && (
          <div className="space-y-4">
            {/* Stepper */}
            <div className="flex items-center justify-center gap-3 sm:gap-5 py-2">
              <div className={`flex items-center gap-1.5 text-[11px] sm:text-xs font-medium transition-colors ${stage === 'search' ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                {stage === 'search'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'hsl(280 60% 55%)' }} />
                  : <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'hsl(280 60% 55%)' }} />}
                <span>유사 특허 검색</span>
              </div>
              <div className="w-6 h-px bg-border/50" />
              <div className={`flex items-center gap-1.5 text-[11px] sm:text-xs font-medium transition-colors ${stage === 'compare' ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                {stage === 'compare'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'hsl(280 60% 55%)' }} />
                  : <Brain className="w-3.5 h-3.5" />}
                <span>차별점 분석</span>
              </div>
            </div>
            {/* Skeleton bars to set expectation */}
            <div className="space-y-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-9 rounded-lg bg-muted/40 animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
            <p className="text-center text-[11px] text-muted-foreground/70">최대 30~45초 소요됩니다. 다음 조회부터는 즉시 표시됩니다.</p>
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
            {/* === Verdict banner === */}
            {overallVerdict && (
              <div
                className="flex items-center gap-3 p-3 sm:p-3.5 rounded-xl border"
                style={{
                  background: overallVerdict.tone === 'primary'
                    ? 'hsl(var(--primary) / 0.06)'
                    : overallVerdict.tone === 'warn'
                    ? 'hsl(25 90% 55% / 0.06)'
                    : 'hsl(var(--muted) / 0.5)',
                  borderColor: overallVerdict.tone === 'primary'
                    ? 'hsl(var(--primary) / 0.25)'
                    : overallVerdict.tone === 'warn'
                    ? 'hsl(25 90% 55% / 0.25)'
                    : 'hsl(var(--border))',
                }}
              >
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: overallVerdict.tone === 'primary'
                      ? 'hsl(var(--primary) / 0.12)'
                      : overallVerdict.tone === 'warn'
                      ? 'hsl(25 90% 55% / 0.12)'
                      : 'hsl(var(--muted))',
                    color: overallVerdict.tone === 'primary'
                      ? 'hsl(var(--primary))'
                      : overallVerdict.tone === 'warn'
                      ? 'hsl(25 90% 45%)'
                      : 'hsl(var(--muted-foreground))',
                  }}
                >
                  <Trophy className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">종합 판정</div>
                  <div className="text-sm sm:text-[15px] font-bold text-foreground">{overallVerdict.label}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg sm:text-xl font-black tabular-nums leading-none text-foreground">
                    {wins.current}<span className="text-muted-foreground/50 text-sm">/{result.rows.length}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">축 우위</div>
                </div>
              </div>
            )}

            {/* === Competitor header cards with similarity === */}
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

            {/* === Versus bars per axis (2x2 grid on sm+) === */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {result.rows.map((row, i) => {
                const curScore = strengthScore(row.currentStrength);
                const compScores = row.competitorStrengths.map(strengthScore);
                const compAvg = compScores.length ? compScores.reduce((a, b) => a + b, 0) / compScores.length : 0;
                const curPct = (curScore / 3) * 100;
                const compPct = (compAvg / 3) * 100;
                const advColor = row.advantage === 'current'
                  ? 'hsl(var(--primary))'
                  : row.advantage === 'competitor'
                  ? 'hsl(25 90% 55%)'
                  : 'hsl(var(--muted-foreground))';
                const advBg = row.advantage === 'current'
                  ? 'hsl(var(--primary) / 0.06)'
                  : row.advantage === 'competitor'
                  ? 'hsl(25 90% 55% / 0.06)'
                  : 'transparent';
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-border/30 p-3 sm:p-3.5 transition-colors"
                    style={{ background: advBg }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[12px] sm:text-[13px] font-bold text-foreground truncate">{row.axis}</span>
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                        style={{ color: advColor, background: `${advColor.replace(')', ' / 0.1)')}` }}
                      >
                        {row.advantage === 'current' ? '대상 우위' : row.advantage === 'competitor' ? '경쟁 우위' : '동등'}
                      </span>
                    </div>
                    {/* Two stacked bars: current vs competitor avg */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-primary w-12 shrink-0">분석대상</span>
                        <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${curPct}%`, background: 'hsl(var(--primary))' }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-foreground/70 w-10 text-right shrink-0">
                          {row.currentStrength === 'strong' ? '강' : row.currentStrength === 'medium' ? '중' : '약'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground w-12 shrink-0">경쟁평균</span>
                        <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${compPct}%`, background: 'hsl(280 50% 60%)' }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-foreground/70 w-10 text-right shrink-0">
                          {compAvg >= 2.5 ? '강' : compAvg >= 1.5 ? '중' : '약'}
                        </span>
                      </div>
                    </div>
                    {/* Inline summary text per side */}
                    <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] sm:text-[12px] leading-snug">
                      <div className="text-foreground/80">
                        <span className="text-primary font-semibold">▸ </span>{row.current}
                      </div>
                      <div className="text-foreground/60">
                        <span className="text-muted-foreground font-semibold">▸ </span>
                        {row.competitors.filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* === AI Summary (moved up for visibility) === */}
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

            {/* === Detailed table (collapsible) === */}
            <button
              onClick={() => setShowTable((v) => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-muted/40 hover:bg-muted/60 border border-border/30 text-[11px] sm:text-xs font-semibold text-foreground/70 transition-colors"
            >
              {showTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showTable ? '상세 비교표 접기' : '상세 비교표 펼치기'}
            </button>

            {showTable && (
            <div className="animate-fade-up">
              {/* Mobile: collapsible row cards (no horizontal scroll) */}
              <div className="md:hidden space-y-2">
                {result.rows.map((row, i) => {
                  const isOpen = expandedRows.has(i);
                  const advTone = row.advantage === 'current'
                    ? { label: '대상 우위', color: 'hsl(var(--primary))', bg: 'hsl(var(--primary) / 0.08)' }
                    : row.advantage === 'competitor'
                    ? { label: '경쟁 우위', color: 'hsl(25 90% 50%)', bg: 'hsl(25 90% 55% / 0.08)' }
                    : { label: '동등', color: 'hsl(var(--muted-foreground))', bg: 'hsl(var(--muted) / 0.5)' };
                  return (
                    <div key={i} className="rounded-xl border border-border/30 bg-background overflow-hidden">
                      <button
                        onClick={() => toggleRow(i)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                      >
                        <span className="flex-1 text-[12px] font-bold text-foreground truncate">{row.axis}</span>
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ color: advTone.color, background: advTone.bg }}
                        >
                          {advTone.label}
                        </span>
                        {isOpen
                          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/20">
                          <div className="rounded-lg p-2.5" style={{ background: 'hsl(var(--primary) / 0.05)' }}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">분석 대상</span>
                              <StrengthDots s={row.currentStrength} />
                            </div>
                            <p className="text-[12px] text-foreground leading-snug">{row.current || '—'}</p>
                          </div>
                          {result.competitors.map((c, idx) => (
                            <div key={idx} className="rounded-lg p-2.5 bg-muted/30">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate" title={c.title}>
                                  경쟁 {idx + 1} · {truncate(c.title, 14)}
                                </span>
                                {row.competitors[idx] && <StrengthDots s={row.competitorStrengths[idx] || 'medium'} />}
                              </div>
                              <p className="text-[12px] text-foreground/75 leading-snug">{row.competitors[idx] || '—'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    onClick={() => setExpandedRows(new Set(result.rows.map((_, i) => i)))}
                    className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    모두 펼치기
                  </button>
                  <span className="text-muted-foreground/40">·</span>
                  <button
                    onClick={() => setExpandedRows(new Set())}
                    className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    모두 접기
                  </button>
                </div>
              </div>

              {/* Desktop: full table with auto-fit columns */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-[13px] border-separate border-spacing-0 table-fixed">
                  <colgroup>
                    <col style={{ width: '14%' }} />
                    <col style={{ width: `${86 / (1 + result.competitors.length)}%` }} />
                    {result.competitors.map((_, i) => (
                      <col key={i} style={{ width: `${86 / (1 + result.competitors.length)}%` }} />
                    ))}
                  </colgroup>
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 rounded-l-lg">평가 축</th>
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
                        <td className="py-3 px-3 font-semibold text-foreground/80 align-top break-keep">
                          <div className="flex items-center gap-1.5">{row.axis}{advIcon}</div>
                        </td>
                        <td className={`py-3 px-3 align-top break-words ${row.advantage === 'current' ? 'bg-primary/[0.05] font-medium text-foreground' : 'text-foreground/70'}`}>
                          <div className="flex items-start">
                            <span className="flex-1">{row.current}</span>
                            <StrengthDots s={row.currentStrength} />
                          </div>
                        </td>
                        {result.competitors.map((_, idx) => (
                          <td key={idx} className="py-3 px-3 align-top text-foreground/60 break-words">
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
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
