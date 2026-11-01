import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, ExternalLink, FileSignature, FileText, Globe, HelpCircle, Lightbulb, Search, Send, Settings, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { parseIpNumber } from "@/lib/ipNumber";
import { buildFilingSrc, buildFilingStandaloneUrl, filingEnabled, filingOrigin, parseFilingMessage, type FilingState } from "@/lib/filing";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// 출원지원 — 관리자 설정 '출원지원' 토글로 켜고 끄는 옵션 메뉴. 화면에는 AIS 의 한 기능으로만 보이고 바깥 서비스 이름은 쓰지 않는다.
// 출원지원 서버(에이프)의 5단계 출원 준비(아이디어 → 선행기술 조사 → 진단·보완 → 서류 작성 → 제출·관리·해외 출원)를 본문만 iframe 으로 넣고,
// 단계 탭·쪽 이동·이전/다음·D-day·도움말·환경설정은 이 페이지가 AIS 디자인으로 그린다 (에이프가 그릴 때마다 상태를 보내 준다).
//   /filing?p=단계            그 단계로 (에이프가 쪽을 바꾸면 주소도 따라 바뀐다)
//   /filing?cite=출원번호&title= 요약 화면의 특허를 비교 특허로 넣고 선행기술 조사로
//   /filing?kw=키워드&field=   검색 키워드로 새 시나리오 시작

const STEP_ICONS = { idea: Lightbulb, prior: Search, diag: Stethoscope, draft: FileText, manage: Send } as const;
// 에이프가 첫 상태를 보내기 전에 보여 줄 기본 단계 (에이프 STEPS 와 같은 순서)
const DEFAULT_STEPS: FilingState["steps"] = [
  { id: "idea", t: "아이디어", s: "키워드로 초안", done: false, cur: true },
  { id: "prior", t: "선행기술 조사", s: "유사 특허·공백", done: false, cur: false },
  { id: "diag", t: "진단·보완", s: "특허성·거절 위험", done: false, cur: false },
  { id: "draft", t: "서류 작성", s: "명세서·출원서", done: false, cur: false },
  { id: "manage", t: "제출·관리", s: "지원·기한·해외", done: false, cur: false },
];

const Filing = () => {
  useDocumentTitle("출원지원");
  const { settings } = useSiteSettings();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<FilingState | null>(null);
  const [frameTop, setFrameTop] = useState(0);
  const enabled = filingEnabled(settings);
  const origin = filingOrigin(settings);

  // iframe 주소는 처음 들어올 때 한 번만 만든다 (바뀌면 iframe 이 다시 읽혀 작성 중인 화면이 날아간다). 강조색은 이 사이트의 --primary 그대로
  const src = useMemo(() => {
    const primary = typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() : "";
    return buildFilingSrc(settings, { page: params.get("p"), cite: params.get("cite"), title: params.get("title"), kw: params.get("kw"), field: params.get("field"), accent: primary ? `hsl(${primary})` : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.filing_url]);
  const standalone = buildFilingStandaloneUrl(settings, { page: state?.step ?? params.get("p") });

  const post = useCallback((msg: Record<string, unknown>) => frameRef.current?.contentWindow?.postMessage(msg, origin), [origin]);

  useEffect(() => {
    if (!enabled) return;
    const onMessage = (ev: MessageEvent) => {
      if (frameRef.current && ev.source !== frameRef.current.contentWindow) return;
      const msg = parseFilingMessage(ev, origin);
      if (!msg) return;
      if (msg.type === "agri-ip:state") {
        setState(msg.state);
        // 에이프 쪽이 바뀌면 주소만 조용히 맞춘다 (새로고침·공유해도 같은 단계로)
        const page = msg.state.mode === "global" ? "global" : msg.state.step;
        const next = page && page !== "idea" ? `/filing?p=${encodeURIComponent(page)}` : "/filing";
        if (window.location.pathname + window.location.search !== next) window.history.replaceState(window.history.state, "", next);
      } else if (msg.type === "agri-ip:ais") {
        // 에이프의 'AIS로 분석' → 출원번호면 요약, 아니면 키워드 검색
        const q = msg.q.trim();
        if (!q) return;
        navigate(parseIpNumber(q) ? `/?patent=${encodeURIComponent(q)}` : `/search?keyword=${encodeURIComponent(q)}`);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [enabled, origin, navigate]);

  // iframe 은 화면 아래 끝까지: 위에 있는 머리글·단계 바 높이만큼 뺀다
  useLayoutEffect(() => {
    const measure = () => { const r = frameRef.current?.getBoundingClientRect(); if (r) setFrameTop(Math.round(r.top + window.scrollY)); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [state?.subs.length, enabled]);

  const headerRight = (
    <>
      <a href={standalone} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm" className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 gap-1 md:gap-2 glossy-card btn-press font-medium" title="출원지원을 새 창으로 엽니다">
          <ExternalLink className="w-3 h-3 md:w-3.5 md:h-3.5" />
          <span className="hidden sm:inline">새 창으로</span>
        </Button>
      </a>
      <Link to="/">
        <Button variant="outline" size="sm" className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 gap-1 md:gap-2 font-medium border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all">
          <ArrowLeft className="w-3 h-3 md:w-3.5 md:h-3.5" />
          <span className="hidden sm:inline">메인으로</span>
        </Button>
      </Link>
    </>
  );

  if (!enabled) {
    return (
      <PageLayout headerRight={headerRight} showFooterLogo={false}>
        <div className="container mx-auto px-4 py-16 max-w-xl text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--gradient-accent)" }}>
            <FileSignature className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">출원지원은 지금 꺼져 있습니다</h1>
          <p className="text-sm text-muted-foreground">관리자 페이지의 기능 설정에서 ‘출원지원’을 켜면 이 메뉴가 열립니다.</p>
        </div>
      </PageLayout>
    );
  }

  const steps = state?.steps ?? DEFAULT_STEPS;
  const inGlobal = state?.mode === "global";
  const subs = state?.subs ?? [];
  const curIdx = steps.findIndex((s) => s.cur);

  return (
    <PageLayout headerRight={headerRight} showFooterLogo={false}>
      <section aria-labelledby="filing-title" className="relative z-10">
        <h1 id="filing-title" className="sr-only">출원지원</h1>
        {/* 단계 바 — AIS 디자인. 누르면 iframe 안 에이프가 그 단계로 간다 */}
        <div className="container mx-auto px-3 sm:px-4 md:px-6 pt-2 md:pt-3">
          <div className="glossy-card rounded-2xl md:rounded-3xl px-2.5 md:px-4 py-2 md:py-2.5">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="hidden lg:flex items-center gap-2 pr-3 border-r border-border/60 flex-shrink-0">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-accent)" }}>
                  <FileSignature className="w-4 h-4 text-white" />
                </div>
                <div className="leading-tight">
                  <p className="text-[13px] font-bold text-foreground">출원지원</p>
                  <p className="text-[10.5px] text-muted-foreground/70 truncate max-w-[160px]" title={state?.title || undefined}>{state?.title || "아이디어부터 해외 출원까지"}</p>
                </div>
              </div>
              <ol className="flex items-center gap-1 md:gap-1.5 overflow-x-auto min-w-0 flex-1 py-0.5" aria-label="출원 준비 단계">
                {steps.map((s, i) => {
                  const Icon = STEP_ICONS[s.id as keyof typeof STEP_ICONS] ?? FileText;
                  const active = s.cur && !inGlobal;
                  return (
                    <li key={s.id} className="flex items-center flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => post({ type: "agri-ip:go", step: s.id, sub: 0 })}
                        aria-current={active ? "step" : undefined}
                        title={`${i + 1}단계 ${s.t} · ${s.s}`}
                        className={`flex items-center gap-1.5 md:gap-2 rounded-full h-8 md:h-9 pl-1 pr-2.5 md:pr-3 text-[12px] md:text-[13px] font-semibold transition-all btn-press ${
                          active ? "text-white shadow-md" : s.done ? "text-primary bg-primary/5 hover:bg-primary/10" : "text-muted-foreground hover:bg-accent/60"
                        }`}
                        style={active ? { background: "var(--gradient-accent)" } : undefined}
                      >
                        <span className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${active ? "bg-white/20" : s.done ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                          {s.done ? <Check className="w-3.5 h-3.5" /> : active ? <Icon className="w-3.5 h-3.5" /> : i + 1}
                        </span>
                        <span className="whitespace-nowrap">{s.t}</span>
                      </button>
                      {i < steps.length - 1 && <span className={`w-3 md:w-4 h-px mx-0.5 ${s.done ? "bg-primary/50" : "bg-border"}`} aria-hidden="true" />}
                    </li>
                  );
                })}
                {!state?.filingOnly && <li className="flex-shrink-0 pl-1 md:pl-2 ml-1 border-l border-border/60">
                  <button
                    type="button"
                    onClick={() => post({ type: "agri-ip:go", step: "global" })}
                    aria-current={inGlobal ? "page" : undefined}
                    className={`flex items-center gap-1.5 rounded-full h-8 md:h-9 px-2.5 md:px-3 text-[12px] md:text-[13px] font-semibold transition-all btn-press ${inGlobal ? "text-white shadow-md" : "text-muted-foreground hover:bg-accent/60"}`}
                    style={inGlobal ? { background: "var(--gradient-accent)" } : undefined}
                    title="키워드로 보는 농식품 해외 사업 인사이트"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span className="whitespace-nowrap">해외동향</span>
                  </button>
                </li>}
              </ol>
              <div className="flex items-center gap-1 flex-shrink-0">
                {state?.dday && (
                  <span className={`hidden md:inline-flex items-center rounded-full h-8 px-3 text-[12px] font-bold tabular-nums ${state.dday.warn ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`} title={state.dday.label}>
                    {state.dday.text}
                  </span>
                )}
                <button type="button" onClick={() => post({ type: "agri-ip:open", panel: "help" })} className="inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full text-muted-foreground hover:bg-accent/60 transition-colors" title="도움말 · 진행 상황 · 작업 파일 내보내기" aria-label="도움말">
                  <HelpCircle className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => post({ type: "agri-ip:open", panel: "settings" })} className="inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full text-muted-foreground hover:bg-accent/60 transition-colors" title="환경설정 · AI 키" aria-label="환경설정">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* 쪽 이동: 이 단계의 쪽들 + 이전/다음 */}
            {!inGlobal && state && (subs.length > 1 || state.prev || state.next) && (
              <div className="mt-1.5 pt-1.5 border-t border-border/50 flex items-center gap-2">
                <ol className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1" aria-label="이 단계의 쪽">
                  {subs.length > 1 && subs.map((t, k) => (
                    <li key={t} className="flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => post({ type: "agri-ip:go", step: state.step, sub: k })}
                        aria-current={k === state.sub ? "step" : undefined}
                        className={`inline-flex items-center gap-1.5 rounded-full h-7 px-2.5 text-[11.5px] md:text-[12px] font-medium transition-colors ${
                          k === state.sub ? "bg-foreground text-background" : k < state.sub ? "text-primary hover:bg-primary/5" : "text-muted-foreground hover:bg-accent/60"
                        }`}
                      >
                        <span className="tabular-nums">{k + 1}</span>
                        {t}
                      </button>
                    </li>
                  ))}
                  {subs.length > 1 && <li className="pl-1 text-[11px] text-muted-foreground/60 tabular-nums flex-shrink-0">{curIdx + 1}/{steps.length}단계 · {state.sub + 1}/{subs.length}쪽</li>}
                </ol>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="sm" disabled={!state.prev} onClick={() => post({ type: "agri-ip:move", dir: -1 })} className="h-8 rounded-full px-2.5 text-[12px] gap-1 text-muted-foreground" title={state.prev || undefined}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline max-w-[140px] truncate">{state.prev || "이전"}</span>
                  </Button>
                  <Button size="sm" disabled={!state.next} onClick={() => post({ type: "agri-ip:move", dir: 1 })} className="h-8 rounded-full px-3 text-[12px] gap-1 font-semibold btn-press" title={state.next || undefined}>
                    <span className="max-w-[160px] truncate">{state.next || "마지막 단계"}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        <iframe
          ref={frameRef}
          src={src}
          title="출원지원"
          className="block w-full border-0 bg-background mt-2"
          style={{ height: `calc(100dvh - ${frameTop}px)`, minHeight: 520 }}
          allow="clipboard-read; clipboard-write; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <p className="container mx-auto px-4 py-2.5 text-[11px] md:text-xs text-muted-foreground/70">
          작성 내용은 이 브라우저에 저장됩니다{state?.api ? ` · ${state.api}` : ""}. 특허 가능성 판단과 명세서 초안은 AI가 만든 참고 자료이며 출원 대리·법률 감정은 변리사를 통해 진행해야 합니다. 화면이 보이지 않으면{" "}
          <a href={standalone} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/70">새 창으로 열기</a>를 누르세요.
        </p>
      </section>
    </PageLayout>
  );
};

export default Filing;
