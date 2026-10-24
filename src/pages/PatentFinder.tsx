import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, Check, ClipboardCheck, Compass, Gauge, Loader2, Package, RotateCcw, Search, Sparkles, Target, Wrench } from "lucide-react";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EMPTY_FINDER_FORM, FINDER_CAPABILITY_CHIPS, FINDER_INDUSTRIES, FINDER_PURPOSES, FINDER_READINESS,
  findMyPatents, fitBand, type FinderForm, type FinderPurpose, type FinderResponse, type FinderResult,
} from "@/lib/patentFinder";

const STORAGE_KEY = "patent-finder:last";
const STEPS = ["회사 조건 분석", "기관 보유 특허 검색", "회사 맞춤 적합도 평가"];

function loadLast(): { form: FinderForm; data: FinderResponse | null } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function FieldLabel({ icon: Icon, children, optional }: { icon: typeof Building2; children: React.ReactNode; optional?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold text-foreground">
      <Icon className="w-4 h-4 text-primary" />
      {children}
      {optional && <span className="text-xs font-normal text-muted-foreground">선택</span>}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`finder-chip inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? "finder-chip-active" : ""}`}
    >
      {active && <Check className="w-3 h-3" />}
      {children}
    </button>
  );
}

function ResultCard({ r, rank, onOpen }: { r: FinderResult; rank: number; onOpen: (id: string) => void }) {
  const band = fitBand(r.fit);
  return (
    <article className="finder-result rounded-2xl border border-border/60 bg-card p-4 md:p-5">
      <div className="flex items-start gap-3 md:gap-4">
        <div className={`finder-fit finder-fit-${band.tone} shrink-0 flex flex-col items-center justify-center rounded-xl w-14 h-14 md:w-16 md:h-16`}>
          <span className="text-lg md:text-xl font-bold tabular-nums leading-none">{r.fit}</span>
          <span className="text-[10px] font-semibold mt-1">{band.label}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{rank}위</span>
            <span aria-hidden>·</span>
            <span className="truncate">{r.applicant || "기관 미상"}</span>
            {r.applicationDate && (<><span aria-hidden>·</span><span className="tabular-nums">{r.applicationDate.slice(0, 4)}년 출원</span></>)}
          </div>
          <button
            type="button"
            onClick={() => onOpen(r.patentId)}
            className="mt-1 text-left text-[15px] md:text-base font-bold leading-snug text-foreground hover:text-primary transition-colors"
          >
            {r.title}
          </button>
          {r.matchPoints.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.matchPoints.map((m) => (
                <span key={m} className="finder-point rounded-md px-2 py-0.5 text-[11px] font-semibold">{m}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 md:pl-20 space-y-2">
        <p className="text-sm leading-relaxed text-foreground/90">
          <span className="font-semibold text-primary">추천 이유 </span>{r.reason}
        </p>
        {r.considerations && (
          <p className="text-[13px] leading-relaxed text-muted-foreground flex gap-1.5">
            <ClipboardCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span><span className="font-semibold text-foreground/80">도입 전 확인 </span>{r.considerations}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted-foreground">
            {typeof r.trl === "number"
              ? <>기술 완성도 <b className="text-foreground">TRL {r.trl}</b>{r.readinessMatch === true ? " · 원하는 완성도와 맞음" : r.readinessMatch === false ? " · 원하는 완성도와 차이 있음" : ""}</>
              : "기술 완성도는 AI 요약에서 확인할 수 있어요"}
            <span className="ml-2 tabular-nums">{r.patentId}</span>
          </span>
          <Button size="sm" className="rounded-full h-8 gap-1 btn-press" onClick={() => onOpen(r.patentId)}>
            AI 요약 보기 <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function PatentFinder() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const last = useRef(loadLast()).current;
  const [form, setForm] = useState<FinderForm>(() => ({
    ...EMPTY_FINDER_FORM,
    ...(last?.form || {}),
    ...(params.get("industry") ? { industry: params.get("industry")! } : {}),
    ...(params.get("item") ? { item: params.get("item")! } : {}),
  }));
  const [data, setData] = useState<FinderResponse | null>(params.get("run") ? null : last?.data ?? null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const autoRun = useRef(false);

  const update = <K extends keyof FinderForm>(key: K, value: FinderForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const togglePurpose = (p: FinderPurpose) =>
    update("purposes", form.purposes.includes(p) ? form.purposes.filter((x) => x !== p) : [...form.purposes, p]);
  const addCapability = (c: string) => {
    if (form.capabilities.includes(c)) return;
    update("capabilities", (form.capabilities ? `${form.capabilities}, ${c}` : c).slice(0, 300));
  };

  const run = async (f: FinderForm = form) => {
    if (!f.industry.trim() || !f.item.trim()) {
      toast.error("업종과 아이템을 입력해 주세요.");
      return;
    }
    setLoading(true);
    setData(null);
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 3500);
    const t2 = setTimeout(() => setStep(2), 22000);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    try {
      const res = await findMyPatents(f);
      if (!res.success) {
        toast.error(res.error || "추천에 실패했습니다.");
        return;
      }
      setData(res);
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ form: f, data: res })); } catch { /* ignore */ }
    } finally {
      clearTimeout(t1); clearTimeout(t2);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoRun.current || !params.get("run")) return;
    autoRun.current = true;
    const next = new URLSearchParams(params);
    next.delete("run");
    setParams(next, { replace: true });
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPatent = (id: string) => navigate(`/?patent=${encodeURIComponent(id)}`);
  const reset = () => { setForm(EMPTY_FINDER_FORM); setData(null); sessionStorage.removeItem(STORAGE_KEY); };

  const headerRight = (
    <Link to="/">
      <Button variant="outline" size="sm" className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 glossy-card gap-1 md:gap-2 btn-press font-medium">
        <ArrowLeft className="w-3 h-3 md:w-3.5 md:h-3.5" />
        <span className="hidden sm:inline">홈으로</span>
      </Button>
    </Link>
  );

  return (
    <PageLayout headerRight={headerRight}>
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 relative z-10">
        <section className="home-search-hero relative -mx-3 sm:-mx-4 md:-mx-6 mb-5 md:mb-7">
          <div className="max-w-6xl mx-auto px-5 md:px-6 py-6 md:py-8">
            <p className="home-hero-accent inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold"><Compass className="w-4 h-4" /> 기업 맞춤 기술 탐색</p>
            <h1 className="mt-1.5 text-2xl md:text-[34px] font-extrabold leading-tight">나만의 특허찾기</h1>
            <p className="home-hero-muted mt-2 text-sm md:text-base max-w-2xl leading-relaxed">
              업종과 아이템, 도입 목적과 보유 설비를 알려 주시면 농업 국가연구기관이 보유한 특허 중 회사에 맞는 기술을 적합도 순으로 추천해 드려요.
            </p>
          </div>
        </section>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-5 lg:gap-7 items-start">
          {/* Form */}
          <form
            onSubmit={(e) => { e.preventDefault(); void run(); }}
            className="finder-panel rounded-2xl border border-border/60 bg-card p-4 md:p-5 space-y-5 lg:sticky lg:top-20"
          >
            <div>
              <FieldLabel icon={Building2}>업종</FieldLabel>
              <Input value={form.industry} maxLength={60} onChange={(e) => update("industry", e.target.value)} placeholder="예: 식품가공" className="h-11 rounded-xl" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {FINDER_INDUSTRIES.map((i) => (
                  <Chip key={i} active={form.industry === i} onClick={() => update("industry", form.industry === i ? "" : i)}>{i}</Chip>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel icon={Package}>아이템</FieldLabel>
              <Input value={form.item} maxLength={120} onChange={(e) => update("item", e.target.value)} placeholder="예: 저당 딸기잼, 버섯 배지, 한우 사료" className="h-11 rounded-xl" />
              <p className="mt-1.5 text-xs text-muted-foreground">만들거나 개선하려는 제품·서비스를 구체적으로 적을수록 정확해요.</p>
            </div>

            <div>
              <FieldLabel icon={Target} optional>도입 목적</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {FINDER_PURPOSES.map((p) => (
                  <Chip key={p} active={form.purposes.includes(p)} onClick={() => togglePurpose(p)}>{p}</Chip>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel icon={Wrench} optional>보유 설비·역량</FieldLabel>
              <Textarea
                value={form.capabilities}
                maxLength={300}
                onChange={(e) => update("capabilities", e.target.value)}
                placeholder="예: 잼 살균·충전 라인 보유, 식품연구원 2명"
                className="min-h-[76px] rounded-xl resize-none"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {FINDER_CAPABILITY_CHIPS.map((c) => (
                  <Chip key={c} active={form.capabilities.includes(c)} onClick={() => addCapability(c)}>{c}</Chip>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel icon={Gauge}>원하는 기술 완성도</FieldLabel>
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup">
                {FINDER_READINESS.map((r) => {
                  const active = form.readiness === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => update("readiness", r.value)}
                      className={`finder-chip rounded-xl border px-3 py-2 text-left transition-colors ${active ? "finder-chip-active" : ""}`}
                    >
                      <span className="block text-sm font-semibold">{r.label}</span>
                      <span className="block text-[11px] opacity-75">{r.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={loading} className="flex-1 h-11 rounded-xl gap-1.5 text-sm font-semibold btn-press">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? "찾는 중..." : "맞춤 특허 추천받기"}
              </Button>
              <Button type="button" variant="outline" onClick={reset} disabled={loading} className="h-11 rounded-xl px-3" aria-label="입력 초기화" title="입력 초기화">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </form>

          {/* Results */}
          <section ref={resultsRef} aria-live="polite" className="min-w-0 scroll-mt-20">
            {loading && (
              <div className="space-y-4">
                <div className="finder-panel rounded-2xl border border-border/60 bg-card p-4 md:p-5">
                  <p className="text-sm font-semibold text-foreground">회사에 맞는 특허를 찾고 있어요 <span className="text-muted-foreground font-normal">(30초~1분)</span></p>
                  <ol className="mt-3 grid gap-2 sm:grid-cols-3">
                    {STEPS.map((s, i) => (
                      <li key={s} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${i < step ? "finder-step-done" : i === step ? "finder-step-active" : "border-border/60 text-muted-foreground"}`}>
                        {i < step ? <Check className="w-3.5 h-3.5" /> : i === step ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="w-3.5 text-center">{i + 1}</span>}
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
              </div>
            )}

            {!loading && !data && (
              <div className="finder-panel rounded-2xl border border-dashed border-border bg-card/60 p-6 md:p-10 text-center">
                <Search className="w-8 h-8 mx-auto text-primary/70" />
                <p className="mt-3 text-base font-semibold text-foreground">업종과 아이템을 입력해 보세요</p>
                <p className="mt-1 text-sm text-muted-foreground">도입 목적·설비·완성도까지 알려 주시면 추천 이유와 도입 전 확인할 점도 함께 보여 드려요.</p>
              </div>
            )}

            {!loading && data && (
              <div className="space-y-4">
                <div className="finder-panel rounded-2xl border border-border/60 bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-base font-bold text-foreground">
                      추천 특허 <span className="text-primary tabular-nums">{data.results?.length ?? 0}</span>건
                      <span className="ml-2 text-xs font-normal text-muted-foreground">기관 보유 특허 {data.candidateCount ?? 0}건 중 적합도 50점 이상</span>
                    </p>
                  </div>
                  {data.need && <p className="mt-1.5 text-sm text-muted-foreground">찾은 기술: {data.need}</p>}
                  {!!data.terms?.length && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground mr-0.5">검색어</span>
                      {data.terms.map((t) => (
                        <Link key={t} to={`/search?keyword=${encodeURIComponent(t)}`} className="finder-chip rounded-full border px-2.5 py-1 text-[11px] font-medium">{t}</Link>
                      ))}
                    </div>
                  )}
                </div>

                {data.results && data.results.length > 0 ? (
                  data.results.map((r, i) => <ResultCard key={r.patentId} r={r} rank={i + 1} onOpen={openPatent} />)
                ) : (
                  <div className="finder-panel rounded-2xl border border-border/60 bg-card p-6 text-center">
                    <p className="text-base font-semibold text-foreground">조건에 꼭 맞는 특허를 찾지 못했어요</p>
                    <p className="mt-1 text-sm text-muted-foreground">아이템을 원료·공정 중심으로 바꾸거나, 완성도를 '상관없음'으로 넓혀 다시 찾아보세요.</p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </PageLayout>
  );
}
