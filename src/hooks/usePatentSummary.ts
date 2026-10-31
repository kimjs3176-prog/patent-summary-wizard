import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { PatentData, RelatedPatent } from "@/components/PatentSummary/types";
import { AnalysisStep } from "@/components/AnalysisProgressStepper";
import { safeFetch } from "@/lib/safeFetch";
import { metaFromPayload, parseSseLine, splitSseBuffer, type SummaryMeta } from "@/lib/summaryStream";

/** How long the streamed body may stay silent before the run is treated as failed. */
const STREAM_IDLE_TIMEOUT_MS = 60_000;

const setAppBusy = (busy: boolean) => {
  if (typeof window !== "undefined") (window as unknown as { __APP_BUSY__?: boolean }).__APP_BUSY__ = busy;
};

/** Reads one chunk, failing when the server sends nothing for STREAM_IDLE_TIMEOUT_MS. */
async function readWithIdleTimeout<T>(read: () => Promise<T>, onTimeout: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout();
          reject(new Error("스트리밍 응답이 중단되었습니다 (timeout)"));
        }, STREAM_IDLE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function usePatentSummary() {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryMeta, setSummaryMeta] = useState<SummaryMeta | null>(null);
  const [currentPatent, setCurrentPatent] = useState("");
  const [patentData, setPatentData] = useState<PatentData | null>(null);
  const [relatedPatents, setRelatedPatents] = useState<RelatedPatent[]>([]);
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>("idle");

  // One run at a time: a newer generateSummary call (or unmount) aborts the previous
  // network work, and callbacks from a superseded run never touch state again.
  const runRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    runRef.current += 1;
    abortRef.current?.abort();
    setAppBusy(false);
  }, []);

  const generateSummary = useCallback(async (patentNumber: string, options: { forceRegenerate?: boolean } = {}) => {
    const force = !!options.forceRegenerate;
    const runId = ++runRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const isCurrent = () => runId === runRef.current;
    /** Ends this run's loading state only if no newer run took over. */
    const finish = (step: AnalysisStep) => {
      if (!isCurrent()) return;
      setAnalysisStep(step);
      setIsLoading(false);
      setAppBusy(false);
    };

    setIsLoading(true);
    setIsFetching(true);
    // Mark app as busy so the global auto-update loop won't reload mid-analysis.
    setAppBusy(true);
    setAnalysisStep("fetching");
    setSummary("");
    setSummaryMeta(null);
    setPatentData(null);
    setRelatedPatents([]);
    setCurrentPatent(patentNumber);

    let fetchedPatentData: PatentData | null = null;
    let fetchedRelated: RelatedPatent[] = [];

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
          signal: controller.signal,
        }
      );
      if (!isCurrent()) return null;

      const fetchResult = await fetchResponse.json().catch(() => ({ success: false, error: "응답 형식이 올바르지 않습니다." }));
      if (!isCurrent()) return null;

      if (fetchResult.success && fetchResult.data) {
        fetchedPatentData = fetchResult.data;
        setPatentData(fetchedPatentData);

        // Set related patents if available
        if (Array.isArray(fetchResult.relatedPatents) && fetchResult.relatedPatents.length > 0) {
          fetchedRelated = fetchResult.relatedPatents;
          setRelatedPatents(fetchedRelated);
        }

        toast.success("특허 정보를 성공적으로 가져왔습니다!");
      } else {
        toast.warning(fetchResult.error || "특허 정보를 가져올 수 없어 일반 요약을 생성합니다.");
      }
    } catch (fetchError) {
      if (!isCurrent()) return null; // superseded or unmounted: stay silent
      console.error("Patent fetch error:", fetchError);
      toast.warning("특허 정보 조회 실패. 일반 요약을 생성합니다.");
    }

    setIsFetching(false);
    setAnalysisStep("summarizing");

    // KIPRIS 데이터 확보 실패 시 요약 호출을 중단(가짜 요약 방지).
    const hasUsable = !!(
      fetchedPatentData && (
        (fetchedPatentData.title && fetchedPatentData.title.trim().length > 1) ||
        (fetchedPatentData.abstract && fetchedPatentData.abstract.trim().length > 20) ||
        (Array.isArray(fetchedPatentData.claims) && fetchedPatentData.claims.some((c) => typeof c === "string" && c.trim().length > 20)) ||
        (fetchedPatentData.description && fetchedPatentData.description.trim().length > 50)
      )
    );
    if (!hasUsable) {
      toast.error("특허 원문을 가져오지 못했습니다. 번호를 확인하거나 잠시 후 다시 시도해 주세요.");
      setSummary("");
      finish("idle");
      return null;
    }

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
        m.includes("생성 중 오류") ||
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
      if (!isCurrent()) return null;
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
              // Force regenerate on retries so we bypass any partially-cached/stale state
              forceRegenerate: force || attempt > 1,
            }),
            // Only the initial request needs a timeout; the streamed body is read by `reader` afterwards
            timeoutMs: 60000,
            retries: 0, // we handle retries here for end-to-end (incl. streaming) failures
            signal: controller.signal,
          }
        );
        if (!isCurrent()) return null;

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
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await readWithIdleTimeout(() => reader.read(), () => reader.cancel().catch(() => undefined));
          if (!isCurrent()) {
            reader.cancel().catch(() => undefined);
            return null;
          }
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const { lines, rest } = splitSseBuffer(buffer);
          buffer = rest;

          for (const line of lines) {
            const frame = parseSseLine(line);
            if (frame.type === "skip") continue;
            if (frame.type === "done") { streamDone = true; break; }
            if (frame.type === "meta") { setSummaryMeta((prev) => ({ ...(prev ?? {}), ...frame.meta })); continue; }
            if (frame.type === "error") throw new Error(frame.message);
            if (frame.type === "final") {
              const extraMeta = metaFromPayload(line);
              if (extraMeta) setSummaryMeta((prev) => ({ ...(prev ?? {}), ...extraMeta }));
              fullContent = frame.content;
            } else {
              fullContent += frame.content;
            }
            setSummary(fullContent);
          }
        }

        // If stream finished but produced no content, treat as retryable failure
        if (!fullContent || fullContent.trim().length < 20) {
          throw new Error("빈 응답을 받았습니다. 재시도합니다.");
        }

        toast.success(
          attempt === 1
            ? "요약서가 생성되었습니다!"
            : `요약서가 생성되었습니다! (재시도 ${attempt - 1}회)`
        );
        finish("done");

        return {
          summary: fullContent,
          patentData: fetchedPatentData,
          relatedPatents: fetchedRelated,
        };
      } catch (error) {
        if (!isCurrent()) return null; // aborted by a newer run or unmount
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
    if (!isCurrent()) return null;
    const message = lastError instanceof Error ? lastError.message : "오류가 발생했습니다.";
    toast.error(`${message}${MAX_ATTEMPTS > 1 ? ` (재시도 ${MAX_ATTEMPTS - 1}회 모두 실패)` : ""}`);
    setSummary("");
    finish("idle");
    return null;
  }, []);

  const loadFromHistory = useCallback((historyItem: {
    summary: string;
    patentData: PatentData;
    relatedPatents: RelatedPatent[];
    patentNumber: string;
  }) => {
    runRef.current += 1;
    abortRef.current?.abort();
    setIsLoading(false);
    setIsFetching(false);
    setAppBusy(false);
    setSummary(historyItem.summary);
    setSummaryMeta(null);
    setPatentData(historyItem.patentData);
    setRelatedPatents(historyItem.relatedPatents);
    setCurrentPatent(historyItem.patentNumber);
  }, []);

  const reset = useCallback(() => {
    runRef.current += 1;
    abortRef.current?.abort();
    setIsLoading(false);
    setIsFetching(false);
    setAppBusy(false);
    setSummary("");
    setSummaryMeta(null);
    setCurrentPatent("");
    setPatentData(null);
    setRelatedPatents([]);
    setAnalysisStep("idle");
  }, []);

  return {
    isLoading,
    isFetching,
    summary,
    summaryMeta,
    currentPatent,
    patentData,
    relatedPatents,
    analysisStep,
    generateSummary,
    loadFromHistory,
    reset,
  };
}
