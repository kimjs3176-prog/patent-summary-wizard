import { useEffect, useState } from "react";
import { Loader2, Lightbulb, Sparkles, Compass, RefreshCw } from "lucide-react";
import { PatentData } from "./types";

interface PivotIdea {
  industry: string;
  title: string;
  useCase: string;
  transferredValue: string;
  feasibility: "상" | "중" | "하" | string;
  feasibilityReason: string;
}

interface PivotResult {
  coreMechanism: string;
  pivots: PivotIdea[];
}

interface Props {
  patentNumber: string;
  patentData: PatentData;
  isStreaming: boolean;
  contentReady: boolean;
}

const FEASIBILITY_COLORS: Record<string, { bg: string; fg: string; bd: string }> = {
  "상": { bg: "hsl(160 65% 93%)", fg: "hsl(160 70% 25%)", bd: "hsl(160 50% 80%)" },
  "중": { bg: "hsl(38 92% 93%)", fg: "hsl(28 80% 35%)", bd: "hsl(38 70% 80%)" },
  "하": { bg: "hsl(0 70% 95%)", fg: "hsl(0 65% 40%)", bd: "hsl(0 55% 85%)" },
};

const ACCENTS = [
  "hsl(217 91% 60%)",
  "hsl(160 70% 40%)",
  "hsl(280 60% 55%)",
  "hsl(25 90% 55%)",
];

export function PivotingAnalysis({ patentNumber, patentData, isStreaming, contentReady }: Props) {
  const [data, setData] = useState<PivotResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!patentData || !patentNumber || isStreaming || !contentReady) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-pivoting`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ patentNumber, patentData }),
          }
        );
        const json = await res.json();
        if (cancelled) return;
        if (json.success && json.data?.pivots?.length) {
          setData(json.data);
        } else {
          setError(json.error || "분석 결과를 불러오지 못했습니다");
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [patentNumber, patentData, isStreaming, contentReady, reloadKey]);

  return (
    <section
      id="sec-pivoting"
      className="relative rounded-2xl overflow-hidden animate-slide-in bg-card border border-border/30 scroll-mt-24 print:hidden"
      style={{ boxShadow: "0 1px 3px hsl(var(--foreground) / 0.03)" }}
    >
      <div
        className="h-0.5"
        style={{
          background:
            "linear-gradient(90deg, hsl(280 60% 55% / 0.5), hsl(217 91% 60% / 0.3), hsl(160 70% 40% / 0.5))",
        }}
      />

      {/* Header */}
      <div className="px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 flex items-center gap-2.5 border-b border-border/20">
        <div
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, hsl(280 60% 55% / 0.10), hsl(160 70% 40% / 0.10))",
            color: "hsl(280 55% 45%)",
          }}
        >
          <Compass className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-[14px] sm:text-[15px] text-foreground tracking-[-0.01em] leading-tight">
              AI 피벗팅 (용도전환)
            </h3>
            <span className="inline-flex items-center px-1.5 py-px rounded-md text-[9px] font-bold bg-primary/10 text-primary">
              BETA
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground/80 font-medium">
            본래 용도를 넘는 발상의 전환으로 새로운 활용 가능성 발굴
          </p>
        </div>
        {data && !loading && (
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="다른 아이디어 다시 생성"
          >
            <RefreshCw className="w-3 h-3" />
            다시 생성
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-4 sm:px-5 md:px-6 py-4 sm:py-5">
        {loading && (
          <div className="flex items-center justify-center gap-2.5 py-10 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">용도전환 아이디어 발상 중...</span>
          </div>
        )}

        {!loading && error && (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-4">
            {/* Core mechanism callout */}
            <div
              className="p-3 sm:p-3.5 rounded-xl flex items-start gap-2.5"
              style={{
                background:
                  "linear-gradient(135deg, hsl(280 60% 55% / 0.05), hsl(217 91% 60% / 0.04))",
                border: "1px solid hsl(280 50% 70% / 0.20)",
              }}
            >
              <span className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0" style={{ background: "hsl(280 55% 55% / 0.12)", color: "hsl(280 55% 45%)" }}>
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "hsl(280 50% 45%)" }}>
                  전이 가능한 핵심 원리
                </p>
                <p className="text-[13px] sm:text-[14px] text-foreground/85 font-semibold leading-[1.6]">
                  {data.coreMechanism}
                </p>
              </div>
            </div>

            {/* Pivots grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.pivots.map((p, i) => {
                const accent = ACCENTS[i % ACCENTS.length];
                const fc = FEASIBILITY_COLORS[p.feasibility] || FEASIBILITY_COLORS["중"];
                return (
                  <div
                    key={i}
                    className="relative rounded-xl border border-border/30 bg-background/60 p-3.5 sm:p-4 transition-all hover:border-border/60 hover:shadow-sm"
                  >
                    <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-sm" style={{ background: accent }} />
                    <div className="pl-2.5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <span
                            className="inline-block px-1.5 py-px rounded text-[10px] font-bold mb-1.5 tracking-tight"
                            style={{ background: `${accent.replace(")", " / 0.10)")}`, color: accent }}
                          >
                            {p.industry}
                          </span>
                          <h4 className="font-bold text-[13.5px] sm:text-[14.5px] text-foreground leading-snug tracking-[-0.01em]">
                            {p.title}
                          </h4>
                        </div>
                        <span
                          className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold"
                          style={{ background: fc.bg, color: fc.fg, border: `1px solid ${fc.bd}` }}
                          title={p.feasibilityReason}
                        >
                          현실성 {p.feasibility}
                        </span>
                      </div>
                      <p className="text-[12.5px] sm:text-[13px] text-foreground/75 leading-[1.7] mb-2">
                        {p.useCase}
                      </p>
                      <div className="flex items-start gap-1.5 pt-2 border-t border-border/20">
                        <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" style={{ color: accent }} />
                        <p className="text-[11.5px] sm:text-[12px] text-muted-foreground/85 leading-[1.65]">
                          <span className="font-semibold text-foreground/70">전이 가치:</span>{" "}
                          {p.transferredValue}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Disclaimer */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/35 border border-border/20">
              <span className="text-xs leading-none">💡</span>
              <p className="text-[10.5px] sm:text-[11px] text-muted-foreground/80 leading-[1.6]">
                AI가 생성한 발상 자료이며, 사업화 검토 시 추가적인 시장·기술 검증이 필요합니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}