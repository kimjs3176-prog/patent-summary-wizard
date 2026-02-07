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

    toast.info("PDF 생성 중...");

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
      const marginLeft = 18;
      const marginRight = 18;
      const marginTop = 20;
      const marginBottom = 20;
      const contentWidth = pageWidth - marginLeft - marginRight;
      let yPosition = marginTop;
      let currentPage = 1;

      // ─────────────────────────────────────────────────────────────────
      // Helper functions
      // ─────────────────────────────────────────────────────────────────
      const addFooter = () => {
        pdf.setFontSize(8);
        pdf.setTextColor(140, 140, 140);
        const footerY = pageHeight - 10;
        pdf.text("© 농식품 특허 1페이지 요약 서비스", marginLeft, footerY);
        const pageNum = `${currentPage}`;
        const pageNumWidth = pdf.getTextWidth(pageNum);
        pdf.text(pageNum, pageWidth - marginRight - pageNumWidth, footerY);
      };

      const checkNewPage = (neededHeight: number) => {
        if (yPosition + neededHeight > pageHeight - marginBottom) {
          addFooter();
          pdf.addPage();
          currentPage++;
          yPosition = marginTop;
          return true;
        }
        return false;
      };

      const addWrappedText = (
        text: string,
        fontSize: number,
        color: number[],
        lineHeight: number = 1.55,
        indent: number = 0
      ) => {
        pdf.setFontSize(fontSize);
        pdf.setTextColor(color[0], color[1], color[2]);

        const effectiveWidth = contentWidth - indent;
        const lines = pdf.splitTextToSize(text, effectiveWidth);
        const lineHeightMm = fontSize * 0.352778 * lineHeight;

        for (const line of lines) {
          checkNewPage(lineHeightMm);
          pdf.text(line, marginLeft + indent, yPosition);
          yPosition += lineHeightMm;
        }
      };

      const getProxiedImageUrl = (imageUrl: string) => {
        const base = import.meta.env.VITE_SUPABASE_URL;
        return `${base}/functions/v1/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      };

      // Load image and upscale for PDF (higher resolution)
      const loadImageForPdf = async (
        imageUrl: string
      ): Promise<{ dataUrl: string; format: "PNG" | "JPEG"; width: number; height: number } | null> => {
        try {
          const proxied = getProxiedImageUrl(imageUrl);
          const res = await fetch(proxied);
          if (!res.ok) return null;

          const contentType = (res.headers.get("content-type") || "").toLowerCase();
          const blob = await res.blob();

          // Create image to get natural dimensions
          const imageBitmap = await createImageBitmap(blob);
          const naturalWidth = imageBitmap.width;
          const naturalHeight = imageBitmap.height;

          // Upscale to 2x for sharper PDF rendering (max 2000px)
          const scale = Math.min(2, 2000 / Math.max(naturalWidth, naturalHeight));
          const targetWidth = Math.round(naturalWidth * scale);
          const targetHeight = Math.round(naturalHeight * scale);

          const canvas = document.createElement("canvas");
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext("2d");
          if (!ctx) return null;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);

          // Use PNG for lossless quality
          const dataUrl = canvas.toDataURL("image/png", 1.0);
          const format: "PNG" | "JPEG" = contentType.includes("jpeg") || contentType.includes("jpg") ? "JPEG" : "PNG";

          return { dataUrl, format: "PNG", width: naturalWidth, height: naturalHeight };
        } catch (e) {
          console.warn("loadImageForPdf failed:", e);
          return null;
        }
      };

      const insertRepresentativeImage = async (): Promise<boolean> => {
        if (!patentData?.representativeImage) return false;

        const img = await loadImageForPdf(patentData.representativeImage);
        if (!img) return false;

        // Calculate display size while maintaining aspect ratio
        const maxWidth = 85;
        const maxHeight = 65;
        const aspectRatio = img.width / img.height;

        let imgWidth = maxWidth;
        let imgHeight = imgWidth / aspectRatio;

        if (imgHeight > maxHeight) {
          imgHeight = maxHeight;
          imgWidth = imgHeight * aspectRatio;
        }

        checkNewPage(imgHeight + 14);

        // Center the image
        const imgX = (pageWidth - imgWidth) / 2;

        // Add subtle border around image
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.3);
        pdf.rect(imgX - 1, yPosition - 1, imgWidth + 2, imgHeight + 2);

        pdf.addImage(img.dataUrl, "PNG", imgX, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 4;

        // Caption
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        const captionText = "【대표 도면】";
        const captionWidth = pdf.getTextWidth(captionText);
        pdf.text(captionText, (pageWidth - captionWidth) / 2, yPosition);
        yPosition += 8;

        return true;
      };

      // ─────────────────────────────────────────────────────────────────
      // HEADER SECTION
      // ─────────────────────────────────────────────────────────────────
      // Decorative top line
      pdf.setDrawColor(30, 80, 140);
      pdf.setLineWidth(1.5);
      pdf.line(marginLeft, yPosition - 5, pageWidth - marginRight, yPosition - 5);

      // Title
      pdf.setFontSize(22);
      pdf.setTextColor(20, 50, 90);
      pdf.text("농식품 특허 요약서", marginLeft, yPosition);

      // Subtitle
      pdf.setFontSize(10);
      pdf.setTextColor(120, 120, 120);
      pdf.text("Agri-Food Patent Summary Report", marginLeft, yPosition + 6);

      // Display number on the right
      const isApplicationSearch = patentData?.searchType === "application";
      const displayNumber = isApplicationSearch
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApplicationSearch ? "출원번호" : "등록번호";

      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      const labelWidth = pdf.getTextWidth(numberLabel);
      pdf.text(numberLabel, pageWidth - marginRight - labelWidth, marginTop - 2);

      pdf.setFontSize(14);
      pdf.setTextColor(20, 50, 90);
      const numWidth = pdf.getTextWidth(displayNumber);
      pdf.text(displayNumber, pageWidth - marginRight - numWidth, marginTop + 5);

      yPosition += 10;

      // Divider
      pdf.setDrawColor(30, 80, 140);
      pdf.setLineWidth(0.8);
      pdf.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
      yPosition += 10;

      // ─────────────────────────────────────────────────────────────────
      // PATENT INFO BOX
      // ─────────────────────────────────────────────────────────────────
      if (patentData) {
        const inventionTitle = patentData.titleKo || patentData.title || "정보 없음";

        // Calculate box height dynamically
        let boxHeight = 24;
        if (patentData.assignee || patentData.inventors?.length) boxHeight += 5;
        if (patentData.filingDate || patentData.publicationDate) boxHeight += 5;

        pdf.setFillColor(245, 248, 252);
        pdf.setDrawColor(200, 210, 225);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(marginLeft, yPosition, contentWidth, boxHeight, 3, 3, "FD");

        const infoX = marginLeft + 6;
        let infoY = yPosition + 7;

        // Title row
        pdf.setFontSize(9);
        pdf.setTextColor(80, 90, 100);
        pdf.text("발명의 명칭", infoX, infoY);

        pdf.setFontSize(11);
        pdf.setTextColor(20, 40, 70);
        const maxTitleWidth = contentWidth - 30;
        const titleLines = pdf.splitTextToSize(inventionTitle, maxTitleWidth);
        pdf.text(titleLines[0] + (titleLines.length > 1 ? "..." : ""), infoX + 26, infoY);
        infoY += 7;

        // Assignee & Inventors row
        if (patentData.assignee || patentData.inventors?.length) {
          pdf.setFontSize(9);
          let xPos = infoX;

          if (patentData.assignee) {
            pdf.setTextColor(80, 90, 100);
            pdf.text("출원인", xPos, infoY);
            xPos += 14;
            pdf.setTextColor(30, 40, 50);
            pdf.text(patentData.assignee, xPos, infoY);
            xPos += pdf.getTextWidth(patentData.assignee) + 8;
          }

          if (patentData.inventors && patentData.inventors.length > 0) {
            pdf.setTextColor(80, 90, 100);
            pdf.text("발명자", xPos, infoY);
            xPos += 14;
            pdf.setTextColor(30, 40, 50);
            const inventorsText = patentData.inventors.slice(0, 3).join(", ") + 
              (patentData.inventors.length > 3 ? " 외" : "");
            pdf.text(inventorsText, xPos, infoY);
          }
          infoY += 6;
        }

        // Dates row
        if (patentData.filingDate || patentData.publicationDate) {
          pdf.setFontSize(9);
          let xPos = infoX;

          if (patentData.filingDate) {
            pdf.setTextColor(80, 90, 100);
            pdf.text("출원일", xPos, infoY);
            xPos += 14;
            pdf.setTextColor(30, 40, 50);
            pdf.text(patentData.filingDate, xPos, infoY);
            xPos += pdf.getTextWidth(patentData.filingDate) + 8;
          }

          if (patentData.publicationDate) {
            pdf.setTextColor(80, 90, 100);
            pdf.text("공개일", xPos, infoY);
            xPos += 14;
            pdf.setTextColor(30, 40, 50);
            pdf.text(patentData.publicationDate, xPos, infoY);
          }
        }

        yPosition += boxHeight + 8;
      }

      // ─────────────────────────────────────────────────────────────────
      // REPRESENTATIVE IMAGE (fallback position if no summary header)
      // ─────────────────────────────────────────────────────────────────
      const hasSummaryHeader = content.includes("## 발명의 요약");
      let imageInserted = false;
      if (!hasSummaryHeader) {
        imageInserted = await insertRepresentativeImage();
      }

      // ─────────────────────────────────────────────────────────────────
      // CONTENT SECTIONS
      // ─────────────────────────────────────────────────────────────────
      const lines = content.split("\n");
      let skipSection = false;
      let sectionCount = 0;

      for (const line of lines) {
        // Skip basic info section
        if (line.startsWith("## 특허 기본 정보")) {
          skipSection = true;
          continue;
        }

        if (skipSection && line.startsWith("## ")) {
          skipSection = false;
        }

        if (skipSection) continue;

        // Skip descriptive basic info lines
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
          .replace(/^\s*[-•]\s+/, "• ")
          .replace(/^\s*\d+\.\s+/, "");

        if (line.startsWith("## ")) {
          const sectionTitle = line.replace("## ", "").replace(/\*\*/g, "");

          if (sectionTitle === "특허 기본 정보") {
            skipSection = true;
            continue;
          }

          sectionCount++;

          // Add spacing before section (except first)
          if (sectionCount > 1) {
            yPosition += 4;
          }

          checkNewPage(16);

          // Section header with colored accent
          pdf.setFillColor(30, 80, 140);
          pdf.rect(marginLeft, yPosition - 3, 3, 8, "F");

          pdf.setFontSize(13);
          pdf.setTextColor(20, 50, 90);
          pdf.text(sectionTitle, marginLeft + 6, yPosition + 2);
          yPosition += 8;

          // Insert image after 발명의 요약 header
          if (sectionTitle === "발명의 요약" && !imageInserted) {
            imageInserted = await insertRepresentativeImage();
          }
        } else if (cleanLine.trim()) {
          // Body text with bullet handling
          const isBullet = cleanLine.startsWith("• ");
          const indent = isBullet ? 4 : 0;
          addWrappedText(cleanLine, 10, [35, 40, 50], 1.6, indent);
          yPosition += 1.5;
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // FOOTER (last page)
      // ─────────────────────────────────────────────────────────────────
      addFooter();

      // Add generation date above footer
      pdf.setFontSize(8);
      pdf.setTextColor(140, 140, 140);
      const dateText = `생성일: ${new Date().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`;
      const dateWidth = pdf.getTextWidth(dateText);
      pdf.text(dateText, (pageWidth - dateWidth) / 2, pageHeight - 15);

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
