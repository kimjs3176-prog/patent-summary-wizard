// 출원지원(에이프 Agri-IP) 연결 — 관리자 설정 feature_filing 으로 켜고 끄는 옵션 기능.
// AIS 는 에이프를 /filing 페이지의 iframe 으로 열고(임베드 모드), 두 창은 postMessage 로만 주고받는다.
//   AIS → 에이프: 주소 {filing_url}?embed=ais&skin=ais&theme=light&accent=hsl(…)#단계[?cite=출원번호&title=…|?kw=키워드&field=분야]
//                 메시지 {type:"agri-ip:go", step, sub} 단계·쪽 이동 · {type:"agri-ip:move", dir} 이전/다음 · {type:"agri-ip:open", panel} 도움말·환경설정
//                      {type:"agri-ip:cite", no, title} (이미 열린 창에 비교 특허 추가)
//   에이프 → AIS: {type:"agri-ip:state", …} 그릴 때마다 단계·쪽·이전/다음·D-day (이 페이지가 단계 바를 그린다) · {type:"agri-ip:ais", q} 'AIS로 분석' → AIS 가 직접 검색
// 반대로 AIS 가 에이프 안(iframe)에 열렸을 때는(?from=agri-ip) 비교 특허를 부모 창으로 postMessage 한다.

export const FILING_DEFAULT_URL = "https://koat-axlab.vercel.app/";

export type SettingsLike = Record<string, string | undefined>;

export function filingEnabled(settings: SettingsLike): boolean {
  return settings.feature_filing !== "false";
}

/** 관리자가 적은 주소를 정리한다 (비어 있거나 https 가 아니면 기본 주소). */
export function filingBaseUrl(settings: SettingsLike): string {
  const raw = (settings.filing_url || "").trim();
  try {
    const u = new URL(raw || FILING_DEFAULT_URL);
    if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return FILING_DEFAULT_URL;
    u.search = "";
    u.hash = "";
    return u.toString().endsWith("/") ? u.toString() : `${u.toString()}/`;
  } catch {
    return FILING_DEFAULT_URL;
  }
}

export function filingOrigin(settings: SettingsLike): string {
  return new URL(filingBaseUrl(settings)).origin;
}

/** 에이프 단계 이름 (주소 #… 에 들어가는 값). 모르는 값은 1단계로. */
export const FILING_PAGES = ["idea", "prior", "diag", "draft", "manage", "global"] as const;
export type FilingPage = (typeof FILING_PAGES)[number];

export function normalizeFilingPage(raw: string | null | undefined): string {
  const v = (raw || "").replace(/^#/, "").trim();
  if (!v) return "idea";
  const [step, sub] = v.split("/");
  if (!(FILING_PAGES as readonly string[]).includes(step)) return "idea";
  return sub && /^[a-z]+$/.test(sub) ? `${step}/${sub}` : step;
}

export interface FilingSrcOptions {
  page?: string | null;
  /** 비교 특허로 넣을 출원번호 (13자리, 하이픈 유무 무관) */
  cite?: string | null;
  title?: string | null;
  /** 키워드로 새 시나리오 시작 */
  kw?: string | null;
  field?: string | null;
  theme?: "light" | "dark";
  /** 에이프의 강조색을 이 사이트 --primary 로: "hsl(158 68% 30%)" 또는 "#rrggbb" */
  accent?: string;
}

export function buildFilingSrc(settings: SettingsLike, opts: FilingSrcOptions = {}): string {
  const base = filingBaseUrl(settings);
  const q = new URLSearchParams({ embed: "ais", skin: "ais", theme: opts.theme || "light" });
  if (opts.accent && /^(hsl\(\d{1,3}(\.\d+)? \d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%\)|#[0-9a-fA-F]{6})$/.test(opts.accent)) q.set("accent", opts.accent);
  let page = normalizeFilingPage(opts.page);
  const hashQ = new URLSearchParams();
  const cite = (opts.cite || "").replace(/[^0-9]/g, "");
  if (/^(10|20)\d{11}$/.test(cite)) {
    page = "prior";
    hashQ.set("cite", cite);
    if (opts.title) hashQ.set("title", opts.title.slice(0, 200));
  } else if (opts.kw && opts.kw.trim()) {
    page = "idea";
    hashQ.set("kw", opts.kw.trim().slice(0, 200));
    if (opts.field && /^[a-z]+$/.test(opts.field)) hashQ.set("field", opts.field);
  }
  const hs = hashQ.toString();
  return `${base}?${q.toString()}#${page}${hs ? `?${hs}` : ""}`;
}

/** 새 창으로 여는 주소 (iframe 이 막혔을 때의 대안) */
export function buildFilingStandaloneUrl(settings: SettingsLike, opts: FilingSrcOptions = {}): string {
  return buildFilingSrc(settings, opts).replace(/\?embed=ais[^#]*/, "");
}

export interface FilingState {
  mode: "apply" | "global";
  step: string;
  sub: number;
  branch: string | null;
  steps: { id: string; t: string; s: string; done: boolean; cur: boolean }[];
  subs: string[];
  prev: string;
  next: string;
  title: string;
  dday: { label: string; text: string; warn: boolean } | null;
  api: string;
}
export type FilingMessage = { type: "agri-ip:state"; state: FilingState } | { type: "agri-ip:ais"; q: string };

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

/** iframe(에이프)에서 온 메시지인지 확인하고 형식을 맞춘다 (출처가 다르거나 모르는 형식이면 null). 문자열은 길이를 자르고 그대로 쓰지 않는다. */
export function parseFilingMessage(ev: { origin: string; data: unknown }, expectedOrigin: string): FilingMessage | null {
  if (ev.origin !== expectedOrigin || !ev.data || typeof ev.data !== "object") return null;
  const d = ev.data as Record<string, unknown>;
  if (d.type === "agri-ip:ais" && typeof d.q === "string") return { type: "agri-ip:ais", q: d.q.slice(0, 200) };
  if (d.type === "agri-ip:state" && Array.isArray(d.steps)) {
    const steps = (d.steps as unknown[]).slice(0, 8).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return { id: str(o.id, 20), t: str(o.t, 40), s: str(o.s, 60), done: o.done === true, cur: o.cur === true };
    }).filter((x) => /^[a-z]+$/.test(x.id) && x.t);
    if (!steps.length) return null;
    const dd = d.dday && typeof d.dday === "object" ? (d.dday as Record<string, unknown>) : null;
    return {
      type: "agri-ip:state",
      state: {
        mode: d.mode === "global" ? "global" : "apply",
        step: /^[a-z]+$/.test(str(d.step, 20)) ? str(d.step, 20) : "idea",
        sub: Math.max(0, Math.min(20, Number(d.sub) || 0)),
        branch: /^[a-z]+$/.test(str(d.branch, 20)) ? str(d.branch, 20) : null,
        steps,
        subs: Array.isArray(d.subs) ? (d.subs as unknown[]).slice(0, 12).map((x) => str(x, 40)).filter(Boolean) : [],
        prev: str(d.prev, 60),
        next: str(d.next, 60),
        title: str(d.title, 120),
        dday: dd && typeof dd.text === "string" ? { label: str(dd.label, 40), text: str(dd.text, 20), warn: dd.warn === true } : null,
        api: str(d.api, 40),
      },
    };
  }
  return null;
}

/** AIS 가 에이프 안(iframe)에 열려 있는가 — 부모 창(referrer) 출처가 설정된 출원지원 주소와 같을 때만. 주소의 from=agri-ip 는 화면을 옮겨 다니면 사라지므로 보지 않는다 */
export function embeddedInFiling(settings: SettingsLike, referrer: string = document.referrer): boolean {
  if (typeof window === "undefined" || window.parent === window) return false;
  try {
    return new URL(referrer).origin === filingOrigin(settings);
  } catch {
    return false;
  }
}

/** 요약 화면의 특허를 출원지원 비교 특허로 보낸다: 에이프 안이면 부모 창에, 아니면 /filing 페이지 주소를 돌려준다. */
export function sendPatentToFiling(settings: SettingsLike, no: string, title: string): { sent: boolean; to?: string } {
  const n = no.replace(/[^0-9]/g, "");
  if (embeddedInFiling(settings)) {
    window.parent.postMessage({ type: "agri-ip:cite", no: n, title }, filingOrigin(settings));
    return { sent: true };
  }
  return { sent: false, to: `/filing?cite=${encodeURIComponent(n)}&title=${encodeURIComponent(title.slice(0, 200))}` };
}
