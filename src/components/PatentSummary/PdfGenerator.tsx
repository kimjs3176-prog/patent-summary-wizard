import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { PatentData } from "./types";
import { loadKoreanFont, addKoreanFontToDoc } from "@/lib/koreanFont";
import { CommercializationDetails } from "./TechnologyCommercializationScore";
import { DEFAULT_PDF_CONFIG, type PdfLayoutConfig } from "@/components/admin/PdfLayoutSettings";

interface PdfGeneratorProps {
  content: string;
  patentNumber: string;
  patentData?: PatentData | null;
  printRef: React.RefObject<HTMLDivElement | null>;
  commercializationDetails?: CommercializationDetails | null;
  commercializationScore?: number | null;
  layoutConfig?: PdfLayoutConfig;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
};

const THEME = {
  bg: [255, 255, 255] as [number, number, number],
  primary: [0, 120, 90] as [number, number, number],
  text: [30, 35, 40] as [number, number, number],
  textMuted: [110, 120, 130] as [number, number, number],
  textBody: [40, 45, 50] as [number, number, number],
  border: [210, 220, 230] as [number, number, number],
  headerGreen: [0, 140, 130] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  sectionBg: [245, 248, 252] as [number, number, number],
  metaBg: [240, 245, 250] as [number, number, number],
};

export function PdfGenerator({
  content,
  patentNumber,
  patentData,
  layoutConfig,
}: PdfGeneratorProps) {
  const cfg = { ...DEFAULT_PDF_CONFIG, ...layoutConfig };
  const handlePdfDownload = async () => {
    if (!content) {
      toast.error("PDF 생성에 실패했습니다.");
      return;
    }

    toast.info("PDF 생성 중... (폰트 로딩 중)");

    try {
      const koreanFontBase64 = await loadKoreanFont();

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      addKoreanFontToDoc(pdf, koreanFontBase64);

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = cfg.page_margin;
      const contentWidth = pageWidth - margin * 2;
      let yPosition = margin;
      const headerColor = hexToRgb(cfg.header_bg_color);
      const accentColor = hexToRgb(cfg.section_accent_color);

      const checkNewPage = (neededHeight: number) => {
        if (yPosition + neededHeight > pageHeight - margin - 10) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      const estimateBodyHeight = (linesArr: string[], startIdx: number, fontSize: number, maxW: number, lineHeight: number): number => {
        let h = 0;
        const lhMm = fontSize * 0.352778 * lineHeight;
        for (let i = startIdx; i < linesArr.length; i++) {
          const l = linesArr[i];
          if (l.startsWith("## ")) break;
          const clean = l.replace(/\*\*/g, "").replace(/^\s*[-•]\s+/, "").replace(/^\s*\d+\.\s+/, "");
          if (!clean.trim()) continue;
          pdf.setFontSize(fontSize);
          const wrapped = pdf.splitTextToSize(clean, maxW);
          h += wrapped.length * lhMm + 0.5;
          if (h > 25) break;
        }
        return Math.min(h, 30);
      };

      const addWrappedText = (text: string, fontSize: number, color: [number, number, number], lineHeight = 1.7, indentX = margin + 2) => {
        const maxW = pageWidth - indentX - margin - 2;
        const lhMm = fontSize * 0.352778 * lineHeight;

        const segments = text.split(/(\*\*[^*]+\*\*)/g);
        const plainText = text.replace(/\*\*/g, '');

        pdf.setFontSize(fontSize);
        const wrappedLines = pdf.splitTextToSize(plainText, maxW);

        let charIdx = 0;
        for (const wLine of wrappedLines) {
          checkNewPage(lhMm + 1);

          let xPos = indentX;
          let remaining = wLine;

          const lineSegments: { text: string; bold: boolean }[] = [];
          let segCharCount = 0;

          for (const seg of segments) {
            if (!remaining) break;
            const isBold = seg.startsWith('**') && seg.endsWith('**');
            const cleanSeg = isBold ? seg.slice(2, -2) : seg;

            if (segCharCount + cleanSeg.length <= charIdx) {
              segCharCount += cleanSeg.length;
              continue;
            }

            const startInSeg = Math.max(0, charIdx - segCharCount);
            const availableFromSeg = cleanSeg.substring(startInSeg);

            if (availableFromSeg.length <= remaining.length && remaining.startsWith(availableFromSeg)) {
              if (availableFromSeg) lineSegments.push({ text: availableFromSeg, bold: isBold });
              remaining = remaining.substring(availableFromSeg.length);
              segCharCount += cleanSeg.length;
              charIdx = segCharCount;
            } else if (remaining.length < availableFromSeg.length && availableFromSeg.startsWith(remaining)) {
              if (remaining) lineSegments.push({ text: remaining, bold: isBold });
              charIdx += remaining.length;
              remaining = '';
            } else {
              if (remaining) lineSegments.push({ text: remaining, bold: false });
              charIdx += remaining.length;
              remaining = '';
            }
          }

          for (const ls of lineSegments) {
            pdf.setFontSize(fontSize);
            pdf.setTextColor(...(ls.bold ? THEME.text : color));
            pdf.text(ls.text, xPos, yPosition);
            xPos += pdf.getTextWidth(ls.text);
          }

          if (lineSegments.length === 0) {
            pdf.setFontSize(fontSize);
            pdf.setTextColor(...color);
            pdf.text(wLine, indentX, yPosition);
          }

          yPosition += lhMm;
        }
      };

      const loadImageForPdf = async (imageUrl: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> => {
        try {
          const proxied = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(imageUrl)}`;
          const res = await fetch(proxied);
          if (!res.ok) return null;
          const ct = (res.headers.get("content-type") || "").toLowerCase();
          const blob = await res.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("FileReader failed"));
            reader.readAsDataURL(blob);
          });
          return { dataUrl, format: ct.includes("png") ? "PNG" : "JPEG" };
        } catch (e) {
          console.warn("loadImageForPdf failed:", e);
          return null;
        }
      };

      // ===== HEADER BAR =====
      const headerH = 20;
      pdf.setFillColor(...headerColor);
      pdf.roundedRect(margin, yPosition, contentWidth, headerH, 3, 3, "F");
      // Subtle darker bottom strip
      pdf.setFillColor(headerColor[0] * 0.85, headerColor[1] * 0.85, headerColor[2] * 0.85);
      pdf.rect(margin, yPosition + headerH - 3, contentWidth, 3, "F");
      // Bottom corners fix
      pdf.setFillColor(...headerColor);
      pdf.roundedRect(margin, yPosition, contentWidth, headerH, 3, 3, "F");

      pdf.setFontSize(13);
      pdf.setTextColor(255, 255, 255);
      pdf.text(cfg.header_title, margin + 7, yPosition + 8.5);

      pdf.setFontSize(7);
      pdf.setTextColor(220, 240, 230);
      pdf.text(cfg.header_subtitle, margin + 7, yPosition + 13.5);

      const isApp = patentData?.searchType === "application";
      const displayNumber = isApp
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApp ? "출원번호" : "등록번호";

      pdf.setFontSize(6.5);
      pdf.setTextColor(200, 230, 215);
      pdf.text(numberLabel, pageWidth - margin - pdf.getTextWidth(numberLabel) - 7, yPosition + 8);
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text(displayNumber, pageWidth - margin - pdf.getTextWidth(displayNumber) - 7, yPosition + 13.5);

      yPosition += headerH + 6;

      // ===== PATENT TITLE & META (card style) =====
      if (patentData && cfg.show_patent_meta) {
        const title = patentData.titleKo || patentData.title || "";
        
        // Light background card for patent info
        const metaCardH = title ? 28 : 18;
        pdf.setFillColor(...THEME.metaBg);
        pdf.setDrawColor(...THEME.border);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, yPosition, contentWidth, metaCardH, 2, 2, "FD");
        
        // Accent left bar
        pdf.setFillColor(...accentColor);
        pdf.rect(margin, yPosition, 2.5, metaCardH, "F");
        
        if (title) {
          pdf.setFontSize(11.5);
          pdf.setTextColor(...THEME.text);
          const titleLines = pdf.splitTextToSize(title, contentWidth - 10);
          for (let i = 0; i < Math.min(titleLines.length, 2); i++) {
            pdf.text(titleLines[i] + (i === 0 && titleLines.length > 2 ? "..." : ""), margin + 6, yPosition + 6 + i * 5.5);
          }
          yPosition += Math.min(titleLines.length, 2) * 5.5 + 3;
        }

        // Compact inline metadata
        const metaParts: string[] = [];
        if (patentData.assignee) metaParts.push(`출원인: ${patentData.assignee}`);
        if (patentData.inventors?.length) metaParts.push(`발명자: ${patentData.inventors.join(", ")}`);
        if (patentData.filingDate) metaParts.push(`출원일: ${patentData.filingDate}`);
        if (patentData.publicationDate) metaParts.push(`${patentData.registrationNumber ? '등록일' : '공개일'}: ${patentData.publicationDate}`);

        if (metaParts.length > 0) {
          pdf.setFontSize(7.5);
          pdf.setTextColor(...THEME.textMuted);
          const metaText = metaParts.join("  |  ");
          const metaLines = pdf.splitTextToSize(metaText, contentWidth - 10);
          for (const ml of metaLines) {
            pdf.text(ml, margin + 6, yPosition + 4);
            yPosition += 3.5;
          }
        }

        yPosition += 8;
      }

      // ===== AI SUMMARY CONTENT =====
      const lines = content.split("\n");
      let skipSection = false;
      let imageInserted = false;

      const insertImages = async () => {
        if (imageInserted) return;
        const imagesToUse = patentData?.images?.slice(0, 3) || (patentData?.representativeImage ? [patentData.representativeImage] : []);
        if (imagesToUse.length === 0) return;

        if (imagesToUse.length > 1) {
          const imgH = 42;
          const gap = 3;
          const totalW = contentWidth - 4;
          const imgW = (totalW - gap * (imagesToUse.length - 1)) / imagesToUse.length;
          checkNewPage(imgH + 10);

          for (let i = 0; i < imagesToUse.length; i++) {
            const img = await loadImageForPdf(imagesToUse[i]);
            if (!img) continue;
            const imgX = margin + 2 + i * (imgW + gap);
            pdf.setDrawColor(...THEME.border);
            pdf.setLineWidth(0.2);
            pdf.roundedRect(imgX - 0.5, yPosition - 0.5, imgW + 1, imgH + 1, 1.5, 1.5, "D");
            pdf.addImage(img.dataUrl, img.format, imgX, yPosition, imgW, imgH);
          }
          yPosition += imgH + 2;
          pdf.setFontSize(6);
          pdf.setTextColor(...THEME.textMuted);
          const cap = "【특허 도면】";
          pdf.text(cap, (pageWidth - pdf.getTextWidth(cap)) / 2, yPosition);
          yPosition += 5;
        } else {
          const img = await loadImageForPdf(imagesToUse[0]);
          if (img) {
            const imgW = 65;
            const imgH = 50;
            checkNewPage(imgH + 10);
            const imgX = (pageWidth - imgW) / 2;
            pdf.setDrawColor(...THEME.border);
            pdf.setLineWidth(0.2);
            pdf.roundedRect(imgX - 1, yPosition - 0.5, imgW + 2, imgH + 1, 1.5, 1.5, "D");
            pdf.addImage(img.dataUrl, img.format, imgX, yPosition, imgW, imgH);
            yPosition += imgH + 2;
            pdf.setFontSize(6);
            pdf.setTextColor(...THEME.textMuted);
            const cap = "【대표 도면】";
            pdf.text(cap, (pageWidth - pdf.getTextWidth(cap)) / 2, yPosition);
            yPosition += 5;
          }
        }
        imageInserted = true;
      };

      const isDuplicatePatentInfo = (text: string): boolean => {
        return (
          /등록번호[는:\s]/.test(text) || /출원번호[는:\s]/.test(text) ||
          text.includes("발명의 명칭은") || text.includes("출원인/권리자는") ||
          text.includes("출원일/등록일은") || text.includes("발명자는") ||
          (displayNumber && text.includes(displayNumber))
        );
      };

      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        if (line.startsWith("## 특허 기본 정보")) { skipSection = true; continue; }
        if (skipSection && line.startsWith("## ")) skipSection = false;
        if (skipSection) continue;

        if (isDuplicatePatentInfo(line)) continue;

        const cleanLine = line.replace(/^\s*[-•]\s+/, "").replace(/^\s*\d+\.\s+/, "");

        if (line.startsWith("## ")) {
          const sectionTitle = line.replace("## ", "").replace(/\*\*/g, "");
          if (sectionTitle === "특허 기본 정보") { skipSection = true; continue; }
          if (sectionTitle.includes("AI 종합") || sectionTitle.includes("종합 요약") || sectionTitle.includes("종합요약")) continue;
          // Skip TRL-related sections in PDF based on config
          if (!cfg.show_trl && (sectionTitle.includes("기술성숙도") || sectionTitle.includes("TRL"))) continue;

          const bodyPreview = estimateBodyHeight(lines, li + 1, cfg.body_font_size, pageWidth - margin * 2 - 6, cfg.line_height);
          const neededForSection = 14 + bodyPreview;
          checkNewPage(neededForSection);
          yPosition += 5;

          // Section header with background band
          const sectionHeaderH = 9;
          const bandY = yPosition - 4.5;
          pdf.setFillColor(THEME.sectionBg[0], THEME.sectionBg[1], THEME.sectionBg[2]);
          pdf.roundedRect(margin, bandY, contentWidth, sectionHeaderH, 1.5, 1.5, "F");
          
          // Section accent bar (left)
          pdf.setFillColor(...accentColor);
          pdf.roundedRect(margin, bandY, 2.5, sectionHeaderH, 0.8, 0.8, "F");

          pdf.setFontSize(cfg.section_title_size);
          pdf.setTextColor(...accentColor);
          pdf.text(sectionTitle, margin + 6, yPosition + 0.5);

          yPosition += sectionHeaderH + 3;

          if (sectionTitle === "발명의 요약" && cfg.show_patent_images) await insertImages();
        } else if (cleanLine.trim()) {
          addWrappedText(cleanLine, cfg.body_font_size, THEME.textBody, cfg.line_height);
          yPosition += 1.5;
        }
      }

      // Disclaimer with background
      if (cfg.show_disclaimer) {
        checkNewPage(12);
        yPosition += 6;
        const discH = 8;
        pdf.setFillColor(255, 248, 230);
        pdf.setDrawColor(240, 220, 180);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, yPosition - 4, contentWidth, discH, 1.5, 1.5, "FD");
        pdf.setFontSize(6.5);
        pdf.setTextColor(140, 110, 50);
        const disc = `⚠ ${cfg.disclaimer_text}`;
        pdf.text(disc, (pageWidth - pdf.getTextWidth(disc)) / 2, yPosition + 0.5);
        yPosition += discH + 2;
      }

      // Footer on all pages
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        const fy = pageHeight - 6;
        // Footer background strip
        pdf.setFillColor(THEME.sectionBg[0], THEME.sectionBg[1], THEME.sectionBg[2]);
        pdf.rect(0, fy - 5, pageWidth, 12, "F");
        pdf.setDrawColor(...THEME.border);
        pdf.setLineWidth(0.2);
        pdf.line(margin, fy - 3, pageWidth - margin, fy - 3);
        pdf.setFontSize(6);
        pdf.setTextColor(...THEME.textMuted);
        pdf.text(cfg.footer_text, margin, fy);
        if (cfg.footer_show_date) {
          const dateText = `생성일: ${new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}`;
          pdf.text(dateText, pageWidth - margin - pdf.getTextWidth(dateText), fy);
        }
        if (cfg.footer_show_page) {
          const pg = `${i} / ${totalPages}`;
          pdf.text(pg, (pageWidth - pdf.getTextWidth(pg)) / 2, fy);
        }
      }

      pdf.save(`특허요약_${patentNumber}.pdf`);
      toast.success("PDF가 다운로드되었습니다!");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("PDF 생성 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePdfDownload} className="gap-2" disabled={!content}>
      <FileDown className="w-4 h-4" />
      PDF 다운로드
    </Button>
  );
}
