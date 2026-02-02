import { useRef, useState } from "react";
import { FileText, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PatentSummaryProps } from "./types";
import { PdfGenerator } from "./PdfGenerator";
import { PrintableContent } from "./PrintableContent";
import { RelatedPatentsSection } from "./RelatedPatentsSection";

export function PatentSummary({
  content,
  patentNumber,
  isStreaming,
  patentData,
  relatedPatents = [],
}: PatentSummaryProps) {
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("클립보드에 복사되었습니다");
    setTimeout(() => setCopied(false), 2000);
  };

  // MD 다운로드 기능 제거 (요청사항)

  const openGooglePatents = () => {
    let patentId = patentNumber.trim();
    if (patentId.startsWith("10-")) {
      patentId = `KR10${patentId.replace("10-", "")}`;
    } else if (!patentId.startsWith("KR")) {
      patentId = `KR${patentId}`;
    }
    window.open(`https://patents.google.com/patent/${patentId}`, "_blank");
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
        
        elements.push(
          <h2 key={index} className="text-xl font-semibold text-primary mt-6 mb-3 first:mt-0">
            {sectionTitle}
          </h2>
        );
        
        // Insert representative image AFTER "발명의 요약" section header
        if (sectionTitle === "발명의 요약" && patentData?.representativeImage) {
          elements.push(
            <div key={`img-${index}`} className="my-6 flex justify-center">
              <div className="text-center">
                <img 
                  src={patentData.representativeImage} 
                  alt="대표 도면" 
                  className="w-40 md:w-44 h-auto max-h-64 object-contain rounded-lg border border-border/50 bg-white mx-auto"
                  onError={(e) => {
                    e.currentTarget.parentElement!.style.display = 'none';
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
      {/* Printable Content (Hidden) */}
      <PrintableContent
        ref={printRef}
        content={content}
        patentNumber={patentNumber}
        patentData={patentData}
      />

      {/* Patent Data Badge */}
      {patentData && (
        <div className="mb-4 p-4 rounded-xl bg-accent/10 border border-accent/20">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm font-medium text-accent">Google Patents 데이터 연동됨</span>
          </div>
          <div className="text-sm text-foreground/80 space-y-1">
            <p>
              <span className="text-muted-foreground">{patentData.searchType === 'application' ? '출원번호' : '등록번호'}:</span>{' '}
              <span className="font-medium">
                {patentData.searchType === 'application' 
                  ? (patentData.applicationNumber || patentData.displayNumber || patentData.patentNumber)
                  : (patentData.displayNumber || patentData.patentNumber)}
              </span>
            </p>
            {patentData.titleKo && (
              <p>
                <span className="text-muted-foreground">발명의 명칭:</span>{' '}
                <span className="font-medium">{patentData.titleKo}</span>
              </p>
            )}
            <p>
              {patentData.assignee && (
                <>
                  <span className="text-muted-foreground">출원인:</span>{' '}
                  <span>{patentData.assignee}</span>
                </>
              )}
              {patentData.inventors && patentData.inventors.length > 0 && (
                <>
                  <span className="text-muted-foreground ml-4">발명자:</span>{' '}
                  <span>{patentData.inventors.join(', ')}</span>
                </>
              )}
            </p>
            <p>
              {patentData.filingDate && (
                <>
                  <span className="text-muted-foreground">출원일:</span>{' '}
                  <span>{patentData.filingDate}</span>
                </>
              )}
              {patentData.publicationDate && (
                <>
                  <span className="text-muted-foreground ml-4">공개일:</span>{' '}
                  <span>{patentData.publicationDate}</span>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="glass-effect rounded-2xl border border-border/50 overflow-hidden">
        {/* Header */}
        <div className="bg-primary/5 border-b border-border/50 px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">특허 요약서</h3>
              <p className="text-sm text-muted-foreground">
                {patentData?.searchType === 'application' ? '출원번호' : '등록번호'}: {patentNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={openGooglePatents} className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Google Patents
            </Button>
            {!isStreaming && content && (
              <>
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "복사됨" : "복사"}
                </Button>
                <PdfGenerator
                  content={content}
                  patentNumber={patentNumber}
                  patentData={patentData}
                  printRef={printRef}
                />
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 min-h-[400px]">
          {content ? (
            <div className="prose prose-slate max-w-none">
              {renderMarkdown(content)}
              {isStreaming && (
                <span className="inline-block w-2 h-5 bg-accent animate-pulse-subtle ml-1" />
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

      {/* Related Patents Section */}
      <RelatedPatentsSection relatedPatents={relatedPatents} />
    </div>
  );
}

// Re-export types for backward compatibility
export type { PatentSummaryProps, PatentData, RelatedPatent } from "./types";
