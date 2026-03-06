import { useRef, useState, useEffect, useMemo } from "react";
import { FileText, Copy, Check, Share2, Printer, Lightbulb, Target, Wrench, TrendingUp, Globe, Microscope, ShieldCheck, Layers, BookOpen, Cpu, Leaf, BarChart3, Users, Zap, Heart, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PatentSummaryProps, FeatureFlags } from "./types";
import { PdfGenerator } from "./PdfGenerator";
import { PptGenerator } from "./PptGenerator";
import { PrintableContent } from "./PrintableContent";
import { RelatedPatentsSection } from "./RelatedPatentsSection";
import { TechnologyCommercializationScore, CommercializationDetails } from "./TechnologyCommercializationScore";
import { useFavoritePatents } from "@/hooks/useFavoritePatents";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export function PatentSummary({
  content,
  patentNumber,
  isStreaming,
  patentData,
  relatedPatents = [],
  onRelatedPatentClick,
  featureFlags = { pdfEnabled: true, pptEnabled: true },
}: PatentSummaryProps) {
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [commercializationScore, setCommercializationScore] = useState<number | null>(null);
  const [commercializationDetails, setCommercializationDetails] = useState<CommercializationDetails | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const { isFavorite, toggleFavorite } = useFavoritePatents();
  const patentIsFavorite = patentNumber ? isFavorite(patentNumber) : false;
  const { settings } = useSiteSettings();

  // Parse summary customization settings
  const sectionTitles = useMemo(() => {
    try { return settings.summary_section_titles ? JSON.parse(settings.summary_section_titles) : {}; } catch { return {}; }
  }, [settings.summary_section_titles]);

  const visibleSections = useMemo(() => {
    try { return settings.summary_visible_sections ? JSON.parse(settings.summary_visible_sections) : {}; } catch { return {}; }
  }, [settings.summary_visible_sections]);

  const pdfLayoutConfig = useMemo(() => {
    try { return settings.pdf_layout_config ? JSON.parse(settings.pdf_layout_config) : undefined; } catch { return undefined; }
  }, [settings.pdf_layout_config]);

  const cardIcons = useMemo(() => {
    try { return settings.summary_card_icons ? JSON.parse(settings.summary_card_icons) : {}; } catch { return {}; }
  }, [settings.summary_card_icons]);

  const infoLabels = useMemo(() => {
    try { return settings.summary_info_labels ? JSON.parse(settings.summary_info_labels) : {}; } catch { return {}; }
  }, [settings.summary_info_labels]);

  const disclaimerText = settings.summary_disclaimer || "※ 본 분석은 특허명세서를 바탕으로 실시하여 실제 연구 및 개발 단계와는 상이할 수 있음";

  // Fetch commercialization score when patent data is available
  useEffect(() => {
    const analyzeCommercialization = async () => {
      if (!patentData || !patentNumber || isStreaming) {
        return;
      }

      setIsAnalyzing(true);
      try {
        const response = await fetch(
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

        const result = await response.json();
        if (result.success) {
          setCommercializationScore(result.score);
          setCommercializationDetails(result.details);
        }
      } catch (error) {
        console.error("Commercialization analysis error:", error);
      } finally {
        setIsAnalyzing(false);
      }
    };

    analyzeCommercialization();
  }, [patentData, patentNumber, isStreaming]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("클립보드에 복사되었습니다");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const publishedOrigin = "https://atipsum.lovable.app";
    const currentOrigin = window.location.origin;
    const baseOrigin = currentOrigin.includes("-preview--") || currentOrigin.includes("lovableproject.com")
      ? publishedOrigin
      : currentOrigin;
    const url = `${baseOrigin}/?patent=${encodeURIComponent(patentNumber)}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `특허 요약서 - ${patentNumber}`,
          text: `${patentData?.titleKo || patentNumber} 특허 요약서`,
          url: url,
        });
        toast.success("공유되었습니다");
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          await navigator.clipboard.writeText(url);
          toast.success("링크가 클립보드에 복사되었습니다");
        }
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("링크가 클립보드에 복사되었습니다");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const sectionIconMap: [RegExp, LucideIcon][] = [
    [/요약|개요|소개/, Lightbulb],
    [/기술\s*분야|기술적|핵심\s*기술/, Cpu],
    [/과제|문제|해결/, Target],
    [/수단|방법|구성|구현/, Wrench],
    [/효과|기대|장점|이점/, Zap],
    [/활용|응용|적용|용도/, Globe],
    [/시장|사업화|상업|경제/, BarChart3],
    [/농업|농산|작물|재배/, Leaf],
    [/분석|평가|검토/, Microscope],
    [/권리|청구|보호|특허성/, ShieldCheck],
    [/구조|계층|시스템/, Layers],
    [/참고|참조|문헌/, BookOpen],
    [/협력|협업|인력/, Users],
    [/성장|전망|발전|추세/, TrendingUp],
  ];

  const getSectionIcon = (title: string): LucideIcon => {
    for (const [pattern, icon] of sectionIconMap) {
      if (pattern.test(title)) return icon;
    }
    return FileText;
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    const elements: JSX.Element[] = [];
    let skipSection = false;
    let hasRenderedFirstSection = false;

    const maybeInsertTechFieldHeader = (currentIndex: number) => {
      if (!hasRenderedFirstSection) {
        hasRenderedFirstSection = true;
        const defaultTitle = sectionTitles["기술 분야"] || "기술 분야";
        const IconComp = getSectionIcon("기술 분야");
        elements.push(
          <h2 key={`auto-tech-${currentIndex}`} className="text-xl font-bold mt-8 mb-3 first:mt-0 flex items-center gap-2.5" style={{ color: 'hsl(210 100% 40%)' }}>
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ background: 'hsl(210 100% 94%)', color: 'hsl(210 100% 40%)' }}>
              <IconComp className="w-4.5 h-4.5" />
            </span>
            {defaultTitle}
          </h2>
        );
      }
    };

    lines.forEach((line, index) => {
      if (line.startsWith("## 특허 기본 정보")) {
        skipSection = true;
        return;
      }
      if (skipSection && line.startsWith("## ")) {
        skipSection = false;
      }
      if (skipSection) return;

      let cleanLine = line
        .replace(/^\s*[-•]\s+/, '')
        .replace(/^\s*\d+\.\s+/, '');

      const hashMatch = line.match(/^(#{2,3})\s*(.*)/);
      if (hashMatch) {
        const rawTitle = hashMatch[2].replace(/\*\*/g, '').trim();
        if (rawTitle === "특허 기본 정보") {
          skipSection = true;
          return;
        }

        const knownSections = ["기술 분야", "발명의 요약", "기술적 특징", "시장동향", "농산업 활용 특장점", "기술 성숙도 및 상용화 전망"];
        const isKnownSection = knownSections.some(s => rawTitle === s || rawTitle.startsWith(s));
        const isLikelyHeading = isKnownSection || rawTitle.length <= 30;

        if (!isLikelyHeading) {
          maybeInsertTechFieldHeader(index);
          const bodyText = hashMatch[2];
          const parts = bodyText.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
          elements.push(
            <p key={index} className="text-foreground/85 leading-[1.85] mb-2.5 text-[15px]">
              {parts.map((part, i) => {
                if ((part.startsWith('**') && part.endsWith('**'))) {
                  return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
                }
                if ((part.startsWith('__') && part.endsWith('__'))) {
                  return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
                }
                return part;
              })}
            </p>
          );
          return;
        }

        hasRenderedFirstSection = true;

        const IconComp = getSectionIcon(rawTitle);
        const displayTitle = sectionTitles[rawTitle] || rawTitle;
        elements.push(
          <h2 key={index} className="text-xl font-bold mt-8 mb-3 first:mt-0 flex items-center gap-2.5" style={{ color: 'hsl(210 100% 40%)' }}>
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ background: 'hsl(210 100% 94%)', color: 'hsl(210 100% 40%)' }}>
              <IconComp className="w-4.5 h-4.5" />
            </span>
            {displayTitle}
          </h2>
        );
        
        if (rawTitle === "발명의 요약" && patentData?.images && patentData.images.length > 0) {
          const imagesToShow = patentData.images.slice(0, 3);
          const isSingle = imagesToShow.length === 1;
          
          elements.push(
            <div key={`imgs-${index}`} className={`my-6 ${isSingle ? 'flex justify-center' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'}`}>
              {imagesToShow.map((imgUrl, imgIdx) => {
                const proxied = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(imgUrl)}`;
                return (
                  <div key={imgIdx} className="text-center">
                    <img
                      src={proxied}
                      alt={`도면 ${imgIdx + 1}`}
                      className={`${isSingle ? 'w-[345px] md:w-[384px]' : 'w-full'} h-auto max-h-[400px] object-contain rounded-2xl border border-border/50 bg-white/90 mx-auto shadow-md`}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {isSingle ? '【대표 도면】' : `【도면 ${imgIdx + 1}】`}
                    </p>
                  </div>
                );
              })}
            </div>
          );
        } else if (rawTitle === "발명의 요약" && patentData?.representativeImage) {
          const proxied = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(
            patentData.representativeImage
          )}`;
          elements.push(
            <div key={`img-${index}`} className="my-6 flex justify-center">
              <div className="text-center">
                <img
                  src={proxied}
                  alt="대표 도면"
                  className="w-[345px] md:w-[384px] h-auto max-h-[460px] object-contain rounded-2xl border border-border/50 bg-white/90 mx-auto shadow-md"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    (e.currentTarget.parentElement?.parentElement as HTMLElement)!.style.display = "none";
                  }}
                />
                <p className="text-xs text-muted-foreground mt-2">【대표 도면】</p>
              </div>
            </div>
          );
        }
      } else if (cleanLine.trim()) {
        maybeInsertTechFieldHeader(index);
        const parts = cleanLine.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
        elements.push(
          <p key={index} className="text-foreground/85 leading-[1.85] mb-2.5 text-[15px]">
            {parts.map((part, i) => {
              if ((part.startsWith('**') && part.endsWith('**'))) {
                return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
              }
              if ((part.startsWith('__') && part.endsWith('__'))) {
                return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </p>
        );
      }
    });

    return elements;
  };

  // A4 page style
  const a4PageStyle = {
    maxWidth: '210mm',
    minHeight: '297mm',
    margin: '0 auto 2rem auto',
  };

  return (
    <div className="w-full mx-auto animate-fade-up">
      {/* Printable Content (Hidden) */}
      <PrintableContent
        ref={printRef}
        content={content}
        patentNumber={patentNumber}
        patentData={patentData}
      />

      {/* Action Bar */}
      {!isStreaming && content && (
        <div className="flex items-center justify-end gap-1.5 flex-wrap mb-1" style={{ maxWidth: '210mm', margin: '0 auto 0.25rem auto' }}>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "복사됨" : "복사"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePrint} className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground">
            <Printer className="w-3.5 h-3.5" />
            인쇄
          </Button>
          <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground">
            <Share2 className="w-3.5 h-3.5" />
            공유
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!patentData) return;
              toggleFavorite({
                patentNumber,
                patentData,
                commercializationScore,
                commercializationDetails,
                summary: content,
                addedAt: new Date().toISOString(),
              });
              toast.success(patentIsFavorite ? "관심특허에서 제거되었습니다" : "관심특허에 담았습니다");
            }}
            className={`gap-1.5 text-xs h-8 ${patentIsFavorite ? "text-destructive hover:text-destructive" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Heart className={`w-3.5 h-3.5 ${patentIsFavorite ? "fill-current" : ""}`} />
            {patentIsFavorite ? "담김" : "담기"}
          </Button>
          {featureFlags.pdfEnabled && (
            <PdfGenerator
              content={content}
              patentNumber={patentNumber}
              patentData={patentData}
              printRef={printRef}
              commercializationDetails={commercializationDetails}
              commercializationScore={commercializationScore}
              layoutConfig={pdfLayoutConfig}
            />
          )}
          {featureFlags.pptEnabled && (
            <PptGenerator
              content={content}
              patentNumber={patentNumber}
              patentData={patentData}
              commercializationDetails={commercializationDetails}
              commercializationScore={commercializationScore}
            />
          )}
        </div>
      )}

      {/* ===== PAGE 1: 특허정보 + 기술사업화점수 + TRL ===== */}
      <div
        className="a4-page bg-background rounded-2xl shadow-lg border border-border/30 p-6 md:p-8 flex flex-col"
        style={a4PageStyle}
      >
        <div className="space-y-5 flex-1">
          {/* 1. Patent Info */}
          {patentData && (
            <div className="glass-effect rounded-2xl p-6 md:p-7 animate-slide-in border-t-[3px]" style={{ borderTopColor: 'hsl(210 100% 50%)' }}>
              <div className="flex items-center gap-2.5 mb-4 pb-4 border-b border-border/40">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg, hsl(210 100% 50%), hsl(220 90% 42%))', color: 'white' }}>
                  {cardIcons.patentInfo || "📄"}
                </div>
                <div className="card-title text-lg font-bold" style={{ color: 'hsl(210 100% 35%)' }}>특허 정보</div>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-3">
                {(() => {
                  const regNum = patentData.registrationNumber;
                  if (regNum) {
                    const cleanNum = regNum.replace(/[^0-9]/g, "");
                    const formatted = cleanNum.length >= 9 && cleanNum.startsWith("10")
                      ? `10-${cleanNum.slice(2, 9)}`
                      : patentData.displayNumber || regNum;
                    return (
                      <div className="inline-block px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'hsl(210 100% 94%)', color: 'hsl(210 100% 35%)', border: '1px solid hsl(210 80% 85%)' }}>
                        {infoLabels.registrationNumber || "등록번호"}: {formatted}
                      </div>
                    );
                  }
                  return null;
                })()}
                {(() => {
                  const appNum = patentData.applicationNumber;
                  if (appNum) {
                    const cleanNum = appNum.replace(/[^0-9]/g, "");
                    const formatted = cleanNum.length >= 11 && cleanNum.startsWith("10")
                      ? `10-${cleanNum.slice(2, 6)}-${cleanNum.slice(6)}`
                      : appNum;
                    return (
                      <div className="inline-block px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'hsl(174 60% 92%)', color: 'hsl(174 60% 28%)', border: '1px solid hsl(174 50% 80%)' }}>
                        {infoLabels.applicationNumber || "출원번호"}: {formatted}
                      </div>
                    );
                  }
                  return null;
                })()}
                {!patentData.registrationNumber && !patentData.applicationNumber && (
                  <div className="inline-block px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'hsl(210 100% 94%)', color: 'hsl(210 100% 35%)', border: '1px solid hsl(210 80% 85%)' }}>
                     {patentData.searchType === 'application' ? '출원번호' : '등록번호'}: {patentData.displayNumber || patentData.patentNumber}
                   </div>
                )}
              </div>
              
              {patentData.titleKo && (
                <h2 className="text-2xl font-bold text-foreground mb-4 leading-tight">{patentData.titleKo}</h2>
              )}
              
              <div className="mt-5 px-4 py-2.5 rounded-xl flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ background: 'hsl(220 30% 96%)', border: '1px solid hsl(220 20% 90%)' }}>
                {patentData.assignee && (
                  <>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <span className="text-muted-foreground text-xs">{infoLabels.assignee || "출원인"}</span>
                      <span className="text-foreground font-medium text-xs">{patentData.assignee}</span>
                    </span>
                    {(patentData.filingDate || patentData.publicationDate || (patentData.classifications && patentData.classifications.length > 0)) && (
                      <span className="text-border">|</span>
                    )}
                  </>
                )}
                {patentData.filingDate && (
                  <>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <span className="text-muted-foreground text-xs">{infoLabels.filingDate || "출원일"}</span>
                      <span className="text-foreground font-medium text-xs">{patentData.filingDate}</span>
                    </span>
                    {(patentData.publicationDate || (patentData.classifications && patentData.classifications.length > 0)) && (
                      <span className="text-border">|</span>
                    )}
                  </>
                )}
                {patentData.publicationDate && (
                  <>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <span className="text-muted-foreground text-xs">{patentData.registrationNumber ? (infoLabels.publicationDate || '등록일') : '공개일'}</span>
                      <span className="text-foreground font-medium text-xs">{patentData.publicationDate}</span>
                    </span>
                    {patentData.classifications && patentData.classifications.length > 0 && (
                      <span className="text-border">|</span>
                    )}
                  </>
                )}
                {patentData.classifications && patentData.classifications.length > 0 && (
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <span className="text-muted-foreground text-xs whitespace-nowrap">{infoLabels.ipc || "IPC"}</span>
                    <span className="text-foreground font-medium text-xs truncate">{patentData.classifications.join(', ')}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 2. Technology Commercialization Score */}
          {patentData && visibleSections.commercialization !== false && (
            <TechnologyCommercializationScore 
              score={commercializationScore}
              isLoading={isAnalyzing}
              details={commercializationDetails}
              showTrlOnly={false}
            />
          )}

          {/* 3. TRL Section (moved to Page 1) */}
          {patentData && commercializationDetails && visibleSections.trl !== false && (
            <TechnologyCommercializationScore 
              score={commercializationScore}
              isLoading={false}
              details={commercializationDetails}
              showTrlOnly={true}
            />
          )}
        </div>

        {/* Page 1 footer */}
        <div className="pt-4 mt-auto text-center border-t border-border/30">
          <span className="text-xs text-muted-foreground">— 1 / 2 —</span>
        </div>
      </div>

      {/* ===== PAGE 2: AI 종합 요약 ===== */}
      <div
        className="a4-page bg-background rounded-2xl shadow-lg border border-border/30 p-6 md:p-8 flex flex-col"
        style={a4PageStyle}
      >
        <div className="space-y-5 flex-1">
          <div className="glass-effect rounded-2xl overflow-hidden animate-slide-in border-t-[3px]" style={{ animationDelay: '0.1s', borderTopColor: 'hsl(174 60% 40%)' }}>
            {/* Header */}
            <div className="border-b px-5 py-3.5 flex items-center justify-between flex-wrap gap-3" style={{ background: 'linear-gradient(135deg, hsl(174 40% 96%), hsl(210 40% 96%))', borderColor: 'hsl(174 30% 88%)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg, hsl(174 60% 40%), hsl(210 80% 45%))', color: 'white' }}>
                  {cardIcons.aiSummary || "🤖"}
                </div>
                <div>
                  <h3 className="font-bold text-base" style={{ color: 'hsl(174 50% 30%)' }}>AI 종합 요약</h3>
                  <p className="text-xs text-muted-foreground">
                    {patentData?.searchType === 'application' ? '출원번호' : '등록번호'}: {patentNumber}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-5 py-6 md:px-7 md:py-8">
              {content ? (
                <div className="prose max-w-none">
                  {renderMarkdown(content)}
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-5 bg-primary/60 animate-pulse-subtle ml-0.5 rounded-full" />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
                  <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                    <FileText className="w-7 h-7" />
                  </div>
                  <p className="text-sm">요약서가 여기에 표시됩니다</p>
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <div className="mx-5 mb-5 px-4 py-3 rounded-xl" style={{ background: 'hsl(40 80% 95%)', border: '1px solid hsl(40 60% 85%)' }}>
              <p className="text-xs font-bold text-center leading-relaxed" style={{ color: 'hsl(40 50% 25%)' }}>
                ⚠️ {disclaimerText}
              </p>
            </div>
          </div>
        </div>

        {/* Page 2 footer */}
        <div className="pt-4 mt-auto text-center border-t border-border/30">
          <span className="text-xs text-muted-foreground">— 2 / 2 —</span>
        </div>
      </div>

      {/* Claims (outside A4 pages, expandable) */}
      {visibleSections.claims !== false && patentData?.claims && patentData.claims.length > 0 && (
        <div className="claims-section glass-effect rounded-3xl p-6 md:p-8 animate-slide-in border-t-[3px]" style={{ animationDelay: '0.15s', borderTopColor: 'hsl(260 60% 55%)', maxWidth: '210mm', margin: '0 auto 2rem auto' }}>
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-border/50">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, hsl(260 60% 55%), hsl(280 50% 45%))', color: 'white' }}>
              {cardIcons.claims || "📑"}
            </div>
            <div>
              <h3 className="font-bold text-lg" style={{ color: 'hsl(260 50% 40%)' }}>청구항</h3>
              <p className="text-sm text-muted-foreground">{patentData.claims.length}개</p>
            </div>
          </div>

          <details>
            <summary className="cursor-pointer select-none text-sm font-semibold text-foreground/90 hover:text-foreground">
              청구항 내용 펼치기/접기
            </summary>
            <div className="mt-4 space-y-3">
              {patentData.claims.map((c, idx) => (
                <div key={idx} className="p-4 rounded-2xl border" style={{ background: 'hsl(260 30% 97%)', borderColor: 'hsl(260 20% 90%)' }}>
                  <div className="text-xs text-muted-foreground mb-2">청구항 {idx + 1}</div>
                  <div className="text-sm text-foreground/85 leading-relaxed">{c}</div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Related Patents */}
      {visibleSections.relatedPatents !== false && (
        <div style={{ maxWidth: '210mm', margin: '0 auto' }}>
          <RelatedPatentsSection relatedPatents={relatedPatents} onPatentClick={onRelatedPatentClick} />
        </div>
      )}
    </div>
  );
}

// Re-export types for backward compatibility
export type { PatentSummaryProps, PatentData, RelatedPatent } from "./types";
