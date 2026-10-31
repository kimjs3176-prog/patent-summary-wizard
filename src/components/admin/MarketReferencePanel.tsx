import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Pencil, RefreshCw, RotateCcw, Save, Search, X } from "lucide-react";
import { toast } from "sonner";

type MarketRefStatus = "official" | "approved" | "ai_pending";

interface MarketRefRow {
  market_key: string;
  label: string;
  base_year: number;
  base_value_eok: number;
  cagr: number;
  source: string | null;
  source_url: string | null;
  status: MarketRefStatus;
  verified_at: string | null;
  created_at: string;
}

interface MarketRefApiResult {
  success?: boolean;
  error?: string;
  items?: MarketRefRow[];
  total?: number;
  pageSize?: number;
  counts?: Record<string, number>;
}

export type MarketRefApiCall = (action: string, data?: Record<string, unknown>) => Promise<MarketRefApiResult>;

interface MarketReferencePanelProps {
  apiCall: MarketRefApiCall;
}

const STATUS_META: Record<MarketRefStatus, { label: string; className: string }> = {
  official: { label: "공식 통계", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  approved: { label: "승인", className: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  ai_pending: { label: "검증 전", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
};

const FILTERS: Array<{ value: MarketRefStatus | "all"; label: string }> = [
  { value: "ai_pending", label: "검증 전" },
  { value: "approved", label: "승인" },
  { value: "official", label: "공식 통계" },
  { value: "all", label: "전체" },
];

const isGlobal = (key: string) => key.startsWith("글로벌");

/** 억 원 / USD 억 단위 값을 읽기 쉬운 표기로 */
function formatValue(row: Pick<MarketRefRow, "market_key" | "base_value_eok">): string {
  const v = Number(row.base_value_eok);
  if (isGlobal(row.market_key)) return `USD ${(Math.round(v * 10) / 10).toLocaleString("en-US")}억`;
  if (v < 1) return `${Math.round(v * 10000).toLocaleString("en-US")}만 원`;
  const rounded = Math.round(v);
  const jo = Math.floor(rounded / 10000);
  const rest = rounded % 10000;
  if (!jo) return `${rest.toLocaleString("en-US")}억 원`;
  return rest ? `${jo}조 ${rest.toLocaleString("en-US")}억 원` : `${jo}조 원`;
}

interface EditForm { source: string; source_url: string; base_year: string; base_value_eok: string; cagr: string }

export function MarketReferencePanel({ apiCall }: MarketReferencePanelProps) {
  const [filter, setFilter] = useState<MarketRefStatus | "all">("ai_pending");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<MarketRefRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>({ source: "", source_url: "", base_year: "", base_value_eok: "", cagr: "" });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  // 관리자 화면의 apiCall은 렌더마다 새로 만들어지므로 ref로 들고 있어 불필요한 재조회를 막는다.
  const apiRef = useRef(apiCall);
  apiRef.current = apiCall;

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await apiRef.current("list-market-refs", { page, status: filter === "all" ? undefined : filter, query: appliedQuery || undefined });
      if (result?.success) {
        setItems(result.items || []);
        setTotal(result.total || 0);
        setPageSize(result.pageSize || 30);
        setCounts(result.counts || {});
      } else {
        toast.error(result?.error || "시장 표준값을 불러오지 못했습니다.");
      }
    } catch {
      toast.error("시장 표준값을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [page, filter, appliedQuery]);

  useEffect(() => { void load(); }, [load]);

  const startEdit = (row: MarketRefRow) => {
    setEditingKey(row.market_key);
    setForm({
      source: row.source || "",
      source_url: row.source_url || "",
      base_year: String(row.base_year),
      base_value_eok: String(row.base_value_eok),
      cagr: String(row.cagr),
    });
  };

  const save = async (row: MarketRefRow, status: "approved" | "ai_pending", withForm: boolean) => {
    if (status === "approved" && withForm && !form.source.trim()) {
      toast.error("승인하려면 확인한 출처를 입력하세요.");
      return;
    }
    setSavingKey(row.market_key);
    try {
      const payload: Record<string, unknown> = { market_key: row.market_key, status };
      if (withForm) {
        payload.source = form.source;
        payload.source_url = form.source_url;
        payload.base_year = Number(form.base_year);
        payload.base_value_eok = Number(form.base_value_eok);
        payload.cagr = Number(form.cagr);
      }
      const result = await apiRef.current("update-market-ref", payload);
      if (result?.success) {
        toast.success(status === "approved" ? "승인했습니다." : "검증 전으로 되돌렸습니다.");
        setEditingKey(null);
        await load();
      } else {
        toast.error(result?.error || "저장하지 못했습니다.");
      }
    } catch {
      toast.error("저장하지 못했습니다.");
    } finally {
      setSavingKey(null);
    }
  };

  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-sm">시장 표준값 검토</h3>
        <p className="text-[10px] text-muted-foreground mt-1">
          요약서의 관련시장 동향 수치는 시장별로 고정됩니다. 공식 통계와 승인한 값만 출처와 함께 표시되고,
          검증 전 값은 요약서에 "(AI 추정치)"로 표시됩니다. 출처를 확인한 값만 승인하세요.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => { setFilter(f.value); setPage(0); }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              filter === f.value ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/30 text-muted-foreground border-border/50"
            }`}
          >
            {f.label}
            {f.value !== "all" && counts[f.value] != null ? ` ${counts[f.value]}` : ""}
          </button>
        ))}
        <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => void load()} disabled={isLoading} aria-label="새로고침">
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </Button>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); setPage(0); setAppliedQuery(query.trim()); }}
      >
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="시장명 검색 (예: 버섯)" className="h-8 text-xs" />
        <Button type="submit" variant="outline" size="sm" className="h-8">
          <Search className="w-3.5 h-3.5" />
        </Button>
      </form>

      <div className="space-y-2">
        {!isLoading && items.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">표시할 시장 표준값이 없습니다.</p>}
        {items.map((row) => {
          const meta = STATUS_META[row.status] ?? STATUS_META.ai_pending;
          const editing = editingKey === row.market_key;
          const busy = savingKey === row.market_key;
          return (
            <Card key={row.market_key} className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium break-keep">{row.label}</span>
                    <Badge variant="outline" className={`text-[10px] ${meta.className}`}>{meta.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {row.base_year}년 {formatValue(row)} · 연평균 {Number(row.cagr)}%
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 break-all">
                    출처: {row.source || "없음"}
                    {row.source_url ? (
                      <> · <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="underline">링크</a></>
                    ) : null}
                    {row.verified_at ? ` · 확인 ${new Date(row.verified_at).toLocaleDateString("ko-KR")}` : ""}
                  </p>
                </div>
                {row.status !== "official" && !editing && (
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => startEdit(row)}>
                      <Pencil className="w-3 h-3 mr-1" /> 검토
                    </Button>
                    {row.status === "approved" && (
                      <Button variant="ghost" size="sm" className="h-7 text-[11px]" disabled={busy} onClick={() => void save(row, "ai_pending", false)}>
                        <RotateCcw className="w-3 h-3 mr-1" /> 승인 취소
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {editing && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[10px] text-muted-foreground">
                      기준연도
                      <Input type="number" value={form.base_year} onChange={(e) => setForm((f) => ({ ...f, base_year: e.target.value }))} className="h-8 text-xs mt-0.5" />
                    </label>
                    <label className="text-[10px] text-muted-foreground">
                      {isGlobal(row.market_key) ? "기준값 (USD 억)" : "기준값 (억 원)"}
                      <Input type="number" step="any" value={form.base_value_eok} onChange={(e) => setForm((f) => ({ ...f, base_value_eok: e.target.value }))} className="h-8 text-xs mt-0.5" />
                    </label>
                    <label className="text-[10px] text-muted-foreground">
                      CAGR (%)
                      <Input type="number" step="any" value={form.cagr} onChange={(e) => setForm((f) => ({ ...f, cagr: e.target.value }))} className="h-8 text-xs mt-0.5" />
                    </label>
                  </div>
                  <Input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder="확인한 출처 (예: 농림축산식품부 「스마트농업 실태조사」 2024)" className="h-8 text-xs" />
                  <Input value={form.source_url} onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))} placeholder="출처 URL (https, 선택)" className="h-8 text-xs" />
                  <div className="flex gap-1.5 flex-wrap">
                    <Button size="sm" className="h-7 text-[11px]" disabled={busy} onClick={() => void save(row, "approved", true)}>
                      {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />} 출처 확인 · 승인
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy} onClick={() => void save(row, "ai_pending", true)}>
                      <Save className="w-3 h-3 mr-1" /> 검증 전으로 저장
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setEditingKey(null)}>
                      <X className="w-3 h-3 mr-1" /> 취소
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0 || isLoading} onClick={() => setPage((p) => Math.max(0, p - 1))} aria-label="이전 페이지">
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground">{page + 1} / {lastPage + 1}</span>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= lastPage || isLoading} onClick={() => setPage((p) => Math.min(lastPage, p + 1))} aria-label="다음 페이지">
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
