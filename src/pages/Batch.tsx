import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Layers, Download, ExternalLink, Loader2, AlertTriangle, CheckCircle2, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { parseIpNumberList, IP_KIND_LABEL, IpNumberInfo } from "@/lib/ipNumber";
import { safeFetch } from "@/lib/safeFetch";
import { PatentData } from "@/components/PatentSummary/types";
import { usePatentSummary } from "@/hooks/usePatentSummary";
import { TossPatentSummary } from "@/components/PatentSummary/TossPatentSummary";

const MAX_ITEMS = 20;
const CONCURRENCY = 1; // API 부하 방지: 순차 처리
const REQUEST_GAP_MS = 700; // 요청 간 최소 간격
const CACHE_TTL_MS = 1000 * 60 * 30; // 30분 세션 캐시
const CACHE_PREFIX = "batch-patent:";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readCache(num: string): PatentData | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + num);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; d: PatentData };
    if (Date.now() - parsed.t > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_PREFIX + num);
      return null;
    }
    return parsed.d;
  } catch {
    return null;
  }
}

function writeCache(num: string, data: PatentData) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + num, JSON.stringify({ t: Date.now(), d: data }));
  } catch {
    /* 저장 실패는 무시 */
  }
}

type RowStatus = "pending" | "loading" | "done" | "error";

interface BatchRow {
  key: string;
  number: string;
  kindLabel: string;
  status: RowStatus;
  data?: PatentData;
  error?: string;
}

async function fetchPatent(patentNumber: string): Promise<PatentData> {
  const cached = readCache(patentNumber);
  if (cached) return cached;
  const res = await safeFetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-patent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ patentNumber }),
      timeoutMs: 45000,
      retries: 0,
    }
  );
  const json = await res.json().catch(() => ({ success: false, error: "응답 형식 오류" }));
  if (!json.success || !json.data) throw new Error(json.error || "특허 정보를 찾을 수 없습니다.");
  const data = json.data as PatentData;
  writeCache(patentNumber, data);
  return data;
}

function firstSentences(text: string | undefined, count = 2): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  const parts = clean.split(/(?<=[.。])\s+/).slice(0, count).join(" ");
  return parts.length > 240 ? `${parts.slice(0, 240)}…` : parts;
}

const Batch = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const run = async (raw: string) => {
    if (isRunning) {
      toast.info("이미 조회가 진행 중입니다.");
      return;
    }
    const { supported, unsupported, invalid } = parseIpNumberList(raw);
    if (unsupported.length > 0) {
      toast.warning(`${unsupported.map((u) => IP_KIND_LABEL[u.kind]).join("·")} 번호는 지원하지 않아 제외했습니다.`);
    }
    if (invalid.length > 0) {
      toast.warning(`번호 형식이 아닌 항목 ${invalid.length}건을 제외했습니다.`);
    }
    if (supported.length === 0) {
      toast.error("조회 가능한 특허·실용신안 번호가 없습니다.");
      return;
    }
    // 중복 번호 제거 (동일 번호 반복 호출 방지)
    const seen = new Set<string>();
    let list: IpNumberInfo[] = supported.filter((ip) => {
      if (seen.has(ip.digits)) return false;
      seen.add(ip.digits);
      return true;
    });
    if (list.length < supported.length) {
      toast.info(`중복된 번호 ${supported.length - list.length}건을 제외했습니다.`);
    }
    if (list.length > MAX_ITEMS) {
      toast.info(`한 번에 최대 ${MAX_ITEMS}건까지 조회합니다.`);
      list = list.slice(0, MAX_ITEMS);
    }

    const initial: BatchRow[] = list.map((ip) => ({
      key: ip.digits,
      number: ip.normalized,
      kindLabel: IP_KIND_LABEL[ip.kind],
      status: "pending",
    }));
    setRows(initial);
    setIsRunning(true);

    let cursor = 0;
    const worker = async () => {
      while (cursor < list.length) {
        const idx = cursor++;
        const ip = list[idx];
        if (idx > 0) await sleep(REQUEST_GAP_MS);
        setRows((prev) => prev.map((r) => (r.key === ip.digits ? { ...r, status: "loading" } : r)));
        try {
          const data = await fetchPatent(ip.normalized);
          setRows((prev) => prev.map((r) => (r.key === ip.digits ? { ...r, status: "done", data } : r)));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "조회 실패";
          setRows((prev) => prev.map((r) => (r.key === ip.digits ? { ...r, status: "error", error: msg } : r)));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));
    setIsRunning(false);
  };

  // ?numbers= 로 진입 시 자동 실행
  useEffect(() => {
    const preset = params.get("numbers");
    if (preset) {
      setInput(preset.replace(/,/g, "\n"));
      void run(preset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => ({
    total: rows.length,
    done: rows.filter((r) => r.status === "done").length,
    error: rows.filter((r) => r.status === "error").length,
  }), [rows]);

  const exportCsv = () => {
    const header = ["출원·등록번호", "명칭", "출원인", "출원일", "등록일", "IPC", "초록"];
    const lines = rows.filter((r) => r.data).map((r) => {
      const d = r.data as PatentData;
      return [
        r.number,
        d.titleKo || d.title || "",
        d.assignee || "",
        d.filingDate || "",
        d.registrationDate || "",
        (d.classifications || []).join(" "),
        (d.abstract || "").replace(/\s+/g, " "),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = "\uFEFF" + [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `AIS_일괄조회_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageLayout
      headerRight={
        <Link to="/">
          <Button variant="outline" size="sm" className="rounded-full text-xs h-8 px-3 gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> 홈으로
          </Button>
        </Link>
      }
    >
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-2">
          <div className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">§ Batch Lookup</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" /> 일괄조회
          </h1>
          <p className="text-sm text-muted-foreground">
            여러 출원·등록번호를 줄바꿈 또는 쉼표로 구분해 입력하면 목록으로 한 번에 정리해 드립니다. (최대 {MAX_ITEMS}건)
          </p>
        </header>

        <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
            spellCheck={false}
            placeholder={"10-2021-0162560\n20-2019-0003962\n10-2456789"}
            className="w-full resize-y rounded-xl border border-border/50 bg-background p-3 text-sm font-mono outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => run(input)} disabled={isRunning || !input.trim()} className="rounded-xl gap-2">
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              {isRunning ? "조회 중" : "일괄조회"}
            </Button>
            {rows.length > 0 && (
              <>
                <Button variant="outline" className="rounded-xl gap-2" onClick={exportCsv} disabled={stats.done === 0}>
                  <Download className="w-4 h-4" /> CSV 저장
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                  총 {stats.total}건 · 완료 {stats.done}건{stats.error > 0 ? ` · 실패 ${stats.error}건` : ""}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {rows.map((row, i) => (
            <article key={row.key} className="rounded-2xl border border-border/50 bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="font-mono text-[11px] text-muted-foreground pt-1 w-8 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-primary">{row.number}</span>
                    <span className="text-[10px] rounded-full border border-border/60 px-2 py-0.5 text-muted-foreground">
                      {row.kindLabel}
                    </span>
                    {row.status === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                    {row.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                    {row.status === "error" && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                  </div>

                  {row.status === "error" && (
                    <p className="text-sm text-destructive">{row.error}</p>
                  )}
                  {row.status !== "error" && (
                    <>
                      <h2 className="text-[15px] font-semibold leading-snug">
                        {row.data?.titleKo || row.data?.title || (row.status === "done" ? "명칭 없음" : "조회 중…")}
                      </h2>
                      {row.data && (
                        <>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                            {row.data.assignee && <span>출원인 {row.data.assignee}</span>}
                            {row.data.filingDate && <span>출원일 {row.data.filingDate}</span>}
                            {row.data.registrationDate && <span>등록일 {row.data.registrationDate}</span>}
                            {row.data.classifications?.[0] && <span>IPC {row.data.classifications[0]}</span>}
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {firstSentences(row.data.abstract)}
                          </p>
                        </>
                      )}
                    </>
                  )}
                </div>

                {row.status === "done" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5 shrink-0"
                    onClick={() => navigate(`/?patent=${encodeURIComponent(row.number)}`)}
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> AI 요약서
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </PageLayout>
  );
};

export default Batch;
