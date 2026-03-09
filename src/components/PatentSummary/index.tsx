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

  const printSections = useMemo(() => {
    const defaults = {
      patentInfo: true,
      commercialization: true,
      aiSummary: true,
      trl: true,
      claims: false,
      relatedPatents: false,
      disclaimer: true,
    };
    try {
      return settings.print_sections ? { ...defaults, ...JSON.parse(settings.print_sections) } : defaults;
    } catch {
      return defaults;
    }
  }, [settings.print_sections]);

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
    // Build shareable URL with patent number - always use published URL for public access
    const publishedOrigin = "https://atipsum.lovable.app";
    const currentOrigin = window.location.origin;
    // Use published URL so recipients don't need Lovable login
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

  


  // MD 다운로드 기능 및 Google Patents 링크 기능 제거 (요청사항)

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

    // Helper: auto-insert "기술 분야" heading if first content line is not a proper section header
    const maybeInsertTechFieldHeader = (currentIndex: number) => {
      if (!hasRenderedFirstSection) {
        hasRenderedFirstSection = true;
        const defaultTitle = sectionTitles["기술 분야"] || "기술 분야";
        const IconComp = getSectionIcon("기술 분야");
        elements.push(
          <div key={`auto-tech-${currentIndex}`} className="mt-9 mb-4 first:mt-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg, hsl(210 100% 94%), hsl(210 80% 90%))', color: 'hsl(210 100% 40%)' }}>
                <IconComp className="w-[18px] h-[18px]" />
              </span>
              <h2 className="text-xl font-bold tracking-tight" style={{ color: 'hsl(210 80% 30%)' }}>
                {defaultTitle}
              </h2>
            </div>
            <div className="mt-2.5 h-px" style={{ background: 'linear-gradient(90deg, hsl(210 60% 88%), transparent 80%)' }} />
          </div>
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

      // Handle ## or ### lines (with or without space after hashes)
      const hashMatch = line.match(/^(#{2,3})\s*(.*)/);
      if (hashMatch) {
        const rawTitle = hashMatch[2].replace(/\*\*/g, '').trim();
        if (rawTitle === "특허 기본 정보") {
          skipSection = true;
          return;
        }

        // Known section titles (short headings). If the text after ## is too long,
        // it's likely a paragraph mistakenly starting with ## — render as body text.
        const knownSections = ["기술 분야", "발명의 요약", "기술적 특징", "시장동향", "농산업 활용 특장점", "기술 성숙도 및 상용화 전망"];
        const isKnownSection = knownSections.some(s => rawTitle === s || rawTitle.startsWith(s));
        const isLikelyHeading = isKnownSection || rawTitle.length <= 30;

        if (!isLikelyHeading) {
          // It's a paragraph starting with ## — auto-insert "기술 분야" header if needed
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
          <div key={index} className="mt-9 mb-4 first:mt-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg, hsl(210 100% 94%), hsl(210 80% 90%))', color: 'hsl(210 100% 40%)' }}>
                <IconComp className="w-[18px] h-[18px]" />
              </span>
              <h2 className="text-xl font-bold tracking-tight" style={{ color: 'hsl(210 80% 30%)' }}>
                {displayTitle}
              </h2>
            </div>
            <div className="mt-2.5 h-px" style={{ background: 'linear-gradient(90deg, hsl(210 60% 88%), transparent 80%)' }} />
          </div>
        );
        
        // Insert representative images AFTER "발명의 요약" section header (up to 3)
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
        // If body text appears before any section header, auto-insert "기술 분야"
        maybeInsertTechFieldHeader(index);
        // Enhanced bold text parsing: **text**, __text__, and partial bold within sentences
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

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-up">
      {/* Printable Content (Hidden) */}
      <PrintableContent
        ref={printRef}
        content={content}
        patentNumber={patentNumber}
        patentData={patentData}
        printSections={printSections}
      />

      {/* Action Bar */}
      {!isStreaming && content && (
        <div className="flex items-center justify-end gap-0.5 flex-wrap mb-2">
          <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "복사됨" : "복사"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePrint} className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground transition-colors">
            <Printer className="w-3.5 h-3.5" />
            인쇄
          </Button>
          <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground transition-colors">
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
            className={`gap-1.5 text-xs h-8 transition-colors ${patentIsFavorite ? "text-destructive hover:text-destructive" : "text-muted-foreground hover:text-foreground"}`}
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

      <div className="space-y-8">
      {/* 1. Patent Info Card — 2025 Elevated Style */}
      {patentData && (
        <div className={`relative rounded-2xl overflow-hidden animate-slide-in surface-elevated ${printSections.patentInfo === false ? "print:hidden" : ""}`}>
          {/* Top accent gradient band */}
          <div className="h-1" style={{ background: 'linear-gradient(90deg, hsl(239 84% 67%), hsl(262 83% 58%), hsl(280 68% 56%))' }} />
          
          <div className="p-6 md:p-8">
            {/* Card header with icon */}
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-md" style={{ background: 'linear-gradient(135deg, hsl(239 84% 67%), hsl(262 83% 58%))', color: 'white' }}>
                {cardIcons.patentInfo || "📄"}
              </div>
              <div>
                <div className="font-bold text-lg text-foreground">특허 정보</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wider">Patent Information</div>
              </div>
            </div>

            {/* Number badges — Indigo accent */}
            <div className="flex flex-wrap gap-2.5 mb-5">
              {(() => {
                const regNum = patentData.registrationNumber;
                if (regNum) {
                  const cleanNum = regNum.replace(/[^0-9]/g, "");
                  const formatted = cleanNum.length >= 9 && cleanNum.startsWith("10")
                    ? `10-${cleanNum.slice(2, 9)}`
                    : patentData.displayNumber || regNum;
                  return (
                    <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm badge-pop" style={{ background: 'linear-gradient(135deg, hsl(239 84% 97%), hsl(239 70% 94%))', color: 'hsl(239 84% 40%)', border: '1px solid hsl(239 60% 88%)' }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: 'hsl(239 84% 67%)', boxShadow: '0 0 6px hsl(239 84% 67% / 0.5)' }} />
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
                    <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm badge-pop" style={{ background: 'linear-gradient(135deg, hsl(262 70% 97%), hsl(262 60% 94%))', color: 'hsl(262 60% 40%)', border: '1px solid hsl(262 50% 88%)' }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: 'hsl(262 83% 58%)', boxShadow: '0 0 6px hsl(262 83% 58% / 0.5)' }} />
                      {infoLabels.applicationNumber || "출원번호"}: {formatted}
                    </div>
                  );
                }
                return null;
              })()}
              {!patentData.registrationNumber && !patentData.applicationNumber && (
                <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm badge-pop" style={{ background: 'linear-gradient(135deg, hsl(239 84% 97%), hsl(239 70% 94%))', color: 'hsl(239 84% 40%)', border: '1px solid hsl(239 60% 88%)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: 'hsl(239 84% 67%)', boxShadow: '0 0 6px hsl(239 84% 67% / 0.5)' }} />
                  {patentData.searchType === 'application' ? '출원번호' : '등록번호'}: {patentData.displayNumber || patentData.patentNumber}
                </div>
              )}
            </div>
            
            {/* Title — Bold typography */}
            {patentData.titleKo && (
              <h2 className="text-[22px] md:text-2xl font-bold text-foreground mb-6 leading-snug tracking-tight">{patentData.titleKo}</h2>
            )}
            
            {/* Meta info — Glass morphism strip */}
            <div className="px-5 py-3.5 rounded-xl flex flex-wrap items-center gap-x-5 gap-y-2" style={{ background: 'hsl(220 14% 96%)', border: '1px solid hsl(220 13% 91%)' }}>
              {patentData.assignee && (
                <>
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">{infoLabels.assignee || "출원인"}</span>
                    <span className="text-foreground font-semibold text-sm">{patentData.assignee}</span>
                  </span>
                  {(patentData.filingDate || patentData.publicationDate || (patentData.classifications && patentData.classifications.length > 0)) && (
                    <span className="text-muted-foreground/40 text-xs">|</span>
                  )}
                </>
              )}
              {patentData.filingDate && (
                <>
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">{infoLabels.filingDate || "출원일"}</span>
                    <span className="text-foreground font-medium text-sm">{patentData.filingDate}</span>
                  </span>
                  {(patentData.publicationDate || (patentData.classifications && patentData.classifications.length > 0)) && (
                    <span className="text-muted-foreground/40 text-xs">|</span>
                  )}
                </>
              )}
              {patentData.publicationDate && (
                <>
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">{patentData.registrationNumber ? (infoLabels.publicationDate || '등록일') : '공개일'}</span>
                    <span className="text-foreground font-medium text-sm">{patentData.publicationDate}</span>
                  </span>
                  {patentData.classifications && patentData.classifications.length > 0 && (
                    <span className="text-muted-foreground/40 text-xs">|</span>
                  )}
                </>
              )}
              {patentData.classifications && patentData.classifications.length > 0 && (
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">{infoLabels.ipc || "IPC"}</span>
                  <span className="text-foreground font-medium text-sm truncate">{patentData.classifications.join(', ')}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Technology Commercialization Score */}
      {patentData && visibleSections.commercialization !== false && printSections.commercialization !== false && (
        <TechnologyCommercializationScore 
          score={commercializationScore}
          isLoading={isAnalyzing}
          details={commercializationDetails}
          showTrlOnly={false}
        />
      )}

      {/* 3. AI Summary Card — 2025 Glass morphism */}
      <div className={`relative rounded-2xl overflow-hidden animate-slide-in surface-elevated print:break-before-page ${printSections.aiSummary === false ? "print:hidden" : ""}`} style={{ animationDelay: '0.1s' }}>
        {/* Top accent gradient band */}
        <div className="h-1" style={{ background: 'linear-gradient(90deg, hsl(160 84% 39%), hsl(174 60% 40%), hsl(200 80% 50%))' }} />
        
        {/* Header */}
        <div className="px-6 md:px-8 py-5 flex items-center justify-between flex-wrap gap-3" style={{ background: 'linear-gradient(180deg, hsl(160 30% 97%), hsl(0 0% 100%))' }}>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-md" style={{ background: 'linear-gradient(135deg, hsl(160 84% 39%), hsl(200 80% 50%))', color: 'white' }}>
              {cardIcons.aiSummary || "🤖"}
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">AI 종합 요약</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                {patentData?.searchType === 'application' ? '출원번호' : '등록번호'}: {patentNumber}
              </p>
            </div>
          </div>
        </div>

        {/* Subtle separator */}
        <div className="mx-6 md:mx-8 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(160 30% 88%), transparent)' }} />

        {/* Content */}
        <div className="px-6 py-8 md:px-8 md:py-10 min-h-[350px]">
          {content ? (
            <div className="prose max-w-none">
              {renderMarkdown(content)}
              {isStreaming && (
                <span className="inline-block w-1.5 h-5 rounded-full ml-1 animate-pulse" style={{ background: 'hsl(var(--primary) / 0.6)' }} />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm" style={{ background: 'hsl(var(--muted))' }}>
                <FileText className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium">요약서가 여기에 표시됩니다</p>
            </div>
          )}
        </div>

        {/* Disclaimer — Warm accent box */}
        {printSections.disclaimer !== false && (
          <div className="mx-6 md:mx-8 mb-6">
            <div className="flex items-center gap-3.5 px-5 py-4 rounded-xl" style={{ background: 'linear-gradient(135deg, hsl(38 92% 95%), hsl(38 70% 92%))', border: '1px solid hsl(38 60% 85%)' }}>
              <span className="text-base shrink-0 leading-none">⚠️</span>
              <p className="text-xs font-semibold leading-relaxed" style={{ color: 'hsl(38 50% 25%)' }}>
                {disclaimerText}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 4. TRL Section */}
      {patentData && commercializationDetails && visibleSections.trl !== false && printSections.trl !== false && (
        <TechnologyCommercializationScore 
          score={commercializationScore}
          isLoading={false}
          details={commercializationDetails}
          showTrlOnly={true}
        />
      )}

      {/* 5. Claims Card — 2025 Purple accent */}
      {printSections.claims !== false && visibleSections.claims !== false && patentData?.claims && patentData.claims.length > 0 && (
        <div className={`relative rounded-2xl overflow-hidden animate-slide-in surface-elevated ${printSections.claims === false ? "print:hidden" : ""}`} style={{ animationDelay: '0.15s' }}>
          {/* Top accent gradient band */}
          <div className="h-1" style={{ background: 'linear-gradient(90deg, hsl(262 83% 58%), hsl(280 68% 56%), hsl(300 60% 55%))' }} />
          
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-md" style={{ background: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(280 68% 56%))', color: 'white' }}>
                {cardIcons.claims || "📑"}
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">청구항</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">{patentData.claims.length}개 항목</p>
              </div>
            </div>

            <details className="group">
              <summary className="cursor-pointer select-none text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2.5 py-2.5 px-4 rounded-xl hover:bg-muted/60">
                <span className="w-5 h-5 flex items-center justify-center text-[10px] rounded-lg transition-transform group-open:rotate-90" style={{ background: 'hsl(262 60% 95%)', color: 'hsl(262 60% 45%)' }}>▶</span>
                청구항 내용 펼치기/접기
              </summary>
              <div className="mt-5 space-y-3">
                {patentData.claims.map((c, idx) => (
                  <div key={idx} className="p-5 rounded-xl border transition-all hover:shadow-sm" style={{ background: 'hsl(262 30% 98%)', borderColor: 'hsl(262 20% 92%)' }}>
                    <div className="inline-flex items-center gap-2 text-[11px] text-muted-foreground mb-3 font-semibold">
                      <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold text-white" style={{ background: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(280 68% 56%))' }}>{idx + 1}</span>
                      청구항 {idx + 1}
                    </div>
                    <div className="text-sm text-foreground/90 leading-relaxed">{c}</div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}

      </div>

      {/* 6. Related Patents Section */}
      {printSections.relatedPatents !== false && visibleSections.relatedPatents !== false && (
        <RelatedPatentsSection relatedPatents={relatedPatents} onPatentClick={onRelatedPatentClick} />
      )}
    </div>
  );
}

// Re-export types for backward compatibility
export type { PatentSummaryProps, PatentData, RelatedPatent } from "./types";
