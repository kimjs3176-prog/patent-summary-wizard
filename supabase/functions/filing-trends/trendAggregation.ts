// Pure aggregation rules for the agri-food filing trend report (Insights page).
// No runtime imports beyond the shared classifier so the rules stay unit-testable.
import { classifyTechnology, TECHNOLOGY_FIELDS, type TechnologyFieldId } from "../_shared/technologyFields.ts";

export const INSTITUTE_GROUPS = [
  { id: "rda", label: "농촌진흥청", pattern: /농촌진흥청/ },
  { id: "qia", label: "농림축산검역본부", pattern: /농림축산검역본부/ },
  { id: "naqs", label: "국립농산물품질관리원", pattern: /국립농산물품질관리원/ },
  { id: "seed", label: "국립종자원", pattern: /국립종자원/ },
  { id: "ares", label: "도 농업기술원", pattern: /농업기술원/ },
  { id: "atec", label: "시·군 농업기술센터", pattern: /농업기술센터/ },
] as const;
export type InstituteId = typeof INSTITUTE_GROUPS[number]["id"];

/** KIPRIS only exposes applications ~18 months after filing. */
export const DISCLOSURE_LAG_MONTHS = 18;
export const TREND_YEARS = 5;
export const MIN_GROWTH_BASE = 5;

export interface RawFiling {
  number: string;
  applicant: string;
  ipc: string;
  date: string; // yyyymmdd
  title?: string;
}

export interface TrendReport {
  start: string;
  end: string;
  completeYear: number;
  disclosedThrough: string; // yyyymmdd — filings after this date are still being disclosed
  total: number;
  yearly: { year: number; count: number; patent: number; utility: number; provisional: boolean }[];
  monthly: { month: string; count: number; provisional: boolean }[];
  fields: { id: TechnologyFieldId; byYear: Record<string, number>; latest: number; previous: number; growth: number | null; share: number }[];
  institutes: { id: InstituteId; label: string; total: number; latest: number; previous: number }[];
  recent: { number: string; title: string; applicant: string; date: string; field: TechnologyFieldId }[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;

/** Last calendar year whose filings are fully disclosed, and the disclosure cut-off date. */
export function disclosureWindow(now: Date) {
  const lag = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - DISCLOSURE_LAG_MONTHS, now.getUTCDate()));
  const lagYear = lag.getUTCFullYear();
  const completeYear = lag.getUTCMonth() === 11 && lag.getUTCDate() === 31 ? lagYear : lagYear - 1;
  return { completeYear, disclosedThrough: ymd(lag) };
}

export function trendPeriod(now: Date) {
  const { completeYear } = disclosureWindow(now);
  return { start: `${completeYear - TREND_YEARS + 1}0101`, end: ymd(now) };
}

export function instituteOf(applicant: string): InstituteId | null {
  return INSTITUTE_GROUPS.find((g) => g.pattern.test(applicant))?.id ?? null;
}

export function growthRate(latest: number, previous: number): number | null {
  if (previous < MIN_GROWTH_BASE) return null;
  return Math.round(((latest - previous) / previous) * 100);
}

/** "1020240123456" → "10-2024-0123456" (display/lookup form). */
export function formatApplicationNumber(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length === 13 ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}` : raw;
}

export function aggregateTrends(items: RawFiling[], now: Date): TrendReport {
  const { completeYear, disclosedThrough } = disclosureWindow(now);
  const { start, end } = trendPeriod(now);
  const firstYear = Number(start.slice(0, 4));
  const lastYear = Number(end.slice(0, 4));
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);

  const seen = new Set<string>();
  const kept: (RawFiling & { field: TechnologyFieldId; inst: InstituteId })[] = [];
  for (const it of items) {
    const key = it.number.replace(/\D/g, "");
    if (!key || seen.has(key) || !/^\d{8}$/.test(it.date) || it.date < start || it.date > end) continue;
    const inst = instituteOf(it.applicant);
    if (!inst) continue; // six-institute scope only
    seen.add(key);
    kept.push({ ...it, field: classifyTechnology(it.ipc), inst });
  }

  const yearly = years.map((year) => {
    const rows = kept.filter((k) => Number(k.date.slice(0, 4)) === year);
    const utility = rows.filter((r) => r.number.replace(/\D/g, "").startsWith("20")).length;
    return { year, count: rows.length, patent: rows.length - utility, utility, provisional: year > completeYear };
  });

  const monthly: TrendReport["monthly"] = [];
  const endDate = new Date(Date.UTC(lastYear, Number(end.slice(4, 6)) - 1, 1));
  for (let i = 23; i >= 0; i--) {
    const d = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - i, 1));
    const month = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}`;
    monthly.push({
      month,
      count: kept.filter((k) => k.date.startsWith(month)).length,
      provisional: `${month}31` > disclosedThrough,
    });
  }

  const latestOf = (rows: typeof kept, y: number) => rows.filter((r) => r.date.startsWith(String(y))).length;
  const latestTotal = latestOf(kept, completeYear);
  const fields = TECHNOLOGY_FIELDS.map((f) => {
    const rows = kept.filter((k) => k.field === f.id);
    const byYear = Object.fromEntries(years.map((y) => [String(y), latestOf(rows, y)]));
    const latest = byYear[String(completeYear)] ?? 0;
    const previous = byYear[String(completeYear - 1)] ?? 0;
    return {
      id: f.id,
      byYear,
      latest,
      previous,
      growth: growthRate(latest, previous),
      share: latestTotal ? Math.round((latest / latestTotal) * 1000) / 10 : 0,
    };
  }).filter((f) => Object.values(f.byYear).some((v) => v > 0));

  const institutes = INSTITUTE_GROUPS.map((g) => {
    const rows = kept.filter((k) => k.inst === g.id);
    return { id: g.id, label: g.label, total: rows.length, latest: latestOf(rows, completeYear), previous: latestOf(rows, completeYear - 1) };
  }).filter((i) => i.total > 0).sort((a, b) => b.total - a.total);

  const recent = [...kept]
    .filter((k) => k.title)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12)
    .map((k) => ({ number: formatApplicationNumber(k.number), title: k.title!, applicant: k.applicant, date: k.date, field: k.field }));

  return { start, end, completeYear, disclosedThrough, total: kept.length, yearly, monthly, fields, institutes, recent };
}

/** Every number the AI summary may cite (counts, growth %, shares, years). */
export function allowedNumbers(r: TrendReport): Set<string> {
  const s = new Set<string>();
  const add = (n: number | null | undefined) => { if (typeof n === "number" && Number.isFinite(n)) { s.add(String(n)); s.add(String(Math.abs(n))); } };
  add(r.total); add(r.completeYear); add(r.completeYear - 1);
  r.yearly.forEach((y) => { add(y.year); add(y.count); add(y.patent); add(y.utility); });
  r.fields.forEach((f) => { add(f.latest); add(f.previous); add(f.growth); add(f.share); Object.values(f.byYear).forEach(add); });
  r.institutes.forEach((i) => { add(i.total); add(i.latest); add(i.previous); });
  const yl = r.yearly.find((y) => y.year === r.completeYear);
  const yp = r.yearly.find((y) => y.year === r.completeYear - 1);
  if (yl && yp) add(growthRate(yl.count, yp.count));
  add(TREND_YEARS); add(DISCLOSURE_LAG_MONTHS);
  return s;
}

/** Keep only AI bullets whose every number comes from the computed statistics. */
export function verifiedInsights(raw: unknown, report: TrendReport): string[] {
  const allowed = allowedNumbers(report);
  const list = Array.isArray(raw) ? raw : [];
  return list
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.replace(/\s+/g, " ").trim().slice(0, 160))
    .filter((t) => t.length >= 10)
    .filter((t) => (t.replace(/(\d),(?=\d{3})/g, "$1").match(/\d+(?:\.\d+)?/g) || []).every((n) => allowed.has(n.replace(/^0+(?=\d)/, ""))))
    .slice(0, 4);
}
