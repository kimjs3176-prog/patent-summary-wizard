// Pure rules for the conversational patent assistant (홈 '물어보기' 탭).
// No runtime imports beyond shared pure modules so the rules stay unit-testable.
import { TECHNOLOGY_FIELDS, type TechnologyFieldId } from "../_shared/technologyFields.ts";

export const CHAT_TOOLS = ["trends", "search", "transfer"] as const;
export type ChatTool = typeof CHAT_TOOLS[number];

export const MAX_HISTORY = 10;
export const MAX_MESSAGE_CHARS = 1500;
export const MAX_PATENT_CARDS = 5;
/** A field must have at least this many filings in the reference year to count as "growing". */
export const MIN_TREND_FIELD_FILINGS = 10;

export interface ChatRoute {
  tools: ChatTool[];
  /** Short search keyword(s) for the patent search, "" when no search is needed. */
  query: string;
  /** True when the user asks for promising technologies without naming a topic. */
  recommendFromTrend: boolean;
}

const QUERY_RE = /[^\w\s가-힣\-·]/gu;
const TREND_RE = /(요즘|요새|최근|동향|트렌드|유망|뜨는|늘어|증가|많이 출원|인기)/;
const TRANSFER_RE = /(기술\s*이전|이전\s*받|라이선스|라이센스|실시권|계약|기술료|신청\s*절차|NATI|무상)/i;
const RECOMMEND_RE = /(기술|특허).*(있|추천|알려|찾|활용|소개)|추천/;
// Words that carry no topic on their own; a query made only of these is treated as "no topic".
const GENERIC_WORDS = new Set([
  "기술", "특허", "추천", "활용", "요즘", "요새", "최근", "좋은", "유망", "동향", "트렌드", "분야", "관련", "정보",
  "어떤", "무엇", "뭐", "있을까", "있나요", "알려줘", "소개", "농업", "농식품", "신기술", "아이템",
]);

/** Clean an AI- or user-provided search keyword: allowed characters only, collapsed spaces, max 40 chars. */
export function sanitizeQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw.replace(QUERY_RE, " ").replace(/\s+/g, " ").trim().slice(0, 40).trim();
  if (cleaned.length < 2) return "";
  const meaningful = cleaned.split(" ").filter((w) => w.length >= 1 && !GENERIC_WORDS.has(w));
  return meaningful.length ? cleaned : "";
}

/** Keyword heuristics used when the AI router fails or returns something unusable. */
export function fallbackRoute(text: string): ChatRoute {
  const tools = new Set<ChatTool>();
  if (TREND_RE.test(text)) tools.add("trends");
  if (TRANSFER_RE.test(text)) tools.add("transfer");
  const query = tools.size ? "" : sanitizeQuery(text);
  if (query) tools.add("search");
  const recommendFromTrend = tools.has("trends") && RECOMMEND_RE.test(text);
  return { tools: CHAT_TOOLS.filter((t) => tools.has(t)), query, recommendFromTrend };
}

/** Validate the AI router's JSON; anything malformed falls back to the keyword heuristics. */
export function normalizeRoute(raw: unknown, text: string): ChatRoute {
  if (!raw || typeof raw !== "object") return fallbackRoute(text);
  const r = raw as Record<string, unknown>;
  const tools = new Set<ChatTool>(
    Array.isArray(r.tools) ? r.tools.filter((t): t is ChatTool => CHAT_TOOLS.includes(t as ChatTool)) : [],
  );
  const query = tools.has("search") ? sanitizeQuery(r.query) : "";
  if (tools.has("search") && !query) tools.delete("search");
  const recommendFromTrend = r.recommendFromTrend === true && !query;
  if (recommendFromTrend) tools.add("trends");
  if (!tools.size && r.smalltalk !== true && r.fromHistory !== true) return fallbackRoute(text);
  return { tools: CHAT_TOOLS.filter((t) => tools.has(t)), query, recommendFromTrend };
}

export interface TrendFieldStat {
  id: TechnologyFieldId;
  latest: number;
  previous: number;
  growth: number | null;
  share: number;
}

const labelOf = (id: string) => TECHNOLOGY_FIELDS.find((f) => f.id === id)?.label ?? id;

/** Field to recommend from when the user asks "what's promising lately?": fastest growth among sizeable fields. */
export function pickTrendField(fields: TrendFieldStat[]): TrendFieldStat | null {
  const sizeable = fields.filter((f) => f.latest >= MIN_TREND_FIELD_FILINGS);
  const growing = sizeable.filter((f) => typeof f.growth === "number" && f.growth > 0)
    .sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0) || b.latest - a.latest);
  if (growing.length) return growing[0];
  const byVolume = [...sizeable].sort((a, b) => b.latest - a.latest);
  return byVolume[0] ?? null;
}

export interface TrendSnapshotLike {
  completeYear: number;
  yearly: { year: number; count: number; provisional: boolean }[];
  fields: TrendFieldStat[];
  insights?: string[];
}

/** Compact, number-exact facts handed to the answer model (it may only quote these). */
export function trendFacts(s: TrendSnapshotLike) {
  const y = s.completeYear;
  const latest = s.yearly.find((r) => r.year === y)?.count ?? 0;
  const prev = s.yearly.find((r) => r.year === y - 1)?.count ?? 0;
  const ranked = s.fields.filter((f) => f.latest > 0).sort((a, b) => b.latest - a.latest);
  const growing = s.fields
    .filter((f) => f.latest >= MIN_TREND_FIELD_FILINGS && typeof f.growth === "number")
    .sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0));
  return {
    기준연도: y,
    기준연도_출원: latest,
    전년_출원: prev,
    연도별_출원: s.yearly.filter((r) => !r.provisional).map((r) => ({ 연도: r.year, 건수: r.count })),
    출원_많은_분야: ranked.slice(0, 5).map((f) => ({ 분야: labelOf(f.id), 건수: f.latest, 비중: f.share })),
    증가율_높은_분야: growing.slice(0, 5).map((f) => ({ 분야: labelOf(f.id), 기준연도: f.latest, 전년: f.previous, 증감률: f.growth })),
    요약: (s.insights ?? []).slice(0, 4),
  };
}

export interface PatentHit {
  patentId: string;
  title: string;
  applicant?: string;
  organizationName?: string;
  applicationDate?: string;
  snippet?: string;
}

export interface ScoreRow {
  patent_number: string;
  total_score: number;
  technology_score: number;
  market_score: number;
  business_score: number;
  trl: number;
}

export interface PatentCard {
  patentId: string;
  title: string;
  applicant: string;
  applicationDate: string;
  snippet: string;
  /** null = not analyzed yet; never estimated. */
  trl: number | null;
  totalScore: number | null;
  technologyScore: number | null;
  marketScore: number | null;
  businessScore: number | null;
}

export const digitsOf = (id: string) => id.replace(/\D/g, "");

export const INSTITUTE_NAMES = ["농촌진흥청", "농림축산검역본부", "국립농산물품질관리원", "국립종자원", "농업기술센터", "농업기술원"];

/** Service scope: only patents filed by the 6 agricultural institutes may be shown. */
export function isInScope(h: Pick<PatentHit, "applicant" | "organizationName">): boolean {
  const owner = h.applicant || h.organizationName || "";
  return INSTITUTE_NAMES.some((n) => owner.includes(n));
}

/** Build cards from retrieved patents only, attaching stored scores when they exist. */
export function buildCards(hits: PatentHit[], scores: ScoreRow[], opts: { newestFirst?: boolean } = {}): PatentCard[] {
  const byKey = new Map<string, ScoreRow>();
  for (const s of scores) byKey.set(s.patent_number, s);
  const seen = new Set<string>();
  const list = hits.filter((h) => {
    const key = digitsOf(h.patentId);
    if (!key || !h.title || seen.has(key) || !isInScope(h)) return false;
    seen.add(key);
    return true;
  });
  if (opts.newestFirst) list.sort((a, b) => (b.applicationDate ?? "").localeCompare(a.applicationDate ?? ""));
  return list.slice(0, MAX_PATENT_CARDS).map((h) => {
    const s = byKey.get(h.patentId) ?? byKey.get(digitsOf(h.patentId));
    return {
      patentId: h.patentId,
      title: h.title,
      applicant: h.applicant || h.organizationName || "",
      applicationDate: h.applicationDate ?? "",
      snippet: (h.snippet ?? "").slice(0, 160),
      trl: s ? s.trl : null,
      totalScore: s ? s.total_score : null,
      technologyScore: s ? s.technology_score : null,
      marketScore: s ? s.market_score : null,
      businessScore: s ? s.business_score : null,
    };
  });
}

export const TRANSFER_GUIDE = {
  제목: "국가직무발명특허 기술이전 6단계 (실시권 허락·라이선싱)",
  단계: [
    "1. 이전 기술 탐색: KIPRIS·NATI에서 관심 기술을 검색합니다.",
    "2. 신청서 제출: NATI(www.nati.or.kr)에서 신청서 작성 후 서류를 첨부합니다.",
    "3. 검토 및 접수: 보완 사항이 있으면 개별 통보 후 재접수합니다.",
    "4. 신청서 결재: 발명자·기관·특허청의 이전 사항을 검토합니다.",
    "5. 계약 체결: 기술이전 승인 및 전자계약을 체결합니다.",
    "6. 정산·납부: 계약 종료 후 기술료를 정산·납부합니다.",
  ],
  무상기술이전: "잠재기술(무상기술이전)은 최초 기술이전에 한하며, 기술이전이 이루어진 경우 유상으로 전환됩니다.",
  문의: "자세한 내용은 NATI(www.nati.or.kr)와 KIPRIS(www.kipris.or.kr)를 참고합니다.",
};
