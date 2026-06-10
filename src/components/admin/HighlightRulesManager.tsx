import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, X, Trash2, Loader2, RefreshCw, Ban, Sparkles, Plus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Rule {
  id: string;
  kind: "exclude" | "include";
  phrase: string;
  weight: number;
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
  const [newKind, setNewKind] = useState<"include" | "exclude">("include");
  const [newPhrase, setNewPhrase] = useState("");
  const [newWeight, setNewWeight] = useState<number>(2);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPhrase, setEditingPhrase] = useState("");
  const [filter, setFilter] = useState("");

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

  const invoke = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("manage-highlight-rules", {
      body: { ...payload, password: adminPassword },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "실패");
    return data;
  };

  const addRule = async () => {
    const phrase = newPhrase.trim();
    if (phrase.length < 2) { toast.error("문구는 2자 이상이어야 합니다"); return; }
    setAdding(true);
    try {
      await invoke({ action: "create", kind: newKind, phrase, weight: newWeight });
      toast.success("규칙이 추가되었습니다");
      setNewPhrase("");
      setTab("approved");
      await load();
    } catch (e) {
      toast.error("추가 실패: " + ((e as Error).message || ""));
    } finally { setAdding(false); }
  };

  const setWeight = async (id: string, weight: number) => {
    setBusyId(id);
    try {
      await invoke({ action: "update-weight", id, weight });
      setRules((rs) => rs.map((r) => r.id === id ? { ...r, weight } : r));
    } catch (e) {
      toast.error("강도 변경 실패: " + ((e as Error).message || ""));
    } finally { setBusyId(null); }
  };

  const savePhrase = async (id: string) => {
    const p = editingPhrase.trim();
    if (p.length < 2) { toast.error("문구는 2자 이상"); return; }
    setBusyId(id);
    try {
      await invoke({ action: "update-phrase", id, phrase: p });
      toast.success("문구가 수정되었습니다");
      setEditingId(null);
      await load();
    } catch (e) {
      toast.error("수정 실패: " + ((e as Error).message || ""));
    } finally { setBusyId(null); }
  };

  const updateStatus = async (id: string, status: Rule["status"]) => {
    setBusyId(id);
    try {
      await invoke({ action: "update-status", id, status });
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
      await invoke({ action: "delete", id });
      toast.success("삭제됨");
      await load();
    } catch (e) {
      toast.error("삭제 실패: " + ((e as Error).message || ""));
    } finally {
      setBusyId(null);
    }
  };

  const q = filter.trim().toLowerCase();
  const filtered = rules
    .filter((r) => r.status === tab)
    .filter((r) => !q || r.phrase.toLowerCase().includes(q) || (r.patent_number ?? "").toLowerCase().includes(q));
  const counts = {
    pending: rules.filter((r) => r.status === "pending").length,
    approved: rules.filter((r) => r.status === "approved").length,
    rejected: rules.filter((r) => r.status === "rejected").length,
  };

  const weightLabel = (w: number) => (w === 1 ? "약" : w === 3 ? "강" : "보통");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold">하이라이트 규칙 제안</h2>
          <p className="text-xs text-muted-foreground mt-1">
            사용자 제안을 검토하거나, 관리자가 직접 강조/제외 문구를 추가하고 강도를 조절할 수 있습니다. 승인된 규칙은 즉시 모든 분석서에 반영됩니다.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          새로고침
        </Button>
      </div>

      {/* 신규 규칙 추가 */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> 새 규칙 추가
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex rounded-md overflow-hidden border">
            {(["include", "exclude"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setNewKind(k)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  newKind === k ? (k === "include" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white") : "bg-background hover:bg-muted"
                }`}
              >
                {k === "include" ? "강조 추가" : "강조 제외"}
              </button>
            ))}
          </div>
          <Input
            value={newPhrase}
            onChange={(e) => setNewPhrase(e.target.value)}
            placeholder="문구 입력 (2~200자, 띄어쓰기는 유연하게 매칭)"
            className="flex-1 min-w-[200px] h-9 text-sm"
            maxLength={200}
            onKeyDown={(e) => { if (e.key === "Enter" && !adding) void addRule(); }}
          />
          {newKind === "include" && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">강도</span>
              <div className="flex rounded-md overflow-hidden border">
                {[1, 2, 3].map((w) => (
                  <button
                    key={w}
                    onClick={() => setNewWeight(w)}
                    className={`px-2.5 py-1.5 text-xs font-semibold ${
                      newWeight === w ? "bg-emerald-600 text-white" : "bg-background hover:bg-muted"
                    }`}
                  >{weightLabel(w)}</button>
                ))}
              </div>
            </div>
          )}
          <Button size="sm" onClick={() => void addRule()} disabled={adding || newPhrase.trim().length < 2}>
            {adding ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
            추가
          </Button>
        </div>
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

      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="문구/특허번호로 검색"
        className="h-9 text-sm"
      />

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
                  {editingId === r.id ? (
                    <div className="flex gap-1.5">
                      <Input
                        value={editingPhrase}
                        onChange={(e) => setEditingPhrase(e.target.value)}
                        className="h-8 text-sm"
                        maxLength={200}
                        autoFocus
                      />
                      <Button size="sm" disabled={busyId === r.id} onClick={() => void savePhrase(r.id)}>저장</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>취소</Button>
                    </div>
                  ) : (
                    <p className="font-semibold text-sm break-words flex items-center gap-1.5">
                      {r.phrase}
                      <button
                        onClick={() => { setEditingId(r.id); setEditingPhrase(r.phrase); }}
                        className="opacity-50 hover:opacity-100"
                        title="문구 수정"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </p>
                  )}
                  {r.context && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">…{r.context}…</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {r.patent_number ? `특허 ${r.patent_number} · ` : ""}
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </p>
                  {r.kind === "include" && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">강조 강도</span>
                      <div className="flex rounded-md overflow-hidden border">
                        {[1, 2, 3].map((w) => (
                          <button
                            key={w}
                            disabled={busyId === r.id || r.weight === w}
                            onClick={() => void setWeight(r.id, w)}
                            className={`px-2 py-0.5 text-[11px] font-semibold ${
                              r.weight === w ? "bg-emerald-600 text-white" : "bg-background hover:bg-muted"
                            }`}
                          >{weightLabel(w)}</button>
                        ))}
                      </div>
                    </div>
                  )}
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