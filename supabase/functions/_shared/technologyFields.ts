export const TECHNOLOGY_FIELDS = [
  { id: "food", label: "식품·가공", keyword: "식품", tone: "food" },
  { id: "bio", label: "바이오·생화학", keyword: "미생물", tone: "bio" },
  { id: "breeding", label: "육종·품종", keyword: "육종", tone: "breeding" },
  { id: "health", label: "의약·건강", keyword: "약학", tone: "health" },
  { id: "cosmetics", label: "화장품", keyword: "화장료", tone: "cosmetics" },
  { id: "crop", label: "작물·재배", keyword: "재배", tone: "crop" },
  { id: "machine", label: "농기계", keyword: "농기계", tone: "machine" },
  { id: "livestock", label: "축산·수산", keyword: "사료", tone: "livestock" },
  { id: "protection", label: "병해충·방제", keyword: "방제", tone: "protection" },
  { id: "environment", label: "환경·자원", keyword: "폐기물", tone: "environment" },
  { id: "fertilizer", label: "비료·토양", keyword: "비료", tone: "fertilizer" },
  { id: "digital", label: "센서·정보기술", keyword: "센서", tone: "digital" },
  { id: "other", label: "기타 기술", keyword: "농업", tone: "other" },
] as const;

export type TechnologyFieldId = typeof TECHNOLOGY_FIELDS[number]["id"];
export function classifyTechnology(ipc: string): TechnologyFieldId {
  const code = ipc.toUpperCase().replace(/\s/g, "").split(/[|,;]/)[0];
  if (/^(A23|C12[CFGHJ])/.test(code)) return "food";
  if (/^A01H/.test(code)) return "breeding";
  // Cosmetic preparations are A61K 8/xx; A61K 80/xx must not match.
  if (/^(A61Q|A61K8\/)/.test(code)) return "cosmetics";
  if (/^A61D/.test(code)) return "livestock";
  if (/^A61/.test(code)) return "health";
  if (/^(C12|C07)/.test(code)) return "bio";
  if (/^A01G/.test(code)) return "crop";
  if (/^A01[BCDF]/.test(code)) return "machine";
  if (/^(A01K|A22)/.test(code)) return "livestock";
  if (/^A01[MNP]/.test(code)) return "protection";
  if (/^C05/.test(code)) return "fertilizer";
  if (/^(C02|B09)/.test(code)) return "environment";
  if (/^[GH]/.test(code)) return "digital";
  return "other";
}

export function filingPeriod(now: Date) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 3);
  // Feb 29 clamps to Feb 28 rather than overflowing into March.
  if (start.getUTCMonth() !== end.getUTCMonth()) start.setUTCDate(0);
  const format = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, "");
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