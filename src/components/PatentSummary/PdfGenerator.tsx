import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { PatentData } from "./types";
import { loadKoreanFont, addKoreanFontToDoc } from "@/lib/koreanFont";
import { CommercializationDetails } from "./TechnologyCommercializationScore";

interface PdfGeneratorProps {
  content: string;
  patentNumber: string;
  patentData?: PatentData | null;
  printRef: React.RefObject<HTMLDivElement | null>;
  commercializationDetails?: CommercializationDetails | null;
  commercializationScore?: number | null;
}

// Helper functions for score colors
function getScoreColorRgb(value: number): [number, number, number] {
  if (value >= 80) return [76, 175, 80]; // Green
  if (value >= 60) return [33, 150, 243]; // Blue
  if (value >= 40) return [255, 193, 7]; // Amber
  return [244, 67, 54]; // Red
}

function getGradeLabel(value: number): string {
  if (value >= 90) return "S";
  if (value >= 80) return "A";
  if (value >= 70) return "B";
  if (value >= 60) return "C";
  if (value >= 50) return "D";
  return "F";
}

function getScoreLabel(value: number): string {
  if (value >= 90) return "매우 우수";
  if (value >= 80) return "우수";
  if (value >= 70) return "양호";
  if (value >= 60) return "보통";
  if (value >= 50) return "미흡";
  return "개선 필요";
}

function getTrlStageLabel(trl: number): string {
  if (trl <= 3) return "기초연구";
  if (trl <= 6) return "실험/시험";
  return "실용화/상용화";
}

export function PdfGenerator({ 
  content, 
  patentNumber, 
  patentData,
  commercializationDetails,
  commercializationScore
}: PdfGeneratorProps) {
  const handlePdfDownload = async () => {
    if (!content) {
      toast.error("PDF 생성에 실패했습니다.");
      return;
    }

    toast.info("PDF 생성 중... (폰트 로딩 중)");

    try {
      const koreanFontBase64 = await loadKoreanFont();

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      addKoreanFontToDoc(pdf, koreanFontBase64);

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let yPosition = margin;

      const checkNewPage = (neededHeight: number) => {
        if (yPosition + neededHeight > pageHeight - margin - 15) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      const addWrappedText = (text: string, fontSize: number, color: number[], lineHeight: number = 1.6) => {
        pdf.setFontSize(fontSize);
        pdf.setTextColor(color[0], color[1], color[2]);

        const lines = pdf.splitTextToSize(text, contentWidth - 10);
        const lineHeightMm = fontSize * 0.352778 * lineHeight;

        for (const line of lines) {
          checkNewPage(lineHeightMm);
          pdf.text(line, margin + 5, yPosition);
          yPosition += lineHeightMm;
        }
      };

      const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number, fill: boolean = true, stroke: boolean = true) => {
        pdf.roundedRect(x, y, w, h, r, r, fill && stroke ? "FD" : fill ? "F" : "S");
      };

      const getProxiedImageUrl = (imageUrl: string) => {
        const base = import.meta.env.VITE_SUPABASE_URL;
        return `${base}/functions/v1/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      };

      const loadImageForPdf = async (imageUrl: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> => {
        try {
          const proxied = getProxiedImageUrl(imageUrl);
          const res = await fetch(proxied);
          if (!res.ok) return null;

          const contentType = (res.headers.get("content-type") || "").toLowerCase();
          const blob = await res.blob();

          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("FileReader failed"));
            reader.readAsDataURL(blob);
          });

          const format: "PNG" | "JPEG" = contentType.includes("png") ? "PNG" : "JPEG";
          return { dataUrl, format };
        } catch (e) {
          console.warn("loadImageForPdf failed:", e);
          return null;
        }
      };

      // ===== HEADER =====
      pdf.setFillColor(34, 85, 64);
      pdf.rect(0, 0, pageWidth, 28, "F");
      
      pdf.setFontSize(18);
      pdf.setTextColor(255, 255, 255);
      pdf.text("농식품 특허 요약서", margin, 14);
      
      pdf.setFontSize(9);
      pdf.setTextColor(200, 220, 210);
      pdf.text("Agri-Food Patent Summary Report", margin, 21);

      const isApplicationSearch = patentData?.searchType === "application";
      const displayNumber = isApplicationSearch
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApplicationSearch ? "출원번호" : "등록번호";

      pdf.setFontSize(9);
      pdf.setTextColor(200, 220, 210);
      const labelWidth = pdf.getTextWidth(numberLabel);
      pdf.text(numberLabel, pageWidth - margin - labelWidth, 12);

      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      const numWidth = pdf.getTextWidth(displayNumber);
      pdf.text(displayNumber, pageWidth - margin - numWidth, 20);

      yPosition = 35;

      // ===== 1. PATENT INFO SECTION =====
      if (patentData) {
        const inventionTitle = patentData.titleKo || patentData.title || "정보 없음";
        
        pdf.setFillColor(248, 250, 245);
        pdf.setDrawColor(200, 215, 200);
        drawRoundedRect(margin, yPosition, contentWidth, 28, 3);
        yPosition += 6;

        pdf.setFontSize(8);
        pdf.setTextColor(100, 115, 100);
        pdf.text("📄 특허 정보", margin + 4, yPosition);
        yPosition += 5;

        pdf.setFontSize(11);
        pdf.setTextColor(30, 60, 45);
        const maxTitleWidth = contentWidth - 12;
        const titleLines = pdf.splitTextToSize(inventionTitle, maxTitleWidth);
        pdf.text(titleLines[0] + (titleLines.length > 1 ? "..." : ""), margin + 4, yPosition);
        yPosition += 6;

        pdf.setFontSize(8);
        let infoLine = "";
        if (patentData.assignee) infoLine += `출원인: ${patentData.assignee}   `;
        if (patentData.inventors?.length) infoLine += `발명자: ${patentData.inventors.join(", ")}   `;
        if (patentData.filingDate) infoLine += `출원일: ${patentData.filingDate}`;
        
        pdf.setTextColor(80, 95, 80);
        pdf.text(infoLine, margin + 4, yPosition);
        yPosition += 12;
      }

      // ===== 2. COMMERCIALIZATION SCORE SECTION =====
      if (commercializationScore !== null && commercializationScore !== undefined && commercializationDetails) {
        checkNewPage(55);
        
        pdf.setFillColor(255, 250, 245);
        pdf.setDrawColor(220, 200, 180);
        drawRoundedRect(margin, yPosition, contentWidth, 50, 3);
        
        const scoreBoxY = yPosition;
        yPosition += 6;

        pdf.setFontSize(9);
        pdf.setTextColor(100, 90, 70);
        pdf.text("✨ AI 기술사업화점수", margin + 4, yPosition);
        yPosition += 8;

        // Main score
        const scoreColor = getScoreColorRgb(commercializationScore);
        pdf.setFontSize(28);
        pdf.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
        pdf.text(String(commercializationScore), margin + 6, yPosition + 4);
        
        pdf.setFontSize(12);
        pdf.setTextColor(120, 120, 120);
        pdf.text("/ 100", margin + 25, yPosition + 4);

        // Grade
        pdf.setFontSize(18);
        pdf.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
        pdf.text(getGradeLabel(commercializationScore), margin + 48, yPosition + 2);
        
        pdf.setFontSize(9);
        pdf.text(getScoreLabel(commercializationScore), margin + 48, yPosition + 8);

        // Sub-scores on the right
        const subScoreX = margin + 75;
        pdf.setFontSize(8);
        
        const techColor = getScoreColorRgb(commercializationDetails.technologyScore);
        pdf.setTextColor(80, 80, 80);
        pdf.text("기술성", subScoreX, yPosition - 4);
        pdf.setTextColor(techColor[0], techColor[1], techColor[2]);
        pdf.text(`${commercializationDetails.technologyScore}점`, subScoreX + 15, yPosition - 4);

        const marketColor = getScoreColorRgb(commercializationDetails.marketScore);
        pdf.setTextColor(80, 80, 80);
        pdf.text("시장성", subScoreX + 35, yPosition - 4);
        pdf.setTextColor(marketColor[0], marketColor[1], marketColor[2]);
        pdf.text(`${commercializationDetails.marketScore}점`, subScoreX + 50, yPosition - 4);

        const bizColor = getScoreColorRgb(commercializationDetails.businessScore);
        pdf.setTextColor(80, 80, 80);
        pdf.text("사업성", subScoreX + 70, yPosition - 4);
        pdf.setTextColor(bizColor[0], bizColor[1], bizColor[2]);
        pdf.text(`${commercializationDetails.businessScore}점`, subScoreX + 85, yPosition - 4);

        yPosition += 12;

        // Progress bar
        const barWidth = contentWidth - 12;
        const barHeight = 4;
        pdf.setFillColor(230, 230, 230);
        pdf.roundedRect(margin + 4, yPosition, barWidth, barHeight, 2, 2, "F");
        
        pdf.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
        const filledWidth = (commercializationScore / 100) * barWidth;
        pdf.roundedRect(margin + 4, yPosition, filledWidth, barHeight, 2, 2, "F");
        
        yPosition += 8;

        // Analysis text
        if (commercializationDetails.analysis) {
          pdf.setFontSize(8);
          pdf.setTextColor(70, 70, 70);
          const analysisLines = pdf.splitTextToSize(commercializationDetails.analysis, contentWidth - 12);
          for (let i = 0; i < Math.min(analysisLines.length, 2); i++) {
            pdf.text(analysisLines[i], margin + 4, yPosition);
            yPosition += 4;
          }
        }

        yPosition = scoreBoxY + 55;
      }

      // ===== 3. AI SUMMARY CONTENT =====
      const lines = content.split("\n");
      let skipSection = false;
      let imageInserted = false;

      const insertRepresentativeImage = async () => {
        if (!patentData?.representativeImage || imageInserted) return false;

        const img = await loadImageForPdf(patentData.representativeImage);
        if (!img) return false;

        const imgWidth = 65;
        const imgHeight = 50;

        checkNewPage(imgHeight + 12);

        const imgX = (pageWidth - imgWidth) / 2;
        pdf.addImage(img.dataUrl, img.format, imgX, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 3;

        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        const captionText = "【대표 도면】";
        const captionWidth = pdf.getTextWidth(captionText);
        pdf.text(captionText, (pageWidth - captionWidth) / 2, yPosition);
        yPosition += 8;

        imageInserted = true;
        return true;
      };

      for (const line of lines) {
        if (line.startsWith("## 특허 기본 정보")) {
          skipSection = true;
          continue;
        }

        if (skipSection && line.startsWith("## ")) {
          skipSection = false;
        }

        if (skipSection) continue;

        if (
          line.includes("등록번호는") ||
          line.includes("출원번호는") ||
          line.includes("발명의 명칭은") ||
          line.includes("출원인/권리자는") ||
          line.includes("출원일/등록일은") ||
          line.includes("발명자는")
        ) {
          continue;
        }

        const cleanLine = line
          .replace(/\*\*/g, "")
          .replace(/^\s*[-•]\s+/, "")
          .replace(/^\s*\d+\.\s+/, "");

        if (line.startsWith("## ")) {
          const sectionTitle = line.replace("## ", "").replace(/\*\*/g, "");

          if (sectionTitle === "특허 기본 정보") {
            skipSection = true;
            continue;
          }

          checkNewPage(12);
          yPosition += 4;
          
          // Section header with accent bar
          pdf.setFillColor(76, 140, 100);
          pdf.rect(margin, yPosition - 4, 3, 8, "F");
          
          pdf.setFontSize(11);
          pdf.setTextColor(34, 85, 64);
          pdf.text(sectionTitle, margin + 6, yPosition);
          yPosition += 6;

          // Insert image after 발명의 요약
          if (sectionTitle === "발명의 요약") {
            await insertRepresentativeImage();
          }
        } else if (cleanLine.trim()) {
          addWrappedText(cleanLine, 9.5, [50, 55, 50], 1.6);
          yPosition += 1;
        }
      }

      // ===== 4. TRL SECTION =====
      if (commercializationDetails?.trl) {
        checkNewPage(40);
        yPosition += 5;
        
        pdf.setFillColor(245, 250, 255);
        pdf.setDrawColor(180, 200, 220);
        drawRoundedRect(margin, yPosition, contentWidth, 35, 3);
        
        yPosition += 6;
        pdf.setFontSize(9);
        pdf.setTextColor(70, 90, 120);
        pdf.text("📊 기술성숙도 (TRL)", margin + 4, yPosition);
        yPosition += 8;

        // TRL visualization
        const trl = commercializationDetails.trl;
        const trlBarWidth = contentWidth - 12;
        const segmentWidth = trlBarWidth / 9;
        
        // Draw TRL segments
        for (let i = 1; i <= 9; i++) {
          const segX = margin + 4 + (i - 1) * segmentWidth;
          
          if (i <= 3) {
            pdf.setFillColor(i <= trl ? 156 : 230, i <= trl ? 39 : 230, i <= trl ? 176 : 230);
          } else if (i <= 6) {
            pdf.setFillColor(i <= trl ? 251 : 230, i <= trl ? 191 : 230, i <= trl ? 36 : 230);
          } else {
            pdf.setFillColor(i <= trl ? 74 : 230, i <= trl ? 222 : 230, i <= trl ? 128 : 230);
          }
          
          pdf.roundedRect(segX, yPosition, segmentWidth - 1, 6, 1, 1, "F");
          
          // TRL number
          pdf.setFontSize(6);
          pdf.setTextColor(i <= trl ? 255 : 150, i <= trl ? 255 : 150, i <= trl ? 255 : 150);
          pdf.text(String(i), segX + segmentWidth / 2 - 1.5, yPosition + 4.5);
        }
        
        yPosition += 10;
        
        // TRL info
        pdf.setFontSize(9);
        pdf.setTextColor(50, 70, 100);
        pdf.text(`현재 TRL ${trl}단계 - ${getTrlStageLabel(trl)}`, margin + 4, yPosition);
        yPosition += 5;
        
        if (commercializationDetails.trlReason) {
          pdf.setFontSize(8);
          pdf.setTextColor(80, 90, 100);
          const reasonLines = pdf.splitTextToSize(commercializationDetails.trlReason, contentWidth - 12);
          for (let i = 0; i < Math.min(reasonLines.length, 2); i++) {
            pdf.text(reasonLines[i], margin + 4, yPosition);
            yPosition += 4;
          }
        }
        
        yPosition += 8;
      }

      // ===== FOOTER =====
      const addFooter = (pageNum: number, totalPages: number) => {
        const footerY = pageHeight - 10;
        
        pdf.setDrawColor(200, 210, 200);
        pdf.setLineWidth(0.3);
        pdf.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

        pdf.setFontSize(7);
        pdf.setTextColor(140, 150, 140);
        pdf.text("© 농식품 특허 1페이지 요약 서비스 | AI 기반 특허 분석", margin, footerY);

        const dateText = `생성일: ${new Date().toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`;
        const dateWidth = pdf.getTextWidth(dateText);
        pdf.text(dateText, pageWidth - margin - dateWidth, footerY);
      };

      // Add footer to all pages
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        addFooter(i, totalPages);
      }

      pdf.save(`특허요약_${patentNumber}.pdf`);
      toast.success("PDF가 다운로드되었습니다!");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("PDF 생성 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePdfDownload}
      className="gap-2"
      disabled={!content}
    >
      <FileDown className="w-4 h-4" />
      PDF 다운로드
    </Button>
  );
}
