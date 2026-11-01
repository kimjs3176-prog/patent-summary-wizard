// Pure table builders for the Insights page (institute ranking + data download).
// Every number comes straight from the server snapshot; the only derived value is the
// year-over-year change, which uses the server's own growthRate rule.
import type { TrendSnapshot } from "@/hooks/useFilingTrends";
import { growthRate } from "../../../supabase/functions/filing-trends/trendAggregation";
import { TECHNOLOGY_FIELDS } from "../../../supabase/functions/_shared/technologyFields";

export type Cell = string | number;
export interface ExportTable {
  /** Sheet name / CSV file suffix (≤31 chars, no []:*?/\). */
  name: string;
  header: string[];
  rows: Cell[][];
  widths: number[];
}

const FIELD_LABEL: Record<string, string> = Object.fromEntries(TECHNOLOGY_FIELDS.map((f) => [f.id, f.label]));
export const PROVISIONAL_MONTH_LABEL = "공개 지연으로 집계가 덜 된 달";

export const fmtYmd = (d: string) => (/^\d{8}$/.test(d) ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : d);
export const fmtMonth = (m: string) => (/^\d{6}$/.test(m) ? `${m.slice(0, 4)}-${m.slice(4, 6)}` : m);

/** Institutes ranked by filings over the whole period, with the complete-year change. */
export function instituteRows(data: Pick<TrendSnapshot, "institutes">) {
  return [...data.institutes]
    .sort((a, b) => b.total - a.total || b.latest - a.latest)
    .map((i, idx) => ({ ...i, rank: idx + 1, growth: growthRate(i.latest, i.previous) }));
}

/** Header lines stating which snapshot (period, complete year) a download comes from. */
export function snapshotNote(data: TrendSnapshot): string[] {
  const updated = data.updatedAt ? new Date(data.updatedAt).toISOString().slice(0, 10) : "";
  return [
    "농업 국가연구기관 6곳 특허·실용신안 출원 통계 (출처: KIPRIS)",
    `집계 기간 ${fmtYmd(data.start)}~${fmtYmd(data.end)} · 공개 완료 기준연도 ${data.completeYear}년 · ${fmtYmd(data.disclosedThrough)}까지 출원분 공개 완료(그 뒤 출원은 잠정)${updated ? ` · 자료 갱신 ${updated}` : ""}`,
  ];
}

const blank = (n: number | null) => (n === null ? "" : n);

export function buildInsightsTables(data: TrendSnapshot): ExportTable[] {
  const y = data.completeYear;
  const years = data.yearly.map((r) => r.year);
  const provisionalYears = new Set(data.yearly.filter((r) => r.provisional).map((r) => r.year));

  const yearly: ExportTable = {
    name: "연도별 출원",
    header: ["연도", "출원(건)", "특허(건)", "실용신안(건)", "집계 상태"],
    rows: data.yearly.map((r) => [r.year, r.count, r.patent, r.utility, r.provisional ? "잠정(공개 진행 중)" : "확정"]),
    widths: [8, 10, 10, 12, 18],
  };

  const fieldsSorted = [...data.fields].sort((a, b) => b.latest - a.latest || b.previous - a.previous);
  const fields: ExportTable = {
    name: "기술 분야별 순위",
    header: [
      "순위", "분야", `${y}년 출원(건)`, `${y - 1}년 출원(건)`, "전년 대비 증감률(%)", `${y}년 비중(%)`,
      ...years.map((yr) => `${yr}년${provisionalYears.has(yr) ? "(잠정)" : ""}`),
    ],
    rows: fieldsSorted.map((f, idx) => [
      idx + 1, FIELD_LABEL[f.id] ?? f.id, f.latest, f.previous, blank(f.growth), f.share,
      ...years.map((yr) => f.byYear[String(yr)] ?? 0),
    ]),
    widths: [6, 14, 14, 14, 18, 14, ...years.map(() => 11)],
  };

  const institutes: ExportTable = {
    name: "기관별 출원",
    header: ["순위", "기관", "집계 기간 누적(건)", `${y}년 출원(건)`, `${y - 1}년 출원(건)`, "전년 대비 증감률(%)"],
    rows: instituteRows(data).map((i) => [i.rank, i.label, i.total, i.latest, i.previous, blank(i.growth)]),
    widths: [6, 20, 18, 14, 14, 18],
  };

  const monthly: ExportTable = {
    name: "월별 출원 추이",
    header: ["월", "출원(건)", "집계 상태"],
    rows: data.monthly.map((m) => [fmtMonth(m.month), m.count, m.provisional ? PROVISIONAL_MONTH_LABEL : "집계 완료"]),
    widths: [10, 10, 28],
  };

  return [yearly, fields, institutes, monthly];
}

/** Rows for one sheet/file: snapshot note, a blank spacer, then the table. */
export function tableToAoa(table: ExportTable, note: string[]): Cell[][] {
  return [...note.map((l) => [l]), [], table.header, ...table.rows];
}

/** RFC 4180 quoting plus a guard so spreadsheet apps never evaluate text as a formula. */
export function csvCell(value: Cell | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let s = value;
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** UTF-8 CSV text with BOM so Excel opens Korean text correctly. */
export function toCsv(rows: Cell[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Single CSV holding every table one after another (used when the XLSX writer fails to load). */
export function combinedCsvRows(tables: ExportTable[], note: string[]): Cell[][] {
  const out: Cell[][] = [...note.map((l) => [l])];
  for (const t of tables) out.push([], [`[${t.name}]`], t.header, ...t.rows);
  return out;
}

export const exportFileName = (data: TrendSnapshot, suffix: string, ext: "xlsx" | "csv") =>
  `농식품_특허출원동향_${data.completeYear}년기준${suffix ? `_${suffix.replace(/\s+/g, "")}` : ""}.${ext}`;
