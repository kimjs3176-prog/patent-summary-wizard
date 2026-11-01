import { safeFetch } from "@/lib/safeFetch";

export const FINDER_INDUSTRIES = [
  "식품가공", "건강기능식품", "농자재·비료", "스마트팜", "종자·육묘",
  "축산·사료", "화장품·바이오소재", "농기계·장비", "유통·포장",
];

export const FINDER_PURPOSES = ["신제품 개발", "공정 개선", "원가 절감", "품질 향상", "신사업 진출", "인증·규제 대응"] as const;
export type FinderPurpose = typeof FINDER_PURPOSES[number];

export const FINDER_CAPABILITY_CHIPS = ["생산 설비 보유", "연구 인력 보유", "시험·분석 장비", "원료 재배·조달", "위탁 생산(OEM)", "판매 유통망"];

export type FinderReadiness = "ready" | "improve" | "codevelop" | "any";
export const FINDER_READINESS: { value: FinderReadiness; label: string; hint: string }[] = [
  { value: "ready", label: "바로 적용", hint: "TRL 7~9" },
  { value: "improve", label: "보완 후 적용", hint: "TRL 4~6" },
  { value: "codevelop", label: "공동 개발", hint: "TRL 1~3" },
  { value: "any", label: "상관없음", hint: "전체" },
];

export interface FinderForm {
  industry: string;
  item: string;
  purposes: FinderPurpose[];
  capabilities: string;
  readiness: FinderReadiness;
}

export interface FinderResult {
  patentId: string;
  title: string;
  applicant?: string;
  applicationDate?: string;
  publicationDate?: string;
  snippet?: string;
  ipc?: string;
  thumbnail?: string;
  terms: string[];
  trl?: number | null;
  fit: number;
  reason: string;
  matchPoints: string[];
  considerations: string;
  readinessMatch: boolean | null;
}

export interface FinderResponse {
  success: boolean;
  error?: string;
  /** The request ran past the client timeout (or the edge runtime's limit); the page offers a retry. */
  timedOut?: boolean;
  terms?: string[];
  need?: string;
  candidateCount?: number;
  results?: FinderResult[];
}

export const EMPTY_FINDER_FORM: FinderForm = { industry: "", item: "", purposes: [], capabilities: "", readiness: "any" };

export function fitBand(fit: number): { label: string; tone: "high" | "mid" | "low" } {
  if (fit >= 80) return { label: "매우 적합", tone: "high" };
  if (fit >= 65) return { label: "적합", tone: "mid" };
  return { label: "검토 가능", tone: "low" };
}

/** Client timeout for one finder run; the server stage budgets (plan 10 s + search 40 s + TRL 4 s + rank 40 s) stay below it. */
export const FINDER_TIMEOUT_MS = 110_000;

/** Staged progress text by elapsed seconds (the server does not stream its stage). */
export function finderStage(elapsedSec: number): number {
  if (elapsedSec < 4) return 0;   // 회사 조건 분석 (검색어 만들기)
  if (elapsedSec < 32) return 1;  // 후보 특허 검색
  return 2;                       // 적합도 평가
}

export async function findMyPatents(form: FinderForm, signal?: AbortSignal): Promise<FinderResponse> {
  const generic = "추천 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  const timeoutMessage = "추천이 예상보다 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.";
  let res: Response;
  try {
    res = await safeFetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-my-patents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(form),
      timeoutMs: FINDER_TIMEOUT_MS,
      // A silent retry would restart a ~1 minute AI run; the page offers an explicit retry instead.
      retries: 0,
      signal,
    });
  } catch (e) {
    if (signal?.aborted) return { success: false, error: "요청을 취소했습니다." };
    const name = e instanceof Error ? e.name : "";
    if (name === "AbortError" || name === "TimeoutError") return { success: false, timedOut: true, error: timeoutMessage };
    return { success: false, error: "네트워크 연결이 불안정합니다. 다시 시도해 주세요." };
  }
  // 504 = gateway timeout, 546 = Supabase edge worker resource/wall-clock limit.
  if (res.status === 504 || res.status === 546) return { success: false, timedOut: true, error: timeoutMessage };
  const body = (await res.json().catch(() => null)) as FinderResponse | null;
  if (!res.ok || !body) return { success: false, error: body?.error || generic };
  return body;
}

/* ───────── 최근 추천 (localStorage) ───────── */

export const FINDER_HISTORY_KEY = "patent-finder:history";
export const FINDER_HISTORY_MAX = 5;
/** Upper bound (UTF-16 chars, as localStorage counts) for the serialized history so it never crowds out favorites. */
export const FINDER_HISTORY_MAX_BYTES = 120_000;

export interface FinderRun {
  id: string;
  at: string;
  form: FinderForm;
  data: FinderResponse;
}

const READINESS_VALUES = FINDER_READINESS.map((r) => r.value);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Validates/clamps a form coming from storage or a shared URL. */
export function normalizeFinderForm(raw: unknown): FinderForm {
  const f = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const purposes = (Array.isArray(f.purposes) ? f.purposes : [])
    .filter((p): p is FinderPurpose => typeof p === "string" && (FINDER_PURPOSES as readonly string[]).includes(p));
  const readiness = READINESS_VALUES.includes(f.readiness as FinderReadiness) ? (f.readiness as FinderReadiness) : "any";
  return {
    industry: str(f.industry, 60),
    item: str(f.item, 120),
    purposes: [...new Set(purposes)],
    capabilities: str(f.capabilities, 300),
    readiness,
  };
}

export const finderFormKey = (f: FinderForm) =>
  JSON.stringify([f.industry.trim(), f.item.trim(), [...f.purposes].sort(), f.capabilities.trim(), f.readiness]);

/** Keeps only what the result cards, CSV and 다시 열기 need; abstracts/images are dropped, text is clamped. */
export function slimFinderResponse(data: FinderResponse): FinderResponse {
  return {
    success: data.success === true,
    terms: (Array.isArray(data.terms) ? data.terms : []).slice(0, 8).map((t) => str(t, 40)),
    need: str(data.need, 120),
    candidateCount: typeof data.candidateCount === "number" ? data.candidateCount : 0,
    results: (Array.isArray(data.results) ? data.results : []).slice(0, 12).map((r) => ({
      patentId: str(r.patentId, 40),
      title: str(r.title, 200),
      applicant: r.applicant ? str(r.applicant, 80) : undefined,
      applicationDate: r.applicationDate ? str(r.applicationDate, 20) : undefined,
      publicationDate: r.publicationDate ? str(r.publicationDate, 20) : undefined,
      terms: Array.isArray(r.terms) ? r.terms.slice(0, 5).map((t) => str(t, 40)) : [],
      trl: typeof r.trl === "number" ? r.trl : null,
      fit: Number(r.fit) || 0,
      reason: str(r.reason, 240),
      matchPoints: Array.isArray(r.matchPoints) ? r.matchPoints.slice(0, 3).map((m) => str(m, 20)) : [],
      considerations: str(r.considerations, 160),
      readinessMatch: typeof r.readinessMatch === "boolean" ? r.readinessMatch : null,
    })),
  };
}

/** Adds a run (newest first), replacing an older run with the same input; caps count and serialized size. */
export function pushFinderHistory(list: FinderRun[], run: FinderRun, maxBytes = FINDER_HISTORY_MAX_BYTES): FinderRun[] {
  const slim: FinderRun = { ...run, form: normalizeFinderForm(run.form), data: slimFinderResponse(run.data) };
  const key = finderFormKey(slim.form);
  const next = [slim, ...list.filter((r) => finderFormKey(r.form) !== key)].slice(0, FINDER_HISTORY_MAX);
  while (next.length > 1 && JSON.stringify(next).length > maxBytes) next.pop();
  return next;
}

export function parseFinderHistory(raw: string | null): FinderRun[] {
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const out: FinderRun[] = [];
  for (const r of parsed) {
    if (!r || typeof r !== "object") continue;
    const run = r as Partial<FinderRun>;
    if (typeof run.id !== "string" || typeof run.at !== "string" || !run.data || typeof run.data !== "object") continue;
    const form = normalizeFinderForm(run.form);
    if (!form.industry || !form.item) continue;
    out.push({ id: run.id, at: run.at, form, data: slimFinderResponse(run.data as FinderResponse) });
    if (out.length >= FINDER_HISTORY_MAX) break;
  }
  return out;
}

export function loadFinderHistory(): FinderRun[] {
  try { return parseFinderHistory(localStorage.getItem(FINDER_HISTORY_KEY)); } catch { return []; }
}

export function saveFinderHistory(list: FinderRun[]): boolean {
  try {
    if (list.length) localStorage.setItem(FINDER_HISTORY_KEY, JSON.stringify(list));
    else localStorage.removeItem(FINDER_HISTORY_KEY);
    return true;
  } catch { return false; }
}

/* ───────── 공유 링크 (입력만) ───────── */

/** Encodes only the company INPUT — never the AI output — plus run=1 so opening the link runs the search. */
export function finderShareParams(form: FinderForm): URLSearchParams {
  const p = new URLSearchParams();
  p.set("industry", form.industry.trim());
  p.set("item", form.item.trim());
  for (const purpose of form.purposes) p.append("purpose", purpose);
  if (form.capabilities.trim()) p.set("cap", form.capabilities.trim());
  if (form.readiness !== "any") p.set("readiness", form.readiness);
  p.set("run", "1");
  return p;
}

/** Reads a form from the URL; null when the link carries no finder input. */
export function finderFormFromParams(params: URLSearchParams): FinderForm | null {
  if (!params.get("industry") && !params.get("item")) return null;
  return normalizeFinderForm({
    industry: params.get("industry") || "",
    item: params.get("item") || "",
    purposes: params.getAll("purpose"),
    capabilities: params.get("cap") || "",
    readiness: params.get("readiness") || "any",
  });
}

/* ───────── CSV ───────── */

/** RFC 4180 quoting, plus a leading apostrophe on formula-like cells so spreadsheets never evaluate them. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const FINDER_CSV_HEADER = ["순위", "특허번호", "발명의 명칭", "보유기관", "적합도", "추천 이유", "맞는 지점", "도입 전 확인"];

export function finderResultsCsv(results: FinderResult[]): string {
  const rows = results.map((r, i) => [
    i + 1, r.patentId, r.title, r.applicant || "", r.fit, r.reason, (r.matchPoints || []).join(" / "), r.considerations || "",
  ]);
  // BOM so Excel opens the Korean text as UTF-8.
  return "﻿" + [FINDER_CSV_HEADER, ...rows].map((cols) => cols.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
