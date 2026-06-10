import { useState, useCallback } from "react";
import { toast } from "sonner";
import { PatentData, RelatedPatent } from "@/components/PatentSummary/types";
import { AnalysisStep } from "@/components/AnalysisProgressStepper";
import { safeFetch } from "@/lib/safeFetch";

export function usePatentSummary() {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [summary, setSummary] = useState("");
  const [currentPatent, setCurrentPatent] = useState("");
  const [patentData, setPatentData] = useState<PatentData | null>(null);
  const [relatedPatents, setRelatedPatents] = useState<RelatedPatent[]>([]);
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>("idle");

  const generateSummary = useCallback(async (patentNumber: string, options: { forceRegenerate?: boolean } = {}) => {
    const force = !!options.forceRegenerate;
    setIsLoading(true);
    setIsFetching(true);
    // Mark app as busy so the global auto-update loop won't reload mid-analysis.
    if (typeof window !== "undefined") (window as any).__APP_BUSY__ = true;
    setAnalysisStep("fetching");
    setSummary("");
    setPatentData(null);
    setRelatedPatents([]);
    setCurrentPatent(patentNumber);

    let fetchedPatentData: PatentData | null = null;

    // Step 1: Fetch patent data from KIPRIS
    try {
      toast.info("KIPRIS에서 특허 정보를 조회 중...");
      
      const fetchResponse = await safeFetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-patent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ patentNumber, forceRegenerate: force }),
          timeoutMs: 45000,
          retries: 1,
        }
      );

      const fetchResult = await fetchResponse.json().catch(() => ({ success: false, error: "응답 형식이 올바르지 않습니다." }));

      if (fetchResult.success && fetchResult.data) {
        fetchedPatentData = fetchResult.data;
        setPatentData(fetchedPatentData);
        
        // Set related patents if available
        if (fetchResult.relatedPatents && fetchResult.relatedPatents.length > 0) {
          setRelatedPatents(fetchResult.relatedPatents);
        }
        
        toast.success("특허 정보를 성공적으로 가져왔습니다!");
      } else {
        toast.warning(fetchResult.error || "특허 정보를 가져올 수 없어 일반 요약을 생성합니다.");
      }
    } catch (fetchError) {
      console.error("Patent fetch error:", fetchError);
      toast.warning("특허 정보 조회 실패. 일반 요약을 생성합니다.");
    }

    setIsFetching(false);
    setAnalysisStep("summarizing");

    // Step 2: Generate AI summary with patent data (with auto-retry + backoff)
    const MAX_ATTEMPTS = 3; // initial + up to 2 retries
    const isRetryableMessage = (msg: string) => {
      const m = msg.toLowerCase();
      return (
        m.includes("network") ||
        m.includes("failed to fetch") ||
        m.includes("load failed") ||
        m.includes("timeout") ||
        m.includes("abort") ||
        m.includes("스트리밍") ||
        m.includes("생성에 실패") ||
        m.includes("http 5") ||
        m.includes("503") ||
        m.includes("502") ||
        m.includes("500") ||
        m.includes("504") ||
        m.includes("429")
      );
    };

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        if (attempt === 1) {
          toast.info("AI 요약서를 생성 중...");
        } else {
          toast.info(`재시도 중... (${attempt - 1}/${MAX_ATTEMPTS - 1})`);
        }

        // Reset partial buffer for clean re-stream
        setSummary("");

        const response = await safeFetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-patent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
            body: JSON.stringify({
              patentNumber,
              patentData: fetchedPatentData,
              // Force regenerate on retries so we bypass any partially-cached/stale state
              forceRegenerate: force || attempt > 1,
            }),
            // Only the initial request needs a timeout; the streamed body is read by `reader` afterwards
            timeoutMs: 60000,
            retries: 0, // we handle retries here for end-to-end (incl. streaming) failures
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 402) {
            // Non-retryable: surface immediately
            throw new Error("AI 서비스 크레딧이 일시적으로 소진되었습니다. 잠시 후 다시 시도해 주세요.");
          }
          const msg = errorData.error || `요약서 생성에 실패했습니다. (HTTP ${response.status})`;
          throw new Error(msg);
        }

        if (!response.body) {
          throw new Error("스트리밍 응답을 받을 수 없습니다.");
        }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setSummary(fullContent);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

        // If stream finished but produced no content, treat as retryable failure
        if (!fullContent || fullContent.trim().length < 20) {
          throw new Error("빈 응답을 받았습니다. 재시도합니다.");
        }

        setAnalysisStep("done");
        toast.success(
          attempt === 1
            ? "요약서가 생성되었습니다!"
            : `요약서가 생성되었습니다! (재시도 ${attempt - 1}회)`
        );

        return {
          summary: fullContent,
          patentData: fetchedPatentData,
          relatedPatents: relatedPatents,
        };
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[summary] attempt ${attempt} failed:`, message);

        const canRetry = attempt < MAX_ATTEMPTS && isRetryableMessage(message);
        if (!canRetry) break;

        // Exponential backoff: 1.5s, 4s (+ small jitter)
        const delayMs = [1500, 4000][attempt - 1] ?? 4000;
        const jitter = Math.floor(Math.random() * 400);
        toast.warning(`요약 생성 실패. ${Math.round((delayMs + jitter) / 1000)}초 후 자동 재시도합니다...`);
        await new Promise((r) => setTimeout(r, delayMs + jitter));
      }
    }

    // All attempts exhausted
    {
      const message = lastError instanceof Error ? lastError.message : "오류가 발생했습니다.";
      toast.error(`${message}${MAX_ATTEMPTS > 1 ? ` (재시도 ${MAX_ATTEMPTS - 1}회 모두 실패)` : ""}`);
      setSummary("");
      setAnalysisStep("idle");
      setIsLoading(false);
      if (typeof window !== "undefined") (window as any).__APP_BUSY__ = false;
      return null;
    }
  }, [relatedPatents]);

  const loadFromHistory = useCallback((historyItem: {
    summary: string;
    patentData: PatentData;
    relatedPatents: RelatedPatent[];
    patentNumber: string;
  }) => {
    setSummary(historyItem.summary);
    setPatentData(historyItem.patentData);
    setRelatedPatents(historyItem.relatedPatents);
    setCurrentPatent(historyItem.patentNumber);
  }, []);



  const reset = useCallback(() => {
    setSummary("");
    setCurrentPatent("");
    setPatentData(null);
    setRelatedPatents([]);
    setAnalysisStep("idle");
  }, []);

  return {
    isLoading,
    isFetching,
    summary,
    currentPatent,
    patentData,
    relatedPatents,
    analysisStep,
    generateSummary,
    loadFromHistory,
    reset,
  };
}
