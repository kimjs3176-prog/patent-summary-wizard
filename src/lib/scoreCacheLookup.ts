// Read-only lookup of already-cached commercialization scores / TRL for list exports.
// Never triggers a new analysis: numbers that were never analysed simply stay blank.

/** patent_score_cache keys are digits-only (current writer) or hyphenated (older rows). */
export const SCORE_LOOKUP_CHUNK = 200;

export interface ScoreCacheRow { patent_number: string; total_score: number | null; trl: number | null }
export interface CachedScore { totalScore: number | null; trl: number | null }
export type ScoreFetcher = (keys: string[]) => Promise<ScoreCacheRow[]>;

export const scoreKey = (num: string) => (num || "").replace(/\D/g, "");

/** Every stored form a number may have: digits, 10-YYYY-NNNNNNN / 10-NNNNNNN, and the input as typed. */
export function scoreKeyVariants(num: string): string[] {
  const d = scoreKey(num);
  if (d.length < 8) return [];
  const out = new Set<string>([d]);
  if (d.length === 13) out.add(`${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`);
  else out.add(`${d.slice(0, 2)}-${d.slice(2)}`);
  const typed = (num || "").trim();
  if (/^\d[\d-]*\d$/.test(typed)) out.add(typed);
  return [...out];
}

/**
 * KIPRIS returns registration numbers as 13 digits (10 + 7-digit number + "0000") while
 * summaries are usually requested as 10-NNNNNNN. Only use this for registration-number
 * columns: an application number ending in 0000 must never be shortened.
 */
export function registrationShortForm(num: string): string | null {
  const d = scoreKey(num);
  return d.length === 13 && d.endsWith("0000") ? d.slice(0, 9) : null;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += Math.max(1, size)) out.push(items.slice(i, i + Math.max(1, size)));
  return out;
}

/**
 * Looks up cached scores for the given numbers in `.in()` chunks of at most `chunkSize` keys.
 * Returns a map keyed by digits-only number. Digits-only rows win over legacy hyphenated rows.
 */
export async function lookupCachedScores(numbers: string[], fetcher: ScoreFetcher, chunkSize = SCORE_LOOKUP_CHUNK): Promise<Map<string, CachedScore>> {
  const keys = [...new Set(numbers.flatMap(scoreKeyVariants))];
  const result = new Map<string, CachedScore>();
  const preferred = new Set<string>();
  const batches = chunk(keys, chunkSize);
  for (let i = 0; i < batches.length; i += 4) {
    const pages = await Promise.all(batches.slice(i, i + 4).map(fetcher));
    for (const row of pages.flat()) {
      const key = scoreKey(row.patent_number);
      if (!key || preferred.has(key)) continue;
      result.set(key, { totalScore: row.total_score ?? null, trl: row.trl ?? null });
      if (row.patent_number === key) preferred.add(key);
    }
  }
  return result;
}

/** First cached score among a row's candidate numbers (e.g. application, then registration). */
export function scoreFor(map: Map<string, CachedScore>, candidates: string[]): CachedScore | null {
  for (const c of candidates) {
    const hit = map.get(scoreKey(c));
    if (hit) return hit;
  }
  return null;
}
