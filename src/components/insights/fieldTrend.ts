// Field trend figures for the search-results panel. The shared filing-trends snapshot is the
// source of truth (same numbers as the Insights page); search-result counts are secondary.
import type { TrendSnapshot } from "@/hooks/useFilingTrends";
import { TECHNOLOGY_FIELDS } from "../../../supabase/functions/_shared/technologyFields";

/** Field id from the /search?fieldId= param, falling back to the field label in ?field=. */
export function resolveFieldId(fieldId: string, fieldName: string): string | null {
  if (TECHNOLOGY_FIELDS.some((f) => f.id === fieldId)) return fieldId;
  const name = fieldName.trim();
  return TECHNOLOGY_FIELDS.find((f) => f.label === name)?.id ?? null;
}

export interface FieldSnapshotTrend {
  completeYear: number;
  latest: number;
  previous: number;
  growth: number | null;
  firstYear: number;
  lastYear: number;
  years: { year: string; count: number; provisional: boolean; completeCount: number | null }[];
}

/** The snapshot's yearly counts for one field, keeping the server's provisional marks. */
export function fieldSnapshotTrend(
  snapshot: Pick<TrendSnapshot, "fields" | "yearly" | "completeYear">,
  fieldId: string,
  fieldName: string,
): FieldSnapshotTrend | null {
  const id = resolveFieldId(fieldId, fieldName);
  const field = id ? snapshot.fields.find((f) => f.id === id) : undefined;
  if (!field || snapshot.yearly.length === 0) return null;
  const years = snapshot.yearly.map((r) => {
    const count = field.byYear[String(r.year)] ?? 0;
    return { year: String(r.year), count, provisional: r.provisional, completeCount: r.provisional ? null : count };
  });
  return {
    completeYear: snapshot.completeYear,
    latest: field.latest,
    previous: field.previous,
    growth: field.growth,
    firstYear: snapshot.yearly[0].year,
    lastYear: snapshot.yearly[snapshot.yearly.length - 1].year,
    years,
  };
}

/** Publication-year counts of the current search results (last 10 years present). */
export function resultYearCounts(results: { publicationDate?: string }[]) {
  const map = new Map<string, number>();
  for (const r of results) {
    const year = (r.publicationDate || "").replace(/\D/g, "").slice(0, 4);
    if (/^(19|20)\d{2}$/.test(year)) map.set(year, (map.get(year) || 0) + 1);
  }
  const years = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-10).map(([year, count]) => ({ year, count }));
  const total = years.reduce((s, d) => s + d.count, 0);
  const last = years[years.length - 1];
  const prev = years.length > 1 ? years[years.length - 2] : null;
  const delta = last && prev && prev.count > 0 ? Math.round(((last.count - prev.count) / prev.count) * 100) : null;
  return { years, total, lastYear: last?.year ?? "", delta };
}
