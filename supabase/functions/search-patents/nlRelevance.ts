// Pure ranking rules for natural-language (sentence) searches.
// Kept free of Deno/runtime imports so the rules can be unit-tested.
//
// A sentence such as "딸기 저장기간 늘리고 싶음" is turned into concept groups by the
// AI planner (must = [딸기, 저장성], should = [선도유지]). Results are ranked by how many
// concepts they cover, so a patent about strawberry storage beats one that only
// mentions strawberries. Conversational words ("늘리고", "싶음") never count as matches.

/** Words that never narrow a patent search on their own. */
export const GENERIC_QUERY_TERMS = [
  "제조방법", "제조", "방법", "조성물", "용도", "이용", "장치", "시스템", "기술", "개발",
  "제품", "사용", "포함", "관한", "도입", "검토", "개선", "향상", "증진", "해결", "필요",
  "가능", "효과", "활용", "적용", "연구", "관련", "생산",
];

/** Suffixes stripped to obtain a matching stem ("저장성" → "저장", "저장기간" → "저장"). */
const STEM_SUFFIXES = ["기간", "향상", "증진", "연장", "개선", "기술", "방법", "장치", "시스템", "성"];

export const MIN_NL_RESULTS = 10;

export const normalizeText = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[\s·・.,()\[\]{}<>"'`~!?:;/\\|*-]/g, "")
    .replace(/알코올/g, "알콜");

/** Trim, drop generic/empty terms and duplicates while keeping priority order. */
export function sanitizeNlTerms(terms: unknown[]): string[] {
  const out: string[] = [];
  for (const raw of terms) {
    if (typeof raw !== "string") continue;
    const t = raw.trim();
    if (!t || t.length > 20) continue;
    const n = normalizeText(t);
    if (!n || GENERIC_QUERY_TERMS.includes(n)) continue;
    if (out.some((o) => normalizeText(o) === n)) continue;
    out.push(t);
  }
  return out;
}

/** The term itself plus a shorter stem for derived forms. */
export function termVariants(term: string): string[] {
  const n = normalizeText(term);
  if (!n) return [];
  const out = [n];
  for (const suf of STEM_SUFFIXES) {
    if (n.length - suf.length >= 2 && n.endsWith(suf)) {
      const stem = n.slice(0, -suf.length);
      if (!GENERIC_QUERY_TERMS.includes(stem)) out.push(stem);
      break;
    }
  }
  return Array.from(new Set(out));
}

/** Keep only synonym lists keyed by an actual must term (matched after normalization). */
export function sanitizeSynonymMap(raw: unknown, must: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, list] of Object.entries(raw as Record<string, unknown>)) {
    const target = must.find((m) => normalizeText(m) === normalizeText(key));
    if (!target || !Array.isArray(list)) continue;
    const syns = sanitizeNlTerms(list).filter((s) => normalizeText(s) !== normalizeText(target)).slice(0, 3);
    if (syns.length > 0) out[target] = syns;
  }
  return out;
}

/**
 * KIPRIS title queries in priority order: all concepts AND-ed, then each concept swapped
 * for one of its synonyms, then concept pairs keeping the target (first term), then
 * single terms as a recall net.
 */
export function buildPlanQueries(
  must: string[],
  synonyms: Record<string, string[]> = {},
  should: string[] = [],
  limit = 7,
): string[] {
  if (must.length === 0) return [];
  const queries: string[] = [must.length > 1 ? must.join("*") : must[0]];
  const lastIdx = must.length - 1;
  for (let i = lastIdx; i >= (must.length > 1 ? 1 : 0); i--) {
    const syns = [...(synonyms[must[i]] ?? []), ...(i === lastIdx ? should : [])];
    for (const syn of syns) {
      const swapped = must.map((m, j) => (j === i ? syn : m));
      queries.push(swapped.join("*"));
    }
  }
  if (must.length === 3) {
    queries.push(`${must[0]}*${must[2]}`, `${must[0]}*${must[1]}`);
  }
  for (const k of must) queries.push(k);
  return Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean))).slice(0, limit);
}

/**
 * One group per core concept with its own synonyms. Free synonyms (`should`) broaden
 * the last concept, matching how the planner swaps them into queries.
 */
export function buildConceptGroups(
  must: string[],
  should: string[],
  extracted: string[] = [],
  synonyms: Record<string, string[]> = {},
): string[][] {
  const core = sanitizeNlTerms(must).slice(0, 3);
  const base = core.length > 0 ? core : sanitizeNlTerms(extracted).slice(0, 3);
  if (base.length === 0) return [];
  const groups = base.map((t) => termVariants(t));
  base.forEach((t, i) => {
    for (const s of (synonyms[t] ?? []).flatMap((x) => termVariants(x))) {
      if (!groups.some((g) => g.includes(s))) groups[i].push(s);
    }
  });
  const last = groups[groups.length - 1];
  for (const s of sanitizeNlTerms(should).flatMap((t) => termVariants(t))) {
    if (!groups.some((g) => g.includes(s))) last.push(s);
  }
  return groups;
}

/** 1-char terms (쌀, 콩, 배) only match at the start of a word to avoid 배→배양. */
function hasTerm(rawText: string, normText: string, term: string): boolean {
  if (!term) return false;
  if (term.length === 1) {
    return new RegExp(`(^|[^가-힣])${term}`).test(rawText);
  }
  return normText.includes(term);
}

export interface Coverage {
  matched: number;
  coverage: number;
  firstMatched: boolean;
  titleMatched: number;
}

export function conceptCoverage(title: string, abstract: string, groups: string[][]): Coverage {
  const nTitle = normalizeText(title);
  const nAbs = normalizeText(abstract);
  let matched = 0;
  let score = 0;
  let titleMatched = 0;
  let firstMatched = false;
  groups.forEach((g, i) => {
    const inTitle = g.some((t) => hasTerm(title, nTitle, t));
    const inAbs = !inTitle && g.some((t) => hasTerm(abstract, nAbs, t));
    if (inTitle || inAbs) {
      matched++;
      if (i === 0) firstMatched = true;
    }
    if (inTitle) {
      titleMatched++;
      score += 1;
    } else if (inAbs) {
      score += 0.6;
    }
  });
  return { matched, coverage: groups.length ? score / groups.length : 0, firstMatched, titleMatched };
}

interface Rankable {
  title: string;
  titleKo?: string;
  snippet?: string;
}

/**
 * Patents covering every concept come first. Partial matches only fill the list up to
 * MIN_NL_RESULTS, and patents matching no concept are dropped.
 */
export function rankNaturalLanguage<T extends Rankable>(patents: T[], groups: string[][]): T[] {
  if (groups.length === 0) return patents;
  const scored = patents
    .map((p, idx) => ({ p, idx, c: conceptCoverage(p.titleKo || p.title || "", p.snippet || "", groups) }))
    .filter((x) => x.c.matched > 0)
    .sort((a, b) =>
      b.c.matched - a.c.matched ||
      Number(b.c.firstMatched) - Number(a.c.firstMatched) ||
      b.c.coverage - a.c.coverage ||
      b.c.titleMatched - a.c.titleMatched ||
      a.idx - b.idx,
    );
  const full = scored.filter((x) => x.c.matched === groups.length);
  if (groups.length === 1 || full.length >= MIN_NL_RESULTS) return full.map((x) => x.p);
  const partial = scored.filter((x) => x.c.matched < groups.length).slice(0, MIN_NL_RESULTS - full.length);
  return [...full, ...partial].map((x) => x.p);
}
