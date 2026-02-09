import { useRef, useState, useEffect } from "react";
import { FileText, Copy, Check, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PatentSummaryProps } from "./types";
import { PdfGenerator } from "./PdfGenerator";
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
}: PatentSummaryProps) {
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [commercializationScore, setCommercializationScore] = useState<number | null>(null);
  const [commercializationDetails, setCommercializationDetails] = useState<CommercializationDetails | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  const handlePrint = () => {
    if (!printRef.current) {
      toast.error("인쇄할 내용이 없습니다");
      return;
    }
    
    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      toast.error("팝업이 차단되었습니다. 팝업을 허용해주세요.");
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>특허 요약서 - ${patentNumber}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Noto Sans KR', sans-serif;
            font-size: 11pt;
            line-height: 1.7;
            color: #1a1a1a;
            padding: 15mm;
            max-width: 210mm;
            margin: 0 auto;
          }
          
          .print-header {
            border-bottom: 2px solid #1e3a5f;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          
          .print-title {
            font-size: 18pt;
            font-weight: 700;
            color: #1e3a5f;
            margin-bottom: 4px;
          }
          
          .print-subtitle {
            font-size: 9pt;
            color: #6b7280;
          }
          
          .print-number {
            text-align: right;
            font-size: 12pt;
            font-weight: 600;
            color: #1e3a5f;
            margin-top: -30px;
          }
          
          .patent-info-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 20px;
            font-size: 9pt;
          }
          
          .patent-info-box p {
            margin: 3px 0;
          }
          
          .patent-info-label {
            color: #6b7280;
          }
          
          h2 {
            font-size: 13pt;
            font-weight: 600;
            color: #1e3a5f;
            margin-top: 18px;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid #e2e8f0;
          }
          
          p {
            margin-bottom: 8px;
            text-align: justify;
          }
          
          .representative-image {
            text-align: center;
            margin: 16px 0;
          }
          
          .representative-image img {
            max-width: 180px;
            max-height: 150px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
          }
          
          .representative-image .caption {
            font-size: 9pt;
            color: #6b7280;
            margin-top: 6px;
          }
          
          .print-footer {
            position: fixed;
            bottom: 10mm;
            left: 15mm;
            right: 15mm;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
            font-size: 8pt;
            color: #9ca3af;
            display: flex;
            justify-content: space-between;
          }
          
          @media print {
            body {
              padding: 0;
            }
            .print-footer {
              position: fixed;
            }
          }
        </style>
      </head>
      <body>
        ${printContent}
        <div class="print-footer">
          <span>© 농식품 특허 1페이지 요약 서비스 | AI 기반 특허 분석</span>
          <span>생성일: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait for fonts and images to load
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // MD 다운로드 기능 및 Google Patents 링크 기능 제거 (요청사항)

  // Section icons mapping
  const getSectionIcon = (title: string): string => {
    const iconMap: Record<string, string> = {
      "발명의 요약": "💡",
      "기술적 특징": "⚙️",
      "핵심 청구항": "📋",
      "기술적 효과": "✅",
      "산업적 활용": "🏭",
      "응용 분야": "🎯",
      "장점": "👍",
      "단점": "👎",
      "결론": "📝",
    };
    
    for (const [key, icon] of Object.entries(iconMap)) {
      if (title.includes(key)) return icon;
    }
    return "📌";
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    const elements: JSX.Element[] = [];
    let skipSection = false;

    lines.forEach((line, index) => {
      // Skip the entire "특허 기본 정보" section
      if (line.startsWith("## 특허 기본 정보")) {
        skipSection = true;
        return;
      }
      
      // Stop skipping when we reach the next section
      if (skipSection && line.startsWith("## ")) {
        skipSection = false;
      }
      
      if (skipSection) {
        return;
      }

      // Remove markdown formatting: **, -, numbered lists
      let cleanLine = line
        .replace(/\*\*/g, '') // Remove **
        .replace(/^\s*[-•]\s+/, '') // Remove bullet points
        .replace(/^\s*\d+\.\s+/, ''); // Remove numbered lists

      if (line.startsWith("## ")) {
        const sectionTitle = line.replace("## ", "").replace(/\*\*/g, '');
        
        // Skip 특허 기본 정보 section
        if (sectionTitle === "특허 기본 정보") {
          skipSection = true;
          return;
        }
        
        const sectionIcon = getSectionIcon(sectionTitle);
        
        elements.push(
          <div key={`section-${index}`} className="mt-8 first:mt-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xl border border-primary/10">
                {sectionIcon}
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {sectionTitle}
              </h2>
            </div>
          </div>
        );
        
        // Insert representative image AFTER "발명의 요약" section header
        if (sectionTitle === "발명의 요약" && patentData?.representativeImage) {
          const proxied = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(
            patentData.representativeImage
          )}`;

          elements.push(
            <div key={`img-${index}`} className="my-6 flex justify-center">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-secondary/50 to-secondary/30 border border-border/50">
                <img
                  src={proxied}
                  alt="대표 도면"
                  className="w-72 md:w-80 h-auto max-h-96 object-contain rounded-xl bg-white/90 mx-auto"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    (e.currentTarget.parentElement?.parentElement as HTMLElement)!.style.display = "none";
                  }}
                />
                <p className="text-xs text-muted-foreground mt-3 text-center flex items-center justify-center gap-2">
                  <span>🖼️</span>
                  <span>대표 도면</span>
                </p>
              </div>
            </div>
          );
        }
      } else if (cleanLine.trim()) {
        elements.push(
          <p key={index} className="text-foreground/80 leading-relaxed mb-3 pl-13">
            {cleanLine}
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

      {/* 1. Patent Info Card with Enhanced Visuals */}
      {patentData && (
        <div className="mb-6 glass-effect rounded-3xl p-8 animate-slide-in">
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-border/50">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl shadow-lg">
              📄
            </div>
            <div className="flex-1">
              <div className="card-title text-xl font-bold text-foreground">특허 정보</div>
              <p className="text-sm text-muted-foreground">Patent Information</p>
            </div>
            <div className="px-4 py-2 bg-gradient-to-r from-accent/20 to-primary/20 text-foreground rounded-full text-sm font-medium border border-accent/30">
              {patentData.searchType === 'application' ? '📋 출원번호' : '✅ 등록번호'}
            </div>
          </div>
          
          {/* Patent Number Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-xl text-sm font-mono mb-4 border border-primary/20">
            <span className="text-primary">🔢</span>
            <span className="text-foreground font-semibold">
              {patentData.searchType === 'application' 
                ? (patentData.applicationNumber || patentData.displayNumber || patentData.patentNumber)
                : (patentData.displayNumber || patentData.patentNumber)}
            </span>
          </div>
          
          {patentData.titleKo && (
            <h2 className="text-2xl font-bold text-foreground mb-5 leading-tight flex items-start gap-3">
              <span className="text-primary text-2xl mt-1">📌</span>
              <span>{patentData.titleKo}</span>
            </h2>
          )}
          
          {/* Info Grid with Icons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            {patentData.assignee && (
              <div className="bg-gradient-to-br from-secondary/50 to-secondary/30 p-4 rounded-xl border border-border/50 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 font-medium">
                  <span>🏢</span>
                  <span>출원인</span>
                </div>
                <div className="text-sm text-foreground font-semibold">{patentData.assignee}</div>
              </div>
            )}
            {patentData.inventors && patentData.inventors.length > 0 && (
              <div className="bg-gradient-to-br from-secondary/50 to-secondary/30 p-4 rounded-xl border border-border/50 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 font-medium">
                  <span>👨‍🔬</span>
                  <span>발명자</span>
                </div>
                <div className="text-sm text-foreground font-semibold">{patentData.inventors.join(', ')}</div>
              </div>
            )}
            {patentData.filingDate && (
              <div className="bg-gradient-to-br from-secondary/50 to-secondary/30 p-4 rounded-xl border border-border/50 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 font-medium">
                  <span>📅</span>
                  <span>출원일</span>
                </div>
                <div className="text-sm text-foreground font-semibold">{patentData.filingDate}</div>
              </div>
            )}
            {patentData.publicationDate && (
              <div className="bg-gradient-to-br from-secondary/50 to-secondary/30 p-4 rounded-xl border border-border/50 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 font-medium">
                  <span>📢</span>
                  <span>공개일</span>
                </div>
                <div className="text-sm text-foreground font-semibold">{patentData.publicationDate}</div>
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

          <div className="flex items-center gap-2 flex-wrap">
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
                <PdfGenerator
                  content={content}
                  patentNumber={patentNumber}
                  patentData={patentData}
                  printRef={printRef}
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
            <div className="prose prose-invert max-w-none">
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

      {/* 5. Claims Card with Enhanced Design */}
      {patentData?.claims && patentData.claims.length > 0 && (
        <div className="mt-6 glass-effect rounded-3xl p-6 md:p-8 animate-slide-in" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center justify-between mb-5 pb-5 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl">
                📑
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">청구항</h3>
                <p className="text-sm text-muted-foreground">Patent Claims</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
              <span className="text-lg">📊</span>
              <span className="text-foreground font-bold">{patentData.claims.length}</span>
              <span className="text-muted-foreground text-sm">개</span>
            </div>
          </div>

          <details className="group">
            <summary className="cursor-pointer select-none flex items-center gap-2 text-sm font-semibold text-foreground/90 hover:text-foreground p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <span className="text-lg group-open:rotate-90 transition-transform">▶</span>
              <span>청구항 내용 펼치기/접기</span>
            </summary>
            <div className="mt-4 space-y-4">
              {patentData.claims.map((c, idx) => (
                <div key={idx} className="p-5 rounded-2xl bg-gradient-to-br from-secondary/40 to-secondary/20 border border-border/50 hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-bold text-sm">{idx + 1}</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {idx === 0 ? "🔹 독립항" : "🔸 종속항"}
                    </span>
                  </div>
                  <div className="text-sm text-foreground/85 leading-relaxed pl-11">{c}</div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* 6. Related Patents Section */}
      <RelatedPatentsSection relatedPatents={relatedPatents} onPatentClick={onRelatedPatentClick} />
    </div>
  );
}

// Re-export types for backward compatibility
export type { PatentSummaryProps, PatentData, RelatedPatent } from "./types";
