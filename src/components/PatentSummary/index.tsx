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
          <h2 key={index} className="text-xl font-bold mt-8 mb-3 first:mt-0 flex items-center gap-2.5" style={{ color: 'hsl(210 100% 40%)' }}>
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ background: 'hsl(210 100% 94%)', color: 'hsl(210 100% 40%)' }}>
              <IconComp className="w-4.5 h-4.5" />
            </span>
            {displayTitle}
          </h2>
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
      />

      {/* Action Buttons Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden" style={{ animation: 'fadeUp 0.4s ease-out forwards' }}>
        {patentNumber && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (patentData) {
                toggleFavorite({ patentNumber, patentData, addedAt: new Date().toISOString() });
              }
            }}
            className="gap-1.5 rounded-xl text-xs transition-all duration-200 hover:scale-[1.03] active:scale-95"
          >
            <Heart className={`w-3.5 h-3.5 transition-colors ${patentIsFavorite ? 'fill-red-500 text-red-500' : ''}`} />
            {patentIsFavorite ? '관심특허 해제' : '관심특허'}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 rounded-xl text-xs transition-all duration-200 hover:scale-[1.03] active:scale-95">
          <Printer className="w-3.5 h-3.5" /> 인쇄
        </Button>
        <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5 rounded-xl text-xs transition-all duration-200 hover:scale-[1.03] active:scale-95">
          <Share2 className="w-3.5 h-3.5" /> 공유
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 rounded-xl text-xs transition-all duration-200 hover:scale-[1.03] active:scale-95">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? '복사됨' : '복사'}
        </Button>
        <div className="flex-1" />
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

      {/* Main Summary Container */}
      <div className="space-y-3">
      {/* Group: patent info + score + TRL — should fit on one print page */}
      <div className="print-first-page-group space-y-3">
      {patentData && (
        <div className="glass-effect rounded-2xl p-5 md:p-6 border-t-[3px] transition-all duration-300 hover:shadow-lg" style={{ borderTopColor: 'hsl(210 100% 50%)', animation: 'scaleIn 0.4s ease-out forwards', animationDelay: '0.05s', opacity: 0 }}>
          <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-border/40">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'linear-gradient(135deg, hsl(210 100% 50%), hsl(220 90% 42%))', color: 'white' }}>
              {cardIcons.patentInfo || "📄"}
            </div>
            <div className="card-title text-base font-bold" style={{ color: 'hsl(210 100% 35%)' }}>특허 정보</div>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-3">
            {/* 등록번호 표시 */}
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
            {/* 출원번호 표시 */}
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
            <h2 className="text-xl font-bold text-foreground mb-3 leading-tight">{patentData.titleKo}</h2>
          )}
          
          <div className="mt-3 px-3 py-2 rounded-xl flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ background: 'hsl(220 30% 96%)', border: '1px solid hsl(220 20% 90%)' }}>
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

      {/* 3. TRL Section (Technology Maturity) */}
      {patentData && commercializationDetails && visibleSections.trl !== false && (
        <TechnologyCommercializationScore 
          score={commercializationScore}
          isLoading={false}
          details={commercializationDetails}
          showTrlOnly={true}
        />
      )}
      </div>{/* end print-first-page-group */}

      {/* 4. AI 종합 요약 */}
      {content && (
        <div className="glass-effect rounded-2xl p-5 md:p-6 border-t-[3px] transition-all duration-300 hover:shadow-lg" style={{ borderTopColor: 'hsl(210 100% 50%)', animation: 'scaleIn 0.45s ease-out forwards', animationDelay: '0.15s', opacity: 0 }}>
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border/50">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{ background: 'linear-gradient(135deg, hsl(210 100% 50%), hsl(220 90% 42%))', color: 'white' }}>
              {cardIcons.aiSummary || "🤖"}
            </div>
            <div>
              <h3 className="font-bold text-base" style={{ color: 'hsl(210 100% 35%)' }}>AI 종합 요약</h3>
              <p className="text-xs text-muted-foreground">특허 명세서 기반 AI 분석</p>
            </div>
          </div>
          <div className="prose prose-sm max-w-none">
            {renderMarkdown(content)}
          </div>
          {/* 면책 조항 */}
          <div className="mt-4 p-3 rounded-xl flex items-start gap-2" style={{ background: 'hsl(45 100% 94%)', border: '1px solid hsl(45 80% 80%)' }}>
            <span className="text-base shrink-0">⚠️</span>
            <p className="text-[11px] font-bold text-foreground/90 leading-relaxed">{disclaimerText}</p>
          </div>
        </div>
      )}

      {/* 5. Claims Card */}
      {visibleSections.claims !== false && patentData?.claims && patentData.claims.length > 0 && (
        <div className="claims-section glass-effect rounded-2xl p-5 md:p-6 border-t-[3px] transition-all duration-300 hover:shadow-lg" style={{ borderTopColor: 'hsl(260 60% 55%)', animation: 'scaleIn 0.45s ease-out forwards', animationDelay: '0.2s', opacity: 0 }}>
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border/50">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{ background: 'linear-gradient(135deg, hsl(260 60% 55%), hsl(280 50% 45%))', color: 'white' }}>
              {cardIcons.claims || "📑"}
            </div>
            <div>
              <h3 className="font-bold text-base" style={{ color: 'hsl(260 50% 40%)' }}>청구항</h3>
              <p className="text-xs text-muted-foreground">{patentData.claims.length}개</p>
            </div>
          </div>

          <details>
            <summary className="cursor-pointer select-none text-sm font-semibold text-foreground/90 hover:text-foreground transition-colors">
              청구항 내용 펼치기/접기
            </summary>
            <div className="mt-3 space-y-2">
              {patentData.claims.map((c, idx) => (
                <div key={idx} className="p-3 rounded-xl border" style={{ background: 'hsl(260 30% 97%)', borderColor: 'hsl(260 20% 90%)' }}>
                  <div className="text-[10px] text-muted-foreground mb-1">청구항 {idx + 1}</div>
                  <div className="text-sm text-foreground/85 leading-relaxed">{c}</div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* End of Summary Container for PDF/Print capture */}
      </div>

      {/* 6. Related Patents Section */}
      {visibleSections.relatedPatents !== false && (
        <RelatedPatentsSection relatedPatents={relatedPatents} onPatentClick={onRelatedPatentClick} />
      )}
    </div>
  );
}

// Re-export types for backward compatibility
export type { PatentSummaryProps, PatentData, RelatedPatent } from "./types";
