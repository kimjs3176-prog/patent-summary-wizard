import { useEffect, useMemo, useRef, useState } from "react";
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
  CONSORTIUM_KIND_LABEL,
  CONSORTIUM_ORGS,
  consortiumKind,
  type ConsortiumKind,
  type ConsortiumPatent,
  type ConsortiumResult,
} from "@/lib/consortium";

const KINDS: ConsortiumKind[] = ["univ", "inst", "holding"];

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
  const [result, setResult] = useState<ConsortiumResult | null>(null);
  const [items, setItems] = useState<ConsortiumPatent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const resultsRef = useRef<HTMLElement>(null);

  const groups = useMemo(() => {
    const q = query.replace(/\s/g, "");
    const shown = CONSORTIUM_ORGS.filter((n) => !q || n.replace(/\s/g, "").includes(q));
    return KINDS.map((k) => ({ kind: k, names: shown.filter((n) => consortiumKind(n) === k) })).filter((g) => g.names.length);
  }, [query]);

  const load = async (name: string, page: number) => {
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase.functions.invoke("consortium-patents", { body: { org: name, page } });
      if (err || !data?.success) throw new Error(data?.error || "특허 목록을 불러오지 못했습니다.");
      const r = data as ConsortiumResult;
      setResult(r);
      setItems((prev) => (page === 1 ? r.items : [...prev, ...r.items.filter((x) => !prev.some((p) => p.applicationNumber === x.applicationNumber))]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "특허 목록을 불러오지 못했습니다.");
      if (page === 1) setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setResult(null);
    setItems([]);
    if (org) void load(org, 1);
  }, [org]);

  const pick = (name: string) => {
    setParams(name === org ? {} : { org: name }, { replace: true });
    // 휴대폰에서는 기관 목록이 길어 결과가 화면 밖에 생기므로 결과 머리로 데려간다
    if (name !== org && window.innerWidth < 768) requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <PageLayout>
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 md:py-10">
        <div className="max-w-5xl mx-auto">
          <header className="mb-6 md:mb-8">
            <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-black tracking-tight">
              <Handshake className="w-6 h-6 md:w-7 md:h-7 text-primary shrink-0" aria-hidden="true" />
              식품기술이전 협의체
            </h1>
            <p className="mt-2 text-[13px] md:text-sm text-muted-foreground leading-relaxed max-w-2xl">
              협의체 {CONSORTIUM_ORGS.length}개 기관이 가진 특허를 기관별로 봅니다. 기관마다 특허고객번호로 찾아, 이름이 비슷한 다른 기관의 특허는 섞이지 않습니다.
            </p>
          </header>

          <section aria-label="기관 고르기" className="rounded-2xl border border-border/50 bg-card p-4 md:p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="기관 이름 찾기 (예: 전북대, 김치)" aria-label="기관 이름 찾기" className="pl-9" />
            </div>
            <div className="mt-4 grid gap-4">
              {groups.map((g) => (
                <div key={g.kind}>
                  <h2 className="text-xs font-semibold text-muted-foreground">{CONSORTIUM_KIND_LABEL[g.kind]} <span className="font-mono">{g.names.length}</span></h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {g.names.map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={n === org}
                        title={n}
                        onClick={() => pick(n)}
                        className={`px-3 py-1.5 rounded-full text-[12px] md:text-[13px] font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          n === org ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground/80 border-border/70 hover:border-primary/50"
                        }`}
                      >
                        {/* 묶음 이름이 '대학 산학협력단'이므로 칩에는 대학 이름만 */}
                        {g.kind === "univ" ? n.replace(/\s*산학협력단$/, "") : n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {groups.length === 0 && <p className="text-sm text-muted-foreground">‘{query}’이 들어간 기관이 없습니다.</p>}
            </div>
          </section>

          <section ref={resultsRef} aria-live="polite" className="mt-6 min-h-[12rem] scroll-mt-20">
            {!org ? (
              <p className="py-12 text-center text-sm text-muted-foreground">위에서 기관을 고르면 그 기관이 가진 특허가 여기에 나옵니다.</p>
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
      </main>
    </PageLayout>
  );
};

export default FoodConsortium;
