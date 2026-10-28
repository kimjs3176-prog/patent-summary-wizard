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

/** A core concept: its own wording (with stems) plus alternative wordings. */
export interface ConceptGroup {
  terms: string[];
  synonyms: string[];
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
): ConceptGroup[] {
  const core = sanitizeNlTerms(must).slice(0, 3);
  const base = core.length > 0 ? core : sanitizeNlTerms(extracted).slice(0, 3);
  if (base.length === 0) return [];
  const groups: ConceptGroup[] = base.map((t) => ({ terms: termVariants(t), synonyms: [] }));
  const taken = (s: string) => groups.some((g) => g.terms.includes(s) || g.synonyms.includes(s));
  base.forEach((t, i) => {
    for (const s of (synonyms[t] ?? []).flatMap((x) => termVariants(x))) {
      if (!taken(s)) groups[i].synonyms.push(s);
    }
  });
  const last = groups[groups.length - 1];
  for (const s of sanitizeNlTerms(should).flatMap((t) => termVariants(t))) {
    if (!taken(s)) last.synonyms.push(s);
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

/**
 * A concept counts when its own wording is in the title or abstract, or a synonym is in
 * the title. Synonyms in the abstract are ignored: short words like "유지" (oil) also
 * mean "maintain" and match unrelated abstracts.
 */
export function conceptCoverage(title: string, abstract: string, groups: ConceptGroup[]): Coverage {
  const nTitle = normalizeText(title);
  const nAbs = normalizeText(abstract);
  let matched = 0;
  let score = 0;
  let titleMatched = 0;
  let firstMatched = false;
  groups.forEach((g, i) => {
    const inTitle = [...g.terms, ...g.synonyms].some((t) => hasTerm(title, nTitle, t));
    const inAbs = !inTitle && g.terms.some((t) => hasTerm(abstract, nAbs, t));
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

/** Concepts a result must cover: all of 1-2 concepts, at least 2 of 3. */
export function requiredConcepts(groupCount: number): number {
  if (groupCount <= 2) return groupCount;
  return Math.max(2, groupCount - 1);
}

interface Rankable {
  title: string;
  titleKo?: string;
  snippet?: string;
}

/**
 * Only patents whose TITLE covers enough of the question's concepts are returned (an
 * empty list is better than unrelated patents). Abstracts mention concepts in passing
 * ("이물질을 제거", "유체를 저장", "건강기능식품"), so abstract hits only affect ranking.
 * Single-concept questions still accept an abstract hit.
 */
export function rankNaturalLanguage<T extends Rankable>(patents: T[], groups: ConceptGroup[]): T[] {
  if (groups.length === 0) return patents;
  const need = requiredConcepts(groups.length);
  return patents
    .map((p, idx) => ({ p, idx, c: conceptCoverage(p.titleKo || p.title || "", p.snippet || "", groups) }))
    .filter((x) => (need <= 1 ? x.c.matched >= 1 : x.c.titleMatched >= need))
    .sort((a, b) =>
      b.c.matched - a.c.matched ||
      Number(b.c.firstMatched) - Number(a.c.firstMatched) ||
      b.c.coverage - a.c.coverage ||
      b.c.titleMatched - a.c.titleMatched ||
      a.idx - b.idx,
    )
    .map((x) => x.p);
}
