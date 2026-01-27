import { forwardRef } from "react";
import { PatentData } from "./types";

interface PrintableContentProps {
  content: string;
  patentNumber: string;
  patentData?: PatentData | null;
}

export const PrintableContent = forwardRef<HTMLDivElement, PrintableContentProps>(
  ({ content, patentNumber, patentData }, ref) => {
    const renderMarkdown = (text: string) => {
      const lines = text.split("\n");
      const elements: JSX.Element[] = [];

      lines.forEach((line, index) => {
        if (line.startsWith("## ")) {
          elements.push(
            <h2
              key={index}
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#1e3a5f",
                marginTop: index === 0 ? "0" : "20px",
                marginBottom: "10px",
                borderBottom: "2px solid #e2e8f0",
                paddingBottom: "6px",
              }}
            >
              {line.replace("## ", "")}
            </h2>
          );
        } else if (line.startsWith("- ")) {
          elements.push(
            <li
              key={index}
              style={{
                fontSize: "12px",
                color: "#374151",
                marginLeft: "16px",
                marginBottom: "4px",
                listStyleType: "disc",
              }}
            >
              {line.replace("- ", "")}
            </li>
          );
        } else if (line.match(/^\d+\.\s/)) {
          elements.push(
            <li
              key={index}
              style={{
                fontSize: "12px",
                color: "#374151",
                marginLeft: "16px",
                marginBottom: "4px",
                listStyleType: "decimal",
              }}
            >
              {line.replace(/^\d+\.\s/, "")}
            </li>
          );
        } else if (line.trim()) {
          elements.push(
            <p
              key={index}
              style={{
                fontSize: "12px",
                color: "#374151",
                lineHeight: "1.6",
                marginBottom: "8px",
              }}
            >
              {line}
            </p>
          );
        }
      });

      return elements;
    };

    return (
      <div
        ref={ref}
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: "210mm",
          minHeight: "297mm",
          padding: "20mm",
          backgroundColor: "#ffffff",
          fontFamily: "'Noto Sans KR', sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            borderBottom: "3px solid #1e3a5f",
            paddingBottom: "16px",
            marginBottom: "20px",
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
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#1e3a5f",
                  margin: 0,
                }}
              >
                특허 요약서
              </h1>
              <p
                style={{
                  fontSize: "14px",
                  color: "#6b7280",
                  marginTop: "4px",
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
                  fontSize: "12px",
                  color: "#6b7280",
                  margin: 0,
                }}
              >
                등록번호
              </p>
              <p
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "#1e3a5f",
                  margin: 0,
                }}
              >
                {patentNumber}
              </p>
            </div>
          </div>
        </div>

        {/* Patent Info Box */}
        {patentData && (
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                fontSize: "11px",
              }}
            >
              {patentData.title && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "#6b7280", fontWeight: 500 }}>발명의 명칭: </span>
                  <span style={{ color: "#1e3a5f", fontWeight: 600 }}>{patentData.title}</span>
                </div>
              )}
              {patentData.assignee && (
                <div>
                  <span style={{ color: "#6b7280", fontWeight: 500 }}>출원인: </span>
                  <span style={{ color: "#374151" }}>{patentData.assignee}</span>
                </div>
              )}
              {patentData.inventors && patentData.inventors.length > 0 && (
                <div>
                  <span style={{ color: "#6b7280", fontWeight: 500 }}>발명자: </span>
                  <span style={{ color: "#374151" }}>{patentData.inventors.join(", ")}</span>
                </div>
              )}
              {patentData.filingDate && (
                <div>
                  <span style={{ color: "#6b7280", fontWeight: 500 }}>출원일: </span>
                  <span style={{ color: "#374151" }}>{patentData.filingDate}</span>
                </div>
              )}
              {patentData.publicationDate && (
                <div>
                  <span style={{ color: "#6b7280", fontWeight: 500 }}>공개일: </span>
                  <span style={{ color: "#374151" }}>{patentData.publicationDate}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div>{renderMarkdown(content)}</div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: "15mm",
            left: "20mm",
            right: "20mm",
            borderTop: "1px solid #e2e8f0",
            paddingTop: "10px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "10px",
            color: "#9ca3af",
          }}
        >
          <span>© 특허요약 서비스 | AI 기반 특허 분석</span>
          <span>
            생성일: {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
          </span>
        </div>
      </div>
    );
  }
);

PrintableContent.displayName = "PrintableContent";
