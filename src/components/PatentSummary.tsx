import { FileText, Download, Copy, Check, ExternalLink, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface PatentData {
  title?: string;
  abstract?: string;
  inventors?: string[];
  assignee?: string;
  filingDate?: string;
  publicationDate?: string;
  claims?: string[];
  patentNumber?: string;
  applicationNumber?: string;
  classifications?: string[];
}

interface RelatedPatent {
  patentId: string;
  title: string;
  assignee?: string;
  publicationDate?: string;
  snippet?: string;
  link?: string;
}

interface PatentSummaryProps {
  content: string;
  patentNumber: string;
  isStreaming: boolean;
  patentData?: PatentData | null;
  relatedPatents?: RelatedPatent[];
}

export function PatentSummary({ content, patentNumber, isStreaming, patentData, relatedPatents = [] }: PatentSummaryProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("클립보드에 복사되었습니다");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `특허요약_${patentNumber}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("파일이 다운로드되었습니다");
  };

  const openGooglePatents = () => {
    let patentId = patentNumber.trim();
    if (patentId.startsWith("10-")) {
      patentId = `KR10${patentId.replace("10-", "")}`;
    } else if (!patentId.startsWith("KR")) {
      patentId = `KR${patentId}`;
    }
    window.open(`https://patents.google.com/patent/${patentId}`, "_blank");
  };

  // Simple markdown to HTML conversion
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    
    lines.forEach((line, index) => {
      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="text-xl font-semibold text-primary mt-6 mb-3 first:mt-0">
            {line.replace('## ', '')}
          </h2>
        );
      } else if (line.startsWith('- ')) {
        elements.push(
          <li key={index} className="text-foreground/90 ml-4 list-disc">
            {line.replace('- ', '')}
          </li>
        );
      } else if (line.match(/^\d+\.\s/)) {
        elements.push(
          <li key={index} className="text-foreground/90 ml-4 list-decimal">
            {line.replace(/^\d+\.\s/, '')}
          </li>
        );
      } else if (line.trim()) {
        elements.push(
          <p key={index} className="text-foreground/80 leading-relaxed mb-2">
            {line}
          </p>
        );
      }
    });
    
    return elements;
  };

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-up">
      {/* Patent Data Badge */}
      {patentData && (
        <div className="mb-4 p-4 rounded-xl bg-accent/10 border border-accent/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm font-medium text-accent">Google Patents 데이터 연동됨</span>
          </div>
          <p className="text-sm text-muted-foreground">
            실제 특허 데이터를 기반으로 요약서가 생성됩니다.
          </p>
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
              <p className="text-sm text-muted-foreground">등록번호: {patentNumber}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={openGooglePatents}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Google Patents
            </Button>
            {!isStreaming && content && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "복사됨" : "복사"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  다운로드
                </Button>
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
      {relatedPatents.length > 0 && (
        <div className="mt-6 glass-effect rounded-2xl border border-border/50 overflow-hidden animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <div className="bg-secondary/30 border-b border-border/50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Link2 className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">유사 특허</h3>
                <p className="text-sm text-muted-foreground">{relatedPatents.length}건의 관련 특허</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 md:p-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {relatedPatents.map((patent, index) => (
                <div
                  key={patent.patentId || index}
                  className="p-4 rounded-xl bg-muted/50 border border-border/30 hover:bg-muted/80 hover:border-primary/30 transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {patent.patentId?.replace('patent/', '').replace('/en', '') || '번호 없음'}
                    </Badge>
                    {patent.link && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => window.open(patent.link, "_blank")}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <h4 className="font-medium text-sm text-foreground line-clamp-2 mb-2">
                    {patent.title}
                  </h4>
                  {patent.snippet && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {patent.snippet}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {patent.assignee && (
                      <span className="truncate max-w-[120px]">{patent.assignee}</span>
                    )}
                    {patent.assignee && patent.publicationDate && <span>•</span>}
                    {patent.publicationDate && <span>{patent.publicationDate}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
