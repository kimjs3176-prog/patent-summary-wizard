// The canonical address of each screen, so search engines index every page under its own URL
// (index.html's static canonical always points at the home page). Only the query keys that
// select what the page shows are kept; tracking or cache-busting parameters are dropped.
export const SITE_ORIGIN = "https://atipsum.lovable.app";

const KEEP: Record<string, string[]> = {
  "/": ["patent"],
  "/search": ["keyword"],
  "/batch": ["mode"],
};

export function canonicalFor(pathname: string, search: string): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of KEEP[path] ?? []) {
    const value = params.get(key)?.trim();
    if (value) kept.set(key, value);
  }
  const qs = kept.toString();
  return `${SITE_ORIGIN}${path}${qs ? `?${qs}` : ""}`;
}
