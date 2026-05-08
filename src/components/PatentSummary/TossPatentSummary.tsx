import { useEffect, useRef, useState, useMemo } from "react";
import {
  Sparkles, Share2, Loader2, Lightbulb, TrendingUp, Leaf, Rocket, FileText, Mail,
  QrCode, X, Copy, Check, Heart, ExternalLink, Printer, Link2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PatentSummaryProps as BasePatentSummaryProps } from "./types";
import type { CommercializationDetails } from "./TechnologyCommercializationScore";
import { RelatedPatentsCompact } from "./RelatedPatentsCompact";
import { PdfGenerator } from "./PdfGenerator";
import { PptGenerator } from "./PptGenerator";
import { PrintableContent } from "./PrintableContent";
import { useFavoritePatents } from "@/hooks/useFavoritePatents";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { annotateWithGlossary } from "@/components/GlossaryTooltip";

interface TossPatentSummaryProps extends BasePatentSummaryProps {
  onKeywordClick?: (keyword: string) => void;
  onScoreReady?: (score: number) => void;
}

const SOFT = "#F2F4F6";
const ACCENT_HEX = "#10B981";

function SectionTitle({ children, kicker }: { children: React.ReactNode; kicker?: string }) {
  return (
    <div className="mb-5">
      {kicker && <p className="text-[13px] font-semibold mb-1.5" style={{ color: ACCENT_HEX }}>{kicker}</p>}
      <h2 className="text-[22px] sm:text-[24px] font-bold text-[#191F28] tracking-[-0.02em] leading-[1.3]">
        {children}
      </h2>
    </div>
  );
}

function SoftCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[20px] p-5 sm:p-6 ${className}`} style={{ background: SOFT }}>
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

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} className="font-semibold text-[#191F28]">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

// 본문 자동 하이라이트: 숫자/단위, 핵심 강조 표현을 시각적으로 강조
const HIGHLIGHT_PATTERNS: { regex: RegExp; className: string }[] = [
  // 숫자+단위 (예: 30%, 5kg, 2년, 100mm)
  {
    regex: /(\d+(?:\.\d+)?(?:\s?(?:%|배|개|건|년|월|일|시간|분|초|kg|g|mg|mm|cm|m|km|ml|L|°C|℃|kW|W|Hz|원|만원|억원)))/g,
    className: "font-bold text-[#191F28] bg-[#10B98114] px-1 py-0.5 rounded",
  },
  // 핵심 강조 형용사·표현
  {
    regex: /(우수한|뛰어난|탁월한|혁신적|독보적|차별화된|핵심|최초|세계\s*최초|국내\s*최초|상용화|실용화|특허\s*등록|핵심\s*기술|주요\s*특징|친환경|고효율|자동화|지능형|스마트|AI|인공지능|머신러닝|딥러닝|IoT|빅데이터|블록체인)/g,
    className: "font-semibold",
    // 색상 inline (semantic 토큰 hex) - 아래 wrapper에서 처리
  },
];

function highlightImportant(nodes: React.ReactNode[]): React.ReactNode[] {
  // 텍스트 노드만 패턴 분해. React 요소(GlossaryTerm 등)는 건드리지 않음.
  const out: React.ReactNode[] = [];
  let key = 0;
  for (const node of nodes) {
    if (typeof node !== "string") {
      out.push(node);
      continue;
    }
    let segments: { text: string; type: "plain" | "num" | "kw" }[] = [{ text: node, type: "plain" }];
    // capture group 사용: split 결과에서 홀수 인덱스가 매칭된 부분
    segments = segments.flatMap((seg) => {
      if (seg.type !== "plain") return [seg];
      const parts = seg.text.split(HIGHLIGHT_PATTERNS[0].regex);
      return parts.map((p, i) => ({ text: p, type: (i % 2 === 1 ? "num" : "plain") } as const));
    });
    segments = segments.flatMap((seg) => {
      if (seg.type !== "plain") return [seg];
      const parts = seg.text.split(HIGHLIGHT_PATTERNS[1].regex);
      return parts.map((p, i) => ({ text: p, type: (i % 2 === 1 ? "kw" : "plain") } as const));
    });
    for (const seg of segments) {
      if (!seg.text) continue;
      if (seg.type === "num") {
        out.push(
          <strong
            key={`hl-n-${key++}`}
            className="font-bold text-[#0B7C5C] bg-[#10B9811A] px-1 rounded-[4px]"
          >
            {seg.text}
          </strong>,
        );
      } else if (seg.type === "kw") {
        out.push(
          <strong key={`hl-k-${key++}`} className="font-semibold text-[#191F28]">
            {seg.text}
          </strong>,
        );
      } else {
        out.push(seg.text);
      }
    }
  }
  return out;
}

function ScoreRow({ label, value, color, reason }: { label: string; value: number; color: string; reason?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[14px] font-semibold text-[#191F28]">{label}</span>
        <span className="text-[16px] font-bold tabular-nums" style={{ color }}>
          {value}<span className="text-[12px] text-[#8B95A1] ml-0.5">점</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#E5E8EB] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
      {reason && (
        <p className="mt-2.5 text-[13px] leading-[1.7] text-[#4E5968]">{renderBold(reason)}</p>
      )}
    </div>
  );
}

type KeywordCategory = "function" | "industry" | "material" | "tech" | "general";

const CATEGORY_STYLE: Record<KeywordCategory, { bg: string; text: string; border: string; label: string }> = {
  function: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", label: "기능" },
  industry: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", label: "활용산업" },
  material: { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA", label: "소재" },
  tech:     { bg: "#FAF5FF", text: "#7E22CE", border: "#E9D5FF", label: "기술" },
  general:  { bg: "#FFFFFF", text: "#4E5968", border: "#E5E8EB", label: "기타" },
};

// 카테고리 분류 사전 (부분일치 + 정규식)
function classifyKeyword(word: string): KeywordCategory {
  const w = word.toLowerCase();
  // 활용산업/분야
  if (/(농업|축산|수산|임업|원예|화훼|식품|제약|의약|의료|바이오|헬스|에너지|환경|건설|건축|자동차|항공|조선|반도체|전자|화학|섬유|패션|물류|유통|교육|관광|금융|미용|화장품|가공|제조|산업|시장|소비자|유아|아동|노인|가정|외식|급식|병원|학교|공장|농장|농가|축사|온실|비닐하우스|스마트팜|밭|논|하우스)/.test(word)) return "industry";
  // 소재/원료
  if (/(소재|원료|재료|성분|물질|추출물|분말|입자|섬유|금속|합금|폴리머|수지|세라믹|실리콘|탄소|나노|효소|미생물|균주|배지|용액|용매|용제|첨가제|보조제|식물|곡물|과일|채소|허브|꽃|뿌리|잎|줄기|씨앗|종자|종균|콩|쌀|밀|보리|옥수수|고구마|감자|토마토|딸기|버섯|약초|한약|생약|단백질|지방|당류|비타민|미네랄)/.test(word)) return "material";
  // 기술/장치
  if (/(ai|인공지능|머신러닝|딥러닝|iot|블록체인|빅데이터|클라우드|로봇|자동화|자율주행|센서|카메라|드론|gps|rfid|nfc|5g|알고리즘|네트워크|플랫폼|소프트웨어|하드웨어|모듈|디바이스|controller|제어기|구동부|모터|배터리|회로|기판|디스플레이)/.test(w)) return "tech";
  // 기능/효과/공정
  if (/(분석|측정|감지|판별|판정|진단|검출|예측|인식|식별|추적|모니터링|제어|조절|관리|운영|운용|처리|가공|살포|분사|분무|건조|냉각|가열|살균|멸균|발효|숙성|혼합|배합|성형|코팅|포장|저장|보관|운반|이송|선별|수확|파종|이식|관수|급수|시비|방제|제초|예찰|예방|보호|개선|향상|증대|증가|감소|절감|절약|최적화|효율|품질|안전|편리|간편|신속|정확)/.test(word)) return "function";
  return "general";
}

function KeywordChip({
  children, onClick, category = "general",
}: { children: React.ReactNode; onClick?: () => void; category?: KeywordCategory }) {
  const s = CATEGORY_STYLE[category];
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center px-3 py-1.5 rounded-full text-[13px] font-semibold border transition-all hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {children}
    </button>
  );
}

interface MdSection { title: string; paragraphs: string[]; }
function parseSections(md: string): MdSection[] {
  if (!md) return [];
  const lines = md.split("\n");
  const sections: MdSection[] = [];
  let cur: MdSection | null = null;
  let buf = "";
  const flush = () => {
    if (cur && buf.trim()) cur.paragraphs.push(buf.trim());
    buf = "";
  };
  for (const raw of lines) {
    const line = raw.replace(/\*\*/g, "");
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      flush();
      if (cur) sections.push(cur);
      cur = { title: h[1].trim(), paragraphs: [] };
      continue;
    }
    if (/^#{3,6}\s/.test(line)) continue;
    if (line.trim() === "") { flush(); continue; }
    if (/^\[\^\d+\]:/.test(line.trim())) continue;
    const cleaned = line.replace(/^\s*[-•]\s+/, "").replace(/^\s*\d+\.\s+/, "").replace(/[`_]/g, "").trim();
    buf += (buf ? " " : "") + cleaned;
  }
  flush();
  if (cur) sections.push(cur);
  return sections.filter(s =>
    !/특허\s*기본\s*정보|출처|참고\s*문헌|references?|sources?/i.test(s.title) &&
    s.paragraphs.length > 0
  );
}

function sectionMeta(title: string): { kicker: string; heading: string; Icon: typeof Lightbulb } {
  if (/기술\s*분야/.test(title)) return { kicker: "기술 분야", heading: "어떤 기술인가요?", Icon: Lightbulb };
  if (/발명|요약|특징/.test(title)) return { kicker: "발명 요약", heading: "무엇을 해결하나요?", Icon: FileText };
  if (/시장|동향/.test(title)) return { kicker: "시장 동향", heading: "시장은 어떻게 움직이나요?", Icon: TrendingUp };
  if (/농산업|활용|응용/.test(title)) return { kicker: "농산업 활용", heading: "어디에 쓸 수 있나요?", Icon: Leaf };
  if (/상용화|사업화|전망|성숙/.test(title)) return { kicker: "상용화 전망", heading: "사업화 가능성은?", Icon: Rocket };
  return { kicker: title, heading: title, Icon: FileText };
}

function extractKeywords(md: string, max = 8): string[] {
  if (!md) return [];
  // 핵심 기능 / 활용 가능 산업 중심 — 해당 섹션만 우선 추출
  const sections = parseSections(md);
  const focusText = sections
    .filter((s) => /활용|응용|산업|분야|발명|요약|특징|기능|용도/.test(s.title))
    .map((s) => s.paragraphs.join(" "))
    .join(" ");
  const source = focusText || md;
  const text = source.replace(/[#*_`>\-\[\]\(\)\.,!?;:"']/g, " ");

  // 한글 조사 제거 (단어 끝에 붙는 조사)
  const stripJosa = (w: string): string => {
    const josa2 = ["으로", "에서", "에게", "이나", "이며", "보다", "까지", "부터", "마다", "처럼", "이라", "라는", "이라는", "하는", "되는", "이다", "한다", "된다"];
    const josa1 = ["의", "이", "가", "을", "를", "은", "는", "에", "와", "과", "도", "로", "만", "나", "며", "고"];
    for (const j of josa2) if (w.endsWith(j) && w.length > j.length + 1) return w.slice(0, -j.length);
    for (const j of josa1) if (w.endsWith(j) && w.length > 2) return w.slice(0, -1);
    return w;
  };

  const stop = new Set([
    // 일반어
    "특허", "발명", "본", "이를", "통해", "있는", "있다", "수", "및", "등", "위한", "관한",
    "기술", "방법", "이러한", "또한", "그리고", "하는", "되는", "대한", "통한", "구성", "포함",
    "사용", "제공", "경우", "다양한", "효과", "수행", "특징", "구비", "마련", "이용", "장치", "시스템",
    // 부사/접속사/대명사
    "동시에", "특히", "주로", "매우", "더욱", "보다", "가장", "이후", "이전", "현재", "최근",
    "기존", "기반", "이상", "이하", "내지", "또는", "따라", "따른", "의해", "관련", "해당",
    "본문", "예시", "예를", "들어", "즉", "한편", "한다", "된다", "있어", "없이", "함께",
    // 어미/명사화 단편
    "작업", "복합", "동작", "수단", "구조", "부분", "전체", "내부", "외부", "상부", "하부",
    // 형용사·부사·일반 수식어 (분석 의미 없음)
    "결과적", "효과적", "효율적", "전반적", "지속적", "순차적", "독립적", "상대적", "절대적",
    "구체적", "기본적", "일반적", "근본적", "직접적", "간접적", "필수적", "선택적", "유기적",
    "불규칙", "불규칙한", "규칙적", "다음과", "위와", "아래와", "같이", "비해", "대비",
    "그러나", "하지만", "그래서", "따라서", "때문", "때문에", "위해", "위해서",
    "다소", "약간", "조금", "많이", "거의", "오히려", "역시", "물론", "실제로", "실제",
    "이는", "이로", "이에", "그것", "그것이", "그들", "그들의", "우리", "우리는",
    "있도록", "되도록", "하여", "되어", "이며", "이었", "였다", "였고", "이고", "이라고",
    "위하여", "통하여", "대하여", "관하여",
    // 영문 stopwords
    "the", "and", "for", "with", "this", "that", "from", "into", "are", "was", "were", "has", "have",
  ]);

  // 형용사/부사형 어미 패턴 — 분석 가치 낮은 단어 제거
  const isAdverbAdjLike = (w: string): boolean => {
    if (!/[가-힣]/.test(w)) return false;
    // -적/-적인 형용사형 (예: 결과적, 효과적, 전반적)
    if (/적$/.test(w) && w.length <= 4) return true;
    // -인/-한/-게 등 수식어 어미 (예: 불규칙한, 다양한)
    if (/(인|한|게|히|이|을|를)$/.test(w) && w.length <= 3) return true;
    return false;
  };

  const freq = new Map<string, number>();
  const rawTokens = text.match(/[가-힣A-Za-z]{2,}/g) || [];
  for (const raw of rawTokens) {
    const t = /[가-힣]/.test(raw) ? stripJosa(raw) : raw.toLowerCase();
    if (!t || t.length < 2) continue;
    if (stop.has(t)) continue;
    if (isAdverbAdjLike(t)) continue;
    // 한글은 3자 이상 우선 (2자는 약한 가중치)
    const weight = /[가-힣]/.test(t) ? (t.length >= 3 ? 2 : 1) : 1;
    freq.set(t, (freq.get(t) || 0) + weight);
  }
  // 2자 한글은 빈도 2 이상일 때만 포함
  const filtered = [...freq.entries()].filter(([w, c]) => {
    if (/^[가-힣]{2}$/.test(w) && c < 3) return false;
    return true;
  });
  return filtered.sort((a, b) => b[1] - a[1]).slice(0, max).map(([w]) => w);
}

export function TossPatentSummary({
  content,
  patentNumber,
  isStreaming,
  patentData,
  relatedPatents = [],
  onRelatedPatentClick,
  onKeywordClick,
  onScoreReady,
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

  const favoritesEnabled = settings.feature_favorites !== "false";
  const competitorAnalysisEnabled = settings.feature_competitor_analysis !== "false";
  const glossaryEnabled = settings.feature_glossary !== "false";
  const annotate = (text: string) => (glossaryEnabled ? annotateWithGlossary(text) : text);

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
            body: JSON.stringify({ patentNumber, patentData }),
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
  }, [patentData, patentNumber, isStreaming]);

  const trl = details?.trl ?? null;
  const trlColor = trl == null ? "#9CA3AF" : trl <= 3 ? "#EF4444" : trl <= 6 ? "#F59E0B" : ACCENT_HEX;
  const trlStage = trl == null ? "-" : trl <= 3 ? "기초연구" : trl <= 6 ? "개발/실증" : "상용화";

  const title = patentData?.titleKo || patentData?.title || `특허 ${patentNumber}`;
  const sections = useMemo(() => parseSections(content), [content]);
  const keywords = useMemo(() => extractKeywords(content, 8), [content]);

  const drawings: string[] = useMemo(() => {
    const list: string[] = [];
    if (patentData?.representativeImage) list.push(patentData.representativeImage);
    if (patentData?.images) for (const u of patentData.images) if (!list.includes(u)) list.push(u);
    return list.slice(0, 4);
  }, [patentData]);
  const proxify = (u: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(u)}`;

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

      <div className="bg-white rounded-[24px] border border-[#F2F4F6] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="max-w-[680px] mx-auto px-5 sm:px-7 pb-12">
          {/* HERO */}
          <section className="pt-9 pb-5">
            <h1 className="text-[24px] sm:text-[28px] font-bold leading-[1.3] tracking-[-0.02em] mb-2 text-[#191F28]">
              {title}
            </h1>
            <p className="text-[14px] text-[#8B95A1] font-medium mb-6 tabular-nums">
              {patentData?.searchType === 'application' ? '출원번호' : '등록번호'} · {patentNumber}
            </p>
          </section>

          {/* 한눈에 보는 기본 정보 — 최상단(타이틀 바로 아래) */}
          {patentData && (
            <section className="mb-6">
              <SectionTitle kicker="특허 정보">한눈에 보는 기본 정보</SectionTitle>
              <SoftCard className="!p-2">
                <div className="bg-white rounded-[16px] px-4 sm:px-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {patentData.applicationNumber && <Row label="출원번호" value={patentData.applicationNumber} />}
                  {patentData.filingDate && <Row label="출원일자" value={patentData.filingDate} />}
                  {patentData.registrationNumber && <Row label="등록번호" value={patentData.registrationNumber} />}
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
                </div>
                {(patentData.filingDate || patentData.publicationDate || patentData.registrationDate || patentData.registrationNumber) && (
                  <div className="bg-white rounded-[16px] mt-2">
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
          <section className="mb-8">
            <SectionTitle kicker="AI 평가">사업화 점수 & 기술 성숙도</SectionTitle>
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
                  <div className="flex items-end gap-1 shrink-0">
                    <span className="text-[44px] sm:text-[52px] font-bold leading-none tabular-nums tracking-tight" style={{ color: ACCENT_HEX }}>
                      {score}
                    </span>
                    <span className="text-[14px] text-[#8B95A1] font-semibold mb-1.5">/100</span>
                  </div>
                )}
              </div>

              {/* 세부 점수 — 컴팩트 그리드 */}
              {details && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 py-5 border-b border-[#E5E8EB]">
                  <ScoreRow label="기술성" value={details.technologyScore} color={ACCENT_HEX} reason={details.technologyReason} />
                  <ScoreRow label="시장성" value={details.marketScore} color="#3B82F6" reason={details.marketReason} />
                  <ScoreRow label="사업성" value={details.businessScore} color="#F59E0B" reason={details.businessReason} />
                </div>
              )}

              {/* TRL — 같은 카드 내 통합 */}
              {details && (
                <div className="pt-5">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] text-[#8B95A1] font-semibold">기술 성숙도 (TRL)</span>
                      <span className="text-[18px] font-bold tabular-nums" style={{ color: trlColor }}>{trl ?? "-"}</span>
                      <span className="text-[#8B95A1] text-[12px] font-semibold">/ 9</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold text-white" style={{ background: trlColor }}>
                      {trlStage}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 9 }).map((_, i) => {
                      const lvl = i + 1;
                      const active = trl != null && lvl <= trl;
                      const c = lvl <= 3 ? "#EF4444" : lvl <= 6 ? "#F59E0B" : ACCENT_HEX;
                      return <div key={i} className="flex-1 h-1.5 rounded-full" style={{ background: active ? c : "#E5E8EB" }} />;
                    })}
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-[#8B95A1] font-medium">
                    <span>1 · 기초</span>
                    <span>5 · 실증</span>
                    <span>9 · 상용</span>
                  </div>
                  {details.trlReason && (
                    <p className="mt-3 text-[12.5px] leading-[1.7] text-[#4E5968]">{renderBold(details.trlReason)}</p>
                  )}
                </div>
              )}
            </SoftCard>
          </section>

          {/* 키워드 */}
          {keywords.length > 0 && (
            <section className="mb-8">
              <SectionTitle kicker="핵심 키워드">핵심 기능 · 활용 가능 산업</SectionTitle>
              <SoftCard className="!p-4">
                <div className="flex flex-wrap gap-2">
                  {keywords.map((k) => (
                    <KeywordChip key={k} onClick={() => onKeywordClick?.(k)}>{k}</KeywordChip>
                  ))}
                </div>
              </SoftCard>
            </section>
          )}

          {/* 도면 */}
          {drawings.length > 0 && (
            <section className="mb-10">
              <SectionTitle kicker="특허 도면">한눈에 보는 기술 구성</SectionTitle>
              <SoftCard className="!p-3">
                <div className={drawings.length === 1 ? "flex justify-center" : "grid grid-cols-2 gap-2"}>
                  {drawings.map((url, i) => (
                    <div key={i} className="bg-white rounded-[14px] p-3 flex flex-col items-center">
                      <img
                        src={proxify(url)}
                        alt={`도면 ${i + 1}`}
                        className="w-full h-auto max-h-[280px] object-contain"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                        }}
                      />
                      <p className="text-[12px] text-[#8B95A1] mt-2 font-medium">
                        {i === 0 && patentData?.representativeImage ? "【대표 도면】" : `【도면 ${i + 1}】`}
                      </p>
                    </div>
                  ))}
                </div>
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
                <section key={idx} className="mb-10">
                  <SectionTitle kicker={kicker}>{heading}</SectionTitle>
                  <div className="space-y-4">
                    {sec.paragraphs.map((p, i) => {
                      const annotated = annotate(p);
                      const nodes = Array.isArray(annotated) ? annotated : [annotated];
                      return (
                        <p key={i} className="text-[15.5px] leading-[1.78] text-[#4E5968]">
                          {highlightImportant(nodes as React.ReactNode[])}
                        </p>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}

          {/* AI 종합 의견 */}
          {details?.analysis && (
            <section className="mb-10">
              <div className="rounded-[20px] p-6" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--primary) / 0.03) 100%)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                    <Sparkles className="w-4 h-4" style={{ color: ACCENT_HEX }} />
                  </div>
                  <p className="text-[13px] font-bold" style={{ color: ACCENT_HEX }}>AI 종합 분석</p>
                </div>
                <p className="text-[15px] leading-[1.75] text-[#191F28] font-medium">
                  {details.analysis}
                </p>
              </div>
            </section>
          )}

          {/* 관련 특허 — 기능·특징이 유사한 특허 */}
          {patentData && (
            <section className="mb-10">
              <SectionTitle kicker="관련 특허"><span className="inline-flex items-center gap-2"><Link2 className="w-5 h-5" style={{ color: ACCENT_HEX }} />기능·특징이 유사한 특허</span></SectionTitle>
              <SoftCard className="!p-3">
                <RelatedPatentsCompact patentData={patentData} onPatentClick={onRelatedPatentClick} />
              </SoftCard>
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
              <div className="bg-white p-3 rounded-[12px]">
                <QRCodeSVG value={shareUrl} size={168} level="M" />
              </div>
              <p className="text-[12px] text-[#8B95A1] mt-3 text-center leading-relaxed">
                카메라 앱으로 QR을 스캔하면<br />이 요약서가 바로 열려요
              </p>
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
    </div>
  );
}