import { forwardRef } from "react";
import { PatentData } from "./types";

interface PrintableContentProps {
  content: string;
  patentNumber: string;
  patentData?: PatentData | null;
  printSections?: Record<string, boolean>;
}

export const PrintableContent = forwardRef<HTMLDivElement, PrintableContentProps>(
  ({ content, patentNumber, patentData, printSections }, ref) => {
    const renderMarkdown = (text: string) => {
      const lines = text.split("\n");
      const elements: JSX.Element[] = [];

      lines.forEach((line, index) => {
        // Keep **bold**, drop bullet/number prefixes
        let cleanLine = line
          .replace(/^\s*[-•]\s+/, '')
          .replace(/^\s*\d+\.\s+/, '');

        if (line.startsWith("## ")) {
          const sectionTitle = line.replace("## ", "").replace(/\*\*/g, '');
          
          // Skip "특허 기본 정보" section entirely
          if (sectionTitle === "특허 기본 정보") {
            return;
          }
          
          elements.push(
            <h2
              key={index}
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#1e3a5f",
                marginTop: index === 0 ? "0" : "16px",
                marginBottom: "8px",
                borderBottom: "2px solid #e2e8f0",
                paddingBottom: "4px",
              }}
            >
              {sectionTitle}
            </h2>
          );
        } else if (cleanLine.trim()) {
          // Skip lines that look like they're from 특허 기본 정보 section
          if (
            cleanLine.includes("등록번호는") ||
            cleanLine.includes("출원번호는") ||
            cleanLine.includes("발명의 명칭은") ||
            cleanLine.includes("출원인/권리자는") ||
            cleanLine.includes("출원일/등록일은") ||
            cleanLine.includes("발명자는")
          ) {
            return;
          }
          
          elements.push(
            <p
              key={index}
              style={{
                fontSize: "11px",
                color: "#374151",
                lineHeight: "1.5",
                marginBottom: "6px",
              }}
            >
              {renderInline(cleanLine)}
            </p>
          );
        }
      });

      return elements;
    };

    // Convert **bold** and *italic* markers into <strong>/<em> nodes for print output
    const renderInline = (text: string): React.ReactNode[] => {
      const boldParts = text.split(/(\*\*[^*\n]+?\*\*)/g);
      const out: React.ReactNode[] = [];
      boldParts.forEach((bp, bi) => {
        const bm = bp.match(/^\*\*([^*\n]+?)\*\*$/);
        if (bm) {
          const inner = bm[1];
          const italicInside = inner.split(/(\*[A-Za-z][A-Za-z0-9 .\-]{1,60}\*)/g);
          out.push(
            <strong key={`b${bi}`} style={{ fontWeight: 700, color: "#1e3a5f" }}>
              {italicInside.map((ip, ii) => {
                const im = ip.match(/^\*([A-Za-z][A-Za-z0-9 .\-]{1,60})\*$/);
                if (im) return <em key={ii} style={{ fontStyle: "italic" }}>{im[1]}</em>;
                return <span key={ii}>{ip}</span>;
              })}
            </strong>,
          );
          return;
        }
        const parts = bp.split(/(\*[A-Za-z][A-Za-z0-9 .\-]{1,60}\*)/g);
        parts.forEach((p, i) => {
          const m = p.match(/^\*([A-Za-z][A-Za-z0-9 .\-]{1,60})\*$/);
          if (m) out.push(<em key={`i${bi}-${i}`} style={{ fontStyle: "italic" }}>{m[1]}</em>);
          else if (p) out.push(<span key={`t${bi}-${i}`}>{p}</span>);
        });
      });
      return out;
    };

    const displayNumber = patentData?.displayNumber || patentNumber;
    const numberLabel = patentData?.searchType === 'application' ? '출원번호' : '등록번호';

    return (
      <div
        ref={ref}
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: "170mm",
          padding: "0",
          backgroundColor: "#ffffff",
          fontFamily: "'Noto Sans KR', sans-serif",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        {printSections?.header !== false && (
          <div
            style={{
              borderBottom: "3px solid #1e3a5f",
              paddingBottom: "8px",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: "22px",
                    fontWeight: 700,
                    color: "#1e3a5f",
                    margin: 0,
                  }}
                >
                  특허 요약서
                </h1>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#6b7280",
                    marginTop: "2px",
                  }}
                >
                  Patent Summary Report
                </p>
              </div>
              <div
                style={{
                  textAlign: "right",
                }}
              >
                <p
                  style={{
                    fontSize: "10px",
                    color: "#6b7280",
                    margin: 0,
                  }}
                >
                  {numberLabel}
                </p>
                <p
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#1e3a5f",
                    margin: 0,
                  }}
                >
                  {displayNumber}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Patent Info - Non-descriptive format */}
        {printSections?.patentInfo !== false && patentData && (
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              padding: "10px",
              marginBottom: "14px",
              fontSize: "10px",
            }}
          >
            <div style={{ marginBottom: "6px" }}>
              <span style={{ color: "#6b7280" }}>{numberLabel}: </span>
              <span style={{ color: "#1e3a5f", fontWeight: 600 }}>{displayNumber}</span>
              {patentData.titleKo && (
                <>
                  <span style={{ color: "#6b7280", marginLeft: "16px" }}>발명의 명칭: </span>
                  <span style={{ color: "#1e3a5f", fontWeight: 500 }}>{patentData.titleKo}</span>
                </>
              )}
            </div>
            <div style={{ marginBottom: "6px" }}>
              {patentData.assignee && (
                <>
                  <span style={{ color: "#6b7280" }}>출원인: </span>
                  <span style={{ color: "#374151" }}>{patentData.assignee}</span>
                </>
              )}
              {patentData.inventors && patentData.inventors.length > 0 && (
                <>
                  <span style={{ color: "#6b7280", marginLeft: "16px" }}>발명자: </span>
                  <span style={{ color: "#374151" }}>{patentData.inventors.join(', ')}</span>
                </>
              )}
            </div>
            <div>
              {patentData.filingDate && (
                <>
                  <span style={{ color: "#6b7280" }}>출원일: </span>
                  <span style={{ color: "#374151" }}>{patentData.filingDate}</span>
                </>
              )}
              {patentData.publicationDate && (
                <>
                  <span style={{ color: "#6b7280", marginLeft: "16px" }}>공개일: </span>
                  <span style={{ color: "#374151" }}>{patentData.publicationDate}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        {printSections?.aiSummary !== false && <div>{renderMarkdown(content)}</div>}

        {/* Footer */}
        {printSections?.footer !== false && (
          <div
            style={{
              marginTop: "16px",
              borderTop: "1px solid #e2e8f0",
              paddingTop: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "9px",
              color: "#9ca3af",
            }}
          >
            <span>© 특허요약 서비스 | AI 기반 특허 분석</span>
            <span>
              생성일: {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>
        )}
      </div>
    );
  }
);

PrintableContent.displayName = "PrintableContent";
