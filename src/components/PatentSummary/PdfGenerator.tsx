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
  text: [15, 20, 18] as [number, number, number],
  textMuted: [80, 100, 90] as [number, number, number],
  textBody: [25, 32, 28] as [number, number, number],
  border: [195, 215, 205] as [number, number, number],
  headerGreen: [0, 140, 130] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  scoreGreen: [16, 185, 129] as [number, number, number],
  scoreBlue: [59, 130, 246] as [number, number, number],
  scoreAmber: [245, 158, 11] as [number, number, number],
  scoreRed: [239, 68, 68] as [number, number, number],
  cardBg: [248, 250, 252] as [number, number, number],
  disclaimerBg: [254, 249, 231] as [number, number, number],
  disclaimerBorder: [253, 230, 138] as [number, number, number],
  disclaimerText: [139, 105, 20] as [number, number, number],
};

function getScoreColor(value: number): [number, number, number] {
  if (value >= 80) return THEME.scoreGreen;
  if (value >= 60) return THEME.scoreBlue;
  if (value >= 40) return THEME.scoreAmber;
  return THEME.scoreRed;
}

function getGradeLabel(value: number): string {
  if (value >= 90) return "S";
  if (value >= 80) return "A";
  if (value >= 70) return "B";
  if (value >= 60) return "C";
  if (value >= 50) return "D";
  return "F";
}

export function PdfGenerator({
  content,
  patentNumber,
  patentData,
  commercializationDetails,
  commercializationScore,
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

      // Helper: draw rounded rect
      const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number, fillColor?: [number, number, number], strokeColor?: [number, number, number]) => {
        if (fillColor) pdf.setFillColor(...fillColor);
        if (strokeColor) {
          pdf.setDrawColor(...strokeColor);
          pdf.setLineWidth(0.3);
        }
        pdf.roundedRect(x, y, w, h, r, r, fillColor && strokeColor ? "FD" : fillColor ? "F" : "D");
      };

      // ===== HEADER BAR (web-like gradient) =====
      pdf.setFillColor(...headerColor);
      pdf.roundedRect(margin, yPosition, contentWidth, 18, 3, 3, "F");

      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      pdf.text(cfg.header_title, margin + 6, yPosition + 7.5);

      pdf.setFontSize(6.5);
      pdf.setTextColor(200, 225, 210);
      pdf.text(cfg.header_subtitle, margin + 6, yPosition + 12.5);

      const isApp = patentData?.searchType === "application";
      const displayNumber = isApp
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApp ? "출원번호" : "등록번호";

      pdf.setFontSize(6);
      pdf.setTextColor(200, 225, 210);
      pdf.text(numberLabel, pageWidth - margin - pdf.getTextWidth(numberLabel) - 6, yPosition + 7.5);
      pdf.setFontSize(8.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text(displayNumber, pageWidth - margin - pdf.getTextWidth(displayNumber) - 6, yPosition + 12.5);

      yPosition += 24;

      // ===== PATENT TITLE & META (styled like web card with blue top border) =====
      if (patentData && cfg.show_patent_meta) {
        // Card-like container with blue accent
        const cardStartY = yPosition;
        pdf.setDrawColor(30, 100, 200);
        pdf.setLineWidth(1);
        pdf.line(margin, cardStartY, margin + contentWidth, cardStartY);
        yPosition += 3;

        const title = patentData.titleKo || patentData.title || "";
        if (title) {
          pdf.setFontSize(11);
          pdf.setTextColor(...THEME.text);
          const titleLines = pdf.splitTextToSize(title, contentWidth - 4);
          for (let i = 0; i < Math.min(titleLines.length, 2); i++) {
            checkNewPage(6);
            pdf.text(titleLines[i] + (i === 0 && titleLines.length > 2 ? "..." : ""), margin + 2, yPosition);
            yPosition += 5.5;
          }
          yPosition += 1;
        }

        // Badges for registration/application number
        const regNum = patentData.registrationNumber;
        const appNum = patentData.applicationNumber;
        let badgeX = margin + 2;
        if (regNum) {
          const cleanNum = regNum.replace(/[^0-9]/g, "");
          const formatted = cleanNum.length >= 9 && cleanNum.startsWith("10")
            ? `10-${cleanNum.slice(2, 9)}`
            : patentData.displayNumber || regNum;
          const badgeText = `등록번호: ${formatted}`;
          pdf.setFontSize(7.5);
          const tw = pdf.getTextWidth(badgeText);
          drawRoundedRect(badgeX, yPosition - 3, tw + 6, 5.5, 1.5, [210, 230, 255], [180, 210, 250]);
          pdf.setTextColor(30, 80, 160);
          pdf.text(badgeText, badgeX + 3, yPosition);
          badgeX += tw + 9;
        }
        if (appNum) {
          const cleanNum = appNum.replace(/[^0-9]/g, "");
          const formatted = cleanNum.length >= 11 && cleanNum.startsWith("10")
            ? `10-${cleanNum.slice(2, 6)}-${cleanNum.slice(6)}`
            : appNum;
          const badgeText = `출원번호: ${formatted}`;
          pdf.setFontSize(7.5);
          const tw = pdf.getTextWidth(badgeText);
          drawRoundedRect(badgeX, yPosition - 3, tw + 6, 5.5, 1.5, [220, 245, 240], [180, 230, 220]);
          pdf.setTextColor(40, 110, 90);
          pdf.text(badgeText, badgeX + 3, yPosition);
        }
        yPosition += 5;

        // Compact inline metadata (styled like web)
        const metaParts: string[] = [];
        if (patentData.assignee) metaParts.push(`출원인: ${patentData.assignee}`);
        if (patentData.inventors?.length) metaParts.push(`발명자: ${patentData.inventors.join(", ")}`);
        if (patentData.filingDate) metaParts.push(`출원일: ${patentData.filingDate}`);
        if (patentData.publicationDate) metaParts.push(`${patentData.registrationNumber ? '등록일' : '공개일'}: ${patentData.publicationDate}`);

        if (metaParts.length > 0) {
          // Light background bar like web
          const metaText = metaParts.join("  |  ");
          pdf.setFontSize(7);
          const metaLines = pdf.splitTextToSize(metaText, contentWidth - 8);
          const metaH = metaLines.length * 3.5 + 3;
          drawRoundedRect(margin, yPosition - 1, contentWidth, metaH, 2, [245, 247, 250]);
          pdf.setTextColor(...THEME.textMuted);
          for (const ml of metaLines) {
            checkNewPage(4);
            pdf.text(ml, margin + 4, yPosition + 2);
            yPosition += 3.5;
          }
          yPosition += 2;
        }

        yPosition += 4;
      }

      // ===== COMMERCIALIZATION SCORE (web-like card) =====
      if (cfg.show_commercialization && commercializationScore != null && commercializationDetails) {
        checkNewPage(55);
        const scoreCardY = yPosition;
        
        // Card background
        drawRoundedRect(margin, scoreCardY, contentWidth, 50, 3, THEME.cardBg, THEME.border);
        
        // Header
        pdf.setFontSize(9);
        pdf.setTextColor(...accentColor);
        pdf.text("✨ AI 기술사업화 점수", margin + 5, scoreCardY + 6);
        
        // Main score
        const scoreColor = getScoreColor(commercializationScore);
        pdf.setFontSize(24);
        pdf.setTextColor(...scoreColor);
        pdf.text(String(commercializationScore), margin + 5, scoreCardY + 18);
        pdf.setFontSize(10);
        pdf.setTextColor(...THEME.textMuted);
        pdf.text("/ 100", margin + 5 + pdf.getTextWidth(String(commercializationScore)) + 2, scoreCardY + 18);
        
        // Grade
        pdf.setFontSize(16);
        pdf.setTextColor(...scoreColor);
        const grade = getGradeLabel(commercializationScore);
        pdf.text(grade, margin + 50, scoreCardY + 16);

        // Sub-scores (vertical layout matching web)
        const subScores = [
          { label: "기술성", score: commercializationDetails.technologyScore },
          { label: "시장성", score: commercializationDetails.marketScore },
          { label: "사업성", score: commercializationDetails.businessScore },
        ];
        
        let subY = scoreCardY + 24;
        for (const sub of subScores) {
          const subColor = getScoreColor(sub.score);
          // Label
          pdf.setFontSize(7);
          pdf.setTextColor(...THEME.textMuted);
          pdf.text(sub.label, margin + 5, subY);
          // Score
          pdf.setFontSize(9);
          pdf.setTextColor(...subColor);
          pdf.text(`${sub.score}점`, margin + 20, subY);
          // Progress bar
          const barX = margin + 35;
          const barW = contentWidth - 45;
          pdf.setFillColor(230, 230, 230);
          pdf.roundedRect(barX, subY - 2.5, barW, 3, 1.5, 1.5, "F");
          pdf.setFillColor(...subColor);
          pdf.roundedRect(barX, subY - 2.5, barW * (sub.score / 100), 3, 1.5, 1.5, "F");
          subY += 7;
        }

        yPosition = scoreCardY + 54;
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

      // AI Summary header (web-like teal-blue gradient header)
      checkNewPage(12);
      const summaryHeaderY = yPosition;
      drawRoundedRect(margin, summaryHeaderY, contentWidth, 10, 2, [240, 248, 248]);
      pdf.setDrawColor(0, 150, 140);
      pdf.setLineWidth(0.8);
      pdf.line(margin, summaryHeaderY, margin + contentWidth, summaryHeaderY);
      pdf.setFontSize(10);
      pdf.setTextColor(0, 100, 80);
      pdf.text("🤖 AI 종합 요약", margin + 5, summaryHeaderY + 6.5);
      pdf.setFontSize(6.5);
      pdf.setTextColor(...THEME.textMuted);
      const subNumText = `${numberLabel}: ${displayNumber}`;
      pdf.text(subNumText, pageWidth - margin - pdf.getTextWidth(subNumText) - 3, summaryHeaderY + 6.5);
      yPosition = summaryHeaderY + 14;

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
          if (!cfg.show_trl && (sectionTitle.includes("기술성숙도") || sectionTitle.includes("TRL"))) continue;

          const bodyPreview = estimateBodyHeight(lines, li + 1, cfg.body_font_size, pageWidth - margin * 2 - 6, cfg.line_height);
          const neededForSection = 14 + bodyPreview;
          checkNewPage(neededForSection);
          yPosition += 6;

          // Section accent bar (web-like blue accent)
          pdf.setFillColor(...accentColor);
          pdf.roundedRect(margin, yPosition - 3, 2.5, 6, 0.8, 0.8, "F");

          pdf.setFontSize(cfg.section_title_size);
          pdf.setTextColor(...accentColor);
          pdf.text(sectionTitle, margin + 5, yPosition);

          pdf.setDrawColor(...THEME.border);
          pdf.setLineWidth(0.15);
          pdf.line(margin + 5, yPosition + 1.5, margin + 5 + Math.min(pdf.getTextWidth(sectionTitle), contentWidth - 8), yPosition + 1.5);

          yPosition += 7;

          if (sectionTitle === "발명의 요약" && cfg.show_patent_images) await insertImages();
        } else if (cleanLine.trim()) {
          addWrappedText(cleanLine, cfg.body_font_size, THEME.textBody, cfg.line_height);
          yPosition += 1.5;
        }
      }

      // Disclaimer (web-like yellow/amber box)
      if (cfg.show_disclaimer) {
        checkNewPage(12);
        yPosition += 4;
        const discW = contentWidth - 8;
        const discX = margin + 4;
        pdf.setFontSize(6.5);
        const discLines = pdf.splitTextToSize("⚠️ " + cfg.disclaimer_text, discW - 8);
        const discH = discLines.length * 3.5 + 4;
        drawRoundedRect(discX, yPosition - 1, discW, discH, 2, THEME.disclaimerBg, THEME.disclaimerBorder);
        pdf.setTextColor(...THEME.disclaimerText);
        for (let i = 0; i < discLines.length; i++) {
          pdf.text(discLines[i], (pageWidth - pdf.getTextWidth(discLines[i])) / 2, yPosition + 2 + i * 3.5);
        }
        yPosition += discH + 3;
      }

      // Watermark on all pages
      const addWatermark = () => {
        if (!cfg.watermark_enabled || !cfg.watermark_text) return;
        const totalPages = pdf.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.saveGraphicsState();
          const gState = new (pdf as any).GState({ opacity: cfg.watermark_opacity });
          pdf.setGState(gState);
          pdf.setFontSize(40);
          pdf.setTextColor(150, 150, 150);
          // Diagonal watermark
          const cx = pageWidth / 2;
          const cy = pageHeight / 2;
          const textW = pdf.getTextWidth(cfg.watermark_text);
          // Rotate text
          pdf.text(cfg.watermark_text, cx - textW / 2, cy, { angle: 35 });
          pdf.restoreGraphicsState();
        }
      };

      // Footer on all pages
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        const fy = pageHeight - 7;
        pdf.setDrawColor(...THEME.border);
        pdf.setLineWidth(0.2);
        pdf.line(margin, fy - 2, pageWidth - margin, fy - 2);
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

      addWatermark();

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
