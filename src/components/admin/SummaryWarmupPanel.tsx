import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * 인기 특허 요약서 미리 만들기: 많이 찾는 특허의 원문·요약서·사업화 점수를 서버 캐시에 미리 만들어 두어,
 * 처음 여는 사람도 기다리지 않게 한다 (요약서 처음 생성은 30초 넘게 걸린다). 이미 있으면 그대로 두고 지나간다.
 * 사용자가 화면에서 여는 것과 같은 공개 함수(fetch-patent → summarize-patent → analyze-commercialization)를 차례로 부른다.
 */
type Row = { no: string; title: string; count: number; state: "wait" | "run" | "cached" | "made" | "fail"; ms?: number; err?: string };
const FN = (name: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
const HEADERS = { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` };
const post = (name: string, body: unknown, signal: AbortSignal) => fetch(FN(name), { method: "POST", headers: HEADERS, body: JSON.stringify(body), signal });

async function warmOne(no: string, signal: AbortSignal): Promise<"cached" | "made"> {
  const f = await post("fetch-patent", { patentNumber: no }, signal).then((r) => r.json()).catch(() => null);
  if (!f?.success || !f.data) throw new Error(f?.error || "특허 정보를 가져오지 못했습니다");
  const s = await post("summarize-patent", { patentNumber: no, patentData: f.data }, signal);
  if (!s.ok || !s.body) throw new Error(`요약서 생성 실패 (HTTP ${s.status})`);
  // 스트림을 끝까지 읽어야 서버가 요약서를 저장한다. 첫 메타에 cached:true 가 오면 이미 있던 것
  const reader = s.body.getReader(), dec = new TextDecoder();
  let head = "", cached = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (head.length < 4000) { head += dec.decode(value, { stream: true }); cached ||= /"cached"\s*:\s*true/.test(head); }
  }
  const a = await post("analyze-commercialization", { patentNumber: no, patentData: f.data, summaryContent: "", analysisMode: "detailed" }, signal).then((r) => r.json()).catch(() => null);
  if (!a?.success) throw new Error(a?.error || "사업화 점수를 만들지 못했습니다");
  return cached ? "cached" : "made";
}

export function SummaryWarmupPanel() {
  const [limit, setLimit] = useState(10);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [ctrl, setCtrl] = useState<AbortController | null>(null);

  const run = async () => {
    setBusy(true);
    const c = new AbortController(); setCtrl(c);
    const { data } = await supabase.from("patent_search_stats").select("patent_number, patent_title, search_count").order("search_count", { ascending: false }).limit(limit);
    const list: Row[] = (data ?? []).map((d) => ({ no: d.patent_number, title: d.patent_title || "", count: d.search_count, state: "wait" }));
    setRows(list);
    for (let i = 0; i < list.length && !c.signal.aborted; i++) {
      const t0 = Date.now();
      setRows((rs) => rs.map((r, k) => (k === i ? { ...r, state: "run" } : r)));
      try {
        const st = await warmOne(list[i].no, c.signal);
        setRows((rs) => rs.map((r, k) => (k === i ? { ...r, state: st, ms: Date.now() - t0 } : r)));
      } catch (e) {
        if (c.signal.aborted) break;
        setRows((rs) => rs.map((r, k) => (k === i ? { ...r, state: "fail", err: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 } : r)));
      }
    }
    setBusy(false); setCtrl(null);
  };

  const label: Record<Row["state"], string> = { wait: "대기", run: "만드는 중…", cached: "이미 있음", made: "새로 만듦", fail: "실패" };
  const done = rows.filter((r) => r.state === "cached" || r.state === "made").length;
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        많이 찾는 특허의 요약서와 사업화 점수를 미리 만들어 둡니다. 처음 여는 사람도 기다리지 않고 바로 봅니다. 이미 만들어진 것은 건너뛰고, 새로 만들 때는 AI 크레딧을 씁니다(1건에 30초~1분).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor="warm-limit">인기 순 상위</label>
        <select id="warm-limit" value={limit} disabled={busy} onChange={(e) => setLimit(Number(e.target.value))} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          {[5, 10, 20].map((n) => <option key={n} value={n}>{n}건</option>)}
        </select>
        {busy ? (
          <Button variant="outline" onClick={() => ctrl?.abort()}><Loader2 className="w-4 h-4 mr-1 animate-spin" />멈추기</Button>
        ) : (
          <Button onClick={run}><Flame className="w-4 h-4 mr-1" />미리 만들기</Button>
        )}
        {rows.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">{done} / {rows.length} 준비됨</span>}
      </div>
      {rows.length > 0 && (
        <ul className="divide-y rounded-md border text-xs">
          {rows.map((r) => (
            <li key={r.no} className="flex items-center gap-2 px-3 py-2">
              <span className="font-mono tabular-nums shrink-0">{r.no}</span>
              <span className="truncate flex-1" title={r.title}>{r.title}</span>
              <span className={`shrink-0 ${r.state === "fail" ? "text-destructive" : r.state === "made" ? "text-primary font-semibold" : "text-muted-foreground"}`} title={r.err}>
                {label[r.state]}{r.ms != null && r.state !== "run" ? ` · ${Math.round(r.ms / 1000)}초` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
