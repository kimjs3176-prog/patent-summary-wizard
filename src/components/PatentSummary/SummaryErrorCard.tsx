import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SummaryError } from "@/hooks/usePatentSummary";

/** 요약서를 만들지 못했을 때 결과 자리에 남는 안내. 처음 화면으로 돌아가지 않고 그 자리에서 다시 시도한다. */
export function SummaryErrorCard({ error, onRetry }: { error: SummaryError; onRetry: () => void }) {
  return (
    <section
      role="alert"
      data-summary-error
      className="max-w-[864px] mx-auto mb-8 rounded-2xl border border-border/50 bg-card px-5 py-8 sm:px-8 text-center break-keep"
    >
      <div className="w-12 h-12 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-destructive" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-bold text-foreground mb-2">요약서를 만들지 못했습니다</h1>
      <p className="text-sm text-foreground leading-relaxed">{error.message}</p>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
        {error.retries > 0 ? `자동으로 ${error.retries}번 더 시도했습니다. ` : ""}
        다른 특허는 위 검색창에서 찾을 수 있습니다.
      </p>
      <Button onClick={onRetry} className="mt-5 rounded-full gap-1.5">
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
        다시 시도
      </Button>
    </section>
  );
}
