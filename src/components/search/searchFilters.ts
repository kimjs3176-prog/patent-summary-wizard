import type { KeywordSearchResult } from "@/components/PatentSummary/types";

/**
 * Client-side filters over the results search-patents already returned.
 * They never re-query the server or change the server's relevance ranking; the
 * state lives in the URL so back/forward and shared links keep it.
 */

/** search-patents also returns these fields; the shared type only lists what the summary needs. */
export type SearchResultRow = KeywordSearchResult & {
  applicationDate?: string;
  applicant?: string;
  organizationName?: string;
};

export type RegisteredFilter = "all" | "registered" | "unregistered";
export type SearchSort = "relevance" | "newest";

export interface SearchFilterState {
  yearFrom: number | null;
  yearTo: number | null;
  orgs: string[];
  registered: RegisteredFilter;
  sort: SearchSort;
}

export const EMPTY_SEARCH_FILTERS: SearchFilterState = { yearFrom: null, yearTo: null, orgs: [], registered: "all", sort: "relevance" };

/** URL query keys owned by the filters (everything else, e.g. keyword/field/fieldId, is preserved). */
export const FILTER_PARAM_KEYS = ["yf", "yt", "org", "reg", "sort"] as const;

const MAX_ORGS = 10;
const MAX_ORG_LENGTH = 80;
const MIN_YEAR = 1950;
const MAX_YEAR = 2100;

function parseYear(raw: string | null): number | null {
  if (!raw || !/^\d{4}$/.test(raw.trim())) return null;
  const y = Number(raw.trim());
  return y >= MIN_YEAR && y <= MAX_YEAR ? y : null;
}

export function parseFilterParams(params: URLSearchParams): SearchFilterState {
  let yearFrom = parseYear(params.get("yf"));
  let yearTo = parseYear(params.get("yt"));
  if (yearFrom !== null && yearTo !== null && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];
  const orgs: string[] = [];
  for (const raw of params.getAll("org")) {
    const org = raw.replace(/\s+/g, " ").trim();
    if (!org || org.length > MAX_ORG_LENGTH || orgs.includes(org)) continue;
    orgs.push(org);
    if (orgs.length >= MAX_ORGS) break;
  }
  const reg = params.get("reg");
  const registered: RegisteredFilter = reg === "1" ? "registered" : reg === "0" ? "unregistered" : "all";
  const sort: SearchSort = params.get("sort") === "newest" ? "newest" : "relevance";
  return { yearFrom, yearTo, orgs, registered, sort };
}

/** Returns a copy of `params` with the filter keys replaced by `state` (defaults are omitted). */
export function writeFilterParams(params: URLSearchParams, state: SearchFilterState): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const k of FILTER_PARAM_KEYS) next.delete(k);
  if (state.yearFrom !== null) next.set("yf", String(state.yearFrom));
  if (state.yearTo !== null) next.set("yt", String(state.yearTo));
  for (const org of state.orgs.slice(0, MAX_ORGS)) next.append("org", org);
  if (state.registered === "registered") next.set("reg", "1");
  if (state.registered === "unregistered") next.set("reg", "0");
  if (state.sort === "newest") next.set("sort", "newest");
  return next;
}

export function isFilterActive(state: SearchFilterState): boolean {
  return state.yearFrom !== null || state.yearTo !== null || state.orgs.length > 0 || state.registered !== "all";
}

const dateDigits = (s?: string) => (s || "").replace(/\D/g, "");

/** Filing (application) year, falling back to the publication date when KIPRIS omitted it. */
export function resultYear(r: SearchResultRow): number | null {
  for (const d of [r.applicationDate, r.publicationDate]) {
    const y = Number(dateDigits(d).slice(0, 4));
    if (y >= MIN_YEAR && y <= MAX_YEAR) return y;
  }
  return null;
}

/** Sort key for 최신순: newest filing first; undated rows go last. */
function dateKey(r: SearchResultRow): string {
  const d = dateDigits(r.applicationDate) || dateDigits(r.publicationDate);
  return d.length >= 8 ? d.slice(0, 8) : d.padEnd(8, "0");
}

export function resultOrg(r: SearchResultRow): string {
  return (r.assignee || r.applicant || r.organizationName || "").replace(/\s+/g, " ").trim();
}

export function isRegisteredResult(r: SearchResultRow): boolean {
  return !!(r.registrationNumber || "").trim();
}

export function applySearchFilters<T extends SearchResultRow>(results: T[], state: SearchFilterState): T[] {
  const out = results.filter((r) => {
    if (state.yearFrom !== null || state.yearTo !== null) {
      const y = resultYear(r);
      if (y === null) return false;
      if (state.yearFrom !== null && y < state.yearFrom) return false;
      if (state.yearTo !== null && y > state.yearTo) return false;
    }
    if (state.orgs.length > 0 && !state.orgs.includes(resultOrg(r))) return false;
    if (state.registered === "registered" && !isRegisteredResult(r)) return false;
    if (state.registered === "unregistered" && isRegisteredResult(r)) return false;
    return true;
  });
  if (state.sort === "newest") {
    // Array.prototype.sort is stable, so ties keep the server's relevance order.
    return out
      .map((r, i) => ({ r, i, k: dateKey(r) }))
      .sort((a, b) => b.k.localeCompare(a.k) || a.i - b.i)
      .map((x) => x.r);
  }
  return out;
}

/** Most frequent applicants among the results (top `limit`), plus any selected ones not in that top list. */
export function topOrgs(results: SearchResultRow[], limit = 8, selected: string[] = []): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of results) {
    const org = resultOrg(r);
    if (org) counts.set(org, (counts.get(org) || 0) + 1);
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .map(([name, count]) => ({ name, count }));
  const top = ranked.slice(0, limit);
  for (const s of selected) {
    if (!top.some((t) => t.name === s)) top.push({ name: s, count: counts.get(s) || 0 });
  }
  return top;
}

export function yearRange(results: SearchResultRow[]): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const r of results) {
    const y = resultYear(r);
    if (y === null) continue;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return Number.isFinite(min) ? { min, max } : null;
}
