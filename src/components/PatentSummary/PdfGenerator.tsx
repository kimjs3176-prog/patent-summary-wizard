import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { PatentData } from "./types";
import { loadKoreanFont, addKoreanFontToDoc } from "@/lib/koreanFont";

interface PdfGeneratorProps {
  content: string;
  patentNumber: string;
  patentData?: PatentData | null;
  printRef: React.RefObject<HTMLDivElement | null>;
}

export function PdfGenerator({ content, patentNumber, patentData }: PdfGeneratorProps) {
  const handlePdfDownload = async () => {
    if (!content) {
      toast.error("PDF 생성에 실패했습니다.");
      return;
    }

    toast.info("PDF 생성 중... (폰트 로딩 중)");

    try {
      // Load Korean font first
      const koreanFontBase64 = await loadKoreanFont();

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Add Korean font support
      addKoreanFontToDoc(pdf, koreanFontBase64);

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let yPosition = margin;

      const checkNewPage = (neededHeight: number) => {
        if (yPosition + neededHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      const addWrappedText = (text: string, fontSize: number, color: number[], lineHeight: number = 1.6) => {
        pdf.setFontSize(fontSize);
        pdf.setTextColor(color[0], color[1], color[2]);

        const lines = pdf.splitTextToSize(text, contentWidth);
        const lineHeightMm = fontSize * 0.352778 * lineHeight;

        for (const line of lines) {
          checkNewPage(lineHeightMm);
          pdf.text(line, margin, yPosition);
          yPosition += lineHeightMm;
        }
      };

      const getProxiedImageUrl = (imageUrl: string) => {
        const base = import.meta.env.VITE_SUPABASE_URL;
        return `${base}/functions/v1/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      };

      // Load image as base64 via backend proxy (avoids CORS-tainted canvas issues)
      const loadImageForPdf = async (imageUrl: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> => {
        try {
          const proxied = getProxiedImageUrl(imageUrl);
          console.log("Loading representative image via proxy:", proxied);

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

      const insertRepresentativeImage = async () => {
        if (!patentData?.representativeImage) return false;

        const img = await loadImageForPdf(patentData.representativeImage);
        if (!img) return false;

        const imgWidth = 70;
        const imgHeight = 55;

        checkNewPage(imgHeight + 12);

        const imgX = (pageWidth - imgWidth) / 2;
        pdf.addImage(img.dataUrl, img.format, imgX, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 3;

        pdf.setFontSize(9);
        pdf.setTextColor(80, 80, 80);
        const captionText = "【대표 도면】";
        const captionWidth = pdf.getTextWidth(captionText);
        pdf.text(captionText, (pageWidth - captionWidth) / 2, yPosition);
        yPosition += 10;

        return true;
      };

      // Title
      pdf.setFontSize(20);
      pdf.setTextColor(30, 58, 95);
      pdf.text("농식품 특허 요약서", margin, yPosition);
      yPosition += 6;

      pdf.setFontSize(9);
      pdf.setTextColor(107, 114, 128);
      pdf.text("Agri-Food Patent Summary Report", margin, yPosition);
      yPosition += 4;

      // Display number on the right
      const isApplicationSearch = patentData?.searchType === "application";
      const displayNumber = isApplicationSearch
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApplicationSearch ? "출원번호" : "등록번호";

      pdf.setFontSize(10);
      pdf.setTextColor(107, 114, 128);
      const labelWidth = pdf.getTextWidth(numberLabel);
      pdf.text(numberLabel, pageWidth - margin - labelWidth, margin + 2);

      pdf.setFontSize(13);
      pdf.setTextColor(30, 58, 95);
      const numWidth = pdf.getTextWidth(displayNumber);
      pdf.text(displayNumber, pageWidth - margin - numWidth, margin + 8);

      // Divider
      yPosition += 2;
      pdf.setDrawColor(30, 58, 95);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // Patent info box
      if (patentData) {
        const inventionTitle = patentData.titleKo || patentData.title || "정보 없음";

        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(margin, yPosition, contentWidth, 20, 2, 2, "FD");
        yPosition += 5;

        const infoX = margin + 4;
        pdf.setFontSize(9);

        pdf.setTextColor(107, 114, 128);
        pdf.text("발명의 명칭: ", infoX, yPosition);
        let xPos = infoX + pdf.getTextWidth("발명의 명칭: ");
        pdf.setTextColor(30, 58, 95);

        const maxTitleWidth = contentWidth - (xPos - margin) - 8;
        const titleLines = pdf.splitTextToSize(inventionTitle, maxTitleWidth);
        pdf.text(titleLines[0] + (titleLines.length > 1 ? "..." : ""), xPos, yPosition);
        yPosition += 5;

        if (patentData.assignee || patentData.inventors?.length) {
          xPos = infoX;
          if (patentData.assignee) {
            pdf.setTextColor(80, 85, 95);
            pdf.text("출원인: ", xPos, yPosition);
            xPos += pdf.getTextWidth("출원인: ");
            pdf.setTextColor(30, 35, 45);
            pdf.text(patentData.assignee, xPos, yPosition);
            xPos += pdf.getTextWidth(patentData.assignee);
          }
          if (patentData.inventors && patentData.inventors.length > 0) {
            pdf.setTextColor(80, 85, 95);
            pdf.text("   발명자: ", xPos, yPosition);
            xPos += pdf.getTextWidth("   발명자: ");
            pdf.setTextColor(30, 35, 45);
            pdf.text(patentData.inventors.join(", "), xPos, yPosition);
          }
          yPosition += 5;
        }

        if (patentData.filingDate || patentData.publicationDate) {
          xPos = infoX;
          if (patentData.filingDate) {
            pdf.setTextColor(80, 85, 95);
            pdf.text("출원일: ", xPos, yPosition);
            xPos += pdf.getTextWidth("출원일: ");
            pdf.setTextColor(30, 35, 45);
            pdf.text(patentData.filingDate, xPos, yPosition);
            xPos += pdf.getTextWidth(patentData.filingDate);
          }
          if (patentData.publicationDate) {
            pdf.setTextColor(80, 85, 95);
            pdf.text("   공개일: ", xPos, yPosition);
            xPos += pdf.getTextWidth("   공개일: ");
            pdf.setTextColor(30, 35, 45);
            pdf.text(patentData.publicationDate, xPos, yPosition);
          }
        }
        yPosition += 12;
      }

      // If summary doesn't contain '발명의 요약' header, insert image here as fallback
      const hasSummaryHeader = content.includes("## 발명의 요약");
      let imageInserted = false;
      if (!hasSummaryHeader) {
        imageInserted = await insertRepresentativeImage();
      }

      // Process content - skip basic info section
      const lines = content.split("\n");
      let skipSection = false;

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

          checkNewPage(10);
          yPosition += 4;
          pdf.setFontSize(12);
          pdf.setTextColor(30, 58, 95);
          pdf.text(sectionTitle, margin, yPosition);
          yPosition += 2;

          pdf.setDrawColor(226, 232, 240);
          pdf.setLineWidth(0.3);
          pdf.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 5;

          // Preferred placement: right after '발명의 요약' header
          if (sectionTitle === "발명의 요약" && !imageInserted) {
            imageInserted = await insertRepresentativeImage();
          }
        } else if (cleanLine.trim()) {
          addWrappedText(cleanLine, 10.5, [25, 30, 35], 1.65);
          yPosition += 2;
        }
      }

      // Footer
      yPosition = pageHeight - margin;
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.2);
      pdf.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);

      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text("© 농식품 특허 1페이지 요약 서비스 | AI 기반 특허 분석", margin, yPosition);

      const dateText = `생성일: ${new Date().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`;
      const dateWidth = pdf.getTextWidth(dateText);
      pdf.text(dateText, pageWidth - margin - dateWidth, yPosition);

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
