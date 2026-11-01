import { useEffect, useRef, useState, useMemo } from "react";
import { Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { PatentSummaryProps as BasePatentSummaryProps } from "./types";
import { useTrlConfig, type CommercializationDetails } from "./commercialization";
import { printWebSummary } from "./PdfGenerator";
import { useFavoritePatents } from "@/hooks/useFavoritePatents";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { safeFetch } from "@/lib/safeFetch";
import { annotateWithGlossary } from "@/components/GlossaryTooltip";
import { useAutoGlossary } from "@/hooks/useAutoGlossary";
import { extractKeywordsFromPatent } from "./_keywords";
import { ImageLightbox } from "./ImageLightbox";
import { useGovtPatent } from "./GovtPatentInfo";
import { useRegisterOwner, isDifferentOwner } from "./useRegisterOwner";
import { SummaryReadyProvider, useSummaryPending } from "./summaryReady";
import { ACCENT_HEX, parseSections, formatAiModelLabel } from "./toss/helpers";
import { ActionBar } from "./toss/ActionBar";
import { HeroSection } from "./toss/HeroSection";
import { BasicInfoSection } from "./toss/BasicInfoSection";
import { ScoreSection } from "./toss/ScoreSection";
import { FiguresSection } from "./toss/FiguresSection";
import { AiSummarySections } from "./toss/AiSummarySections";
import { AnalysisSection } from "./toss/AnalysisSection";
import { RelatedSection } from "./toss/RelatedSection";
import { RegulationSection } from "./toss/RegulationSection";
import { ShareDialog } from "./toss/ShareDialog";

interface TossPatentSummaryProps extends BasePatentSummaryProps {
  onKeywordClick?: (keyword: string) => void;
  onScoreReady?: (score: number) => void;
  onRegenerate?: () => void;
}

function formatGeneratedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function TossPatentSummaryInner({
  content,
  patentNumber,
  isStreaming,
  patentData,
  relatedPatents = [],
  onRelatedPatentClick,
  onKeywordClick,
  onScoreReady,
  onRegenerate,
  featureFlags = { pdfEnabled: true },
  summaryMeta = null,
}: TossPatentSummaryProps) {
  const { settings } = useSiteSettings();
  const trlConfig = useTrlConfig();
  const { isFavorite, toggleFavorite, favorites, updateFavorite } = useFavoritePatents();
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
  const glossaryEnabled = settings.feature_glossary !== "false";
  const autoGlossary = useAutoGlossary(
    patentNumber,
    content,
    !!isStreaming,
    glossaryEnabled,
    patentData?.titleKo || patentData?.title,
  );
  const annotate = (text: string) => (glossaryEnabled ? annotateWithGlossary(text, autoGlossary) : text);

  // 사업화 점수 호출 — 특허가 바뀌면 이전 요청의 늦은 응답은 버린다.
  useEffect(() => {
    if (!patentData || !patentNumber || isStreaming) return;
    let cancelled = false;
    const controller = new AbortController();
    const run = async () => {
      setScoreLoading(true);
      try {
        const res = await safeFetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-commercialization`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            // 현재 서버는 patent_data_cache / patent_ai_cache 저장본만 쓰고 아래 두 필드는 무시한다.
            // 재배포 전의 이전 함수가 이 필드를 요구하므로 배포 순서와 무관하게 동작하도록 함께 보낸다.
            body: JSON.stringify({ patentNumber, patentData, summaryContent: content, analysisMode: "detailed" }),
            timeoutMs: 90000,
            retries: 1,
            signal: controller.signal,
          }
        );
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          setScore(json.score);
          setDetails(json.details);
          onScoreReady?.(json.score);
        }
      } catch (e) {
        if (!cancelled) console.error("Commercialization analysis error:", e);
      } finally {
        if (!cancelled) setScoreLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patentData, patentNumber, isStreaming, content]);

  // "담기"를 분석 완료 전에 눌렀으면 점수·TRL이 비어 저장된다. 점수가 도착하면 저장본을 채운다.
  useEffect(() => {
    if (!patentNumber || score == null || !details) return;
    const stored = favorites.find((f) => f.patentNumber === patentNumber);
    if (stored && (stored.commercializationScore == null || !stored.commercializationDetails)) {
      updateFavorite(patentNumber, { commercializationScore: score, commercializationDetails: details });
    }
  }, [favorites, patentNumber, score, details, updateFavorite]);

  const registrationNumberForLookup =
    patentData?.registrationNumber || (patentData && patentData.searchType !== 'application' ? patentNumber : undefined);
  const govtPatent = useGovtPatent(registrationNumberForLookup);
  const { finalOwner, loading: ownerLoading } = useRegisterOwner(registrationNumberForLookup);
  const ownerChanged = isDifferentOwner(patentData?.assignee, finalOwner);

  // 모든 섹션 로딩이 끝나야 PDF 다운로드를 허용한다.
  const pendingSections = useSummaryPending();
  const allReady =
    !isStreaming && !!content && !scoreLoading && !ownerLoading && pendingSections === 0;

  const trl = details?.trl ?? null;
  const trlColor = trl == null ? "#9CA3AF" : trl <= 3 ? "#EF4444" : trl <= 6 ? "#F59E0B" : ACCENT_HEX;
  const trlStage = trl == null ? "-" : trl <= 3 ? "기초연구" : trl <= 6 ? "개발/실증" : "상용화";
  const trlName = trl != null ? trlConfig.levels.find((l) => l.level === trl)?.label : null;

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

  const handlePrint = async () => {
    const opened = await printWebSummary(printRef.current, patentNumber);
    if (!opened) toast.error("인쇄 화면을 열지 못했습니다. 다시 시도해주세요.");
  };

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
      {/* 액션바: 토스 스타일 미니멀, 기능은 모두 유지 */}
          <ActionBar isStreaming={isStreaming} content={content} patentData={patentData} handlePrint={handlePrint} onRegenerate={onRegenerate} setShareOpen={setShareOpen} favoritesEnabled={favoritesEnabled} toggleFavorite={toggleFavorite} patentNumber={patentNumber} score={score} details={details} patentIsFavorite={patentIsFavorite} featureFlags={featureFlags} printRef={printRef} allReady={allReady} />

      <div ref={(node) => { aiBodyRef.current = node; printRef.current = node; }} data-toss-summary data-toss-surface className="bp-doc precision-report border border-border overflow-hidden max-w-[864px] mx-auto">
        <div className="bp-doc-head">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#6B7684]">
            AI TECH ANALYSIS REPORT
          </span>
          <span className="font-mono text-[10px] tabular-nums tracking-[0.12em] text-[#6B7684]">
            DOC · {patentNumber}
          </span>
        </div>
        <div className="px-5 sm:px-7 pb-12">
          {/* HERO */}
          <HeroSection patentData={patentData} title={title} patentNumber={patentNumber} govtPatent={govtPatent} />

          {/* 한눈에 보는 기본 정보 — 최상단(타이틀 바로 아래) */}
          <BasicInfoSection patentData={patentData} ownerChanged={ownerChanged} finalOwner={finalOwner} keywords={keywords} onKeywordClick={onKeywordClick} govtPatent={govtPatent} />

          {/* 종합점수 + 세부점수 + TRL 통합 카드 */}
          <ScoreSection scoreLoading={scoreLoading} score={score} scoreSummary={scoreSummary} details={details} trlColor={trlColor} trl={trl} trlName={trlName} trlStage={trlStage} trlConfig={trlConfig} />

          {/* 도면 */}
          <FiguresSection drawings={drawings} figureItems={figureItems} setLightboxIndex={setLightboxIndex} />

          {/* AI 요약 본문 */}
          <AiSummarySections isStreaming={isStreaming} sections={sections} annotate={annotate} />

          {/* AI 종합 의견 */}
          <AnalysisSection details={details} />

          {/* 관련 특허 — 기능·특징이 유사한 특허 */}
          <RelatedSection patentData={patentData} onRelatedPatentClick={onRelatedPatentClick} />

          {/* 사업화 예상 규제 — 요약서 하단으로 이동 */}
          <RegulationSection patentData={patentData} isStreaming={isStreaming} patentNumber={patentNumber} />

          {/* 액션 버튼 */}
          {!isStreaming && content && (
            <section className="mb-2 print:hidden">
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

          {/* 분석 모델·생성 정보 표기 — 서버가 보낸 실제 값을 우선 사용한다 */}
          {!isStreaming && content && (
            <section className="mt-6 mb-2 space-y-1.5">
              <div className="flex items-center justify-center gap-1.5 text-[11.5px] text-[#6B7684]">
                <Sparkles className="w-3 h-3" style={{ color: ACCENT_HEX }} />
                <span>
                  본 분석은 <span className="font-semibold text-[#4E5968]">{formatAiModelLabel(summaryMeta?.model || settings.ai_model)}</span> 모델로 생성되었습니다
                </span>
              </div>
              {(summaryMeta?.generatedAt || summaryMeta?.cached != null) && (
                <p className="text-center text-[11px] text-[#6B7684] tabular-nums">
                  {summaryMeta?.generatedAt ? `생성 ${formatGeneratedAt(summaryMeta.generatedAt)}` : "생성 시각 미상"}
                  {summaryMeta?.cached ? " · 저장된 요약서" : " · 이번에 새로 생성"}
                  {summaryMeta?.promptVersion ? ` · 분석 기준 ${summaryMeta.promptVersion}` : ""}
                </p>
              )}
              {summaryMeta?.marketFallback && (
                <p className="text-center text-[11px] leading-relaxed text-[#B45309]">
                  ※ 관련시장 동향의 수치는 이 특허에 맞는 통계를 확인하지 못해 농식품 분야 표준 참고값을 사용했습니다.
                </p>
              )}
            </section>
          )}

          <p className="text-[12px] text-[#6B7684] text-center leading-relaxed mt-8">
            ※ 본 분석은 특허명세서를 바탕으로 실시하여<br />실제 연구 및 개발 단계와는 상이할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 공유 모달 */}
          <ShareDialog shareOpen={shareOpen} setShareOpen={setShareOpen} qrRef={qrRef} shareUrl={shareUrl} downloadQr={downloadQr} mailtoHref={mailtoHref} copyLink={copyLink} copied={copied} />

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
export function TossPatentSummary(props: TossPatentSummaryProps & { onKeywordClick?: (keyword: string) => void; onRegenerate?: () => void }) {
  return (
    <SummaryReadyProvider>
      <TossPatentSummaryInner {...props} />
    </SummaryReadyProvider>
  );
}
