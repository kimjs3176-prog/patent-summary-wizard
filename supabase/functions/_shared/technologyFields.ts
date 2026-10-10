export const TECHNOLOGY_FIELDS = [
  { id: "food", label: "식품·가공", keyword: "식품", tone: "food" },
  { id: "bio", label: "바이오·육종", keyword: "육종", tone: "bio" },
  { id: "crop", label: "작물·재배", keyword: "재배", tone: "crop" },
  { id: "machine", label: "농기계", keyword: "농기계", tone: "machine" },
  { id: "livestock", label: "축산·수산", keyword: "사료", tone: "livestock" },
  { id: "environment", label: "방제·환경", keyword: "방제", tone: "environment" },
  { id: "digital", label: "AI·센서", keyword: "센서", tone: "digital" },
  { id: "other", label: "기타 기술", keyword: "농업", tone: "other" },
] as const;

export type TechnologyFieldId = typeof TECHNOLOGY_FIELDS[number]["id"];
export function classifyTechnology(ipc: string): TechnologyFieldId {
  const code = ipc.toUpperCase().replace(/\s/g, "").split(/[|,;]/)[0];
  if (/^A23/.test(code)) return "food";
  if (/^(C12|C07|A61|A01H)/.test(code)) return "bio";
  if (/^(A01G|A01P)/.test(code)) return "crop";
  if (/^A01[BCDF]/.test(code)) return "machine";
  if (/^(A01K|A22)/.test(code)) return "livestock";
  if (/^(A01[MN]|C02|C05|B09)/.test(code)) return "environment";
  if (/^[GH]/.test(code)) return "digital";
  return "other";
}

export function filingPeriod(now: Date) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 3);
  // Feb 29 clamps to Feb 28 rather than overflowing into March.
  if (start.getUTCMonth() !== end.getUTCMonth()) start.setUTCDate(0);
  const format = (date: Date) => date.toISOString().slice(0, 10).replaceAll("-", "");
  return { start: format(start), end: format(end) };
}

export interface TechnologyStats {
  fields: { id: TechnologyFieldId; count: number }[];
  total: number;
  start: string;
  end: string;
  updatedAt: string;
}

export function aggregateFilings(items: { number: string; applicant: string; ipc: string; date: string }[], start: string, end: string): TechnologyStats["fields"] {
  const counts = new Map<TechnologyFieldId, number>(TECHNOLOGY_FIELDS.map(field => [field.id, 0]));
  const seen = new Set<string>();
  const allowed = /(농촌진흥청|농림축산검역본부|국립농산물품질관리원|국립종자원|농업기술센터|농업기술원)/;
  for (const item of items) {
    if (!item.number || seen.has(item.number) || !allowed.test(item.applicant) || !/^\d{8}$/.test(item.date) || item.date < start || item.date > end) continue;
    seen.add(item.number);
    const field = classifyTechnology(item.ipc);
    counts.set(field, (counts.get(field) ?? 0) + 1);
  }
  return TECHNOLOGY_FIELDS.map(field => ({ id: field.id, count: counts.get(field.id) ?? 0 }));
}