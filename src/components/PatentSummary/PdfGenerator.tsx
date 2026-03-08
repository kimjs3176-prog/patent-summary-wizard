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

// 2024-2025 modern PDF color palette — muted, sophisticated tones
const THEME = {
  bg: [255, 255, 255] as [number, number, number],
  // Deep charcoal for primary text — modern & readable
  text: [22, 27, 34] as [number, number, number],
  textSecondary: [80, 90, 105] as [number, number, number],
  textMuted: [140, 150, 165] as [number, number, number],
  textBody: [40, 48, 58] as [number, number, number],
  // Subtle warm gray borders
  border: [225, 228, 235] as [number, number, number],
  borderLight: [240, 242, 248] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  // Very light blue-gray for section backgrounds
  surfaceLight: [248, 250, 254] as [number, number, number],
  surfaceMuted: [243, 245, 250] as [number, number, number],
  // Accent — modern teal
  accent: [0, 140, 130] as [number, number, number],
  accentLight: [230, 248, 246] as [number, number, number],
  // Warm amber for disclaimer
  amber: [245, 158, 11] as [number, number, number],
  amberBg: [255, 251, 235] as [number, number, number],
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
        if (yPosition + neededHeight > pageHeight - margin - 14) {
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

      // ── Modern text renderer with inline bold support ──
      const addWrappedText = (text: string, fontSize: number, color: [number, number, number], lineHeight = 1.7, indentX = margin + 4) => {
        const maxW = pageWidth - indentX - margin - 3;
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
            if (ls.bold) pdf.text(ls.text, xPos + 0.15, yPosition); // faux bold
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

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  HEADER — full-bleed modern bar  ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const headerH = 26;
      const hY = yPosition;

      // Multi-layer gradient simulation (12 strips)
      const darkEnd = lerpColor(headerColor, [10, 15, 25], 0.35);
      const stripCount = 16;
      for (let i = 0; i < stripCount; i++) {
        const t = i / (stripCount - 1);
        const c = lerpColor(headerColor, darkEnd, t * t); // easeIn curve
        pdf.setFillColor(...c);
        const sy = hY + (headerH * i) / stripCount;
        const sh = headerH / stripCount + 0.3;
        if (i === 0) {
          pdf.roundedRect(margin, sy, contentWidth, sh, 4, 4, "F");
        } else {
          pdf.rect(margin, sy, contentWidth, sh, "F");
        }
      }
      // Clean rounded rect on top
      pdf.setFillColor(...headerColor);
      pdf.roundedRect(margin, hY, contentWidth, headerH, 4, 4, "F");
      // Bottom gradient overlay
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        pdf.setFillColor(...lerpColor(headerColor, darkEnd, t * 0.5));
        pdf.rect(margin, hY + headerH - 8 + i * 1.4, contentWidth, 1.6, "F");
      }

      // Subtle top edge highlight
      pdf.setFillColor(...lerpColor(headerColor, [255, 255, 255], 0.2));
      pdf.roundedRect(margin + 0.5, hY + 0.5, contentWidth - 1, 1, 0.5, 0.5, "F");

      // Geometric decorative element — subtle circles
      pdf.setGState(new (pdf as any).GState({ opacity: 0.08 }));
      pdf.setFillColor(255, 255, 255);
      pdf.circle(pageWidth - margin - 12, hY + headerH / 2, 18, "F");
      pdf.circle(pageWidth - margin - 5, hY + 6, 8, "F");
      pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

      // Title
      pdf.setFontSize(15);
      pdf.setTextColor(255, 255, 255);
      pdf.text(cfg.header_title, margin + 9, hY + 10.5);
      pdf.text(cfg.header_title, margin + 9.15, hY + 10.5); // faux bold

      // Subtitle
      pdf.setFontSize(7.5);
      pdf.setTextColor(...lerpColor(headerColor, [255, 255, 255], 0.7));
      pdf.text(cfg.header_subtitle, margin + 9, hY + 16);

      // Patent number — right aligned, modern pill style
      const isApp = patentData?.searchType === "application";
      const displayNumber = isApp
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApp ? "출원번호" : "등록번호";

      pdf.setFontSize(6);
      pdf.setTextColor(...lerpColor(headerColor, [255, 255, 255], 0.55));
      const nlW = pdf.getTextWidth(numberLabel);
      pdf.text(numberLabel, pageWidth - margin - nlW - 9, hY + 10);

      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      const dnW = pdf.getTextWidth(displayNumber);
      pdf.text(displayNumber, pageWidth - margin - dnW - 9, hY + 15);
      pdf.text(displayNumber, pageWidth - margin - dnW - 8.85, hY + 15); // faux bold

      // Thin separator line between label and number
      pdf.setDrawColor(...lerpColor(headerColor, [255, 255, 255], 0.25));
      pdf.setLineWidth(0.2);
      pdf.line(pageWidth - margin - dnW - 9, hY + 11.5, pageWidth - margin - 9, hY + 11.5);

      yPosition = hY + headerH + 8;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  PATENT TITLE & META — modern card     ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (patentData && cfg.show_patent_meta) {
        const title = patentData.titleKo || patentData.title || "";
        const metaAccent = hexToRgb(cfg.meta_accent_color || "#3278c8");

        // Calculate card height
        let innerH = 8;
        pdf.setFontSize(11.5);
        const titleLines = title ? pdf.splitTextToSize(title, contentWidth - 18) : [];
        const titleLineCount = Math.min(titleLines.length, 2);
        if (title) innerH += titleLineCount * 5.5 + 2;

        const metaParts: string[] = [];
        if (patentData.assignee) metaParts.push(`출원인: ${patentData.assignee}`);
        if (patentData.inventors?.length) metaParts.push(`발명자: ${patentData.inventors.join(", ")}`);
        if (patentData.filingDate) metaParts.push(`출원일: ${patentData.filingDate}`);
        if (patentData.publicationDate) metaParts.push(`${patentData.registrationNumber ? '등록일' : '공개일'}: ${patentData.publicationDate}`);

        if (metaParts.length > 0) {
          pdf.setFontSize(7.5);
          const metaText = metaParts.join("  ·  ");
          const metaLines = pdf.splitTextToSize(metaText, contentWidth - 18);
          innerH += 6 + metaLines.length * 3.8;
        }
        innerH += 4;

        const cardStartY = yPosition;
        const metaCardH = innerH;

        // Modern card — subtle shadow layers
        pdf.setFillColor(200, 210, 225);
        pdf.setGState(new (pdf as any).GState({ opacity: 0.15 }));
        pdf.roundedRect(margin + 1.2, yPosition + 1.5, contentWidth, metaCardH, 3, 3, "F");
        pdf.setGState(new (pdf as any).GState({ opacity: 0.08 }));
        pdf.setFillColor(180, 195, 215);
        pdf.roundedRect(margin + 0.6, yPosition + 0.8, contentWidth, metaCardH, 3, 3, "F");
        pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

        // Card body — white with very subtle border
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(...THEME.borderLight);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, yPosition, contentWidth, metaCardH, 3, 3, "FD");

        // Left accent gradient bar (3 tones)
        const barW = 3;
        const barSegH = metaCardH / 3;
        pdf.setFillColor(...metaAccent);
        pdf.roundedRect(margin, yPosition, barW, metaCardH, 1.5, 1.5, "F");
        pdf.setFillColor(...lerpColor(metaAccent, [255, 255, 255], 0.2));
        pdf.rect(margin, yPosition, barW, barSegH, "F");
        pdf.setFillColor(...lerpColor(metaAccent, [0, 0, 0], 0.15));
        pdf.rect(margin, yPosition + barSegH * 2, barW, barSegH + 1, "F");

        yPosition += 7;

        // Title
        if (title) {
          pdf.setFontSize(11.5);
          pdf.setTextColor(...THEME.text);
          for (let i = 0; i < titleLineCount; i++) {
            const tLine = titleLines[i] + (i === 0 && titleLines.length > 2 ? "…" : "");
            pdf.text(tLine, margin + 8, yPosition + 2 + i * 5.5);
            pdf.text(tLine, margin + 8.12, yPosition + 2 + i * 5.5); // faux bold
          }
          yPosition += titleLineCount * 5.5 + 2;
        }

        // Dotted divider
        if (metaParts.length > 0) {
          pdf.setDrawColor(...THEME.border);
          pdf.setLineWidth(0.15);
          pdf.setLineDashPattern([0.8, 0.8], 0);
          pdf.line(margin + 8, yPosition + 1, margin + contentWidth - 7, yPosition + 1);
          pdf.setLineDashPattern([], 0);
          yPosition += 5;

          pdf.setFontSize(7.5);
          pdf.setTextColor(...THEME.textSecondary);
          const metaText = metaParts.join("  ·  ");
          const metaLines = pdf.splitTextToSize(metaText, contentWidth - 18);
          for (const ml of metaLines) {
            pdf.text(ml, margin + 8, yPosition);
            yPosition += 3.8;
          }
        }

        yPosition = cardStartY + metaCardH + 8;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  CONTENT SECTIONS               ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const lines = content.split("\n");
      let skipSection = false;
      let imageInserted = false;
      let sectionIndex = 0;

      const insertImages = async () => {
        if (imageInserted) return;
        const imagesToUse = patentData?.images?.slice(0, 3) || (patentData?.representativeImage ? [patentData.representativeImage] : []);
        if (imagesToUse.length === 0) return;

        checkNewPage(58);
        yPosition += 3;

        if (imagesToUse.length > 1) {
          const imgH = 46;
          const gap = 3;
          const totalW = contentWidth - 8;
          const imgW = (totalW - gap * (imagesToUse.length - 1)) / imagesToUse.length;

          for (let i = 0; i < imagesToUse.length; i++) {
            const img = await loadImageForPdf(imagesToUse[i]);
            if (!img) continue;
            const imgX = margin + 4 + i * (imgW + gap);
            // Soft shadow
            pdf.setFillColor(210, 215, 225);
            pdf.setGState(new (pdf as any).GState({ opacity: 0.2 }));
            pdf.roundedRect(imgX + 0.8, yPosition + 0.8, imgW, imgH, 2.5, 2.5, "F");
            pdf.setGState(new (pdf as any).GState({ opacity: 1 }));
            // White frame
            pdf.setFillColor(255, 255, 255);
            pdf.setDrawColor(...THEME.borderLight);
            pdf.setLineWidth(0.25);
            pdf.roundedRect(imgX, yPosition, imgW, imgH, 2.5, 2.5, "FD");
            pdf.addImage(img.dataUrl, img.format, imgX + 1.5, yPosition + 1.5, imgW - 3, imgH - 3);
          }
          yPosition += imgH + 4;
        } else {
          const img = await loadImageForPdf(imagesToUse[0]);
          if (img) {
            const imgW = 70;
            const imgH = 54;
            const imgX = (pageWidth - imgW) / 2;
            // Layered shadow
            pdf.setFillColor(200, 208, 220);
            pdf.setGState(new (pdf as any).GState({ opacity: 0.12 }));
            pdf.roundedRect(imgX + 1.2, yPosition + 1.5, imgW, imgH, 3, 3, "F");
            pdf.setGState(new (pdf as any).GState({ opacity: 0.06 }));
            pdf.setFillColor(180, 190, 210);
            pdf.roundedRect(imgX + 2, yPosition + 2.5, imgW, imgH, 3, 3, "F");
            pdf.setGState(new (pdf as any).GState({ opacity: 1 }));
            // Frame
            pdf.setFillColor(255, 255, 255);
            pdf.setDrawColor(...THEME.borderLight);
            pdf.setLineWidth(0.3);
            pdf.roundedRect(imgX, yPosition, imgW, imgH, 3, 3, "FD");
            pdf.addImage(img.dataUrl, img.format, imgX + 2, yPosition + 2, imgW - 4, imgH - 4);
            yPosition += imgH + 4;
          }
        }

        // Caption — minimal style
        pdf.setFontSize(6.5);
        pdf.setTextColor(...THEME.textMuted);
        const cap = imagesToUse.length > 1 ? "특허 도면" : "대표 도면";
        const capW = pdf.getTextWidth(cap);
        // Thin line + text centered
        const capCenterX = pageWidth / 2;
        const lineGap = 2;
        pdf.setDrawColor(...THEME.border);
        pdf.setLineWidth(0.15);
        pdf.line(capCenterX - capW / 2 - 12, yPosition, capCenterX - capW / 2 - lineGap, yPosition);
        pdf.line(capCenterX + capW / 2 + lineGap, yPosition, capCenterX + capW / 2 + 12, yPosition);
        pdf.text(cap, capCenterX - capW / 2, yPosition + 0.5);
        yPosition += 7;
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
          const neededForSection = 18 + bodyPreview;
          checkNewPage(neededForSection);
          yPosition += 7;

          sectionIndex++;

          // ── Modern section header ──
          const sectionHeaderH = 10;
          const bandY = yPosition - 4.5;

          // Clean background band with subtle gradient
          pdf.setFillColor(...THEME.surfaceLight);
          pdf.roundedRect(margin, bandY, contentWidth, sectionHeaderH, 2.5, 2.5, "F");

          // Accent left edge — rounded pill
          pdf.setFillColor(...accentColor);
          pdf.roundedRect(margin + 0.5, bandY + 1.5, 2, sectionHeaderH - 3, 1, 1, "F");

          // Section number — modern circular badge
          const badgeX = margin + 7;
          const badgeY = bandY + sectionHeaderH / 2;
          const badgeR = 3.2;

          // Badge with subtle gradient feel
          pdf.setFillColor(...accentColor);
          pdf.circle(badgeX, badgeY, badgeR, "F");
          // Inner highlight
          pdf.setFillColor(...lerpColor(accentColor, [255, 255, 255], 0.2));
          pdf.circle(badgeX - 0.3, badgeY - 0.3, badgeR * 0.7, "F");
          pdf.setFillColor(...accentColor);
          pdf.circle(badgeX, badgeY, badgeR - 0.3, "F");

          pdf.setFontSize(6.5);
          pdf.setTextColor(255, 255, 255);
          const numStr = String(sectionIndex);
          pdf.text(numStr, badgeX - pdf.getTextWidth(numStr) / 2, badgeY + 1.2);

          // Section title
          const titleX = margin + 13;
          const titleY = yPosition + 0.8;
          pdf.setFontSize(cfg.section_title_size);
          pdf.setTextColor(...accentColor);
          pdf.text(sectionTitle, titleX, titleY);
          pdf.text(sectionTitle, titleX + 0.16, titleY); // faux bold

          yPosition += sectionHeaderH + 3;

          if (sectionTitle === "발명의 요약" && cfg.show_patent_images) await insertImages();
        } else if (cleanLine.trim()) {
          addWrappedText(cleanLine, cfg.body_font_size, THEME.textBody, cfg.line_height);
          yPosition += 1;
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  DISCLAIMER — amber callout      ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (cfg.show_disclaimer) {
        checkNewPage(16);
        yPosition += 10;
        const discH = 10;
        const dY = yPosition - 4;

        // Soft shadow
        pdf.setFillColor(240, 235, 215);
        pdf.setGState(new (pdf as any).GState({ opacity: 0.3 }));
        pdf.roundedRect(margin + 0.5, dY + 0.5, contentWidth, discH, 2.5, 2.5, "F");
        pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

        // Background
        pdf.setFillColor(...THEME.amberBg);
        pdf.setDrawColor(235, 215, 170);
        pdf.setLineWidth(0.25);
        pdf.roundedRect(margin, dY, contentWidth, discH, 2.5, 2.5, "FD");

        // Left amber accent bar
        pdf.setFillColor(...THEME.amber);
        pdf.roundedRect(margin, dY, 2.5, discH, 1, 1, "F");

        // Warning icon circle
        const iconX = margin + 7;
        const iconY = dY + discH / 2;
        pdf.setFillColor(...lerpColor(THEME.amber, [255, 255, 255], 0.5));
        pdf.circle(iconX, iconY, 2, "F");
        pdf.setFontSize(5.5);
        pdf.setTextColor(...THEME.amber);
        pdf.text("!", iconX - 0.5, iconY + 1);

        pdf.setFontSize(7);
        pdf.setTextColor(130, 100, 40);
        const disc = cfg.disclaimer_text;
        const discLines = pdf.splitTextToSize(disc, contentWidth - 16);
        for (let i = 0; i < discLines.length; i++) {
          pdf.text(discLines[i], margin + 12, dY + 4 + i * 3.5);
        }
        yPosition = dY + discH + 3;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  FOOTER — modern minimal style   ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        const fy = pageHeight - 8;

        // Clean footer background
        pdf.setFillColor(...THEME.surfaceLight);
        pdf.rect(0, fy - 5, pageWidth, 15, "F");

        // Top accent line — thin gradient
        pdf.setDrawColor(...lerpColor(accentColor, THEME.border, 0.6));
        pdf.setLineWidth(0.3);
        pdf.line(margin, fy - 5, pageWidth - margin, fy - 5);

        // Accent dot before footer text
        pdf.setFillColor(...accentColor);
        pdf.circle(margin + 1, fy - 0.5, 0.6, "F");

        // Footer text
        pdf.setFontSize(6);
        pdf.setTextColor(...THEME.textMuted);
        pdf.text(cfg.footer_text, margin + 3.5, fy);

        if (cfg.footer_show_date) {
          const dateText = `${new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}`;
          pdf.text(dateText, pageWidth - margin - pdf.getTextWidth(dateText), fy);
        }
        if (cfg.footer_show_page) {
          // Modern page number — accent colored current page
          const pgText = `${i}`;
          const pgTotal = ` / ${totalPages}`;
          const pgTotalW = pdf.getTextWidth(pgTotal);
          const pgW = pdf.getTextWidth(pgText);
          const pgX = (pageWidth - pgW - pgTotalW) / 2;

          pdf.setFontSize(7);
          pdf.setTextColor(...accentColor);
          pdf.text(pgText, pgX, fy);
          pdf.text(pgText, pgX + 0.12, fy); // faux bold
          pdf.setFontSize(6);
          pdf.setTextColor(...THEME.textMuted);
          pdf.text(pgTotal, pgX + pgW, fy);
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
