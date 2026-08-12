import { useEffect, useRef, useState, useMemo } from "react";
import {
  Sparkles, Share2, Loader2, Lightbulb, TrendingUp, Leaf, Rocket, FileText, Mail,
  QrCode, X, Copy, Check, Heart, ExternalLink, Printer, Link2, RefreshCw, Download,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PatentSummaryProps as BasePatentSummaryProps } from "./types";
import type { CommercializationDetails } from "./TechnologyCommercializationScore";
import { RelatedPatentsCompact } from "./RelatedPatentsCompact";
import { RegulationAnalysis } from "./RegulationAnalysis";
import { TechValuation } from "./TechValuation";

import { PdfGenerator } from "./PdfGenerator";
import { PptGenerator } from "./PptGenerator";
import { PrintableContent } from "./PrintableContent";
import { useFavoritePatents } from "@/hooks/useFavoritePatents";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { annotateWithGlossary } from "@/components/GlossaryTooltip";
import { useAutoGlossary } from "@/hooks/useAutoGlossary";
import { KeywordChip, CATEGORY_STYLE, extractKeywordsFromPatent, type KeywordCategory } from "./_keywords";
import { ImageLightbox } from "./ImageLightbox";

// 중요도 볼드(**...**) + 학명 이탤릭(*..*) 렌더러
function renderBold(text: string): React.ReactNode {
  if (!text) return text;
  // 1) 먼저 **...**를 분리
  const boldParts = text.split(/(\*\*[^*\n]+?\*\*)/g);
  const nodes: React.ReactNode[] = [];
  boldParts.forEach((bp, bi) => {
    const bm = bp.match(/^\*\*([^*\n]+?)\*\*$/);
    if (bm) {
      // 볼드 내부에서도 학명 이탤릭 처리
      const inner = bm[1];
      const italicInside = inner.split(/(\*[A-Za-z][A-Za-z0-9 .\-]{1,60}\*)/g);
      nodes.push(
        <strong key={`b-${bi}`} className="font-bold text-[#191F28]">
          {italicInside.map((ip, ii) => {
            const im = ip.match(/^\*([A-Za-z][A-Za-z0-9 .\-]{1,60})\*$/);
            if (im) return <em key={ii} className="italic">{im[1]}</em>;
            return <span key={ii}>{ip}</span>;
          })}
        </strong>,
      );
      return;
    }
    // 2) 볼드가 아닌 조각에서 학명 이탤릭만 처리
    const italicParts = bp.split(/(\*[A-Za-z][A-Za-z0-9 .\-]{1,60}\*)/g);
    italicParts.forEach((p, i) => {
      const m = p.match(/^\*([A-Za-z][A-Za-z0-9 .\-]{1,60})\*$/);
      if (m) nodes.push(<em key={`i-${bi}-${i}`} className="italic">{m[1]}</em>);
      else if (p) nodes.push(<span key={`t-${bi}-${i}`}>{p}</span>);
    });
  });
  return nodes;
}

interface TossPatentSummaryProps extends BasePatentSummaryProps {
  onKeywordClick?: (keyword: string) => void;
  onScoreReady?: (score: number) => void;
  onRegenerate?: () => void;
}

const SOFT = "#F2F4F6";
const ACCENT_HEX = "#10B981";

/**
 * 출원번호: ##-####-####### (13자리)
 * 등록번호: ##-####### (앞 9자리, 뒤 0000 패딩 제거)
 */
function formatPatentNumber(value: string | undefined | null, kind: 'application' | 'registration'): string {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (kind === 'application') {
    if (digits.length === 13) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return String(value);
  }
  // registration: 7자리 본번호. 13자리 입력이면 앞 2 + 다음 7만 사용
  if (digits.length >= 9) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 9)}`;
  }
  return String(value);
}

function formatAiModelLabel(model?: string): string {
  if (!model) return "Gemini 3.6 Flash";
  const map: Record<string, string> = {
    "google/gemini-3.1-pro-preview": "Gemini 3.1 Pro",
    "google/gemini-2.5-pro": "Gemini 2.5 Pro",
    "google/gemini-3.6-flash": "Gemini 3.6 Flash",
    "google/gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
    "openai/gpt-5": "GPT-5",
    "openai/gpt-5-mini": "GPT-5 Mini",
    "openai/gpt-5-nano": "GPT-5 Nano",
    "openai/gpt-5.2": "GPT-5.2",
  };
  return map[model] || model.replace(/^.*\//, "");
}

function SectionTitle({ children, kicker, index }: { children: React.ReactNode; kicker?: string; index?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2.5 mb-1.5">
        {index && (
          <span className="font-mono text-[10.5px] font-bold tabular-nums text-[#B0B8C1] tracking-[0.1em]">
            §{index}
          </span>
        )}
        {kicker && <span className="bp-kicker">{kicker}</span>}
      </div>
      <h2 className="text-[21px] sm:text-[24px] font-bold text-[#191F28] tracking-[-0.022em] leading-[1.3]">
        {children}
      </h2>
      <div className="mt-3 h-px bg-[repeating-linear-gradient(90deg,#D1D6DB_0_5px,transparent_5px_10px)]" />
    </div>
  );
}

function SoftCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bp-panel p-5 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-[#E5E8EB] last:border-0">
      <span className="text-[14px] text-[#8B95A1] font-medium">{label}</span>
      <span className="text-[14px] text-[#191F28] font-semibold text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function PatentTimeline({
  filingDate,
  publicationDate,
  registrationDate,
  hasRegistration,
}: {
  filingDate?: string;
  publicationDate?: string;
  registrationDate?: string;
  hasRegistration: boolean;
}) {
  const steps = [
    { key: "file", label: "출원", date: filingDate, done: !!filingDate, color: "#3B82F6" },
    { key: "pub", label: "공개", date: publicationDate, done: !!publicationDate, color: "#F59E0B" },
    { key: "reg", label: "등록", date: registrationDate, done: hasRegistration, color: ACCENT_HEX },
  ];
  // Elapsed days from filing to registration (or today if pending)
  const parse = (s?: string) => {
    if (!s) return null;
    const m = s.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (!m) return null;
    return new Date(`${m[1]}-${m[2]}-${m[3]}`);
  };
  const start = parse(filingDate);
  const end = parse(registrationDate) || parse(publicationDate);
  let elapsed: string | null = null;
  if (start && end) {
    const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
    const years = (days / 365).toFixed(1);
    elapsed = `${years}년 (${days.toLocaleString()}일)`;
  }

  return (
    <div className="px-4 sm:px-5 pt-4 pb-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-semibold text-[#8B95A1]">출원 · 등록 경과</p>
        {elapsed && (
          <p className="text-[12px] font-semibold text-[#4E5968] tabular-nums">
            소요 <span style={{ color: ACCENT_HEX }}>{elapsed}</span>
          </p>
        )}
      </div>
      <div className="relative">
        {/* base line */}
        <div className="absolute left-[10%] right-[10%] top-[13px] h-[3px] bg-[#E5E8EB] rounded-full" />
        {/* progress gradient line */}
        <div
          className="absolute left-[10%] top-[13px] h-[3px] rounded-full transition-all duration-500"
          style={{
            background: hasRegistration
              ? "linear-gradient(90deg, #3B82F6 0%, #F59E0B 50%, #10B981 100%)"
              : publicationDate
              ? "linear-gradient(90deg, #3B82F6 0%, #F59E0B 100%)"
              : "#3B82F6",
            width: hasRegistration ? "80%" : publicationDate ? "40%" : filingDate ? "0%" : "0%",
          }}
        />
        <div className="relative grid grid-cols-3 gap-2">
          {steps.map((s) => (
            <div key={s.key} className="flex flex-col items-center text-center">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center border-[2.5px] bg-white shadow-sm transition-all"
                style={{
                  borderColor: s.done ? s.color : "#D1D6DB",
                  background: s.done ? s.color : "#fff",
                  boxShadow: s.done ? `0 0 0 4px ${s.color}1A` : undefined,
                }}
              >
                {s.done && (
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6.5L5 9L9.5 3.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <p
                className="mt-2 text-[12.5px] font-bold"
                style={{ color: s.done ? s.color : "#8B95A1" }}
              >
                {s.label}
              </p>
              <p className="text-[11px] text-[#8B95A1] font-medium tabular-nums mt-0.5 min-h-[14px]">
                {s.date || (s.done ? "" : "—")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function ScoreRow({ label, value, color, reason }: { label: string; value: number; color: string; reason?: string }) {
  // 색상별 은은한 배경(tint) — 세 하위 점수를 시각적으로 분리해 가독성을 높인다
  const tint = `${color}0D`; // ~5% opacity
  const border = `${color}26`; // ~15% opacity
  return (
    <div
      className="min-w-0 rounded-[14px] p-4 sm:p-[18px] border"
      style={{ background: tint, borderColor: border }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-2.5">
        <p className="text-[14px] sm:text-[15px] font-bold text-[#191F28] leading-none">{label}</p>
        <div className="flex items-baseline gap-0.5 shrink-0">
          <span className="text-[26px] sm:text-[30px] font-black tabular-nums leading-none" style={{ color }}>
            {value}
          </span>
          <span className="text-[11px] text-[#8B95A1] font-semibold">/100</span>
        </div>
      </div>
      <div className="h-[6px] rounded-full bg-white/70 overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      {reason && (
        <p className="text-[12.5px] sm:text-[13px] leading-[1.75] text-[#4E5968]">
          {renderBold(reason)}
        </p>
      )}
    </div>
  );
}

// 컴팩트 원형 게이지 — 종합 사업화 점수용
function MiniGauge({ score }: { score: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = c - (pct / 100) * c;
  const color = pct >= 80 ? "#10B981" : pct >= 65 ? "#3B82F6" : pct >= 50 ? "#F59E0B" : "#EF4444";
  return (
    <div className="relative w-[78px] h-[78px] sm:w-[88px] sm:h-[88px] shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#E5E8EB" strokeWidth="7" />
        <circle
          cx="40" cy="40" r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[22px] sm:text-[24px] font-bold tabular-nums" style={{ color }}>{score}</span>
        <span className="text-[9px] text-[#8B95A1] font-semibold mt-0.5">/ 100</span>
      </div>
    </div>
  );
}


interface MdSection {
  title: string;
  paragraphs: string[];
  footnotes?: { num: number; text: string }[];
}
function parseSections(md: string): MdSection[] {
  if (!md) return [];
  const lines = md.split("\n");
  const sections: MdSection[] = [];
  let cur: MdSection | null = null;
  let buf = "";
  let inSourcesBlock = false; // ### 출처 진입 후 footnote 수집 모드
  const flush = () => {
    if (cur && buf.trim()) cur.paragraphs.push(buf.trim());
    buf = "";
  };
  for (const raw of lines) {
    // 마크다운 강조 표기 처리:
    //  - `**...**` (볼드): 중요도 강조로 유지 (렌더러에서 <strong>)
    //  - `*...*` (이탤릭): 라틴어 학명만 유지, 그 외는 평문화
    let line = raw.replace(/^\s*\*\s+/, "");                    // * bullet → plain text
    line = line.replace(/([.!?。．！？])\s+\*\s+/g, "$1 ");       // mid-line pseudo bullet
    line = line.replace(/\*\*\*([^*\n]+?)\*\*\*/g, "**$1**"); // ***x*** → **x**
    // 볼드 마커 내부에 개행/빈 볼드는 평문화
    line = line.replace(/\*\*\s*\*\*/g, "");
    // 볼드 바깥의 단일 이탤릭 마커만 학명 판정으로 정리
    // (볼드 안쪽은 renderBold에서 처리)
    line = line.replace(/(^|[^*])\*([^*\n]{1,80})\*(?!\*)/g, (_full, pre: string, inner: string) => {
      const looksLikeLatin = /^[A-Za-z][A-Za-z0-9 .\-]{1,60}$/.test(inner.trim());
      return pre + (looksLikeLatin ? `*${inner}*` : inner);
    });
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      flush();
      if (cur) sections.push(cur);
      cur = { title: h2[1].trim(), paragraphs: [], footnotes: [] };
      inSourcesBlock = false;
      continue;
    }
    // ### 출처 / 참고문헌 등 헤더 — footnote 수집 모드 진입
    const h3 = line.match(/^#{3,6}\s+(.+?)\s*$/);
    if (h3) {
      flush();
      inSourcesBlock = /출처|참고\s*문헌|references?|sources?/i.test(h3[1]);
      continue;
    }
    // [^N]: 본문 어디서든 footnote 정의로 인식
    const fn = line.match(/^\s*\[\^(\d+)\]:\s*(.+?)\s*$/);
    if (fn && cur) {
      cur.footnotes!.push({ num: parseInt(fn[1], 10), text: fn[2].trim() });
      continue;
    }
    if (line.trim() === "") { flush(); continue; }
    // 출처 블록 내 일반 라인 — "1. 기관명, ..." 또는 "- 기관명" 형식도 footnote로 흡수
    if (inSourcesBlock && cur) {
      // 본문 인용 마커([^N])가 포함되면 본문 문단이 재개된 것 → 출처 모드 종료
      if (/\[\^\d+\]/.test(line)) {
        inSourcesBlock = false;
        const cleaned = line.replace(/^\s*[-•*]\s+/, "").replace(/^\s*\d+\.\s+/, "").replace(/[`_]/g, "").trim();
        buf += (buf ? " " : "") + cleaned;
        continue;
      }
      const numbered = line.match(/^\s*(?:[-•]|\d+\.)\s*(.+?)\s*$/);
      const txt = (numbered ? numbered[1] : line).trim();
      if (txt) {
        const next = (cur.footnotes!.length || 0) + 1;
        cur.footnotes!.push({ num: next, text: txt });
      }
      continue;
    }
    const cleaned = line.replace(/^\s*[-•*]\s+/, "").replace(/^\s*\d+\.\s+/, "").replace(/[`_]/g, "").trim();
    buf += (buf ? " " : "") + cleaned;
  }
  flush();
  if (cur) sections.push(cur);
  // 각주 정리: (1) 동일 텍스트 중복 제거, (2) 1부터 재번호
  for (const s of sections) {
    if (!s.footnotes || s.footnotes.length === 0) continue;
    const seen = new Set<string>();
    const dedup: { num: number; text: string }[] = [];
    const renumber = new Map<number, number>(); // 원본 num → 새 num
    for (const f of s.footnotes) {
      const key = f.text.replace(/\s+/g, " ").trim();
      if (!key) continue;
      if (seen.has(key)) {
        // 중복 출처 — 기존 번호로 매핑
        const existing = dedup.find((d) => d.text.replace(/\s+/g, " ").trim() === key);
        if (existing) renumber.set(f.num, existing.num);
        continue;
      }
      seen.add(key);
      const newNum = dedup.length + 1;
      renumber.set(f.num, newNum);
      dedup.push({ num: newNum, text: f.text });
    }
    s.footnotes = dedup;
    // 본문 단락의 [^N] 인라인 마커를 재번호에 맞춰 갱신
    s.paragraphs = s.paragraphs.map((p) =>
      p.replace(/\[\^(\d+)\]/g, (m, n) => {
        const mapped = renumber.get(parseInt(n, 10));
        return mapped ? `[^${mapped}]` : m;
      }),
    );
    // 본문에 인라인 각주 마커가 하나도 없으면, 마지막 단락 끝에 모든 출처 번호를 자동 부착
    const hasInline = s.paragraphs.some((p) => /\[\^\d+\]/.test(p));
    if (!hasInline && dedup.length > 0 && s.paragraphs.length > 0) {
      const markers = dedup.map((d) => `[^${d.num}]`).join("");
      const lastIdx = s.paragraphs.length - 1;
      s.paragraphs[lastIdx] = s.paragraphs[lastIdx].replace(/\s*$/, "") + markers;
    }
  }
  const parsed = sections.filter(s =>
    !/특허\s*기본\s*정보/i.test(s.title) &&
    (s.paragraphs.length > 0 || (s.footnotes && s.footnotes.length > 0))
  );
  if (parsed.length > 0) return parsed;

  const fallback = md
    .replace(/\*\*/g, "")
    .split("\n")
    .map((line) => line.replace(/^#{1,6}\s+/, "").replace(/^\s*[-•]\s+/, "").replace(/^\s*\d+\.\s+/, "").trim())
    .filter(Boolean)
    .filter((line) => !/^[-–—]{3,}$/.test(line))
    .filter((line) => !/^특허\s*기본\s*정보$/i.test(line));
  return fallback.length > 0 ? [{ title: "AI 요약", paragraphs: fallback, footnotes: [] }] : [];
}


function sectionMeta(title: string): { kicker: string; heading: string; Icon: typeof Lightbulb } {
  if (/기술\s*분야/.test(title)) return { kicker: "기술 분야", heading: "어떤 기술인가요?", Icon: Lightbulb };
  if (/발명|요약|특징/.test(title)) return { kicker: "발명 요약", heading: "무엇을 해결하나요?", Icon: FileText };
  if (/시장|동향/.test(title)) return { kicker: "시장 동향", heading: "시장은 어떻게 움직이나요?", Icon: TrendingUp };
  if (/농산업|활용|응용/.test(title)) return { kicker: "농산업 활용", heading: "어디에 쓸 수 있나요?", Icon: Leaf };
  if (/상용화|사업화|전망|성숙/.test(title)) return { kicker: "상용화 전망", heading: "사업화 가능성은?", Icon: Rocket };
  return { kicker: title, heading: title, Icon: FileText };
}

// 디자인 개편 전 키워드 로직 복원: IPC + 제목/초록 기반의 다층 라벨 추출.
// 카테고리 별 라벨을 직접 만들어 색상 구분에 그대로 사용한다.

export function TossPatentSummary({
  content,
  patentNumber,
  isStreaming,
  patentData,
  relatedPatents = [],
  onRelatedPatentClick,
  onKeywordClick,
  onScoreReady,
  onRegenerate,
  featureFlags = { pdfEnabled: true, pptEnabled: true },
}: TossPatentSummaryProps) {
  const { settings } = useSiteSettings();
  const { isFavorite, toggleFavorite } = useFavoritePatents();
  const patentIsFavorite = patentNumber ? isFavorite(patentNumber) : false;

  const [score, setScore] = useState<number | null>(null);
  const [details, setDetails] = useState<CommercializationDetails | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const aiBodyRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const favoritesEnabled = settings.feature_favorites !== "false";
  const competitorAnalysisEnabled = settings.feature_competitor_analysis !== "false";
  const glossaryEnabled = settings.feature_glossary !== "false";
  const autoGlossary = useAutoGlossary(
    patentNumber,
    content,
    !!isStreaming,
    glossaryEnabled,
    patentData?.titleKo || patentData?.title,
  );
  const annotate = (text: string) => (glossaryEnabled ? annotateWithGlossary(text, autoGlossary) : text);

  const pdfLayoutConfig = useMemo(() => {
    try { return settings.pdf_layout_config ? JSON.parse(settings.pdf_layout_config) : undefined; } catch { return undefined; }
  }, [settings.pdf_layout_config]);

  const printSections = useMemo(() => {
    const defaults = { patentInfo: true, commercialization: true, aiSummary: true, trl: true, claims: false, relatedPatents: false, disclaimer: true };
    try { return settings.print_sections ? { ...defaults, ...JSON.parse(settings.print_sections) } : defaults; } catch { return defaults; }
  }, [settings.print_sections]);

  // 사업화 점수 호출
  useEffect(() => {
    const run = async () => {
      if (!patentData || !patentNumber || isStreaming) return;
      setScoreLoading(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-commercialization`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ patentNumber, patentData, summaryContent: content, analysisMode: "detailed" }),
          }
        );
        const json = await res.json();
        if (json.success) {
          setScore(json.score);
          setDetails(json.details);
          onScoreReady?.(json.score);
        }
      } catch (e) {
        console.error("Commercialization analysis error:", e);
      } finally {
        setScoreLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patentData, patentNumber, isStreaming, content]);

  const trl = details?.trl ?? null;
  const trlColor = trl == null ? "#9CA3AF" : trl <= 3 ? "#EF4444" : trl <= 6 ? "#F59E0B" : ACCENT_HEX;
  const trlStage = trl == null ? "-" : trl <= 3 ? "기초연구" : trl <= 6 ? "개발/실증" : "상용화";

  const title = patentData?.titleKo || patentData?.title || `특허 ${patentNumber}`;
  const sections = useMemo(() => parseSections(content), [content]);
  // 스트리밍 중에는 매 토큰마다 재계산하지 않도록 완료 후에만 요약서 기반으로 추출
  const keywords = useMemo(
    () => extractKeywordsFromPatent(patentData, 8, isStreaming ? undefined : content),
    [patentData, content, isStreaming],
  );

  const drawings: string[] = useMemo(() => {
    return (() => {
    const list: string[] = [];
    if (patentData?.representativeImage) list.push(patentData.representativeImage);
    if (patentData?.images) for (const u of patentData.images) if (!list.includes(u)) list.push(u);
    return list.slice(0, 8);
    })();
  }, [patentData]);

  const proxify = (u: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(u)}`;

  const figureItems = useMemo(
    () =>
      drawings.map((url, i) => ({
        src: proxify(url),
        caption: i === 0 && patentData?.representativeImage ? "【대표 도면】" : `【도면 ${i + 1}】`,
      })),
    [drawings, patentData?.representativeImage],
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const scoreSummary = score == null ? "분석 중" : score >= 80 ? "높은 편" : score >= 65 ? "보통 수준" : "낮은 편";

  // 공유 URL: 항상 published origin 사용 (수신자 접근성)
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const publishedOrigin = "https://atipsum.lovable.app";
    const currentOrigin = window.location.origin;
    const baseOrigin = currentOrigin.includes("-preview--") || currentOrigin.includes("lovableproject.com")
      ? publishedOrigin
      : currentOrigin;
    return `${baseOrigin}/?patent=${encodeURIComponent(patentNumber)}`;
  }, [patentNumber]);

  const shareTitle = `[특허 요약] ${title}`;
  const shareBody =
    `${title}\n` +
    `· 특허번호: ${patentNumber}\n` +
    (score != null ? `· 사업화 점수: ${score}/100 (${scoreSummary})\n` : "") +
    (trl != null ? `· TRL: ${trl}/9 (${trlStage})\n` : "") +
    `\n전체 요약서 보기:\n${shareUrl}\n`;
  const mailtoHref = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareBody)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("링크가 복사되었습니다");
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const handlePrint = () => window.print();

  // QR 이미지를 PNG 파일로 저장
  const downloadQr = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const SCALE = 4;
    const size = 168;
    const source = new XMLSerializer().serializeToString(svg);
    const svgUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(source)));
    const img = new Image();
    img.onload = () => {
      const pad = 16 * SCALE;
      const canvas = document.createElement("canvas");
      canvas.width = size * SCALE + pad * 2;
      canvas.height = size * SCALE + pad * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, pad, pad, size * SCALE, size * SCALE);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `특허요약_QR_${patentNumber || "share"}.png`;
      a.click();
      toast.success("QR 이미지가 저장되었습니다");
    };
    img.onerror = () => toast.error("QR 이미지 저장에 실패했습니다");
    img.src = svgUrl;
  };

  return (
    <div className="text-[#191F28]" style={{ fontFamily: "'Pretendard','Inter',sans-serif" }}>
      {/* Printable (Hidden) */}
      <PrintableContent
        ref={printRef}
        content={content}
        patentNumber={patentNumber}
        patentData={patentData}
        printSections={printSections}
      />

      {/* 액션바: 토스 스타일 미니멀, 기능은 모두 유지 */}
      {!isStreaming && content && (
        <div className="flex items-center justify-between flex-wrap gap-2 mb-6 print:hidden">
          <div className="flex items-center gap-1.5">
            <a href="https://www.nati.or.kr/login.do?selPrgId=xfr_apply" target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-1.5 text-[12.5px] h-9 rounded-full bg-[#191F28] text-white hover:bg-[#333D4B] font-semibold shadow-sm">
                <ExternalLink className="w-3.5 h-3.5" />
                기술이전 신청
              </Button>
            </a>
            {patentData?.applicationNumber && (
              <a href={`https://www.kipris.or.kr/khome/detail/newWindow.do?right=kpat&applno=${patentData.applicationNumber}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5 text-[12.5px] h-9 rounded-full font-medium border-[#E5E8EB] text-[#4E5968]">
                  <FileText className="w-3.5 h-3.5" />
                  특허상세
                </Button>
              </a>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handlePrint} className="gap-1 text-[12px] h-9 px-2.5 rounded-full text-[#4E5968]">
              <Printer className="w-3.5 h-3.5" /> 인쇄
            </Button>
            {onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm("기존 요약서 캐시를 삭제하고 새로 생성합니다. 진행할까요?")) {
                    onRegenerate();
                  }
                }}
                className="gap-1 text-[12px] h-9 px-2.5 rounded-full text-[#4E5968]"
                title="요약서를 새로 생성합니다"
              >
                <RefreshCw className="w-3.5 h-3.5" /> 재생성
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)} className="gap-1 text-[12px] h-9 px-2.5 rounded-full text-[#4E5968]">
              <Share2 className="w-3.5 h-3.5" /> 공유
            </Button>
            {favoritesEnabled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!patentData) return;
                  toggleFavorite({
                    patentNumber,
                    patentData,
                    commercializationScore: score,
                    commercializationDetails: details,
                    summary: content,
                    addedAt: new Date().toISOString(),
                  });
                  toast.success(patentIsFavorite ? "관심특허에서 제거되었습니다" : "관심특허에 담았습니다");
                }}
                className={`gap-1 text-[12px] h-9 px-2.5 rounded-full ${patentIsFavorite ? "text-[#EF4444]" : "text-[#4E5968]"}`}
              >
                <Heart className={`w-3.5 h-3.5 ${patentIsFavorite ? "fill-current" : ""}`} />
                {patentIsFavorite ? "담김" : "담기"}
              </Button>
            )}
            {featureFlags.pdfEnabled && (
              <PdfGenerator
                content={content}
                patentNumber={patentNumber}
                patentData={patentData}
                printRef={printRef}
                commercializationDetails={details}
                commercializationScore={score}
                layoutConfig={pdfLayoutConfig}
              />
            )}
            {featureFlags.pptEnabled && (
              <PptGenerator
                content={content}
                patentNumber={patentNumber}
                patentData={patentData}
                commercializationDetails={details}
                commercializationScore={score}
              />
            )}
          </div>
        </div>
      )}

      <div ref={aiBodyRef} data-toss-summary data-toss-surface className="bp-doc border border-[#DDE2E6] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden max-w-[864px] mx-auto">
        <div className="bp-doc-head">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8B95A1]">
            AI TECH ANALYSIS REPORT
          </span>
          <span className="font-mono text-[10px] tabular-nums tracking-[0.12em] text-[#8B95A1]">
            DOC · {patentNumber}
          </span>
        </div>
        <div className="px-5 sm:px-7 pb-12">
          {/* HERO */}
          <section className="pt-8 pb-5 relative">
            <div className="mb-3 h-px bg-[repeating-linear-gradient(90deg,#D1D6DB_0_5px,transparent_5px_10px)]" />
            <h1 className="text-[24px] sm:text-[28px] font-bold leading-[1.3] tracking-[-0.02em] mb-2 text-[#191F28]">
              {title}
            </h1>
            <p className="font-mono text-[12.5px] text-[#8B95A1] font-medium mb-6 tabular-nums tracking-[0.04em]">
              {patentData?.searchType === 'application' ? '출원번호' : '등록번호'} · {formatPatentNumber(patentNumber, patentData?.searchType === 'application' ? 'application' : 'registration')}
            </p>
          </section>

          {/* 한눈에 보는 기본 정보 — 최상단(타이틀 바로 아래) */}
          {patentData && (
            <section id="sec-basic" data-summary-section data-summary-label="기본 정보" className="mb-6 scroll-mt-24">
              <SectionTitle index="01" kicker="특허 정보">한눈에 보는 기본 정보</SectionTitle>
              <SoftCard className="!p-2">
                <div className="rounded-[4px] px-4 sm:px-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {patentData.applicationNumber && <Row label="출원번호" value={formatPatentNumber(patentData.applicationNumber, 'application')} />}
                  {patentData.filingDate && <Row label="출원일자" value={patentData.filingDate} />}
                  {patentData.registrationNumber && <Row label="등록번호" value={formatPatentNumber(patentData.registrationNumber, 'registration')} />}
                  {patentData.registrationDate
                    ? <Row label="등록일자" value={patentData.registrationDate} />
                    : (patentData.publicationDate && <Row label="공개일자" value={patentData.publicationDate} />)}
                  {patentData.assignee && <Row label="출원인" value={patentData.assignee} />}
                  {patentData.inventors?.length ? (
                    <Row label="발명자" value={patentData.inventors.length >= 5 ? `${patentData.inventors.slice(0, 4).join(", ")} 등 ${patentData.inventors.length}명` : patentData.inventors.join(", ")} />
                  ) : null}
                  {patentData.classifications?.length ? (
                    <Row label="IPC 분류" value={patentData.classifications.slice(0, 3).join(", ")} />
                  ) : null}
                  {/* 관련 키워드 — IPC 우측 여백 활용 */}
                  {keywords.length > 0 && (
                    <div className="py-3 border-b border-[#F2F4F6] last:border-0">
                      <p className="text-[12px] text-[#8B95A1] font-semibold mb-2">관련 키워드</p>
                      {(() => {
                        const grouped = keywords.reduce<Record<KeywordCategory, string[]>>((acc, k) => {
                          (acc[k.cat] ||= []).push(k.word);
                          return acc;
                        }, { function: [], industry: [], material: [], product: [], tech: [], general: [] });
                        const order: KeywordCategory[] = ["function", "industry", "product", "tech"];
                        const flat = order.flatMap((c) => (grouped[c] || []).map((w) => ({ c, w })));
                        return (
                          <div className="flex flex-wrap gap-1.5">
                            {flat.map(({ c, w }) => (
                              <KeywordChip key={`${c}-${w}`} category={c} onClick={() => onKeywordClick?.(w)}>{w}</KeywordChip>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
                {(patentData.filingDate || patentData.publicationDate || patentData.registrationDate || patentData.registrationNumber) && (
                  <div className="mt-2 border-t border-dashed border-[#E5E8EB]">
                    <PatentTimeline
                      filingDate={patentData.filingDate}
                      publicationDate={patentData.publicationDate}
                      registrationDate={patentData.registrationDate}
                      hasRegistration={!!(patentData.registrationDate || patentData.registrationNumber)}
                    />
                  </div>
                )}
              </SoftCard>
            </section>
          )}

          {/* 종합점수 + 세부점수 + TRL 통합 카드 */}
          <section id="sec-score" data-summary-section data-summary-label="사업화 점수" className="mb-8 scroll-mt-24">
            <SectionTitle index="02" kicker="AI 평가">사업화 점수 & 기술 성숙도</SectionTitle>
            <SoftCard>
              {/* 종합점수 헤더 */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#E5E8EB]">
                <div className="min-w-0">
                  <p className="text-[12px] text-[#8B95A1] font-semibold mb-1">종합 사업화 점수</p>
                  {scoreLoading || score == null ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: ACCENT_HEX }} />
                      <span className="text-[13px] text-[#8B95A1] font-semibold">분석 중...</span>
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#4E5968] font-medium">
                      상용화 잠재력 <span className="font-bold text-[#191F28]">{scoreSummary}</span>
                    </p>
                  )}
                </div>
                {score != null && (
                  <MiniGauge score={score} />
                )}
              </div>

              {/* 세부 점수 — 실제 요약서 화면에 반영되는 가로 하위 카드 */}
              {details && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 py-5 border-b border-[#E5E8EB]">
                  <ScoreRow label="기술성" value={details.technologyScore} color={ACCENT_HEX} reason={details.technologyReason} />
                  <ScoreRow label="시장성" value={details.marketScore} color="#3B82F6" reason={details.marketReason} />
                  <ScoreRow label="사업성" value={details.businessScore} color="#F59E0B" reason={details.businessReason} />
                </div>
              )}

              {/* TRL — 같은 카드 내 통합 */}
              {details && (
                <div className="pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] text-[#191F28] font-bold">기술 성숙도</span>
                      <span className="text-[11px] text-[#8B95A1] font-semibold">TRL</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[22px] font-black tabular-nums leading-none" style={{ color: trlColor }}>
                        {trl ?? "-"}
                      </span>
                      <span className="text-[#8B95A1] text-[11px] font-semibold">/ 9</span>
                      <span
                        className="ml-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
                        style={{ background: trlColor }}
                      >
                        {trlStage}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {Array.from({ length: 9 }).map((_, i) => {
                      const lvl = i + 1;
                      const active = trl != null && lvl <= trl;
                      const isCurrent = trl != null && lvl === trl;
                      const c = lvl <= 3 ? "#EF4444" : lvl <= 6 ? "#F59E0B" : ACCENT_HEX;
                      return (
                        <div
                          key={i}
                          className="flex-1 h-7 rounded-[6px] flex items-center justify-center text-[11px] font-bold tabular-nums transition-all"
                          style={{
                            background: active ? c : "#F1F3F5",
                            color: active ? "#FFFFFF" : "#B0B8C1",
                            boxShadow: isCurrent ? `0 0 0 2px #FFFFFF, 0 0 0 3px ${c}` : "none",
                          }}
                        >
                          {lvl}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 text-[10.5px] text-[#8B95A1] font-semibold">
                    <span>1–3 · 기초 연구</span>
                    <span>4–6 · 실증</span>
                    <span>7–9 · 상용화</span>
                  </div>
                  {details.trlReason && (
                    <p className="mt-4 text-[13px] leading-[1.75] text-[#4E5968] bg-[#F9FAFB] rounded-[12px] px-4 py-3">
                      {renderBold(details.trlReason)}
                    </p>
                  )}
                </div>
              )}
            </SoftCard>
          </section>

          {/* 도면 */}
          {drawings.length > 0 && (
            <section id="sec-figures" data-summary-section data-summary-label="특허 도면" className="mb-8 scroll-mt-24">
              <SectionTitle index="03" kicker="특허 도면">한눈에 보는 기술 구성</SectionTitle>
              <SoftCard className="!p-3">
                {/* 대표 도면 */}
                <button
                  type="button"
                  onClick={() => setLightboxIndex(0)}
                  title="클릭하면 확대됩니다"
                  className="w-full bg-white rounded-[14px] p-3 flex flex-col items-center cursor-zoom-in transition-transform hover:scale-[1.01]"
                >
                  <img
                    src={figureItems[0].src}
                    alt={figureItems[0].caption}
                    className="w-full h-auto max-h-[340px] object-contain"
                    decoding="async"
                    onError={(e) => {
                      (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                    }}
                  />
                  <p className="text-[12px] text-[#8B95A1] mt-2 font-medium">{figureItems[0].caption}</p>
                </button>

                {/* 나머지 도면 썸네일 */}
                {figureItems.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {figureItems.slice(1).map((item, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setLightboxIndex(i + 1)}
                        title={`${item.caption} — 클릭하면 확대됩니다`}
                        className="shrink-0 w-[92px] bg-white rounded-[10px] border border-[#E5E8EB] p-2 flex flex-col items-center cursor-zoom-in hover:border-[#B0B8C1] transition-colors"
                      >
                        <img
                          src={item.src}
                          alt={item.caption}
                          className="w-full h-[64px] object-contain"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                          }}
                        />
                        <span className="text-[10px] text-[#8B95A1] mt-1 font-medium truncate w-full text-center">
                          {item.caption}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </SoftCard>
            </section>
          )}

          {/* AI 요약 본문 */}
          {isStreaming && sections.length === 0 ? (
            <section className="mb-10">
              <div className="flex items-center gap-2 text-[#8B95A1]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[14px]">AI가 요약서를 생성 중입니다...</span>
              </div>
            </section>
          ) : (
            sections.map((sec, idx) => {
              const { kicker, heading } = sectionMeta(sec.title);
              return (
                <section key={idx} id={`sec-ai-${idx}`} data-summary-section data-summary-label={heading} className="mb-8 scroll-mt-24">
                  <SectionTitle index={String(idx + 4).padStart(2, "0")} kicker={kicker}>{heading}</SectionTitle>
                  <div className="space-y-4">
                    {sec.paragraphs.map((p, i) => {
                      // 1) [^N] 인라인 마커를 먼저 분리하여 superscript 노드로 변환
                      const refParts = p.split(/(\[\^\d+\])/g);
                      const processed: React.ReactNode[] = [];
                      refParts.forEach((part, j) => {
                        const m = part.match(/^\[\^(\d+)\]$/);
                        if (m) {
                          processed.push(
                            <sup
                              key={`fn-${i}-${j}`}
                              className="ml-[1px] mr-[1px] text-[10px] font-bold align-super"
                              style={{ color: "#10B981" }}
                            >
                              {m[1]}
                            </sup>,
                          );
                        } else if (part) {
                          // 2) 볼드(**...**) → 학명 이탤릭(*...*) 순서로 분리.
                          //    볼드 밖 텍스트는 용어집 주석까지 적용.
                          const boldParts = part.split(/(\*\*[^*\n]+?\*\*)/g);
                          boldParts.forEach((bp, bi) => {
                            if (!bp) return;
                            const bm = bp.match(/^\*\*([^*\n]+?)\*\*$/);
                            if (bm) {
                              // 볼드 내부: 이탤릭만 렌더링 (용어집은 성능/노이즈 회피)
                              const inner = bm[1];
                              const italicInside = inner.split(/(\*[A-Za-z][A-Za-z0-9 .\-]{1,60}\*)/g);
                              processed.push(
                                <strong
                                  key={`b-${i}-${j}-${bi}`}
                                  className="font-bold text-[#191F28]"
                                >
                                  {italicInside.map((ip, ii) => {
                                    const im = ip.match(/^\*([A-Za-z][A-Za-z0-9 .\-]{1,60})\*$/);
                                    if (im) return <em key={ii} className="italic">{im[1]}</em>;
                                    return <span key={ii}>{ip}</span>;
                                  })}
                                </strong>,
                              );
                              return;
                            }
                            // 볼드 바깥: 학명 이탤릭 → 나머지에 용어집 주석
                            const italicParts = bp.split(/(\*[A-Za-z][A-Za-z0-9 .\-]{1,60}\*)/g);
                            italicParts.forEach((ip, k) => {
                              if (!ip) return;
                              const im = ip.match(/^\*([A-Za-z][A-Za-z0-9 .\-]{1,60})\*$/);
                              if (im) {
                                processed.push(
                                  <em
                                    key={`it-${i}-${j}-${bi}-${k}`}
                                    className="italic"
                                    style={{ fontStyle: "italic" }}
                                  >
                                    {im[1]}
                                  </em>,
                                );
                              } else {
                                const annotated = annotate(ip);
                                const nodes = Array.isArray(annotated) ? annotated : [annotated];
                                processed.push(...(nodes as React.ReactNode[]));
                              }
                            });
                          });
                        }
                      });
                      return (
                        <p
                          key={i}
                          className={
                            i === 0
                              ? "text-[16px] leading-[1.8] text-[#191F28] font-medium"
                              : "text-[15.5px] leading-[1.8] text-[#333D4B]"
                          }
                        >
                          {processed}
                        </p>
                      );
                    })}
                  </div>
                  {/* 출처 (각주) — 시장동향 등 출처가 있는 섹션 */}
                  {sec.footnotes && sec.footnotes.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-[#E5E8EB]">
                      <p className="text-[12px] font-bold text-[#8B95A1] mb-2">출처</p>
                      <ol className="space-y-1.5">
                        {sec.footnotes.map((fn) => (
                          <li
                            key={fn.num}
                            className="text-[12.5px] leading-[1.6] text-[#4E5968] flex gap-1.5"
                          >
                            <span className="font-bold tabular-nums shrink-0" style={{ color: "#10B981" }}>
                              {fn.num}.
                            </span>
                            <span>{fn.text}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </section>
              );
            })
          )}

          {/* AI 종합 의견 */}
          {details?.analysis && (
            <section id="sec-analysis" data-summary-section data-summary-label="AI 종합 분석" className="mb-10 scroll-mt-24">
              <div className="rounded-[20px] p-6" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--primary) / 0.03) 100%)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                    <Sparkles className="w-4 h-4" style={{ color: ACCENT_HEX }} />
                  </div>
                  <p className="text-[13px] font-bold" style={{ color: ACCENT_HEX }}>AI 종합 분석</p>
                </div>
                <p className="text-[15px] leading-[1.75] text-[#191F28] font-medium">
                  {renderBold(details.analysis)}
                </p>
              </div>
            </section>
          )}

          {/* 관련 특허 — 기능·특징이 유사한 특허 */}
          {patentData && (
            <section id="sec-related" data-summary-section data-summary-label="관련 특허" className="mb-10 scroll-mt-24">
              <SectionTitle index="99" kicker="관련 특허"><span className="inline-flex items-center gap-2"><Link2 className="w-5 h-5" style={{ color: ACCENT_HEX }} />기능·특징이 유사한 특허</span></SectionTitle>
              <SoftCard className="!p-3">
                <RelatedPatentsCompact patentData={patentData} onPatentClick={onRelatedPatentClick} />
              </SoftCard>
            </section>
          )}

          {/* 사업화 예상 규제 — 요약서 하단으로 이동 */}
          {patentData && !isStreaming && (
            <section id="sec-regulation" data-summary-section data-summary-label="예상 규제" className="mb-10 scroll-mt-24">
              <RegulationAnalysis patentNumber={patentNumber} patentData={patentData} isStreaming={isStreaming} />
            </section>
          )}

          {/* 기술가치 간이평가 (임시 숨김) */}
          {false && patentData && !isStreaming && (
            <section id="sec-valuation" data-summary-section data-summary-label="가치평가" className="mb-10 scroll-mt-24">
              <TechValuation patentData={patentData} score={score} details={details} />
            </section>
          )}

          {/* 액션 버튼 */}
          {!isStreaming && content && (
            <section className="mb-2">
              <button
                onClick={() => setShareOpen(true)}
                className="w-full h-14 rounded-[16px] text-[16px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.99] flex items-center justify-center gap-2"
                style={{ background: ACCENT_HEX }}
              >
                <Share2 className="w-[18px] h-[18px]" />
                이메일·QR로 전송하기
              </button>
            </section>
          )}

          {/* 분석 모델 표기 */}
          {!isStreaming && content && (
            <section className="mt-6 mb-2">
              <div className="flex items-center justify-center gap-1.5 text-[11.5px] text-[#8B95A1]">
                <Sparkles className="w-3 h-3" style={{ color: ACCENT_HEX }} />
                <span>
                  본 분석은 <span className="font-semibold text-[#4E5968]">{formatAiModelLabel(settings.ai_model)}</span> 모델로 생성되었습니다
                </span>
              </div>
            </section>
          )}

          <p className="text-[12px] text-[#8B95A1] text-center leading-relaxed mt-8">
            ※ 본 분석은 특허명세서를 바탕으로 실시하여<br />실제 연구 및 개발 단계와는 상이할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 공유 모달 */}
      {shareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 print:hidden"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="w-full sm:max-w-[420px] bg-white rounded-t-[24px] sm:rounded-[24px] p-6 shadow-2xl animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[18px] font-bold text-[#191F28]">요약서 전송하기</h3>
              <button
                onClick={() => setShareOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-[#F2F4F6] flex items-center justify-center text-[#4E5968]"
                aria-label="닫기"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
            </div>

            <div className="rounded-[16px] bg-[#F2F4F6] p-5 flex flex-col items-center mb-4">
              <p className="text-[13px] font-semibold text-[#4E5968] mb-3 flex items-center gap-1.5">
                <QrCode className="w-4 h-4" /> 휴대폰으로 스캔하기
              </p>
              <div ref={qrRef} className="bg-white p-3 rounded-[12px]">
                <QRCodeSVG value={shareUrl} size={168} level="M" />
              </div>
              <p className="text-[12px] text-[#8B95A1] mt-3 text-center leading-relaxed">
                카메라 앱으로 QR을 스캔하면<br />이 요약서가 바로 열려요
              </p>
              <button
                onClick={downloadQr}
                className="mt-3 h-9 px-4 rounded-full bg-white hover:bg-[#E5E8EB] transition-colors flex items-center gap-1.5 text-[13px] font-bold text-[#191F28]"
              >
                <Download className="w-4 h-4" />
                QR 이미지 저장
              </button>
            </div>

            <a
              href={mailtoHref}
              className="w-full h-12 rounded-[14px] flex items-center justify-center gap-2 text-[15px] font-bold text-white mb-2"
              style={{ background: ACCENT_HEX }}
            >
              <Mail className="w-[18px] h-[18px]" />
              이메일로 보내기
            </a>

            <button
              onClick={copyLink}
              className="w-full h-12 rounded-[14px] flex items-center justify-center gap-2 text-[15px] font-bold text-[#191F28] bg-[#F2F4F6] hover:bg-[#E5E8EB] transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-[18px] h-[18px]" style={{ color: ACCENT_HEX }} />
                  <span style={{ color: ACCENT_HEX }}>링크 복사 완료</span>
                </>
              ) : (
                <>
                  <Copy className="w-[18px] h-[18px]" />
                  링크 복사
                </>
              )}
            </button>

            <p className="text-[11px] text-[#8B95A1] text-center mt-4 leading-relaxed">
              ※ 이메일 버튼은 기기의 메일 앱이 열리며,<br />수신자·내용을 확인 후 발송할 수 있어요.
            </p>
          </div>
        </div>
      )}

      {lightboxIndex !== null && figureItems.length > 0 && (
        <ImageLightbox
          images={figureItems}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}