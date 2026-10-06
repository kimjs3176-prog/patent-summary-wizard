import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, FileSpreadsheet, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLayout } from "@/components/layout/PageLayout";
import { safeFetch } from "@/lib/safeFetch";

const ORGS = ["농촌진흥청", "농림축산검역본부", "국립농산물품질관리원", "국립종자원"];
const STATUSES = [
  { v: "all", l: "전체" }, { v: "registered", l: "등록" }, { v: "published", l: "공개" },
  { v: "rejected", l: "거절" }, { v: "expired", l: "소멸" }, { v: "withdrawn", l: "취하" }, { v: "abandoned", l: "포기" },
];
const PAGE = 500;
const ENDPOINT = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/export-patents`;

interface Item {
  applicationNumber: string; registrationNumber: string; title: string; applicationDate: string;
  openDate: string; registerDate: string; status: string; applicant: string; ipc: string; abstract: string;
  org?: string;
}

interface TmItem {
  applicationNumber: string; registrationNumber: string; title: string; applicationDate: string;
  registerDate: string; status: string; applicant: string; drawing: string; org?: string;
}

const dash = (n: string) => {
  const c = (n || "").replace(/\D/g, "");
  if (c.length === 13) return `${c.slice(0, 2)}-${c.slice(2, 6)}-${c.slice(6)}`;
  if (c.length >= 9) return `${c.slice(0, 2)}-${c.slice(2, 9)}`;
  return n;
};

export default function PatentExport() {
  const [orgs, setOrgs] = useState<string[]>(["농촌진흥청"]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [inventor, setInventor] = useState("");
  const [status, setStatus] = useState("all");
  const [items, setItems] = useState<Item[]>([]);
  const [tmKeyword, setTmKeyword] = useState("");
  const [trademarks, setTrademarks] = useState<TmItem[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);
  const cancel = useRef(false);

  const toggleOrg = (o: string) => setOrgs((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));

  const fetchPage = async (org: string, pageNo: number) => {
    const res = await safeFetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ org, from, to, inventor, status, pageNo, numOfRows: PAGE }),
      timeoutMs: 45000, retries: 2,
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "조회 실패");
    return data as { totalCount: number; items: Item[] };
  };

  const run = async () => {
    if (orgs.length === 0) return toast.error("기관을 하나 이상 선택해 주세요.");
    if (from && to && from > to) return toast.error("기간을 확인해 주세요.");
    cancel.current = false;
    setRunning(true);
    setItems([]);
    const all: Item[] = [];
    try {
      const firsts = [];
      for (const org of orgs) firsts.push({ org, ...(await fetchPage(org, 1)) });
      const total = firsts.reduce((s, f) => s + f.totalCount, 0);
      for (const f of firsts) {
        all.push(...f.items.map((i) => ({ ...i, org: f.org })));
        setProgress({ done: all.length, total });
        const pages = Math.ceil(f.totalCount / PAGE);
        for (let p = 2; p <= pages; p++) {
          if (cancel.current) break;
          const r = await fetchPage(f.org, p);
          all.push(...r.items.map((i) => ({ ...i, org: f.org })));
          setProgress({ done: all.length, total });
          setItems([...all]);
        }
        if (cancel.current) break;
      }
      const seen = new Set<string>();
      const uniq = all.filter((i) => (seen.has(i.applicationNumber) ? false : (seen.add(i.applicationNumber), true)));
      setItems(uniq);
      toast.success(`${uniq.length.toLocaleString()}건을 불러왔습니다.`);
    } catch (e) {
      setItems(all);
      toast.error(e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.");
    } finally {
      setRunning(false);
    }
  };

  const toRows = () =>
    items.map((i, idx) => {
      const num = i.registrationNumber ? dash(i.registrationNumber) : dash(i.applicationNumber);
      return {
        번호: idx + 1,
        출원번호: dash(i.applicationNumber),
        등록번호: i.registrationNumber ? dash(i.registrationNumber) : "",
        발명의명칭: i.title,
        출원일: i.applicationDate,
        공개일: i.openDate,
        등록일: i.registerDate,
        등록상태: i.status,
        검색기관: i.org ?? "",
        출원인: i.applicant.replace(/\|/g, ", "),
        ...(inventor ? { "발명자(검색조건)": inventor } : {}),
        IPC: i.ipc.replace(/\|/g, ", "),
        초록: i.abstract,
        요약서링크: `${window.location.origin}/?patent=${encodeURIComponent(num)}`,
      };
    });

  const fileName = (ext: string) => `특허목록_${new Date().toISOString().slice(0, 10)}.${ext}`;

  const downloadXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(toRows());
    ws["!cols"] = [6, 18, 14, 50, 11, 11, 11, 8, 16, 30, ...(inventor ? [12] : []), 24, 60, 40].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "특허목록");
    XLSX.writeFile(wb, fileName("xlsx"));
  };

  const downloadCsv = () => {
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(toRows()));
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName("csv");
    a.click();
    URL.revokeObjectURL(a.href);
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
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-2">
          <div className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">§ Patent List Export</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-primary" /> 특허 목록 다운로드
          </h1>
          <p className="text-sm text-muted-foreground">
            조건을 정해 특허·실용신안 목록을 한 번에 불러오고 엑셀 또는 CSV로 내려받습니다. (출처: KIPRIS)
          </p>
        </header>

        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-5">
          <div className="space-y-2">
            <div className="text-sm font-semibold">발명기관</div>
            <div className="flex flex-wrap gap-2">
              {ORGS.map((o) => (
                <button
                  key={o}
                  onClick={() => toggleOrg(o)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    orgs.includes(o) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/40"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-sm font-semibold">출원 기간</div>
              <div className="flex items-center gap-2">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                <span className="text-muted-foreground">~</span>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">발명자</div>
              <Input value={inventor} onChange={(e) => setInventor(e.target.value)} placeholder="예: 홍길동 (비우면 전체)" maxLength={50} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">등록상태</div>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s.v}
                    onClick={() => setStatus(s.v)}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                      status === s.v ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/40"
                    }`}
                  >
                    {s.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {running ? (
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => (cancel.current = true)}>
                <X className="w-4 h-4" /> 중지
              </Button>
            ) : (
              <Button onClick={run} className="rounded-xl gap-2">
                <Search className="w-4 h-4" /> 목록 불러오기
              </Button>
            )}
            <Button variant="outline" className="rounded-xl gap-2" onClick={downloadXlsx} disabled={running || items.length === 0}>
              <Download className="w-4 h-4" /> 엑셀 받기
            </Button>
            <Button variant="outline" className="rounded-xl gap-2" onClick={downloadCsv} disabled={running || items.length === 0}>
              <Download className="w-4 h-4" /> CSV 받기
            </Button>
            {progress && (
              <span className="text-sm text-muted-foreground flex items-center gap-2 ml-auto">
                {running && <Loader2 className="w-4 h-4 animate-spin" />}
                {progress.done.toLocaleString()} / {progress.total.toLocaleString()}건
              </span>
            )}
          </div>
          {progress && progress.total > 0 && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, (progress.done / progress.total) * 100)}%` }} />
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="px-4 py-3 text-sm text-muted-foreground border-b border-border/50">
              미리보기 (상위 100건 / 전체 {items.length.toLocaleString()}건)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 whitespace-nowrap">출원번호</th>
                    <th className="px-3 py-2">발명의 명칭</th>
                    <th className="px-3 py-2 whitespace-nowrap">출원일</th>
                    <th className="px-3 py-2 whitespace-nowrap">상태</th>
                    <th className="px-3 py-2 whitespace-nowrap">기관</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 100).map((i) => (
                    <tr key={i.applicationNumber} className="border-t border-border/40">
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{dash(i.applicationNumber)}</td>
                      <td className="px-3 py-2">
                        <Link to={`/?patent=${encodeURIComponent(dash(i.registrationNumber || i.applicationNumber))}`} className="hover:text-primary">
                          {i.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{i.applicationDate}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{i.status}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{i.org}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
