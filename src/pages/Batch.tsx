import { useState, useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Layers, Download, ExternalLink, Loader2, AlertTriangle, CheckCircle2, FileText, X, Search, Hash, SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLayout } from "@/components/layout/PageLayout";
import { parseIpNumberList, IP_KIND_LABEL, IpNumberInfo } from "@/lib/ipNumber";
import { safeFetch } from "@/lib/safeFetch";
import { PatentData } from "@/components/PatentSummary/types";
import { usePatentSummary } from "@/hooks/usePatentSummary";
import { TossPatentSummary } from "@/components/PatentSummary/TossPatentSummary";

/* ------------------------------------------------------------------ */
/* 공통: 모드, 다운로드                                                 */
/* ------------------------------------------------------------------ */

type Mode = "numbers" | "criteria";

const MODES: { v: Mode; l: string; d: string; icon: typeof Hash }[] = [
  { v: "numbers", l: "번호로 조회", d: "출원·등록번호를 여러 건 붙여 넣어 한 번에 조회", icon: Hash },
  { v: "criteria", l: "조건으로 불러오기", d: "기관·기간·상태 등 조건으로 전체 목록을 불러오기", icon: SlidersHorizontal },
];

/** 엑셀·CSV 공통 열 — 두 모드 모두 같은 형식으로 내려받는다 */
interface ExportRow {
  번호: number | string;
  구분: string;
  출원번호: string;
  등록번호: string;
  발명의명칭: string;
  출원일: string;
  공개일: string;
  등록일: string;
  등록상태: string;
  검색기관: string;
  출원인: string;
  발명자: string;
  IPC: string;
  초록: string;
  요약서링크: string;
}

const EXPORT_COL_WIDTHS = [6, 12, 18, 14, 50, 11, 11, 11, 8, 16, 30, 24, 24, 60, 40];

const fileName = (ext: string) => `특허목록_${new Date().toISOString().slice(0, 10)}.${ext}`;

const summaryLink = (num: string) => `${window.location.origin}/?patent=${encodeURIComponent(num)}`;

function downloadXlsx(rows: ExportRow[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = EXPORT_COL_WIDTHS.map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "특허목록");
  XLSX.writeFile(wb, fileName("xlsx"));
}

function downloadCsv(rows: ExportRow[]) {
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows));
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName("csv");
  a.click();
  URL.revokeObjectURL(a.href);
}

/** 숫자만 있는 KIPRIS 번호를 10-2021-0162560 / 10-2456789 형태로 */
const dash = (n: string) => {
  const c = (n || "").replace(/\D/g, "");
  if (c.length === 13) return `${c.slice(0, 2)}-${c.slice(2, 6)}-${c.slice(6)}`;
  if (c.length >= 9) return `${c.slice(0, 2)}-${c.slice(2, 9)}`;
  return n;
};

/* ------------------------------------------------------------------ */
/* 번호로 조회                                                          */
/* ------------------------------------------------------------------ */

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

function batchRowsToExport(rows: BatchRow[]): ExportRow[] {
  return rows
    .filter((r) => r.data)
    .map((r, idx) => {
      const d = r.data as PatentData;
      return {
        번호: idx + 1,
        구분: r.kindLabel,
        출원번호: d.applicationNumber ? dash(d.applicationNumber) : (d.searchType === "application" ? r.number : ""),
        등록번호: d.registrationNumber ? dash(d.registrationNumber) : (d.searchType === "registration" ? r.number : ""),
        발명의명칭: d.titleKo || d.title || "",
        출원일: d.filingDate || "",
        공개일: d.publicationDate || "",
        등록일: d.registrationDate || "",
        등록상태: d.legalStatus || "",
        검색기관: "",
        출원인: d.assignee || "",
        발명자: (d.inventors || []).join(", "),
        IPC: (d.classifications || []).join(", "),
        초록: (d.abstract || "").replace(/\s+/g, " "),
        요약서링크: summaryLink(r.number),
      };
    });
}

/* ------------------------------------------------------------------ */
/* 조건으로 불러오기                                                    */
/* ------------------------------------------------------------------ */

const ORGS = ["농촌진흥청", "농림축산검역본부", "국립농산물품질관리원", "국립종자원"];
const STATUSES = [
  { v: "all", l: "전체" }, { v: "registered", l: "등록" }, { v: "published", l: "공개" },
  { v: "rejected", l: "거절" }, { v: "expired", l: "소멸" }, { v: "withdrawn", l: "취하" }, { v: "abandoned", l: "포기" },
];
const PAGE = 500;
const EXPORT_ENDPOINT = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/export-patents`;

interface Item {
  applicationNumber: string; registrationNumber: string; title: string; applicationDate: string;
  openDate: string; registerDate: string; status: string; applicant: string; ipc: string; abstract: string; inventors?: string;
  org?: string;
}

interface TmItem {
  applicationNumber: string; registrationNumber: string; title: string; applicationDate: string;
  registerDate: string; status: string; applicant: string; drawing: string; org?: string;
}

const IP_TYPES = [
  { v: "all", l: "전체(특허+실용신안)" },
  { v: "patent", l: "특허" },
  { v: "utility", l: "실용신안" },
  { v: "design", l: "디자인" },
  { v: "trademark", l: "상표" },
];

const SEG_MAX = [4, 2, 2];

/** YYYY-MM-DD segmented date input — 자릿수가 채워지면 다음 칸으로 커서가 자동 이동 */
function SegmentedDate({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const [seg, setSeg] = useState<[string, string, string]>(m ? [m[1], m[2], m[3]] : ["", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const setSegAt = (i: number, raw: string) => {
    let d = raw.replace(/\D/g, "").slice(0, SEG_MAX[i]);
    let advance = d.length === SEG_MAX[i];
    // 월 2~9 → "0x", 일 4~9 → "0x" 로 채우고 즉시 다음 칸으로
    if ((i === 1 || i === 2) && d.length === 1 && Number(d) >= (i === 1 ? 2 : 4)) {
      d = `0${d}`;
      advance = true;
    }
    // 13월, 32일 등 불가능한 값은 마지막 입력을 무시하고 다음 칸으로 넘어가지 않음
    if (d.length === SEG_MAX[i] && ((i === 1 && Number(d) > 12) || (i === 2 && Number(d) > 31))) {
      d = d.slice(0, -1);
      advance = false;
    }
    const next = [...seg];
    next[i] = d;
    setSeg(next as [string, string, string]);
    if (next.every((s, j) => s.length === SEG_MAX[j])) {
      onChange(`${next[0]}-${next[1]}-${next[2]}`);
    } else if (value !== "") {
      onChange("");
    }
    if (advance && i < 2) refs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && seg[i] === "" && i > 0) {
      e.preventDefault();
      const prev = [...seg];
      prev[i - 1] = prev[i - 1].slice(0, -1);
      setSeg(prev as [string, string, string]);
      if (value !== "") onChange("");
      refs.current[i - 1]?.focus();
    }
  };

  const cls = (w: string) => `${w} px-1 text-center tabular-nums`;
  return (
    <div className="flex items-center gap-1 min-w-0">
      <Input
        ref={(el) => (refs.current[0] = el)}
        inputMode="numeric" placeholder="YYYY" maxLength={4}
        className={cls("w-16 shrink-0")} value={seg[0]}
        onChange={(e) => setSegAt(0, e.target.value)} onKeyDown={(e) => onKey(0, e)}
      />
      <span className="text-muted-foreground">-</span>
      <Input
        ref={(el) => (refs.current[1] = el)}
        inputMode="numeric" placeholder="MM" maxLength={2}
        className={cls("w-11 shrink-0")} value={seg[1]}
        onChange={(e) => setSegAt(1, e.target.value)} onKeyDown={(e) => onKey(1, e)}
      />
      <span className="text-muted-foreground">-</span>
      <Input
        ref={(el) => (refs.current[2] = el)}
        inputMode="numeric" placeholder="DD" maxLength={2}
        className={cls("w-11 shrink-0")} value={seg[2]}
        onChange={(e) => setSegAt(2, e.target.value)} onKeyDown={(e) => onKey(2, e)}
      />
    </div>
  );
}

function criteriaToExport(items: Item[], trademarks: TmItem[], ipType: string): ExportRow[] {
  const patentRows: ExportRow[] = items.map((i, idx) => {
    const num = i.registrationNumber ? dash(i.registrationNumber) : dash(i.applicationNumber);
    return {
      번호: idx + 1,
      구분: IP_TYPES.find((t) => t.v === ipType)?.l ?? "특허/실용신안",
      출원번호: dash(i.applicationNumber),
      등록번호: i.registrationNumber ? dash(i.registrationNumber) : "",
      발명의명칭: i.title,
      출원일: i.applicationDate,
      공개일: i.openDate,
      등록일: i.registerDate,
      등록상태: i.status,
      검색기관: i.org ?? "",
      출원인: i.applicant.replace(/\|/g, ", "),
      발명자: i.inventors ?? "",
      IPC: i.ipc.replace(/\|/g, ", "),
      초록: i.abstract,
      요약서링크: summaryLink(num),
    };
  });
  const tmRows: ExportRow[] = trademarks.map((t) => ({
    번호: "",
    구분: "상표",
    출원번호: dash(t.applicationNumber),
    등록번호: t.registrationNumber ? dash(t.registrationNumber) : "",
    발명의명칭: t.title,
    출원일: t.applicationDate,
    공개일: "",
    등록일: t.registerDate,
    등록상태: t.status,
    검색기관: t.org ?? "",
    출원인: t.applicant,
    발명자: "",
    IPC: "",
    초록: "",
    요약서링크: "",
  }));
  return [...patentRows, ...tmRows];
}

const chip = (active: boolean, size: "sm" | "md" = "md") =>
  `${size === "sm" ? "px-2.5 py-1 rounded-lg text-xs" : "px-3 py-1.5 rounded-full text-sm"} border transition-colors ${
    active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/40"
  }`;

/* ------------------------------------------------------------------ */
/* 페이지                                                               */
/* ------------------------------------------------------------------ */

const Batch = () => {
  const [params, setParams] = useSearchParams();
  const presetNumbers = params.get("numbers");
  const [mode, setMode] = useState<Mode>(() =>
    params.get("mode") === "criteria" && !presetNumbers ? "criteria" : "numbers"
  );

  const switchMode = (next: Mode) => {
    setMode(next);
    const sp = new URLSearchParams(params);
    if (next === "criteria") sp.set("mode", "criteria");
    else sp.delete("mode");
    setParams(sp, { replace: true });
  };

  /* ---------- 번호로 조회 상태 ---------- */
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const {
    isLoading, summary, currentPatent, patentData, relatedPatents, generateSummary,
  } = usePatentSummary();

  const openSummary = (num: string) => {
    setSelected(num);
    if (num !== currentPatent) void generateSummary(num);
    setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const runNumbers = async (raw: string) => {
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
    setSelected(null);
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
    if (presetNumbers) {
      setInput(presetNumbers.replace(/,/g, "\n"));
      void runNumbers(presetNumbers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => ({
    total: rows.length,
    done: rows.filter((r) => r.status === "done").length,
    error: rows.filter((r) => r.status === "error").length,
  }), [rows]);

  /* ---------- 조건으로 불러오기 상태 ---------- */
  const [orgs, setOrgs] = useState<string[]>(["농촌진흥청"]);
  const [ipType, setIpType] = useState("all");
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
    const res = await safeFetch(EXPORT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ org, from, to, inventor, status, pageNo, numOfRows: PAGE, trademarkKeyword: ipType === "design" || ipType === "trademark" ? tmKeyword : undefined, withInventors: true, ipType }),
      timeoutMs: 45000, retries: 2,
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "조회 실패");
    return data as { totalCount: number; items: Item[]; trademarks?: TmItem[] };
  };

  const runCriteria = async () => {
    if (orgs.length === 0) return toast.error("기관을 하나 이상 선택해 주세요.");
    if (from && to && from > to) return toast.error("기간을 확인해 주세요.");
    if ((ipType === "design" || ipType === "trademark") && !tmKeyword.trim()) {
      return toast.error(ipType === "design" ? "디자인 물품명을 입력해 주세요." : "상표명을 입력해 주세요.");
    }
    cancel.current = false;
    setRunning(true);
    setItems([]);
    setTrademarks([]);
    const all: Item[] = [];
    const tms: TmItem[] = [];
    try {
      const firsts = [];
      for (const org of orgs) {
        const f = { org, ...(await fetchPage(org, 1)) };
        firsts.push(f);
        if (Array.isArray(f.trademarks)) tms.push(...f.trademarks.map((t) => ({ ...t, org: f.org })));
      }
      setTrademarks(tms);
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
      toast.success(`특허 ${uniq.length.toLocaleString()}건${tms.length > 0 ? `, 상표 ${tms.length.toLocaleString()}건` : ""}을 불러왔습니다.`);
    } catch (e) {
      setItems(all);
      toast.error(e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.");
    } finally {
      setRunning(false);
    }
  };

  /* ---------- 공통 다운로드 ---------- */
  const exportRows = (): ExportRow[] =>
    mode === "numbers" ? batchRowsToExport(rows) : criteriaToExport(items, trademarks, ipType);
  const busy = mode === "numbers" ? isRunning : running;
  const canDownload = !busy && (mode === "numbers" ? stats.done > 0 : items.length > 0 || trademarks.length > 0);
  const downloadCount = mode === "numbers" ? stats.done : items.length + trademarks.length;

  const downloadButtons = (
    <>
      <Button variant="outline" className="rounded-xl gap-2" onClick={() => downloadXlsx(exportRows())} disabled={!canDownload} title={canDownload ? `${downloadCount.toLocaleString()}건 저장` : undefined}>
        <Download className="w-4 h-4" /> 엑셀 받기
      </Button>
      <Button variant="outline" className="rounded-xl gap-2" onClick={() => downloadCsv(exportRows())} disabled={!canDownload} title={canDownload ? `${downloadCount.toLocaleString()}건 저장` : undefined}>
        <Download className="w-4 h-4" /> CSV 받기
      </Button>
    </>
  );

  const wide = mode === "numbers" && selected;

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
      <div className={`${wide ? "max-w-[1500px]" : "max-w-6xl"} mx-auto px-4 py-8 space-y-6 transition-all`}>
        <header className="space-y-2">
          <div className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">§ Batch Lookup &amp; Export</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" /> 일괄조회·목록 다운로드
          </h1>
          <p className="text-sm text-muted-foreground">
            특허번호를 여러 건 붙여 넣거나 기관·기간 같은 조건을 정해 목록을 한 번에 불러오고, 엑셀 또는 CSV로 내려받습니다. (출처: KIPRIS)
          </p>
        </header>

        {/* 모드 전환 */}
        <div className="grid gap-2 sm:grid-cols-2" role="tablist" aria-label="조회 방식">
          {MODES.map((m) => {
            const active = mode === m.v;
            const Icon = m.icon;
            return (
              <button
                key={m.v}
                role="tab"
                aria-selected={active}
                onClick={() => switchMode(m.v)}
                className={`text-left rounded-2xl border p-4 transition-colors ${
                  active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Icon className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground"}`} /> {m.l}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{m.d}</div>
              </button>
            );
          })}
        </div>

        {/* ---------- 번호로 조회 ---------- */}
        {mode === "numbers" && (
          <>
            <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={5}
                spellCheck={false}
                placeholder={"10-2021-0162560\n20-2019-0003962\n10-2456789"}
                className="w-full resize-y rounded-xl border border-border/50 bg-background p-3 text-sm font-mono outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
              <p className="text-xs text-muted-foreground">줄바꿈 또는 쉼표로 구분해 입력합니다. (최대 {MAX_ITEMS}건)</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => runNumbers(input)} disabled={isRunning || !input.trim()} className="rounded-xl gap-2">
                  {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                  {isRunning ? "조회 중" : "일괄조회"}
                </Button>
                {rows.length > 0 && (
                  <>
                    {downloadButtons}
                    <span className="text-xs text-muted-foreground ml-auto">
                      총 {stats.total}건 · 완료 {stats.done}건{stats.error > 0 ? ` · 실패 ${stats.error}건` : ""}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className={selected ? "flex flex-col lg:flex-row gap-5 items-start" : ""}>
              <div className={selected ? "space-y-3 w-full lg:w-[340px] shrink-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1" : "space-y-3"}>
                {rows.map((row, i) => {
                  const isActive = selected === row.number;
                  return (
                    <article
                      key={row.key}
                      className={`rounded-2xl border bg-card p-4 transition-colors ${isActive ? "border-primary/60 ring-1 ring-primary/20" : "border-border/50"}`}
                    >
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
                                    {!selected && row.data.registrationDate && <span>등록일 {row.data.registrationDate}</span>}
                                    {!selected && row.data.classifications?.[0] && <span>IPC {row.data.classifications[0]}</span>}
                                  </div>
                                  {!selected && (
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                      {firstSentences(row.data.abstract)}
                                    </p>
                                  )}
                                </>
                              )}
                            </>
                          )}

                          {row.status === "done" && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <Button
                                size="sm"
                                variant={isActive ? "default" : "outline"}
                                className="rounded-xl gap-1.5 h-8 text-xs"
                                onClick={() => openSummary(row.number)}
                              >
                                <FileText className="w-3.5 h-3.5" /> AI 요약서
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-xl gap-1.5 h-8 text-xs text-muted-foreground"
                                onClick={() => window.open(`/?patent=${encodeURIComponent(row.number)}`, "_blank")}
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> 새 창
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {selected && (
                <div ref={summaryRef} className="min-w-0 flex-1 w-full">
                  <div className="rounded-2xl border border-border/50 bg-card p-4 md:p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">§ AI Summary</div>
                        <div className="font-mono text-xs text-muted-foreground truncate">{selected}</div>
                      </div>
                      <Button size="sm" variant="ghost" className="rounded-full h-8 px-2" onClick={() => setSelected(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    {isLoading && !summary ? (
                      <div className="py-16 flex flex-col items-center gap-3 text-sm text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        AI 요약서를 생성하는 중입니다…
                      </div>
                    ) : (
                      <TossPatentSummary
                        content={summary}
                        patentNumber={currentPatent}
                        isStreaming={isLoading}
                        patentData={patentData}
                        relatedPatents={relatedPatents}
                        onRelatedPatentClick={(num: string) => openSummary(num)}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ---------- 조건으로 불러오기 ---------- */}
        {mode === "criteria" && (
          <>
            <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-5">
              <div className="space-y-2">
                <div className="text-sm font-semibold">발명기관</div>
                <div className="flex flex-wrap gap-2">
                  {ORGS.map((o) => (
                    <button key={o} onClick={() => toggleOrg(o)} className={chip(orgs.includes(o))}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">권리 종류</div>
                <div className="flex flex-wrap gap-2">
                  {IP_TYPES.map((t) => (
                    <button key={t.v} onClick={() => setIpType(t.v)} className={chip(ipType === t.v)}>
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2 min-w-0">
                  <div className="text-sm font-semibold">출원 기간</div>
                  <div className="flex items-center gap-2">
                    <SegmentedDate value={from} onChange={setFrom} />
                    <span className="text-muted-foreground shrink-0">~</span>
                    <SegmentedDate value={to} onChange={setTo} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold">발명자</div>
                  <Input value={inventor} onChange={(e) => setInventor(e.target.value)} placeholder="예: 홍길동 (비우면 전체)" maxLength={50} />
                </div>
                {(ipType === "design" || ipType === "trademark") && (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">{ipType === "design" ? "디자인 물품명 (필수)" : "상표명 (필수)"}</div>
                    <Input
                      value={tmKeyword}
                      onChange={(e) => setTmKeyword(e.target.value)}
                      placeholder={ipType === "design" ? "예: 포장용기" : "예: 설향"}
                      maxLength={50}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <div className="text-sm font-semibold">등록상태</div>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map((s) => (
                      <button key={s.v} onClick={() => setStatus(s.v)} className={chip(status === s.v, "sm")}>
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
                  <Button onClick={runCriteria} className="rounded-xl gap-2">
                    <Search className="w-4 h-4" /> 목록 불러오기
                  </Button>
                )}
                {downloadButtons}
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
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default Batch;
