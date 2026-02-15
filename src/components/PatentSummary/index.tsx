import { useRef, useState, useEffect } from "react";
import { FileText, Copy, Check, Share2, Printer, Lightbulb, Target, Wrench, TrendingUp, Globe, Microscope, ShieldCheck, Layers, BookOpen, Cpu, Leaf, BarChart3, Users, Zap, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PatentSummaryProps } from "./types";
import { PdfGenerator } from "./PdfGenerator";
import { PptGenerator } from "./PptGenerator";
import { PrintableContent } from "./PrintableContent";
import { RelatedPatentsSection } from "./RelatedPatentsSection";
import { TechnologyCommercializationScore, CommercializationDetails } from "./TechnologyCommercializationScore";

export function PatentSummary({
  content,
  patentNumber,
  isStreaming,
  patentData,
  relatedPatents = [],
  onRelatedPatentClick,
  onAnalysisModeChange,
}: PatentSummaryProps) {
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [commercializationScore, setCommercializationScore] = useState<number | null>(null);
  const [commercializationDetails, setCommercializationDetails] = useState<CommercializationDetails | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<"summary" | "detailed">("summary");

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

  const handleModeChange = (mode: "summary" | "detailed") => {
    if (mode === analysisMode || isStreaming) return;
    setAnalysisMode(mode);
    onAnalysisModeChange?.(mode);
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

      if (line.startsWith("## ")) {
        const sectionTitle = line.replace("## ", "").replace(/\*\*/g, '');
        if (sectionTitle === "특허 기본 정보") {
          skipSection = true;
          return;
        }
        const IconComp = getSectionIcon(sectionTitle);
        elements.push(
          <h2 key={index} className="text-xl font-semibold text-primary mt-6 mb-3 first:mt-0 flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
              <IconComp className="w-4.5 h-4.5" />
            </span>
            {sectionTitle}
          </h2>
        );
        
        // Insert representative images AFTER "발명의 요약" section header (up to 3)
        if (sectionTitle === "발명의 요약" && patentData?.images && patentData.images.length > 0) {
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
        } else if (sectionTitle === "발명의 요약" && patentData?.representativeImage) {
          // Fallback: single representative image
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
        // Parse bold text (**text**)
        const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
        elements.push(
          <p key={index} className="text-foreground/80 leading-relaxed mb-2">
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
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
      {/* Printable Content (Hidden) - Legacy, kept for compatibility */}
      <PrintableContent
        ref={printRef}
        content={content}
        patentNumber={patentNumber}
        patentData={patentData}
      />

      {/* Main Summary Container */}
      <div className="space-y-6">
      {patentData && (
        <div className="mb-6 glass-effect rounded-3xl p-8 animate-slide-in">
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-border/50">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl">
              📄
            </div>
            <div className="card-title text-xl font-bold text-foreground">특허 정보</div>
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
                  <div className="inline-block px-4 py-2 bg-primary/15 text-primary rounded-lg text-sm font-medium">
                    등록번호: {formatted}
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
                  <div className="inline-block px-4 py-2 bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium">
                    출원번호: {formatted}
                  </div>
                );
              }
              return null;
            })()}
            {/* 등록번호도 출원번호도 없는 경우 fallback */}
            {!patentData.registrationNumber && !patentData.applicationNumber && (
              <div className="inline-block px-4 py-2 bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium">
                {patentData.searchType === 'application' ? '출원번호' : '등록번호'}: {patentData.displayNumber || patentData.patentNumber}
              </div>
            )}
          </div>
          
          {patentData.titleKo && (
            <h2 className="text-2xl font-bold text-foreground mb-4 leading-tight">{patentData.titleKo}</h2>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
            {patentData.assignee && (
              <div className="bg-secondary/30 p-4 rounded-xl border border-border/50 hover-lift animate-scale-in stagger-1">
                <div className="text-xs text-muted-foreground mb-1 font-medium">출원인</div>
                <div className="text-sm text-foreground font-medium">{patentData.assignee}</div>
              </div>
            )}
            {patentData.inventors && patentData.inventors.length > 0 && (
              <div className="bg-secondary/30 p-4 rounded-xl border border-border/50 hover-lift animate-scale-in stagger-2">
                <div className="text-xs text-muted-foreground mb-1 font-medium">발명자</div>
                <div className="text-sm text-foreground font-medium">{patentData.inventors.join(', ')}</div>
              </div>
            )}
            {patentData.filingDate && (
              <div className="bg-secondary/30 p-4 rounded-xl border border-border/50 hover-lift animate-scale-in stagger-3">
                <div className="text-xs text-muted-foreground mb-1 font-medium">출원일</div>
                <div className="text-sm text-foreground font-medium">{patentData.filingDate}</div>
              </div>
            )}
            {patentData.publicationDate && (
              <div className="bg-secondary/30 p-4 rounded-xl border border-border/50 hover-lift animate-scale-in stagger-4">
                <div className="text-xs text-muted-foreground mb-1 font-medium">
                  {patentData.registrationNumber ? '등록일' : '공개일'}
                </div>
                <div className="text-sm text-foreground font-medium">{patentData.publicationDate}</div>
              </div>
            )}
            {patentData.classifications && patentData.classifications.length > 0 && (
              <div className="bg-secondary/30 p-4 rounded-xl border border-border/50 hover-lift animate-scale-in stagger-5 sm:col-span-2 lg:col-span-1">
                <div className="text-xs text-muted-foreground mb-1 font-medium">IPC 코드</div>
                <div className="text-sm text-foreground font-medium">{patentData.classifications.join(', ')}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Technology Commercialization Score */}
      {patentData && (
        <TechnologyCommercializationScore 
          score={commercializationScore}
          isLoading={isAnalyzing}
          details={commercializationDetails}
          showTrlOnly={false}
        />
      )}

      {/* 3. AI Summary Card */}
      <div className="glass-effect rounded-3xl overflow-hidden animate-slide-in" style={{ animationDelay: '0.1s' }}>
        {/* Header */}
        <div className="bg-secondary/30 border-b border-border/50 px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl">
              🤖
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">AI 종합 요약</h3>
              <p className="text-sm text-muted-foreground">
                {patentData?.searchType === 'application' ? '출원번호' : '등록번호'}: {patentNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Analysis Mode Toggle */}
            {!isStreaming && content && onAnalysisModeChange && (
              <div className="flex items-center bg-secondary/50 rounded-lg p-0.5 border border-border/50">
                <button
                  onClick={() => handleModeChange("summary")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    analysisMode === "summary"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  요약분석
                </button>
                <button
                  onClick={() => handleModeChange("detailed")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    analysisMode === "detailed"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  상세분석
                </button>
              </div>
            )}

            {!isStreaming && content && (
              <>
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2 border-border/50 bg-card/50 hover:bg-card text-foreground">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "복사됨" : "복사"}
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 border-border/50 bg-card/50 hover:bg-card text-foreground">
                  <Printer className="w-4 h-4" />
                  인쇄
                </Button>
                <Button variant="outline" size="sm" onClick={handleShare} className="gap-2 border-border/50 bg-card/50 hover:bg-card text-foreground">
                  <Share2 className="w-4 h-4" />
                  공유
                </Button>
                <PdfGenerator
                  content={content}
                  patentNumber={patentNumber}
                  patentData={patentData}
                  printRef={printRef}
                  commercializationDetails={commercializationDetails}
                  commercializationScore={commercializationScore}
                />
                <PptGenerator
                  content={content}
                  patentNumber={patentNumber}
                  patentData={patentData}
                  commercializationDetails={commercializationDetails}
                  commercializationScore={commercializationScore}
                />
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 min-h-[400px]">
          {content ? (
            <div className="prose max-w-none">
              {renderMarkdown(content)}
              {isStreaming && (
                <span className="inline-block w-2 h-5 bg-primary animate-pulse-subtle ml-1" />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <p>요약서가 여기에 표시됩니다</p>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="mt-4 px-6 pb-2">
          <p className="text-xs text-muted-foreground italic text-center">
            ※ 본 분석은 특허명세서를 바탕으로 실시하여 실제 연구 및 개발 단계와는 상이할 수 있음
          </p>
        </div>
      </div>

      {/* 4. TRL Section (Technology Maturity) */}
      {patentData && commercializationDetails && (
        <TechnologyCommercializationScore 
          score={commercializationScore}
          isLoading={false}
          details={commercializationDetails}
          showTrlOnly={true}
        />
      )}

      {/* 5. Claims Card */}
      {patentData?.claims && patentData.claims.length > 0 && (
        <div className="claims-section mt-6 glass-effect rounded-3xl p-6 md:p-8 animate-slide-in" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-border/50">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl">
              📑
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">청구항</h3>
              <p className="text-sm text-muted-foreground">{patentData.claims.length}개</p>
            </div>
          </div>

          <details>
            <summary className="cursor-pointer select-none text-sm font-semibold text-foreground/90 hover:text-foreground">
              청구항 내용 펼치기/접기
            </summary>
            <div className="mt-4 space-y-3">
              {patentData.claims.map((c, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-secondary/30 border border-border/50">
                  <div className="text-xs text-muted-foreground mb-2">청구항 {idx + 1}</div>
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
      <RelatedPatentsSection relatedPatents={relatedPatents} onPatentClick={onRelatedPatentClick} />
    </div>
  );
}

// Re-export types for backward compatibility
export type { PatentSummaryProps, PatentData, RelatedPatent } from "./types";
