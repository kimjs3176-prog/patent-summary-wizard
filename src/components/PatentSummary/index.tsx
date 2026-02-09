import { useRef, useState, useEffect } from "react";
import { FileText, Copy, Check, Printer, Share2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { PatentSummaryProps } from "./types";
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
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

  const handleShare = async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `특허 요약서 - ${patentNumber}`,
          text: `${patentData?.titleKo || patentNumber} 특허 요약서`,
          url: url,
        });
        toast.success("공유되었습니다");
      } catch (error) {
        // User cancelled or error occurred
        if ((error as Error).name !== 'AbortError') {
          // Fallback to clipboard
          await navigator.clipboard.writeText(url);
          toast.success("링크가 클립보드에 복사되었습니다");
        }
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      await navigator.clipboard.writeText(url);
      toast.success("링크가 클립보드에 복사되었습니다");
    }
  };

  const handlePrint = async () => {
    if (!summaryRef.current) {
      toast.error("인쇄할 내용이 없습니다");
      return;
    }

    toast.info("인쇄 준비 중...");

    try {
      const canvas = await html2canvas(summaryRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const printWindow = window.open("", "_blank");
      
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
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              display: flex; 
              justify-content: center; 
              align-items: flex-start;
              min-height: 100vh;
              padding: 10mm;
              background: white;
            }
            img { 
              max-width: 100%; 
              height: auto; 
            }
            @media print {
              body { padding: 0; }
              img { max-width: 100%; page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <img src="${imgData}" alt="특허 요약서" />
        </body>
        </html>
      `);

      printWindow.document.close();

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 300);
      };
    } catch (error) {
      console.error("Print error:", error);
      toast.error("인쇄 준비 중 오류가 발생했습니다.");
    }
  };

  const handlePdfDownload = async () => {
    if (!summaryRef.current) {
      toast.error("PDF 생성에 실패했습니다.");
      return;
    }

    setIsGeneratingPdf(true);
    toast.info("PDF 생성 중...");

    try {
      const canvas = await html2canvas(summaryRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // A4 dimensions in mm
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;
      const contentWidth = pdfWidth - margin * 2;

      // Calculate the height needed for the content to fit the width
      const ratio = contentWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      // Create PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Calculate number of pages needed
      const pageContentHeight = pdfHeight - margin * 2;
      const totalPages = Math.ceil(scaledHeight / pageContentHeight);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
          pdf.addPage();
        }

        // Calculate the portion of the image to draw on this page
        const sourceY = (page * pageContentHeight) / ratio;
        const sourceHeight = Math.min(pageContentHeight / ratio, imgHeight - sourceY);
        const destHeight = sourceHeight * ratio;

        // Create a temporary canvas to extract the portion
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = imgWidth;
        tempCanvas.height = sourceHeight;
        const tempCtx = tempCanvas.getContext("2d");

        if (tempCtx) {
          tempCtx.drawImage(
            canvas,
            0, sourceY, imgWidth, sourceHeight,
            0, 0, imgWidth, sourceHeight
          );

          const pageImgData = tempCanvas.toDataURL("image/png");
          pdf.addImage(pageImgData, "PNG", margin, margin, contentWidth, destHeight);
        }
      }

      // Add footer to each page
      const totalPdfPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPdfPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `© 농식품 특허 요약 서비스 | 생성일: ${new Date().toLocaleDateString("ko-KR")}`,
          margin,
          pdfHeight - 5
        );
        pdf.text(`${i} / ${totalPdfPages}`, pdfWidth - margin - 10, pdfHeight - 5);
      }

      pdf.save(`특허요약_${patentNumber}.pdf`);
      toast.success("PDF가 다운로드되었습니다!");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };


  // MD 다운로드 기능 및 Google Patents 링크 기능 제거 (요청사항)

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
        
        elements.push(
          <h2 key={index} className="text-xl font-semibold text-primary mt-6 mb-3 first:mt-0">
            {sectionTitle}
          </h2>
        );
        
        // Insert representative image AFTER "발명의 요약" section header
        if (sectionTitle === "발명의 요약" && patentData?.representativeImage) {
          const proxied = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(
            patentData.representativeImage
          )}`;

          elements.push(
            <div key={`img-${index}`} className="my-6 flex justify-center">
              <div className="text-center">
                <img
                  src={proxied}
                  alt="대표 도면"
                  className="w-72 md:w-80 h-auto max-h-96 object-contain rounded-2xl border border-border/50 bg-white/90 mx-auto shadow-md"
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
        elements.push(
          <p key={index} className="text-foreground/80 leading-relaxed mb-2">
            {cleanLine}
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

      {/* Main Summary Container - Used for PDF/Print capture */}
      <div ref={summaryRef} className="space-y-6 bg-background p-4 rounded-lg">
      {patentData && (
        <div className="mb-6 glass-effect rounded-3xl p-8 animate-slide-in">
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-border/50">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl">
              📄
            </div>
            <div className="card-title text-xl font-bold text-foreground">특허 정보</div>
          </div>
          
          <div className="inline-block px-4 py-2 bg-accent/20 text-accent rounded-lg text-sm font-medium mb-3">
            {patentData.searchType === 'application' ? '출원번호' : '등록번호'}: {
              patentData.searchType === 'application' 
                ? (patentData.applicationNumber || patentData.displayNumber || patentData.patentNumber)
                : (patentData.displayNumber || patentData.patentNumber)
            }
          </div>
          
          {patentData.titleKo && (
            <h2 className="text-2xl font-bold text-foreground mb-4 leading-tight">{patentData.titleKo}</h2>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
            {patentData.assignee && (
              <div className="bg-secondary/30 p-4 rounded-xl border border-border/50">
                <div className="text-xs text-muted-foreground mb-1 font-medium">출원인</div>
                <div className="text-sm text-foreground font-medium">{patentData.assignee}</div>
              </div>
            )}
            {patentData.inventors && patentData.inventors.length > 0 && (
              <div className="bg-secondary/30 p-4 rounded-xl border border-border/50">
                <div className="text-xs text-muted-foreground mb-1 font-medium">발명자</div>
                <div className="text-sm text-foreground font-medium">{patentData.inventors.join(', ')}</div>
              </div>
            )}
            {patentData.filingDate && (
              <div className="bg-secondary/30 p-4 rounded-xl border border-border/50">
                <div className="text-xs text-muted-foreground mb-1 font-medium">출원일</div>
                <div className="text-sm text-foreground font-medium">{patentData.filingDate}</div>
              </div>
            )}
            {patentData.publicationDate && (
              <div className="bg-secondary/30 p-4 rounded-xl border border-border/50">
                <div className="text-xs text-muted-foreground mb-1 font-medium">공개일</div>
                <div className="text-sm text-foreground font-medium">{patentData.publicationDate}</div>
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
                <Button variant="outline" size="sm" onClick={handleShare} className="gap-2 border-border/50 bg-card/50 hover:bg-card text-foreground">
                  <Share2 className="w-4 h-4" />
                  공유
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 border-border/50 bg-card/50 hover:bg-card text-foreground">
                  <Printer className="w-4 h-4" />
                  인쇄
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePdfDownload} 
                  disabled={isGeneratingPdf}
                  className="gap-2 border-border/50 bg-card/50 hover:bg-card text-foreground"
                >
                  <FileDown className="w-4 h-4" />
                  {isGeneratingPdf ? "생성 중..." : "PDF 다운로드"}
                </Button>
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

      {/* 5. Claims Card */}
      {patentData?.claims && patentData.claims.length > 0 && (
        <div className="mt-6 glass-effect rounded-3xl p-6 md:p-8 animate-slide-in" style={{ animationDelay: '0.15s' }}>
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
