export const TECHNOLOGY_FIELDS = [
  { id: "food", label: "식품", keyword: "식품", tone: "food" },
  { id: "processing", label: "가공장치", keyword: "가공장치", tone: "machine" },
  { id: "storage", label: "식품보존", keyword: "선도유지", tone: "food" },
  { id: "fermentation", label: "발효식품", keyword: "발효", tone: "food" },
  { id: "bio", label: "바이오", keyword: "미생물", tone: "bio" },
  { id: "chemistry", label: "생화학", keyword: "펩타이드", tone: "bio" },
  { id: "breeding", label: "육종", keyword: "육종", tone: "breeding" },
  { id: "variety", label: "품종", keyword: "품종", tone: "breeding" },
  { id: "health", label: "의약", keyword: "약학", tone: "health" },
  { id: "cosmetics", label: "화장품", keyword: "화장료", tone: "cosmetics" },
  { id: "crop", label: "재배", keyword: "재배", tone: "crop" },
  { id: "machine", label: "농기계", keyword: "농기계", tone: "machine" },
  { id: "livestock", label: "축산", keyword: "사료", tone: "livestock" },
  { id: "aquaculture", label: "수산", keyword: "양식", tone: "livestock" },
  { id: "protection", label: "작물보호", keyword: "방제", tone: "protection" },
  { id: "environment", label: "수처리", keyword: "수처리", tone: "environment" },
  { id: "recycling", label: "자원재활용", keyword: "폐기물", tone: "environment" },
  { id: "fertilizer", label: "비료", keyword: "비료", tone: "fertilizer" },
  { id: "soil", label: "토양개량", keyword: "토양", tone: "fertilizer" },
  { id: "digital", label: "센서", keyword: "센서", tone: "digital" },
  { id: "computing", label: "정보처리", keyword: "데이터", tone: "digital" },
  { id: "control", label: "자동제어", keyword: "제어", tone: "digital" },
  { id: "electronics", label: "전자기술", keyword: "전자", tone: "digital" },
  { id: "other", label: "기타 기술", keyword: "농업", tone: "other" },
] as const;

export type TechnologyFieldId = typeof TECHNOLOGY_FIELDS[number]["id"];
export function classifyTechnology(ipc: string): TechnologyFieldId {
  const code = ipc.toUpperCase().replace(/\s/g, "").split(/[|,;]/)[0];
  if (/^A23N/.test(code)) return "processing";
  if (/^A23B/.test(code)) return "storage";
  if (/^C12[CFGHJ]/.test(code)) return "fermentation";
  if (/^A23/.test(code)) return "food";
  if (/^A01H[56]\//.test(code)) return "variety";
  if (/^A01H/.test(code)) return "breeding";
  if (/^(A61Q|A61K8\/)/.test(code)) return "cosmetics";
  if (/^A61D/.test(code)) return "livestock";
  if (/^A61/.test(code)) return "health";
  if (/^C12/.test(code)) return "bio";
  if (/^C07/.test(code)) return "chemistry";
  if (/^A01G/.test(code)) return "crop";
  if (/^A01[BCDF]/.test(code)) return "machine";
  if (/^A01K(6[1-3]|[7-9]\d)\//.test(code)) return "aquaculture";
  if (/^(A01K|A22)/.test(code)) return "livestock";
  if (/^A01[MNP]/.test(code)) return "protection";
  if (/^C05/.test(code)) return "fertilizer";
  if (/^C09K17\//.test(code)) return "soil";
  if (/^C02/.test(code)) return "environment";
  if (/^B09/.test(code)) return "recycling";
  if (/^G01/.test(code)) return "digital";
  if (/^G06/.test(code)) return "computing";
  if (/^G05/.test(code)) return "control";
  if (/^H/.test(code)) return "electronics";
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