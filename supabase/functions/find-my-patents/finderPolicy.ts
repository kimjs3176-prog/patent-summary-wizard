// Pure rules for "나만의 특허찾기" (company-profile patent finder).
// Kept free of Deno/runtime imports so the rules can be unit-tested.

export const INSTITUTE_NAMES = ["농촌진흥청", "농림축산검역본부", "국립농산물품질관리원", "국립종자원", "농업기술센터", "농업기술원"];

export const PURPOSES = ["신제품 개발", "공정 개선", "원가 절감", "품질 향상", "신사업 진출", "인증·규제 대응"] as const;
export type Purpose = typeof PURPOSES[number];

export type Readiness = "ready" | "improve" | "codevelop" | "any";

/** Desired technology maturity → accepted TRL range (inclusive). */
export const READINESS_TRL: Record<Exclude<Readiness, "any">, [number, number]> = {
  ready: [7, 9],     // 바로 적용
  improve: [4, 6],   // 일부 보완 후 적용
  codevelop: [1, 3], // 공동 연구·개발
};

export const MIN_FIT = 50;
export const MAX_RESULTS = 12;
export const MAX_TERMS = 5;
export const MAX_CANDIDATES = 40;

export interface FinderCandidate {
  patentId: string;
  title: string;
  applicant?: string;
  applicationDate?: string;
  publicationDate?: string;
  snippet?: string;
  ipc?: string;
  thumbnail?: string;
  hits: number;
  terms: string[];
  trl?: number | null;
}

export interface RankedItem {
  patentId: unknown;
  fit: unknown;
  reason?: unknown;
  matchPoints?: unknown;
  considerations?: unknown;
}

export interface FinderResult extends FinderCandidate {
  fit: number;
  reason: string;
  matchPoints: string[];
  considerations: string;
  readinessMatch: boolean | null;
}

const SEARCH_TERM_RE = /^[\w\s가-힣\-·]+$/u;

export function isInScope(applicant?: string): boolean {
  if (!applicant) return false;
  return INSTITUTE_NAMES.some((n) => applicant.includes(n));
}

/** Clean AI-proposed search terms: short, allowed characters, unique, max MAX_TERMS. */
export function sanitizeTerms(raw: unknown, fallback: string[]): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const t of [...list, ...fallback]) {
    if (typeof t !== "string") continue;
    const term = t.replace(/\s+/g, " ").trim();
    if (term.length < 2 || term.length > 30 || !SEARCH_TERM_RE.test(term)) continue;
    if (out.some((o) => o === term)) continue;
    out.push(term);
    if (out.length >= MAX_TERMS) break;
  }
  return out;
}

/** Merge per-term search results; drop anything outside the six-institute scope. */
export function mergeCandidates(groups: { term: string; patents: Array<Record<string, unknown>> }[]): FinderCandidate[] {
  const map = new Map<string, FinderCandidate>();
  for (const { term, patents } of groups) {
    for (const p of patents) {
      const patentId = typeof p.patentId === "string" ? p.patentId : "";
      const title = String(p.titleKo || p.title || "").trim();
      const applicant = String(p.applicant || p.assignee || "");
      if (!patentId || !title || !isInScope(applicant)) continue;
      const existing = map.get(patentId);
      if (existing) {
        if (!existing.terms.includes(term)) { existing.terms.push(term); existing.hits += 1; }
        continue;
      }
      map.set(patentId, {
        patentId,
        title,
        applicant,
        applicationDate: p.applicationDate as string | undefined,
        publicationDate: p.publicationDate as string | undefined,
        snippet: p.snippet as string | undefined,
        ipc: p.ipc as string | undefined,
        thumbnail: p.thumbnail as string | undefined,
        hits: 1,
        terms: [term],
      });
    }
  }
  return [...map.values()]
    .sort((a, b) => b.hits - a.hits || String(b.applicationDate || "").localeCompare(String(a.applicationDate || "")))
    .slice(0, MAX_CANDIDATES);
}

export function readinessMatch(readiness: Readiness, trl?: number | null): boolean | null {
  if (readiness === "any" || typeof trl !== "number" || trl < 1 || trl > 9) return null;
  const [lo, hi] = READINESS_TRL[readiness];
  return trl >= lo && trl <= hi;
}

const shortText = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Turn the AI ranking into results. Only patents that exist in the candidate list
 * are kept (no invented patents), scores are clamped, and weak matches are dropped.
 */
export function buildResults(ranked: unknown, candidates: FinderCandidate[], readiness: Readiness): FinderResult[] {
  const byId = new Map(candidates.map((c) => [c.patentId, c]));
  const items = Array.isArray(ranked) ? (ranked as RankedItem[]) : [];
  const seen = new Set<string>();
  const results: FinderResult[] = [];
  for (const item of items) {
    const id = typeof item?.patentId === "string" ? item.patentId.trim() : "";
    const cand = byId.get(id);
    if (!cand || seen.has(id)) continue;
    const fitNum = Math.round(Number(item.fit));
    if (!Number.isFinite(fitNum)) continue;
    const fit = Math.max(0, Math.min(100, fitNum));
    if (fit < MIN_FIT) continue;
    const reason = shortText(item.reason, 240);
    if (!reason) continue;
    seen.add(id);
    results.push({
      ...cand,
      fit,
      reason,
      matchPoints: (Array.isArray(item.matchPoints) ? item.matchPoints : [])
        .map((m) => shortText(m, 20)).filter(Boolean).slice(0, 3),
      considerations: shortText(item.considerations, 160),
      readinessMatch: readinessMatch(readiness, cand.trl),
    });
  }
  return results.sort((a, b) => b.fit - a.fit).slice(0, MAX_RESULTS);
}
