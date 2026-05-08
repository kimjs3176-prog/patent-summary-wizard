import { useEffect, useRef, useState, useMemo } from "react";
import {
  Sparkles, Share2, Loader2, Lightbulb, TrendingUp, Leaf, Rocket, FileText, Mail,
  QrCode, X, Copy, Check, Heart, ExternalLink, Printer, GitCompare, Network,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PatentSummaryProps as BasePatentSummaryProps } from "./types";
import {
  TechnologyCommercializationScore,
  CommercializationDetails,
} from "./TechnologyCommercializationScore";
import { CompetitorComparisonTable } from "./CompetitorComparisonTable";
import { PatentFamilyTree } from "./PatentFamilyTree";
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

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <p className="text-[13px] text-[#8B95A1] font-medium mb-1.5">{label}</p>
      <p className="text-[22px] font-bold text-[#191F28] tracking-tight tabular-nums">
        {value}
        {suffix && <span className="text-[14px] text-[#8B95A1] font-semibold ml-0.5">{suffix}</span>}
      </p>
    </div>
  );
}

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

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
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
    </div>
  );
}

function KeywordChip({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center px-3 py-1.5 rounded-full bg-white text-[13px] font-semibold text-[#4E5968] hover:bg-[#E5E8EB] transition-colors"
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
  const text = md.replace(/[#*_`>\-\[\]\(\)]/g, " ");
  const tokens = text.match(/[가-힣A-Za-z]{2,}/g) || [];
  const stop = new Set(["특허", "발명", "본", "이를", "통해", "있는", "있다", "수", "및", "등", "위한", "관한", "기술", "방법", "the", "and", "for", "with", "이러한", "또한", "그리고", "하는", "되는", "대한", "통한"]);
  const freq = new Map<string, number>();
  for (const t of tokens) {
    if (stop.has(t)) continue;
    if (t.length < 2) continue;
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([w]) => w);
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
          <section className="pt-9 pb-7">
            <p className="text-[13px] font-semibold mb-3" style={{ color: ACCENT_HEX }}>AI 종합 평가</p>
            <h1 className="text-[24px] sm:text-[28px] font-bold leading-[1.3] tracking-[-0.02em] mb-2 text-[#191F28]">
              {title}
            </h1>
            <p className="text-[14px] text-[#8B95A1] font-medium mb-6 tabular-nums">
              {patentData?.searchType === 'application' ? '출원번호' : '등록번호'} · {patentNumber}
            </p>

            <div className="flex items-end gap-3 mb-2">
              {scoreLoading || score == null ? (
                <div className="flex items-center gap-2 h-[72px]">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT_HEX }} />
                  <span className="text-[16px] text-[#8B95A1] font-semibold">사업화 점수 분석 중...</span>
                </div>
              ) : (
                <>
                  <span className="text-[72px] font-bold leading-none tabular-nums tracking-tight" style={{ color: ACCENT_HEX }}>
                    {score}
                  </span>
                  <span className="text-[20px] text-[#8B95A1] font-semibold mb-2">/ 100점</span>
                </>
              )}
            </div>
            <p className="text-[14px] text-[#8B95A1] font-medium">
              상용화 잠재력이 <span className="font-bold text-[#191F28]">{scoreSummary}</span>이에요
            </p>
          </section>

          {/* 핵심 지표 */}
          {details && (
            <section className="mb-3">
              <SoftCard>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="기술성" value={details.technologyScore != null ? String(details.technologyScore) : "-"} suffix="점" />
                  <Stat label="시장성" value={details.marketScore != null ? String(details.marketScore) : "-"} suffix="점" />
                  <Stat label="사업성" value={details.businessScore != null ? String(details.businessScore) : "-"} suffix="점" />
                </div>
              </SoftCard>
            </section>
          )}

          {/* TRL */}
          {details && (
            <section className="mb-10">
              <SoftCard>
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <p className="text-[13px] text-[#8B95A1] font-medium mb-1">기술 성숙도 (TRL)</p>
                    <p className="text-[18px] font-bold">
                      <span className="text-[24px]" style={{ color: trlColor }}>{trl ?? "-"}</span>
                      <span className="text-[#8B95A1] text-[14px] font-semibold ml-1">/ 9 단계</span>
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[12px] font-bold text-white" style={{ background: trlColor }}>
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
              </SoftCard>
            </section>
          )}

          {/* 특허 정보 */}
          {patentData && (
            <section className="mb-10">
              <SectionTitle kicker="특허 정보">한눈에 보는 기본 정보</SectionTitle>
              <SoftCard className="!p-2">
                <div className="bg-white rounded-[16px] px-5">
                  {patentData.applicationNumber && <Row label="출원번호" value={patentData.applicationNumber} />}
                  {patentData.filingDate && <Row label="출원일자" value={patentData.filingDate} />}
                  {patentData.registrationNumber && <Row label="등록번호" value={patentData.registrationNumber} />}
                  {patentData.publicationDate && <Row label={patentData.registrationNumber ? "등록일자" : "공개일자"} value={patentData.publicationDate} />}
                  {patentData.assignee && <Row label="출원인" value={patentData.assignee} />}
                  {patentData.inventors?.length ? (
                    <Row label="발명자" value={patentData.inventors.length >= 5 ? `${patentData.inventors.slice(0, 4).join(", ")} 등 ${patentData.inventors.length}명` : patentData.inventors.join(", ")} />
                  ) : null}
                  {patentData.classifications?.length ? (
                    <Row label="IPC 분류" value={patentData.classifications.slice(0, 3).join(", ")} />
                  ) : null}
                </div>
              </SoftCard>
            </section>
          )}

          {/* 점수 디테일 */}
          {details && (
            <section className="mb-10">
              <SectionTitle kicker="세부 점수">왜 이 점수인가요?</SectionTitle>
              <SoftCard>
                <div className="space-y-5">
                  <ScoreBar label="기술성" value={details.technologyScore} color={ACCENT_HEX} />
                  <ScoreBar label="시장성" value={details.marketScore} color="#3B82F6" />
                  <ScoreBar label="사업성" value={details.businessScore} color="#F59E0B" />
                </div>
              </SoftCard>
            </section>
          )}

          {/* 키워드 */}
          {keywords.length > 0 && (
            <section className="mb-10">
              <SectionTitle kicker="핵심 키워드">기술의 정체성</SectionTitle>
              <SoftCard>
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
              const { kicker, heading, Icon } = sectionMeta(sec.title);
              return (
                <section key={idx} className="mb-10">
                  <SectionTitle kicker={kicker}>{heading}</SectionTitle>
                  <div className="flex items-center gap-2 mb-3 text-[#4E5968]">
                    <Icon className="w-4 h-4" style={{ color: ACCENT_HEX }} />
                    <span className="text-[13px] font-semibold">{sec.title}</span>
                  </div>
                  <div className="space-y-4">
                    {sec.paragraphs.map((p, i) => (
                      <p key={i} className="text-[15.5px] leading-[1.78] text-[#4E5968]">{annotate(p)}</p>
                    ))}
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

      {/* 부가 분석: 사업화 점수 상세 / 경쟁 비교 / 패밀리 트리 (기존 기능 유지) */}
      {patentData && (
        <div className="mt-6 space-y-6">
          <TechnologyCommercializationScore
            score={score}
            isLoading={scoreLoading}
            details={details}
          />
          {competitorAnalysisEnabled && (
            <CompetitorComparisonTable
              patentData={patentData}
              relatedPatents={relatedPatents}
              onPatentClick={onRelatedPatentClick}
            />
          )}
          {patentData.assignee && (
            <PatentFamilyTree patentData={patentData} onPatentClick={onRelatedPatentClick} />
          )}
        </div>
      )}

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