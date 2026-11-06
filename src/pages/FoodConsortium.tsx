import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Handshake, Loader2, Search } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FavoriteToggle } from "@/components/search/FavoriteToggle";
import { useCardFavorites } from "@/components/search/useCardFavorites";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  CONSORTIUM_ORGS,
  consortiumInitial,
  consortiumKind,
  consortiumShortName,
  sortedConsortiumOrgs,
  type ConsortiumKind,
  type ConsortiumPatent,
  type ConsortiumResult,
} from "@/lib/consortium";

const KIND_TABS: ["all" | ConsortiumKind, string][] = [["all", "전체"], ["univ", "대학"], ["inst", "연구기관"], ["holding", "기술지주"]];
const KIND_TAG: Record<ConsortiumKind, string> = { univ: "대학", inst: "연구기관", holding: "기술지주" };

const statusClass = (s: string) =>
  /등록/.test(s) ? "bg-primary/12 text-primary border-primary/25" : "bg-muted text-muted-foreground border-border";

/**
 * 식품기술이전 협의체: 기관을 고르면 그 기관이 가진 특허를 보여 준다.
 * 서버(consortium-patents)가 출원인명으로 특허고객번호를 찾아 그 번호로만 목록을 받으므로,
 * 이름이 비슷한 다른 기관의 특허는 섞이지 않는다. 고른 기관은 ?org= 로 주소에 남는다.
 */
const FoodConsortium = () => {
  useDocumentTitle("식품기술이전 협의체");
  const navigate = useNavigate();
  const favorites = useCardFavorites();
  const [params, setParams] = useSearchParams();
  const org = CONSORTIUM_ORGS.includes(params.get("org") ?? "") ? (params.get("org") as string) : "";
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | ConsortiumKind>("all");
  const [result, setResult] = useState<ConsortiumResult | null>(null);
  const [items, setItems] = useState<ConsortiumPatent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);
  const resultsRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // 주소(?org=)로 들어왔을 때 고른 기관이 목록 안에서 보이도록 목록만 스크롤한다 (페이지는 그대로)
  useEffect(() => {
    const box = listRef.current, on = box?.querySelector<HTMLElement>("button[aria-pressed='true']");
    if (box && on) box.scrollTop = on.offsetTop - box.clientHeight / 2 + on.offsetHeight / 2;
  }, [org]);

  // 가나다순으로 놓고 초성(ㄱ·ㄴ…)으로 묶는다
  const groups = useMemo(() => {
    const q = query.replace(/\s/g, "");
    const shown = sortedConsortiumOrgs().filter((n) => (kind === "all" || consortiumKind(n) === kind) && (!q || n.replace(/\s/g, "").includes(q)));
    const out: { initial: string; names: string[] }[] = [];
    for (const n of shown) {
      const i = consortiumInitial(n);
      if (out.at(-1)?.initial === i) out.at(-1)!.names.push(n);
      else out.push({ initial: i, names: [n] });
    }
    return out;
  }, [query, kind]);

  const load = useCallback(async (name: string, page: number) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase.functions.invoke("consortium-patents", { body: { org: name, page } });
      if (requestId !== requestIdRef.current) return;
      if (err || !data?.success) throw new Error(data?.error || "특허 목록을 불러오지 못했습니다.");
      const r = data as ConsortiumResult;
      setResult(r);
      setItems((prev) => (page === 1 ? r.items : [...prev, ...r.items.filter((x) => !prev.some((p) => p.applicationNumber === x.applicationNumber))]));
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : "특허 목록을 불러오지 못했습니다.");
      if (page === 1) setItems([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setResult(null);
    setItems([]);
    setError("");
    setLoading(false);
    if (org) void load(org, 1);
    // Invalidate first-page and pagination requests on selection change or unmount.
    return () => { requestIdRef.current += 1; };
  }, [org, load]);

  const pick = (name: string) => {
    setParams(name === org ? {} : { org: name }, { replace: true });
    // 휴대폰에서는 기관 목록이 길어 결과가 화면 밖에 생기므로 결과 머리로 데려간다
    if (name !== org && window.innerWidth < 1024) requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <PageLayout>
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 md:py-10">
        <div className="max-w-6xl mx-auto">
          <header className="mb-6 md:mb-8">
            <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-black tracking-tight">
              <Handshake className="w-6 h-6 md:w-7 md:h-7 text-primary shrink-0" aria-hidden="true" />
              식품기술이전 협의체
            </h1>
            <p className="mt-2 text-[13px] md:text-sm text-muted-foreground leading-relaxed max-w-2xl">
              협의체 {CONSORTIUM_ORGS.length}개 기관이 가진 특허를 기관별로 봅니다. 기관마다 특허고객번호로 찾아, 이름이 비슷한 다른 기관의 특허는 섞이지 않습니다.
            </p>
          </header>

          <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
          {/* 왼쪽: 기관 고르기 (가나다순·초성 묶음). 큰 화면에서는 따라 내려오고 목록만 스크롤된다 */}
          <section aria-label="기관 고르기" className="rounded-2xl border border-border/50 bg-card lg:sticky lg:top-20 flex flex-col overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="p-3 border-b border-border/50 grid gap-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="기관 이름 찾기 (예: 전북대)" aria-label="기관 이름 찾기" className="pl-9 h-9" />
              </div>
              <div role="radiogroup" aria-label="기관 종류" className="grid grid-cols-4 gap-1 rounded-lg bg-muted/60 p-1">
                {KIND_TABS.map(([k, label]) => {
                  const n = k === "all" ? CONSORTIUM_ORGS.length : CONSORTIUM_ORGS.filter((x) => consortiumKind(x) === k).length;
                  return (
                    <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                      className={`rounded-md px-1 py-1.5 text-[12px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${kind === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                      {label}<span className="block text-[11px] font-normal tabular-nums opacity-80">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div ref={listRef} className="relative max-h-[52vh] lg:max-h-[calc(100vh-15rem)] overflow-y-auto overscroll-contain p-1.5">
              {groups.map((g) => (
                <div key={g.initial} className="mb-1 last:mb-0">
                  <h2 className="sticky top-0 z-[1] bg-card/95 px-2.5 pt-2 pb-1 text-[11px] font-bold text-primary">{g.initial}</h2>
                  <ul>
                    {g.names.map((n) => {
                      const on = n === org;
                      return (
                        <li key={n}>
                          <button type="button" aria-pressed={on} title={n} onClick={() => pick(n)}
                            className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "bg-primary text-primary-foreground font-semibold" : "text-foreground/85 hover:bg-muted/60"}`}>
                            <span className="min-w-0 truncate">{consortiumShortName(n)}</span>
                            {kind === "all" && consortiumKind(n) !== "univ" && (
                              <span className={`shrink-0 text-[11px] ${on ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{KIND_TAG[consortiumKind(n)]}</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {groups.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">‘{query}’이 들어간 기관이 없습니다.</p>}
            </div>
          </section>

          <section ref={resultsRef} aria-live="polite" className="min-w-0 min-h-[12rem] scroll-mt-20">
            {!org ? (
              <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
                <Handshake className="mx-auto w-8 h-8 text-primary/70" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold">기관을 고르면 그 기관이 가진 특허가 여기에 나옵니다.</p>
                <p className="mt-1 text-[13px] text-muted-foreground">대학 {CONSORTIUM_ORGS.filter((x) => consortiumKind(x) === "univ").length}곳 · 연구기관·공공기관 {CONSORTIUM_ORGS.filter((x) => consortiumKind(x) === "inst").length}곳 · 기술지주회사 {CONSORTIUM_ORGS.filter((x) => consortiumKind(x) === "holding").length}곳</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                  <h2 className="text-lg md:text-xl font-bold">{org}</h2>
                  {result && result.codes.length > 0 && (
                    <span className="text-[12px] text-muted-foreground">
                      특허고객번호 <span className="font-mono">{result.codes.join(", ")}</span> · 살아 있는 권리 {items.length}건 표시 (KIPRIS 전체 {result.total.toLocaleString()}건)
                    </span>
                  )}
                </div>
                {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
                {result && !result.codes.length && !loading && (
                  <p className="py-10 text-center text-sm text-muted-foreground">KIPRIS에서 이 이름으로 출원한 특허를 찾지 못했습니다.</p>
                )}
                {items.length > 0 && (
                  <ul className="rounded-2xl border border-border/50 bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                    {items.map((r) => (
                      <li key={r.applicationNumber} className="border-b border-border/40 last:border-b-0 flex items-center">
                        <button
                          type="button"
                          onClick={() => navigate(`/?patent=${encodeURIComponent(r.applicationNumber)}`)}
                          className="min-w-0 flex-1 text-left px-4 py-3.5 hover:bg-muted/40 transition-colors flex items-start gap-3"
                        >
                          <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-md border text-[11px] font-bold ${statusClass(r.status)}`}>{r.status || "-"}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-semibold leading-snug break-keep">{r.title}</span>
                            <span className="block mt-1 text-[11px] font-mono text-muted-foreground">
                              출원 {r.applicationNumber} · {r.applicationDate}
                              {r.registrationNumber ? ` · 등록 ${r.registrationNumber}` : ""}
                              {r.ipc ? ` · ${r.ipc}` : ""}
                            </span>
                            {r.applicant && r.applicant.replace(/\s/g, "") !== org.replace(/\s/g, "") && (
                              <span className="block mt-0.5 text-[11px] text-muted-foreground">출원인 {r.applicant}</span>
                            )}
                          </span>
                          <ArrowRight className="shrink-0 w-4 h-4 text-muted-foreground mt-1" aria-hidden="true" />
                        </button>
                        {favorites.enabled && (
                          <FavoriteToggle
                            className="shrink-0 mr-3"
                            active={favorites.isFavorite(r.applicationNumber)}
                            title={r.title}
                            onToggle={() => favorites.toggle({
                              patentNumber: r.applicationNumber,
                              title: r.title,
                              assignee: r.applicant || org,
                              applicationNumber: r.applicationNumber,
                              registrationNumber: r.registrationNumber ?? null,
                              registrationDate: r.registrationDate ?? null,
                            })}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {loading && (
                  <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> <span className="text-sm">특허고객번호로 특허를 찾는 중…</span>
                  </div>
                )}
                {!loading && result?.hasMore && (
                  <div className="mt-5 flex justify-center">
                    <Button variant="outline" size="sm" onClick={() => void load(org, (result?.page ?? 1) + 1)}>더 보기</Button>
                  </div>
                )}
              </>
            )}
          </section>
          </div>
        </div>
      </main>
    </PageLayout>
  );
};

export default FoodConsortium;
