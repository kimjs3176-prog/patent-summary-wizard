import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

interface SummaryReadyValue {
  pendingCount: number;
  setTask: (key: string, active: boolean) => void;
}

const SummaryReadyContext = createContext<SummaryReadyValue | null>(null);

/** 요약서 하위 섹션들의 비동기 로딩 상태를 모아 PDF 다운로드 가능 시점을 판단한다. */
export function SummaryReadyProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const setTask = useCallback((key: string, active: boolean) => {
    setPending((prev) => {
      if (!!prev[key] === active) return prev;
      const next = { ...prev };
      if (active) next[key] = true;
      else delete next[key];
      return next;
    });
  }, []);

  const pendingCount = Object.keys(pending).length;
  const value = useMemo(() => ({ pendingCount, setTask }), [pendingCount, setTask]);

  return <SummaryReadyContext.Provider value={value}>{children}</SummaryReadyContext.Provider>;
}

export function useSummaryPending(): number {
  return useContext(SummaryReadyContext)?.pendingCount ?? 0;
}

/** 로딩 중인 동안 요약서 준비 상태를 '대기'로 표시한다. */
export function useSummaryTask(name: string, active: boolean) {
  const ctx = useContext(SummaryReadyContext);
  const keyRef = useRef(`${name}-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    if (!ctx) return;
    const key = keyRef.current;
    ctx.setTask(key, active);
    return () => ctx.setTask(key, false);
  }, [ctx, active]);
}
