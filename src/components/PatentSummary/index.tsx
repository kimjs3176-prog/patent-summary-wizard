import { useRef, useState, useEffect, useMemo } from "react";
import { FileText, Copy, Check, Share2, Printer, Lightbulb, Target, Wrench, TrendingUp, Globe, Microscope, ShieldCheck, Layers, BookOpen, Cpu, Leaf, BarChart3, Users, Zap, Heart, ExternalLink, Info, GaugeCircle, Sparkles, ScrollText, GitCompare, Network, type LucideIcon } from "lucide-react";
import { SectionNav, type SectionNavItem } from "./SectionNav";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PatentSummaryProps as BasePatentSummaryProps, FeatureFlags } from "./types";

interface PatentSummaryProps extends BasePatentSummaryProps {
  onKeywordClick?: (keyword: string) => void;
  onScoreReady?: (score: number) => void;
}
import { PdfGenerator } from "./PdfGenerator";
import { PptGenerator } from "./PptGenerator";
import { PrintableContent } from "./PrintableContent";

import { TechnologyCommercializationScore, CommercializationDetails } from "./TechnologyCommercializationScore";
import { CompetitorComparisonTable } from "./CompetitorComparisonTable";
import { PatentFamilyTree } from "./PatentFamilyTree";
import { useFavoritePatents } from "@/hooks/useFavoritePatents";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { annotateWithGlossary } from "@/components/GlossaryTooltip";

export function PatentSummary({
  content,
  patentNumber,
  isStreaming,
  patentData,
  relatedPatents = [],
  onRelatedPatentClick,
  onKeywordClick,
  onScoreReady,
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

  // Feature flags from site settings
  const favoritesEnabled = settings.feature_favorites !== "false";
  const competitorAnalysisEnabled = settings.feature_competitor_analysis !== "false";
  const glossaryEnabled = settings.feature_glossary !== "false";
  const annotate = (text: string) => (glossaryEnabled ? annotateWithGlossary(text) : text);

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
          onScoreReady?.(result.score);
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

  const renderMarkdown = (text: string): { body: JSX.Element[]; footnotes: { num: string; text: string }[] } => {
    // Pre-process: strip trailing source/reference sections that have no real body content
    // (only footnote definitions or whitespace), so empty "## 출처" / "### 참고문헌" headings don't render.
    const sourceHeadingRe = /^#{2,3}\s*\**\s*(출처|참고문헌|참고\s*자료|참고|references?|sources?)\s*\**\s*$/i;
    const rawLines = text.split("\n");
    const lines: string[] = [];
    let i = 0;
    while (i < rawLines.length) {
      const line = rawLines[i];
      if (sourceHeadingRe.test(line.trim())) {
        // Look ahead: is there any non-footnote, non-empty content before next ## heading or EOF?
        let j = i + 1;
        let hasBody = false;
        while (j < rawLines.length) {
          const next = rawLines[j];
          if (/^##\s/.test(next) && !sourceHeadingRe.test(next.trim())) break;
          const trimmed = next.trim();
          if (trimmed && !/^\[\^\d+\]:/.test(trimmed) && !sourceHeadingRe.test(trimmed)) {
            hasBody = true;
            break;
          }
          j++;
        }
        if (!hasBody) {
          // Skip the heading itself but keep footnote definitions (they're collected separately)
          i++;
          while (i < rawLines.length) {
            const next = rawLines[i];
            if (/^##\s/.test(next) && !sourceHeadingRe.test(next.trim())) break;
            if (/^\[\^\d+\]:/.test(next.trim())) lines.push(next);
            i++;
          }
          continue;
        }
      }
      lines.push(line);
      i++;
    }

    const elements: JSX.Element[] = [];
    const footnotes: { num: string; text: string }[] = [];
    let inSourcesSection = false;
    let skipSection = false;
    let hasRenderedFirstSection = false;

    // Helper: auto-insert "기술분야" heading if first content line is not a proper section header
    const maybeInsertTechFieldHeader = (currentIndex: number) => {
      if (!hasRenderedFirstSection) {
        hasRenderedFirstSection = true;
        const defaultTitle = sectionTitles["기술분야"] || sectionTitles["기술 분야"] || "기술분야";
        const IconComp = getSectionIcon("기술분야");
        elements.push(
          <div key={`auto-tech-${currentIndex}`} className="mt-7 mb-3 first:mt-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0 bg-primary/[0.08]" style={{ color: 'hsl(var(--primary))' }}>
                <IconComp className="w-[13px] h-[13px]" />
              </span>
              <h2 className="text-[15px] sm:text-[16px] font-bold tracking-[-0.02em] text-foreground leading-tight">
                {defaultTitle}
              </h2>
            </div>
            <div className="mt-2 h-px bg-gradient-to-r from-border/50 via-border/30 to-transparent" />
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
        // Safety net: never render source-style headings as section titles
        if (/^(출처|참고문헌|참고\s*자료|참고|references?|sources?)$/i.test(rawTitle)) {
          inSourcesSection = true;
          return;
        }

        // Known section titles (short headings). If the text after ## is too long,
        // it's likely a paragraph mistakenly starting with ## — render as body text.
        const knownSections = [
          "기술분야", "기술 분야",
          "발명요약 및 특징", "발명의 요약 및 기술적 특징", "발명의 요약", "기술적 특징",
          "관련시장 동향", "시장동향",
          "농산업활용 가능성", "농산업 활용 특장점",
          "상용화전망", "기술 성숙도 및 상용화 전망",
        ];
        const isKnownSection = knownSections.some(s => rawTitle === s || rawTitle.startsWith(s));
        const isLikelyHeading = isKnownSection || rawTitle.length <= 30;

        if (!isLikelyHeading) {
          // It's a paragraph starting with ## — auto-insert "기술분야" header if needed
          maybeInsertTechFieldHeader(index);
          const bodyText = hashMatch[2];
          const parts = bodyText.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
          elements.push(
          <p key={index} className="text-foreground/80 leading-[1.78] mb-2 text-[13.5px] sm:text-[14.5px] md:text-[15px] tracking-[-0.005em]">
              {parts.map((part, i) => {
                if ((part.startsWith('**') && part.endsWith('**'))) {
                  return <strong key={i} className="font-bold text-foreground">{annotate(part.slice(2, -2))}</strong>;
                }
                if ((part.startsWith('__') && part.endsWith('__'))) {
                  return <strong key={i} className="font-bold text-foreground">{annotate(part.slice(2, -2))}</strong>;
                }
                return <span key={i}>{annotate(part)}</span>;
              })}
            </p>
          );
          return;
        }

        hasRenderedFirstSection = true;

        const IconComp = getSectionIcon(rawTitle);
        const displayTitle = sectionTitles[rawTitle] || rawTitle;
        elements.push(
          <div key={index} className="mt-7 mb-3 first:mt-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0 bg-primary/[0.08]" style={{ color: 'hsl(var(--primary))' }}>
                <IconComp className="w-[13px] h-[13px]" />
              </span>
              <h2 className="text-[15px] sm:text-[16px] font-bold tracking-[-0.02em] text-foreground leading-tight">
                {displayTitle}
              </h2>
            </div>
            <div className="mt-2 h-px bg-gradient-to-r from-border/50 via-border/30 to-transparent" />
          </div>
        );
        
        // Insert representative images AFTER 발명요약 section header (up to 3)
        const isInventionSummarySection = (
          rawTitle === "발명요약 및 특징" ||
          rawTitle === "발명의 요약 및 기술적 특징" ||
          rawTitle === "발명의 요약"
        );
        if (isInventionSummarySection && patentData?.images && patentData.images.length > 0) {
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
        } else if (isInventionSummarySection && patentData?.representativeImage) {
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
        // Footnote definition lines: [^N]: text → collect, do NOT render inline
        const footnoteDefMatch = cleanLine.match(/^\[\^(\d+)\]:\s*(.+)$/);
        if (footnoteDefMatch) {
          footnotes.push({ num: footnoteDefMatch[1], text: footnoteDefMatch[2] });
          return;
        }

        // ### 출처 subheading: enter sources section, suppress remaining lines from body
        const subHeadMatch = cleanLine.match(/^###\s+(.+)$/);
        if (subHeadMatch) {
          if (/출처|참고/.test(subHeadMatch[1])) {
            inSourcesSection = true;
            return;
          }
          // Other ### subheadings render normally
          maybeInsertTechFieldHeader(index);
          elements.push(
            <h4 key={index} className="text-[12px] sm:text-[13px] font-bold text-muted-foreground uppercase tracking-wider mt-4 mb-2 pb-1 border-b border-border/30">
              {subHeadMatch[1]}
            </h4>
          );
          return;
        }

        // Inside 출처 section: skip everything (footnotes already extracted)
        if (inSourcesSection) return;

        // If body text appears before any section header, auto-insert "기술 분야"
        maybeInsertTechFieldHeader(index);

        // Enhanced bold text parsing with footnote refs [^N]
        const parts = cleanLine.split(/(\*\*[^*]+\*\*|__[^_]+__|\[\^\d+\])/g);
        elements.push(
          <p key={index} className="text-foreground/80 leading-[1.78] mb-2.5 text-[13.5px] sm:text-[14.5px] md:text-[15px] tracking-[-0.005em]">
            {parts.map((part, i) => {
              if ((part.startsWith('**') && part.endsWith('**'))) {
                return <strong key={i} className="font-bold text-foreground">{annotate(part.slice(2, -2))}</strong>;
              }
              if ((part.startsWith('__') && part.endsWith('__'))) {
                return <strong key={i} className="font-bold text-foreground">{annotate(part.slice(2, -2))}</strong>;
              }
              const fnMatch = part.match(/^\[\^(\d+)\]$/);
              if (fnMatch) {
                return (
                  <a key={i} href={`#fn-${fnMatch[1]}`} className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 ml-0.5 align-super text-[9px] font-bold rounded bg-primary/10 text-primary hover:bg-primary/20 no-underline transition-colors">
                    {fnMatch[1]}
                  </a>
                );
              }
              return <span key={i}>{annotate(part)}</span>;
            })}
          </p>
        );
      }
    });

    return { body: elements, footnotes };
  };

  // Build section nav items based on what's visible
  const navItems = useMemo<SectionNavItem[]>(() => {
    const items: SectionNavItem[] = [];
    if (patentData) items.push({ id: "sec-info", label: "특허 정보", icon: Info });
    if (patentData && visibleSections.commercialization !== false) items.push({ id: "sec-score", label: "기술분석 점수", icon: GaugeCircle });
    if (content) items.push({ id: "sec-summary", label: "AI 요약", icon: Sparkles });
    if (patentData?.claims && patentData.claims.length > 0 && visibleSections.claims !== false) items.push({ id: "sec-claims", label: "청구항", icon: ScrollText });
    if (patentData && visibleSections.competitorComparison !== false) items.push({ id: "sec-compare", label: "경쟁 비교", icon: GitCompare });
    if (patentData?.assignee && visibleSections.familyTree !== false) items.push({ id: "sec-family", label: "패밀리 트리", icon: Network });
    return items;
  }, [patentData, content, visibleSections]);

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

      {/* Section Navigation — sticky pill bar */}
      {!isStreaming && content && navItems.length > 1 && <SectionNav items={navItems} />}

      {/* Toss-style Action Bar — floating pill */}
      {!isStreaming && content && (
        <div className="flex items-center justify-between flex-wrap mb-3 gap-2 px-1 print:hidden">
          <div className="flex items-center gap-1.5">
            <a href="https://www.nati.or.kr/login.do?selPrgId=xfr_apply" target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-1.5 text-[12px] h-8 rounded-lg bg-foreground text-background hover:bg-foreground/90 shadow-sm btn-press font-semibold tracking-[-0.01em]">
                <ExternalLink className="w-3.5 h-3.5" />
                기술이전 신청
              </Button>
            </a>
            {patentData?.applicationNumber && (
              <a href={`https://www.kipris.or.kr/khome/detail/newWindow.do?right=kpat&applno=${patentData.applicationNumber}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5 text-[12px] h-8 rounded-lg btn-press font-medium border-border/60 tracking-[-0.01em]">
                  <FileText className="w-3.5 h-3.5" />
                  특허상세보기
                </Button>
              </a>
            )}
          </div>
          <div className="flex items-center gap-0">
            <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1 text-[11.5px] h-8 px-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "복사됨" : "복사"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handlePrint} className="gap-1 text-[11.5px] h-8 px-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <Printer className="w-3.5 h-3.5" />
              인쇄
            </Button>
            <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1 text-[11.5px] h-8 px-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <Share2 className="w-3.5 h-3.5" />
              공유
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
                    commercializationScore,
                    commercializationDetails,
                    summary: content,
                    addedAt: new Date().toISOString(),
                  });
                  toast.success(patentIsFavorite ? "관심특허에서 제거되었습니다" : "관심특허에 담았습니다");
                }}
                className={`gap-1 text-[11.5px] h-8 px-2 rounded-lg transition-colors ${patentIsFavorite ? "text-destructive hover:text-destructive" : "text-muted-foreground hover:text-foreground"}`}
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
        </div>
      )}

      <div className="space-y-3">
      {/* 1. Patent Info Card — Dashboard-style */}
      {patentData && (
        <section id="sec-info" className={`relative rounded-2xl overflow-hidden animate-slide-in bg-card border border-border/30 scroll-mt-24 ${printSections.patentInfo === false ? "print:hidden" : ""}`} style={{ boxShadow: '0 1px 3px hsl(var(--foreground) / 0.03)' }}>
          {/* Subtle top accent */}
          <div className="h-0.5" style={{ background: 'linear-gradient(90deg, hsl(var(--primary) / 0.5), hsl(var(--primary) / 0.15), transparent)' }} />
          
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 md:px-6 md:py-4">
            {/* Header row — minimal */}
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: 'hsl(var(--primary) / 0.06)', color: 'hsl(var(--primary))' }}>
                {cardIcons.patentInfo || "📄"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[14px] sm:text-[15px] text-foreground leading-tight tracking-[-0.01em]">특허 정보</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(() => {
                  const regNum = patentData.registrationNumber;
                  if (regNum) {
                    const cleanNum = regNum.replace(/[^0-9]/g, "");
                    const formatted = cleanNum.length >= 9 && cleanNum.startsWith("10")
                      ? `10-${cleanNum.slice(2, 9)}`
                      : patentData.displayNumber || regNum;
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-foreground/[0.04] text-foreground/70 tabular-nums tracking-tight">
                        {infoLabels.registrationNumber || "등록번호"} <span className="text-foreground/85">{formatted}</span>
                      </span>
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
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-foreground/[0.04] text-foreground/70 tabular-nums tracking-tight">
                        {infoLabels.applicationNumber || "출원번호"} <span className="text-foreground/85">{formatted}</span>
                      </span>
                    );
                  }
                  return null;
                })()}
                {!patentData.registrationNumber && !patentData.applicationNumber && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-foreground/[0.04] text-foreground/70 tabular-nums tracking-tight">
                    {patentData.searchType === 'application' ? '출원번호' : '등록번호'} <span className="text-foreground/85">{patentData.displayNumber || patentData.patentNumber}</span>
                  </span>
                )}
              </div>
            </div>
            
            {/* Title */}
            {patentData.titleKo && (
              <h2 className="text-[17px] sm:text-[19px] md:text-[21px] font-extrabold text-foreground mb-3 leading-[1.35] tracking-[-0.02em]">{patentData.titleKo}</h2>
            )}

            {/* Stacked layout: Meta info (top) + Keywords (bottom) */}
            <div className="flex flex-col gap-3">
              {/* Top: Meta info — Toss-style subtle dividers */}
              <div className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] sm:text-[12.5px] bg-muted/30 border border-border/15">
                {patentData.assignee && (
                  <>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">{infoLabels.assignee || "출원인"}</span>
                      <span className="text-foreground font-semibold">{patentData.assignee}</span>
                    </span>
                    <span className="text-border text-xs">|</span>
                  </>
                )}
                {patentData.inventors && patentData.inventors.length > 0 && (
                  <>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">{infoLabels.inventors || "발명자"}</span>
                      <span className="text-foreground font-medium">
                        {patentData.inventors.length >= 5
                          ? `${patentData.inventors.slice(0, 4).join(', ')} 등 ${patentData.inventors.length}명`
                          : patentData.inventors.join(', ')}
                      </span>
                    </span>
                    {(patentData.filingDate || patentData.publicationDate || (patentData.classifications && patentData.classifications.length > 0)) && (
                      <span className="text-border text-xs">|</span>
                    )}
                  </>
                )}
                {patentData.filingDate && (
                  <>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">{infoLabels.filingDate || "출원일"}</span>
                      <span className="text-foreground font-semibold tabular-nums">{patentData.filingDate}</span>
                    </span>
                    {(patentData.publicationDate || (patentData.classifications && patentData.classifications.length > 0)) && (
                      <span className="text-border text-xs">|</span>
                    )}
                  </>
                )}
                {patentData.publicationDate && (
                  <>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">{patentData.registrationNumber ? (infoLabels.publicationDate || '등록일') : '공개일'}</span>
                      <span className="text-foreground font-semibold tabular-nums">{patentData.publicationDate}</span>
                    </span>
                    {patentData.classifications && patentData.classifications.length > 0 && (
                      <span className="text-border text-xs">|</span>
                    )}
                  </>
                )}
                {patentData.classifications && patentData.classifications.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">{infoLabels.ipc || "IPC"}</span>
                    <span className="text-foreground font-medium truncate">{patentData.classifications.join(', ')}</span>
                  </span>
                )}
              </div>

              {/* Right: Technology Keywords */}
              {(() => {
                const industryKws: string[] = [];
                const funcKws: string[] = [];
                const featKws: string[] = [];
                const text = [patentData.titleKo || patentData.title || '', patentData.abstract || ''].join(' ');

                // 1. IPC → 활용가능산업
                const normalizedClassifications = (patentData.classifications || [])
                  .flatMap(cls => cls.split(/[|,;]+/))
                  .map(cls => cls.trim())
                  .filter(Boolean);

                if (normalizedClassifications.length) {
                  const ipcIndustryMap: Record<string, string> = {
                    'A23L': '건강기능식품', 'A23B': '식품저장', 'A23C': '유제품', 'A23D': '유지식품',
                    'A23F': '음료', 'A23G': '제과', 'A23J': '단백질식품', 'A23K': '사료',
                    'A23P': '식품가공', 'A22C': '축산식품', 'A22B': '도축',
                    'A01G': '스마트팜', 'A01H': '품종개량', 'A01K': '스마트축산',
                    'A01N': '농약·방제', 'A01C': '정밀농업', 'A01D': '수확기계', 'A01J': '유가공',
                    'A01F': '수확후관리',
                    'A61K': '의약품', 'A61P': '치료제', 'A61B': '의료기기', 'A61F': '의료용품',
                    'A61L': '의료위생', 'A61Q': '화장품',
                    'B01D': '화학공정', 'B01J': '촉매산업', 'B01F': '혼합공정',
                    'B02C': '분쇄산업', 'B29C': '성형산업', 'B65B': '포장산업', 'B09B': '환경산업',
                    'B02B': '곡물가공', 'B07B': '선별산업',
                    'C12N': '바이오산업', 'C12P': '발효산업', 'C12G': '주류산업', 'C12Q': '진단산업',
                    'C07K': '바이오의약', 'C07D': '정밀화학', 'C08L': '소재산업',
                    'C05G': '비료산업', 'C02F': '수처리산업',
                    'G06F': 'AI·SW', 'G06N': 'AI산업', 'G06Q': '유통·물류', 'G01N': '분석·검사',
                    'G16B': '바이오IT', 'G05B': '자동화산업',
                    'H04L': 'IoT', 'H04W': '무선통신',
                    'F26B': '건조산업', 'F25D': '냉장냉동산업',
                    'A23': '식품산업', 'A01': '농업', 'A22': '축산업', 'A61': '헬스케어',
                    'C12': '바이오산업', 'C07': '의약화학', 'C08': '소재산업',
                    'G06': 'ICT', 'B01': '화학공정', 'H04': 'IoT', 'G01': '계측산업',
                    'B65': '물류산업', 'B02': '곡물가공', 'F26': '건조산업',
                  };
                  normalizedClassifications.forEach(cls => {
                    const c = cls.replace(/\s/g, '');
                    const k = ipcIndustryMap[c.slice(0, 4)] || ipcIndustryMap[c.slice(0, 3)];
                    if (k && !industryKws.includes(k)) industryKws.push(k);
                  });
                }

                // 2. 제목+초록 → 활용가능산업 보강
                const industryPatterns: [RegExp, string][] = [
                  [/식품|음식|먹/, '식품산업'], [/화장품|미용|뷰티/, '화장품산업'],
                  [/의약|약[학물]|치료/, '제약산업'], [/사료|가축|축산/, '축산업'],
                  [/비료|토양|퇴비/, '비료산업'], [/건강기능|건기식|기능성식품/, '건강기능식품'],
                  [/수산|어류|양식/, '수산업'], [/섬유|직물|의류/, '섬유산업'],
                  [/에너지|태양광|바이오매스/, '에너지산업'], [/환경|폐수|폐기물/, '환경산업'],
                  [/반도체|전자/, '전자산업'], [/건설|건축/, '건설산업'],
                ];
                industryPatterns.forEach(([p, l]) => { if (p.test(text) && !industryKws.includes(l)) industryKws.push(l); });

                // 3. 제목+초록 → 기능성
                const funcPatterns: [RegExp, string][] = [
                  [/항균|살균|멸균|항미생물/, '항균'], [/항산화|산화방지|라디칼/, '항산화'],
                  [/항염|소염|염증억제/, '항염'], [/항암|종양억제|암세포/, '항암'],
                  [/항바이러스|항virus|바이러스억제/, '항바이러스'],
                  [/면역|면역력|면역조절/, '면역강화'], [/혈당|당뇨|인슐린/, '혈당조절'],
                  [/혈압|고혈압|저혈압/, '혈압조절'], [/비만|체중감소|지방분해/, '체중조절'],
                  [/치매|인지기능|기억력/, '인지개선'], [/피부|보습|주름/, '피부개선'],
                  [/발효|숙성|유산균/, '발효기능'], [/프로바이오|장건강|장내/, '장건강'],
                  [/콜라겐|탄력/, '피부탄력'], [/노화방지|안티에이징/, '항노화'],
                  [/수분보유|보수력/, '보수성'], [/유화|분산/, '유화안정'],
                  [/점도|겔[화형]/, '점도조절'], [/방부|보존|저장성/, '보존성향상'],
                  [/흡착|흡수/, '흡착기능'], [/소취|탈취|냄새/, '소취기능'],
                  [/진통|통증/, '진통효과'], [/이뇨|배뇨/, '이뇨작용'],
                  [/간보호|간기능/, '간기능개선'], [/골[밀다]|뼈/, '골건강'],
                ];
                funcPatterns.forEach(([p, l]) => { if (p.test(text) && !funcKws.includes(l)) funcKws.push(l); });

                // 4. 제목+초록 → 특징(기술적 특징)
                const featPatterns: [RegExp, string][] = [
                  [/나노|나노입자|나노캡슐/, '나노기술'], [/마이크로캡슐|마이크로/, '마이크로캡슐'],
                  [/코팅|피복/, '코팅기술'], [/추출|분리정제/, '추출정제'],
                  [/건조|동결건조|열풍/, '건조공정'], [/분쇄|미분|초미분/, '미분화'],
                  [/캡슐[화형]|포접/, '캡슐화'], [/수경|양액/, '수경재배'],
                  [/드론|무인비행/, '드론활용'], [/IoT|사물인터넷|센서/, 'IoT기반'],
                  [/AI|인공지능|딥러닝|머신러닝/, 'AI활용'], [/로봇|자동화/, '자동화'],
                  [/친환경|유기|무농약/, '친환경'], [/저온|저온처리/, '저온공정'],
                  [/고온|고압|초고압/, '고압처리'], [/효소[처분]|효소적/, '효소처리'],
                  [/미생물|균주|접종/, '미생물활용'], [/배양|세포배양/, '배양기술'],
                  [/유전자|형질전환|게놈/, '유전공학'], [/3D|삼차원|적층/, '3D기술'],
                  [/블록체인|이력추적/, '이력추적'], [/빅데이터|데이터분석/, '빅데이터'],
                  [/복합|융합|하이브리드/, '복합기술'], [/모니터링|실시간/, '실시간모니터링'],
                  [/영상|이미지|비전/, '영상분석'], [/스펙트럼|분광/, '분광분석'],
                  [/장치|디바이스/, '장치기술'], [/시스템/, '시스템기술'], [/구조|프레임/, '구조설계'],
                  [/제어|조절/, '제어기술'], [/구동|모터|벨트|기어|동력/, '구동메커니즘'],
                  [/진동|캠|베어링/, '진동구조'], [/선별|분리|정선/, '선별기술'],
                  [/탈곡|수확/, '수확처리'], [/호퍼|드럼|배출부|망체|타공체망/, '처리구조'],
                ];
                featPatterns.forEach(([p, l]) => { if (p.test(text) && !featKws.includes(l)) featKws.push(l); });

                // 5. 소재 키워드
                const subjectPatterns: [RegExp, string][] = [
                  [/쌀|미곡|현미/, '쌀'], [/밀가루|밀(?!봉)/, '밀'], [/보리/, '보리'], [/옥수수/, '옥수수'],
                  [/콩|대두/, '콩'], [/인삼|홍삼/, '인삼'], [/녹차|차(?:잎|나무)/, '차'],
                  [/고추/, '고추'], [/마늘/, '마늘'], [/양파/, '양파'], [/배추/, '배추'],
                  [/토마토/, '토마토'], [/감자/, '감자'], [/고구마/, '고구마'],
                  [/딸기/, '딸기'], [/사과/, '사과'], [/포도/, '포도'], [/감귤|귤/, '감귤'],
                  [/블루베리/, '블루베리'], [/버섯/, '버섯'], [/김치/, '김치'],
                  [/한우|소고기/, '한우'], [/돼지|돈육/, '돼지'], [/닭|가금/, '닭'],
                  [/우유|원유|유청/, '우유'], [/계란|달걀/, '계란'],
                  [/새우/, '새우'], [/김|해조류/, '해조류'], [/미역/, '미역'],
                  [/꿀|벌꿀/, '꿀'], [/유산균|젖산균/, '유산균'], [/효모/, '효모'],
                  [/키토산/, '키토산'], [/펙틴/, '펙틴'], [/폴리페놀/, '폴리페놀'],
                  [/단백질/, '단백질'], [/전분/, '전분'], [/셀룰로오스|섬유소/, '셀룰로오스'],
                ];
                const subjectKws: string[] = [];
                subjectPatterns.forEach(([p, l]) => { if (p.test(text) && !subjectKws.includes(l)) subjectKws.push(l); });

                const extraFallbacks: string[] = [];
                const fallbackPatterns: [RegExp, string][] = [
                  [/조성물/, '조성물'], [/제조방법|제조 공정|제조/, '제조공정'], [/방법/, '처리방법'],
                  [/기기|장치/, '기계장치'], [/시스템/, '시스템'], [/모듈/, '모듈구성'],
                  [/센서/, '센서기반'], [/자동|자동화/, '자동화설비'], [/제어/, '속도제어'],
                  [/구동/, '구동제어'], [/선별|정선/, '정밀선별'], [/분리/, '분리처리'],
                  [/수확|탈곡/, '농기계'], [/드럼|호퍼|배출/, '핵심구성요소'],
                ];
                fallbackPatterns.forEach(([p, l]) => { if (p.test(text) && !extraFallbacks.includes(l)) extraFallbacks.push(l); });

                // 조합: 기능성 + 활용(산업) 우선, 각 최소 2개 / 합계 최소 5개 보장
                const allKws: string[] = [];
                const maxTotal = 12;
                const minFunc = 2;
                const minIndustry = 2;
                const minPriority = 5; // 기능+활용 합산 최소

                // 1순위: 기능성 + 활용(산업)을 라운드로빈으로 우선 배치 (기능 먼저)
                const priorityCats = [funcKws, industryKws];
                let pRound = 0;
                let pAdded = true;
                while (pAdded && allKws.length < maxTotal) {
                  pAdded = false;
                  for (const cat of priorityCats) {
                    if (pRound < cat.length && allKws.length < maxTotal) {
                      const kw = cat[pRound];
                      if (!allKws.includes(kw)) {
                        allKws.push(kw);
                        pAdded = true;
                      }
                    }
                  }
                  pRound++;
                }

                // 2순위: 소재 + 기술특징으로 보강
                const secondaryCats = [subjectKws, featKws];
                let sRound = 0;
                let sAdded = true;
                while (sAdded && allKws.length < maxTotal) {
                  sAdded = false;
                  for (const cat of secondaryCats) {
                    if (sRound < cat.length && allKws.length < maxTotal) {
                      const kw = cat[sRound];
                      if (!allKws.includes(kw)) {
                        allKws.push(kw);
                        sAdded = true;
                      }
                    }
                  }
                  sRound++;
                }

                // 기능/활용 각각 최소 보장 + 합산 최소 보장 (기능 우선)
                const funcCount = () => allKws.filter(k => funcKws.includes(k)).length;
                const industryCount = () => allKws.filter(k => industryKws.includes(k)).length;
                const priorityCount = () => funcCount() + industryCount();
                const genericFunc = ['기능성소재', '품질개선', '공정효율', '안정성향상', '활성증진', '효능강화'];
                const genericIndustry = ['식품산업', '농업', '바이오산업', '헬스케어', '환경산업', '소재산업'];
                for (const k of genericFunc) {
                  if (funcCount() >= minFunc || allKws.length >= maxTotal) break;
                  if (!allKws.includes(k)) { funcKws.push(k); allKws.push(k); }
                }
                for (const k of genericIndustry) {
                  if (industryCount() >= minIndustry || allKws.length >= maxTotal) break;
                  if (!allKws.includes(k)) { industryKws.push(k); allKws.push(k); }
                }
                // 합산 부족 시 기능 우선으로 추가 보강
                while (priorityCount() < minPriority && allKws.length < maxTotal) {
                  const fk = genericFunc.find(k => !allKws.includes(k));
                  const ik = genericIndustry.find(k => !allKws.includes(k));
                  if (fk) { funcKws.push(fk); allKws.push(fk); }
                  else if (ik) { industryKws.push(ik); allKws.push(ik); }
                  else break;
                }

                // 부족하면 폴백에서 보충
                if (allKws.length < 5) {
                  extraFallbacks.forEach(k => {
                    if (!allKws.includes(k) && allKws.length < maxTotal) allKws.push(k);
                  });
                }
                if (allKws.length < 5) {
                  const robustFallbacks: [RegExp, string][] = [
                    [/식물\s*생육|생장\s*촉진/, '식물생육증진'],
                    [/식물병|병원균|병해/, '식물병억제'],
                    [/신규\s*균주|균주/, '신규균주'],
                    [/미생물제|미생물\s*제제/, '미생물제'],
                    [/슈도모나스|Pseudomonas/i, '슈도모나스'],
                    [/사포니필라|saponiphila/i, '사포니필라'],
                    [/생물\s*방제|방제/, '생물방제'],
                  ];
                  robustFallbacks.forEach(([p, l]) => {
                    if (p.test(text) && !allKws.includes(l) && allKws.length < maxTotal) allKws.push(l);
                  });
                }
                const unique = allKws.slice(0, maxTotal);

                if (unique.length === 0) return null;

                // 카테고리별 색상
                const getColor = (kw: string) => {
                  if (funcKws.includes(kw)) return { bg: 'hsl(270 60% 95%)', fg: 'hsl(270 50% 35%)', bd: 'hsl(270 40% 88%)' };
                  if (industryKws.includes(kw)) return { bg: 'hsl(210 70% 95%)', fg: 'hsl(210 60% 35%)', bd: 'hsl(210 50% 88%)' };
                  if (subjectKws.includes(kw)) return { bg: 'hsl(140 60% 95%)', fg: 'hsl(140 50% 30%)', bd: 'hsl(140 40% 88%)' };
                  return { bg: 'hsl(30 70% 95%)', fg: 'hsl(30 55% 35%)', bd: 'hsl(30 45% 88%)' };
                };

                return (
                  <div className="patent-keyword-container flex flex-wrap items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-muted/25 border border-border/15">
                    <span className="text-[9.5px] text-muted-foreground/80 font-bold uppercase tracking-[0.08em] mr-0.5">키워드</span>
                    <span className="patent-keyword-print-text sr-only">{unique.map(kw => `#${kw}`).join(' ')}</span>
                    {unique.map((kw, i) => {
                      const c = getColor(kw);
                      return (
                        <span
                          key={i}
                          role="button"
                          tabIndex={0}
                          onClick={() => onKeywordClick?.(kw)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKeywordClick?.(kw); } }}
                          className="patent-keyword-chip inline-flex items-center px-2 py-[3px] rounded-md text-[11px] font-semibold transition-all hover:-translate-y-px hover:shadow-sm cursor-pointer tracking-tight"
                          style={{ background: c.bg, color: c.fg, border: `1px solid ${c.bd}` }}
                          title={`"${kw}" 관련 특허 검색`}
                        >
                          #{kw}
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </section>
      )}

      {/* Wrap commercialization score in id anchor */}
      <div id="sec-score" className="scroll-mt-24" />
      {patentData && visibleSections.commercialization !== false && printSections.commercialization !== false && (
        <TechnologyCommercializationScore 
          score={commercializationScore}
          isLoading={isAnalyzing}
          details={commercializationDetails}
        />
      )}

      {/* 3. AI Summary Card — Dashboard-style */}
      <section id="sec-summary" className={`relative rounded-2xl overflow-hidden animate-slide-in bg-card border border-border/30 print:break-before-page ai-summary-print-section scroll-mt-24 ${printSections.aiSummary === false ? "print:hidden" : ""}`} style={{ animationDelay: '0.1s', boxShadow: '0 1px 3px hsl(var(--foreground) / 0.03)' }}>
        <div className="h-0.5" style={{ background: 'linear-gradient(90deg, hsl(var(--primary) / 0.5), hsl(var(--primary) / 0.15), transparent)' }} />
        
        {/* Header */}
        <div className="px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 flex items-center gap-2.5 border-b border-border/20">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-base sm:text-lg" style={{ background: 'hsl(var(--primary) / 0.06)', color: 'hsl(var(--primary))' }}>
            {cardIcons.aiSummary || "🤖"}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[14px] sm:text-[15px] text-foreground tracking-[-0.01em] leading-tight">AI 종합 요약</h3>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium tabular-nums tracking-tight">
              {patentData?.searchType === 'application' ? '출원번호' : '등록번호'} · {patentNumber}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-4 sm:px-5 sm:py-5 md:px-6 md:py-6 min-h-[300px]">
          {content ? (
            (() => {
              const { body, footnotes } = renderMarkdown(content);
              return (
                <div className="prose max-w-none">
                  {body}
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-5 rounded-full ml-1 animate-pulse bg-primary/50" />
                  )}
                  {footnotes.length > 0 && !isStreaming && (
                    <div className="mt-8 pt-4 border-t border-border/40">
                      <h4 className="text-[11px] sm:text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <span className="inline-block w-1 h-3 bg-primary rounded-full" />
                        참고 출처
                      </h4>
                      <div className="space-y-1.5">
                        {footnotes.map((fn) => (
                          <div key={fn.num} id={`fn-${fn.num}`} className="flex gap-2 text-[11px] sm:text-[12px] text-muted-foreground/90 leading-[1.6] pl-2 border-l-2 border-primary/20">
                            <span className="font-bold text-primary/70 shrink-0">[{fn.num}]</span>
                            <span>{fn.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 bg-muted">
                <FileText className="w-7 h-7" />
              </div>
              <p className="text-sm font-medium">요약서가 여기에 표시됩니다</p>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        {printSections.disclaimer !== false && (
          <div className="mx-4 sm:mx-5 md:mx-6 mb-4">
            <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-muted/40 border border-border/20">
              <span className="text-sm shrink-0 leading-none">⚠️</span>
              <p className="text-[11px] sm:text-[12px] font-medium leading-[1.7] text-muted-foreground/80">
                {disclaimerText}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* 4. TRL is now integrated into the AI 기술분석 점수 section above */}

      {/* 5. Claims Card */}
      {printSections.claims !== false && visibleSections.claims !== false && patentData?.claims && patentData.claims.length > 0 && (
        <section id="sec-claims" className={`relative rounded-2xl overflow-hidden animate-slide-in bg-card border border-border/30 scroll-mt-24 ${printSections.claims === false ? "print:hidden" : ""}`} style={{ animationDelay: '0.15s', boxShadow: '0 1px 3px hsl(var(--foreground) / 0.03)' }}>
          <div className="h-0.5" style={{ background: 'linear-gradient(90deg, hsl(262 60% 55% / 0.4), hsl(262 40% 55% / 0.1), transparent)' }} />
          
          <div className="p-4 sm:p-5 md:p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-base sm:text-lg" style={{ background: 'hsl(262 60% 55% / 0.06)', color: 'hsl(262 60% 50%)' }}>
                {cardIcons.claims || "📑"}
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-foreground tracking-tight">청구항</h3>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">{patentData.claims.length}개 항목</p>
              </div>
            </div>

            <details className="group">
              <summary className="cursor-pointer select-none text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-muted/40">
                <span className="w-4 h-4 flex items-center justify-center text-[9px] rounded-md transition-transform group-open:rotate-90 bg-muted text-muted-foreground">▶</span>
                청구항 내용 펼치기/접기
              </summary>
              <div className="mt-3 space-y-2">
                {patentData.claims.map((c, idx) => (
                  <div key={idx} className="p-3 sm:p-4 rounded-xl border bg-muted/20 border-border/20">
                    <div className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2 font-semibold">
                      <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-primary-foreground bg-primary/80">{idx + 1}</span>
                      청구항 {idx + 1}
                    </div>
                    <div className="text-[12px] sm:text-[13px] text-foreground/80 leading-[1.75]">{c}</div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </section>
      )}

      </div>

      {/* 6. Competitor Comparison Table — AI generated */}
      {patentData && !isStreaming && content && competitorAnalysisEnabled && visibleSections.competitorComparison !== false && (
        <div id="sec-compare" className="mt-4 scroll-mt-24 print:hidden">
          <CompetitorComparisonTable patentData={patentData} relatedPatents={relatedPatents} onPatentClick={onRelatedPatentClick} />
        </div>
      )}

      {/* 7. Patent Family Tree — D3 visualization */}
      {patentData?.assignee && !isStreaming && content && visibleSections.familyTree !== false && (
        <div id="sec-family" className="mt-4 scroll-mt-24 print:hidden">
          <PatentFamilyTree patentData={patentData} onPatentClick={onRelatedPatentClick} />
        </div>
      )}

    </div>
  );
}

// Re-export types for backward compatibility
export type { PatentSummaryProps, PatentData, RelatedPatent } from "./types";
