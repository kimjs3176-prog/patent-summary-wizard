import { useEffect, useState } from "react";
import { Loader2, Scale, ExternalLink, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PatentData } from "./types";

interface RegulationLaw {
  name: string;
  ministry?: string;
  effectiveDate?: string;
  lawId?: string;
  link?: string;
  reason?: string;
}

interface RegulationResult {
  keywords: string[];
  laws: RegulationLaw[];
  summary: string;
}

interface Props {
  patentNumber: string;
  patentData: PatentData;
  isStreaming: boolean;
}

function formatEffectiveDate(d?: string): string | undefined {
  if (!d) return undefined;
  const s = d.replace(/[^0-9]/g, "");
  if (s.length === 8) return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)} 시행`;
  return d;
}

export function RegulationAnalysis({ patentNumber, patentData, isStreaming }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patentNumber || !patentData || isStreaming) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke("analyze-regulations", {
          body: { patentNumber, patentData },
        });
        if (cancelled) return;
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "분석 실패");
        setResult({ keywords: data.keywords || [], laws: data.laws || [], summary: data.summary || "" });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [patentNumber, isStreaming]);

  return (
    <section
      className="relative rounded-2xl overflow-hidden animate-slide-in bg-card border border-border/30 scroll-mt-24"
      style={{ animationDelay: "0.08s", boxShadow: "0 1px 3px hsl(var(--foreground) / 0.03)" }}
    >
      <div className="h-0.5" style={{ background: "linear-gradient(90deg, hsl(var(--primary) / 0.5), hsl(var(--primary) / 0.15), transparent)" }} />
      <div className="px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 flex items-center gap-2 border-b border-border/20">
        <Scale className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--primary))" }} />
        <p className="text-[10.5px] sm:text-[11px] text-muted-foreground font-medium tracking-tight">
          국가법령정보 기반 관련 법령 도출
        </p>
      </div>

      <div className="px-4 py-4 sm:px-5 sm:py-5 md:px-6 md:py-6">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" />
            관련 법령을 분석 중입니다...
          </div>
        )}
        {!loading && error && (
          <div className="flex items-start gap-2 text-[13px] text-muted-foreground">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
            <div>규제 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>
          </div>
        )}
        {!loading && !error && result && (
          <div className="space-y-4">
            {result.summary && (
              <p className="text-[13.5px] sm:text-[14px] leading-[1.75] text-foreground/85 tracking-[-0.005em]">
                {result.summary}
              </p>
            )}
            {result.laws.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">추출된 관련 법령이 없습니다.</p>
            ) : (
              <ul className="space-y-2.5">
                {result.laws.map((law, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-border/40 bg-muted/20 px-3.5 py-3 sm:px-4 sm:py-3.5 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[13.5px] sm:text-[14.5px] text-foreground leading-tight">
                            {law.name}
                          </span>
                          {law.ministry && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                              {law.ministry}
                            </span>
                          )}
                        </div>
                        {law.reason && (
                          <p className="mt-1.5 text-[12.5px] sm:text-[13px] text-foreground/70 leading-[1.65]">
                            {law.reason}
                          </p>
                        )}
                        {formatEffectiveDate(law.effectiveDate) && (
                          <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                            {formatEffectiveDate(law.effectiveDate)}
                          </p>
                        )}
                      </div>
                      {law.link && (
                        <a
                          href={law.link}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="shrink-0 inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary hover:underline"
                        >
                          법령 <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10.5px] text-muted-foreground/80 leading-[1.5] pt-1">
              ※ AI가 추정한 관련 법령 목록이며, 실제 인허가 및 규제 적용 여부는 소관부처와 별도 확인이 필요합니다. (출처: 국가법령정보센터)
            </p>
          </div>
        )}
      </div>
    </section>
  );
}