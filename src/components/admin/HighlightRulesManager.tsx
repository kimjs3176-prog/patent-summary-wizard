import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Trash2, Loader2, RefreshCw, Ban, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Rule {
  id: string;
  kind: "exclude" | "include";
  phrase: string;
  status: "pending" | "approved" | "rejected";
  patent_number: string | null;
  context: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface Props { adminPassword: string; }

const STATUS_TABS: { key: Rule["status"]; label: string }[] = [
  { key: "pending", label: "대기" },
  { key: "approved", label: "승인" },
  { key: "rejected", label: "반려" },
];

export function HighlightRulesManager({ adminPassword }: Props) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Rule["status"]>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-highlight-rules", {
        body: { action: "list", password: adminPassword },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "조회 실패");
      setRules(data.rules ?? []);
    } catch (e) {
      toast.error("규칙 목록 조회 실패: " + ((e as Error).message || ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const updateStatus = async (id: string, status: Rule["status"]) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-highlight-rules", {
        body: { action: "update-status", password: adminPassword, id, status },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "실패");
      toast.success(status === "approved" ? "승인됨" : status === "rejected" ? "반려됨" : "대기로 변경");
      await load();
    } catch (e) {
      toast.error("상태 변경 실패: " + ((e as Error).message || ""));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("이 제안을 삭제할까요?")) return;
    setBusyId(id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-highlight-rules", {
        body: { action: "delete", password: adminPassword, id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "실패");
      toast.success("삭제됨");
      await load();
    } catch (e) {
      toast.error("삭제 실패: " + ((e as Error).message || ""));
    } finally {
      setBusyId(null);
    }
  };

  const filtered = rules.filter((r) => r.status === tab);
  const counts = {
    pending: rules.filter((r) => r.status === "pending").length,
    approved: rules.filter((r) => r.status === "approved").length,
    rejected: rules.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold">하이라이트 규칙 제안</h2>
          <p className="text-xs text-muted-foreground mt-1">
            사용자가 분석서 본문에서 우클릭/드래그로 제안한 '강조 제외/추가' 문구를 검토합니다. 승인하면 즉시 모든 분석서에 반영됩니다.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          새로고침
        </Button>
      </div>

      <div className="flex gap-1 border-b">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs opacity-60">({counts[t.key]})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">해당 상태의 제안이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id} className="rounded-lg border bg-card p-3">
              <div className="flex items-start gap-3">
                <Badge variant={r.kind === "exclude" ? "destructive" : "default"} className="shrink-0">
                  {r.kind === "exclude" ? (
                    <><Ban className="w-3 h-3 mr-1" />제외</>
                  ) : (
                    <><Sparkles className="w-3 h-3 mr-1" />추가</>
                  )}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm break-words">{r.phrase}</p>
                  {r.context && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">…{r.context}…</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {r.patent_number ? `특허 ${r.patent_number} · ` : ""}
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {r.status !== "approved" && (
                    <Button
                      size="sm" variant="default"
                      disabled={busyId === r.id}
                      onClick={() => void updateStatus(r.id, "approved")}
                    >
                      <Check className="w-3 h-3 mr-1" />승인
                    </Button>
                  )}
                  {r.status !== "rejected" && (
                    <Button
                      size="sm" variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => void updateStatus(r.id, "rejected")}
                    >
                      <X className="w-3 h-3 mr-1" />반려
                    </Button>
                  )}
                  <Button
                    size="sm" variant="ghost"
                    disabled={busyId === r.id}
                    onClick={() => void remove(r.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}