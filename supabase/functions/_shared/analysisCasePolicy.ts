import { classifyTechnology } from "./technologyFields.ts";

export const CASE_POLICY_VERSION = "source-evidence-v1";
export const INSTITUTE_NAMES = ["농촌진흥청", "농림축산검역본부", "국립농산물품질관리원", "국립종자원", "농업기술센터", "농업기술원"];
export interface CasePatent {
  title?: string; titleKo?: string; assignee?: string; abstract?: string;
  claims?: string[]; description?: string; classifications?: string[];
  patentNumber?: string; applicationNumber?: string; registrationNumber?: string;
}
export interface EvidenceCase {
  id?: string; patent_key: string; identity_keys: string[]; field_id: string;
  ipc_prefix: string; policy_version: string; evidence: string[];
}
export const patentIdentity = (value: string) => value.replace(/\D/g, "");
const text = (value: unknown): string => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
export function sourceSignature(data: CasePatent): string {
  return JSON.stringify([text(data.title || data.titleKo), text(data.assignee), text(data.abstract),
    (data.claims || []).map(text), text(data.description), (data.classifications || []).map(text)]);
}
export function buildEvidenceCase(key: string, data: CasePatent): EvidenceCase | null {
  if (!INSTITUTE_NAMES.some(name => text(data.assignee).includes(name))) return null;
  const ipc = (data.classifications || []).join("|").toUpperCase().replace(/\s/g, "");
  const prefix = ipc.match(/^[A-H]\d{2}[A-Z]/)?.[0];
  const canonical = patentIdentity(data.applicationNumber || data.patentNumber || key);
  if (!prefix || !canonical || !text(data.title || data.titleKo)) return null;
  // Copy only original source passages, never AI-written interpretations or numbers.
  const evidence = [...(data.claims || []).slice(0, 2), data.abstract || ""]
    .map(text).filter(s => s.length >= 40 && s.length <= 2000)
    .filter(s => !/(ignore.{0,30}instructions|system\s*prompt|이전\s*지시.{0,20}무시)/i.test(s)).slice(0, 3);
  if (!evidence.length) return null;
  return { patent_key: canonical, identity_keys: [...new Set([canonical, key, data.patentNumber || "", data.applicationNumber || "", data.registrationNumber || ""].map(patentIdentity).filter(Boolean))],
    field_id: classifyTechnology(ipc), ipc_prefix: prefix, policy_version: CASE_POLICY_VERSION, evidence };
}
export function selectEvidenceCases(current: EvidenceCase, candidates: EvidenceCase[]): EvidenceCase[] {
  const tokens = new Set(current.evidence.join(" ").match(/[가-힣A-Za-z]{3,}/g) || []);
  return candidates.filter(c => c.policy_version === CASE_POLICY_VERSION && c.field_id === current.field_id &&
    c.ipc_prefix === current.ipc_prefix && !c.identity_keys.some(k => current.identity_keys.includes(k)))
    .map(c => ({ c, overlap: new Set((c.evidence.join(" ").match(/[가-힣A-Za-z]{3,}/g) || []).filter(t => tokens.has(t))).size }))
    .filter(r => r.overlap >= 2).sort((a, b) => b.overlap - a.overlap || a.c.patent_key.localeCompare(b.c.patent_key))
    .slice(0, 3).map(r => r.c);
}
export function validateAnalysisResult(kind: string, result: string, trl?: number): boolean {
  if (kind === "summary") return ["기술분야", "발명요약", "관련시장 동향", "농산업활용", "상용화전망"].every(s => result.includes(`## ${s}`));
  return Number.isInteger(trl) && Number(trl) >= 1 && Number(trl) <= 9 && result.length >= 40;
}