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

const lerpColor = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

const THEME = {
  bg: [255, 255, 255] as [number, number, number],
  primary: [0, 120, 90] as [number, number, number],
  text: [25, 30, 35] as [number, number, number],
  textMuted: [120, 130, 140] as [number, number, number],
  textBody: [45, 50, 55] as [number, number, number],
  border: [215, 225, 235] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  sectionBg: [247, 249, 253] as [number, number, number],
  metaBg: [240, 246, 252] as [number, number, number],
  divider: [230, 235, 242] as [number, number, number],
};

// Section icon symbols for visual flair
const SECTION_ICONS: Record<string, string> = {
  "발명의 요약": "📋",
  "기술 분야": "🔬",
  "핵심 기술": "⚡",
  "해결하려는 과제": "🎯",
  "해결 수단": "🔧",
  "기대 효과": "✨",
  "청구항": "📄",
  "기술성숙도": "📊",
  "TRL": "📊",
  "사업화": "💼",
};

const getSectionIcon = (title: string): string => {
  for (const [key, icon] of Object.entries(SECTION_ICONS)) {
    if (title.includes(key)) return icon;
  }
  return "▸";
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
      const headerColorDark = lerpColor(headerColor, [0, 0, 0], 0.25);
      const accentColor = hexToRgb(cfg.section_accent_color);

      const checkNewPage = (neededHeight: number) => {
        if (yPosition + neededHeight > pageHeight - margin - 12) {
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

      const addWrappedText = (text: string, fontSize: number, color: [number, number, number], lineHeight = 1.7, indentX = margin + 3) => {
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

      // ===== HEADER =====
      const headerH = 22;
      // Gradient simulation: draw multiple thin strips
      const stripCount = 12;
      const stripH = headerH / stripCount;
      for (let i = 0; i < stripCount; i++) {
        const t = i / (stripCount - 1);
        const c = lerpColor(headerColor, headerColorDark, t * 0.4);
        pdf.setFillColor(...c);
        if (i === 0) {
          pdf.roundedRect(margin, yPosition + i * stripH, contentWidth, stripH + 0.3, 3, 3, "F");
        } else if (i === stripCount - 1) {
          pdf.roundedRect(margin, yPosition + i * stripH - 0.1, contentWidth, stripH + 0.3, 0, 0, "F");
          // Bottom rounded corners
          pdf.roundedRect(margin, yPosition, contentWidth, headerH, 3, 3, "S");
          pdf.setDrawColor(...headerColor);
        } else {
          pdf.rect(margin, yPosition + i * stripH, contentWidth, stripH + 0.3, "F");
        }
      }
      // Overdraw the full rounded rect outline cleanly
      pdf.setFillColor(...headerColor);
      pdf.roundedRect(margin, yPosition, contentWidth, headerH, 3, 3, "F");
      // Bottom darkened band
      const bottomBandH = 5;
      pdf.setFillColor(...lerpColor(headerColor, [0, 0, 0], 0.15));
      pdf.rect(margin, yPosition + headerH - bottomBandH, contentWidth, bottomBandH, "F");
      // Re-draw rounded rect border
      pdf.setDrawColor(...lerpColor(headerColor, [0, 0, 0], 0.2));
      pdf.setLineWidth(0.3);
      pdf.roundedRect(margin, yPosition, contentWidth, headerH, 3, 3, "S");

      // Decorative top highlight line
      pdf.setFillColor(...lerpColor(headerColor, [255, 255, 255], 0.3));
      pdf.rect(margin + 1, yPosition + 0.8, contentWidth - 2, 0.6, "F");

      // Title text
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text(cfg.header_title, margin + 8, yPosition + 9);
      pdf.text(cfg.header_title, margin + 8.15, yPosition + 9); // faux bold

      pdf.setFontSize(7.5);
      pdf.setTextColor(220, 245, 235);
      pdf.text(cfg.header_subtitle, margin + 8, yPosition + 14.5);

      // Patent number (right side)
      const isApp = patentData?.searchType === "application";
      const displayNumber = isApp
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApp ? "출원번호" : "등록번호";

      pdf.setFontSize(6.5);
      pdf.setTextColor(200, 235, 220);
      const nlW = pdf.getTextWidth(numberLabel);
      pdf.text(numberLabel, pageWidth - margin - nlW - 8, yPosition + 8.5);
      pdf.setFontSize(9.5);
      pdf.setTextColor(255, 255, 255);
      const dnW = pdf.getTextWidth(displayNumber);
      pdf.text(displayNumber, pageWidth - margin - dnW - 8, yPosition + 14);

      yPosition += headerH + 7;

      // ===== PATENT TITLE & META CARD =====
      if (patentData && cfg.show_patent_meta) {
        const title = patentData.titleKo || patentData.title || "";
        const metaBg = hexToRgb(cfg.meta_bg_color || "#e6f3ff");
        const metaAccent = hexToRgb(cfg.meta_accent_color || "#3278c8");

        let innerH = 7;
        pdf.setFontSize(12);
        const titleLines = title ? pdf.splitTextToSize(title, contentWidth - 16) : [];
        const titleLineCount = Math.min(titleLines.length, 2);
        if (title) innerH += titleLineCount * 5.8 + 3;

        const metaParts: string[] = [];
        if (patentData.assignee) metaParts.push(`출원인: ${patentData.assignee}`);
        if (patentData.inventors?.length) metaParts.push(`발명자: ${patentData.inventors.join(", ")}`);
        if (patentData.filingDate) metaParts.push(`출원일: ${patentData.filingDate}`);
        if (patentData.publicationDate) metaParts.push(`${patentData.registrationNumber ? '등록일' : '공개일'}: ${patentData.publicationDate}`);

        if (metaParts.length > 0) {
          pdf.setFontSize(7.5);
          const metaText = metaParts.join("  ·  ");
          const metaLines = pdf.splitTextToSize(metaText, contentWidth - 16);
          innerH += 5 + metaLines.length * 3.8;
        }
        innerH += 4;

        const cardStartY = yPosition;
        const metaCardH = innerH;

        // Card shadow
        pdf.setFillColor(220, 228, 238);
        pdf.roundedRect(margin + 0.8, yPosition + 0.8, contentWidth, metaCardH, 2.5, 2.5, "F");

        // Card background
        pdf.setFillColor(...metaBg);
        pdf.setDrawColor(...lerpColor(metaBg, [150, 180, 210], 0.4));
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, yPosition, contentWidth, metaCardH, 2.5, 2.5, "FD");

        // Left accent bar with gradient effect
        pdf.setFillColor(...metaAccent);
        pdf.roundedRect(margin, yPosition, 3, metaCardH, 1.2, 1.2, "F");
        // Lighter accent overlay on top half
        pdf.setFillColor(...lerpColor(metaAccent, [255, 255, 255], 0.25));
        pdf.rect(margin, yPosition, 3, metaCardH * 0.4, "F");

        yPosition += 7;

        if (title) {
          pdf.setFontSize(12);
          pdf.setTextColor(...THEME.text);
          for (let i = 0; i < titleLineCount; i++) {
            const tLine = titleLines[i] + (i === 0 && titleLines.length > 2 ? "…" : "");
            pdf.text(tLine, margin + 7, yPosition + 2 + i * 5.8);
            pdf.text(tLine, margin + 7.12, yPosition + 2 + i * 5.8); // faux bold
          }
          yPosition += titleLineCount * 5.8 + 3;
        }

        // Subtle divider line before meta
        if (metaParts.length > 0) {
          pdf.setDrawColor(...THEME.divider);
          pdf.setLineWidth(0.2);
          pdf.line(margin + 7, yPosition, margin + contentWidth - 6, yPosition);
          yPosition += 3;

          pdf.setFontSize(7.5);
          pdf.setTextColor(...THEME.textMuted);
          const metaText = metaParts.join("  ·  ");
          const metaLines = pdf.splitTextToSize(metaText, contentWidth - 16);
          for (const ml of metaLines) {
            pdf.text(ml, margin + 7, yPosition + 2);
            yPosition += 3.8;
          }
        }

        yPosition = cardStartY + metaCardH + 7;
      }

      // ===== CONTENT SECTIONS =====
      const lines = content.split("\n");
      let skipSection = false;
      let imageInserted = false;
      let sectionIndex = 0;

      const insertImages = async () => {
        if (imageInserted) return;
        const imagesToUse = patentData?.images?.slice(0, 3) || (patentData?.representativeImage ? [patentData.representativeImage] : []);
        if (imagesToUse.length === 0) return;

        checkNewPage(55);
        yPosition += 2;

        if (imagesToUse.length > 1) {
          const imgH = 44;
          const gap = 3;
          const totalW = contentWidth - 6;
          const imgW = (totalW - gap * (imagesToUse.length - 1)) / imagesToUse.length;

          for (let i = 0; i < imagesToUse.length; i++) {
            const img = await loadImageForPdf(imagesToUse[i]);
            if (!img) continue;
            const imgX = margin + 3 + i * (imgW + gap);
            // Image shadow
            pdf.setFillColor(230, 235, 240);
            pdf.roundedRect(imgX + 0.5, yPosition + 0.5, imgW, imgH, 2, 2, "F");
            // Image border
            pdf.setDrawColor(...THEME.border);
            pdf.setLineWidth(0.25);
            pdf.setFillColor(255, 255, 255);
            pdf.roundedRect(imgX, yPosition, imgW, imgH, 2, 2, "FD");
            pdf.addImage(img.dataUrl, img.format, imgX + 1, yPosition + 1, imgW - 2, imgH - 2);
          }
          yPosition += imgH + 3;
        } else {
          const img = await loadImageForPdf(imagesToUse[0]);
          if (img) {
            const imgW = 68;
            const imgH = 52;
            const imgX = (pageWidth - imgW) / 2;
            // Shadow
            pdf.setFillColor(230, 235, 240);
            pdf.roundedRect(imgX + 0.7, yPosition + 0.7, imgW, imgH, 2, 2, "F");
            // Border
            pdf.setDrawColor(...THEME.border);
            pdf.setLineWidth(0.25);
            pdf.setFillColor(255, 255, 255);
            pdf.roundedRect(imgX, yPosition, imgW, imgH, 2, 2, "FD");
            pdf.addImage(img.dataUrl, img.format, imgX + 1.5, yPosition + 1.5, imgW - 3, imgH - 3);
            yPosition += imgH + 3;
          }
        }

        // Caption
        pdf.setFontSize(6.5);
        pdf.setTextColor(...THEME.textMuted);
        const cap = imagesToUse.length > 1 ? "【특허 도면】" : "【대표 도면】";
        pdf.text(cap, (pageWidth - pdf.getTextWidth(cap)) / 2, yPosition);
        yPosition += 6;
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
          if (!cfg.show_trl && (sectionTitle.includes("기술성숙도") || sectionTitle.includes("TRL"))) continue;

          const bodyPreview = estimateBodyHeight(lines, li + 1, cfg.body_font_size, pageWidth - margin * 2 - 8, cfg.line_height);
          const neededForSection = 16 + bodyPreview;
          checkNewPage(neededForSection);
          yPosition += 6;

          sectionIndex++;
          const icon = getSectionIcon(sectionTitle);

          // Section header band
          const sectionHeaderH = 9.5;
          const bandY = yPosition - 4.5;

          // Band background
          pdf.setFillColor(THEME.sectionBg[0], THEME.sectionBg[1], THEME.sectionBg[2]);
          pdf.roundedRect(margin, bandY, contentWidth, sectionHeaderH, 2, 2, "F");

          // Left accent bar
          pdf.setFillColor(...accentColor);
          pdf.roundedRect(margin, bandY, 3, sectionHeaderH, 1, 1, "F");

          // Section number badge
          const badgeX = margin + 5.5;
          const badgeY = bandY + sectionHeaderH / 2;
          const badgeR = 3;
          pdf.setFillColor(...accentColor);
          pdf.circle(badgeX, badgeY, badgeR, "F");
          pdf.setFontSize(6.5);
          pdf.setTextColor(255, 255, 255);
          const numStr = String(sectionIndex);
          pdf.text(numStr, badgeX - pdf.getTextWidth(numStr) / 2, badgeY + 1.2);

          // Section title text
          const titleX = margin + 11;
          const titleY = yPosition + 0.5;
          pdf.setFontSize(cfg.section_title_size);
          pdf.setTextColor(...accentColor);
          pdf.text(`${sectionTitle}`, titleX, titleY);
          pdf.text(`${sectionTitle}`, titleX + 0.18, titleY); // faux bold

          yPosition += sectionHeaderH + 3;

          if (sectionTitle === "발명의 요약" && cfg.show_patent_images) await insertImages();
        } else if (cleanLine.trim()) {
          addWrappedText(cleanLine, cfg.body_font_size, THEME.textBody, cfg.line_height);
          yPosition += 1.2;
        }
      }

      // ===== DISCLAIMER =====
      if (cfg.show_disclaimer) {
        checkNewPage(14);
        yPosition += 8;
        const discH = 9;

        // Disclaimer shadow
        pdf.setFillColor(245, 240, 225);
        pdf.roundedRect(margin + 0.5, yPosition - 4 + 0.5, contentWidth, discH, 2, 2, "F");

        // Disclaimer background
        pdf.setFillColor(255, 250, 235);
        pdf.setDrawColor(235, 215, 170);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, yPosition - 4, contentWidth, discH, 2, 2, "FD");

        // Left amber bar
        pdf.setFillColor(220, 180, 80);
        pdf.roundedRect(margin, yPosition - 4, 2.5, discH, 0.8, 0.8, "F");

        pdf.setFontSize(7);
        pdf.setTextColor(140, 110, 50);
        const disc = `⚠  ${cfg.disclaimer_text}`;
        const discLines = pdf.splitTextToSize(disc, contentWidth - 10);
        for (let i = 0; i < discLines.length; i++) {
          pdf.text(discLines[i], margin + 6, yPosition + i * 3.5);
        }
        yPosition += discH + 2;
      }

      // ===== FOOTER ON ALL PAGES =====
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        const fy = pageHeight - 7;

        // Footer background
        pdf.setFillColor(THEME.sectionBg[0], THEME.sectionBg[1], THEME.sectionBg[2]);
        pdf.rect(0, fy - 5, pageWidth, 14, "F");

        // Top divider with accent color
        pdf.setDrawColor(...lerpColor(accentColor, THEME.divider, 0.5));
        pdf.setLineWidth(0.4);
        pdf.line(margin, fy - 4, pageWidth - margin, fy - 4);

        // Footer text
        pdf.setFontSize(6.5);
        pdf.setTextColor(...THEME.textMuted);
        pdf.text(cfg.footer_text, margin, fy);

        if (cfg.footer_show_date) {
          const dateText = `생성일: ${new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}`;
          pdf.text(dateText, pageWidth - margin - pdf.getTextWidth(dateText), fy);
        }
        if (cfg.footer_show_page) {
          // Page number with accent dot
          const pg = `${i} / ${totalPages}`;
          const pgW = pdf.getTextWidth(pg);
          const pgX = (pageWidth - pgW) / 2;
          pdf.setTextColor(...THEME.textMuted);
          pdf.text(pg, pgX, fy);
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
