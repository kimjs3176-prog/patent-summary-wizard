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

// 2025 Modern PDF Design System — Bold, Clean, Sophisticated
const THEME = {
  bg: [255, 255, 255] as [number, number, number],
  // Rich ink black for premium typography
  text: [15, 23, 42] as [number, number, number],
  textSecondary: [71, 85, 105] as [number, number, number],
  textMuted: [148, 163, 184] as [number, number, number],
  textBody: [30, 41, 59] as [number, number, number],
  // Soft neutral borders
  border: [226, 232, 240] as [number, number, number],
  borderLight: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  // Elevated surface tones
  surfaceLight: [248, 250, 252] as [number, number, number],
  surfaceMuted: [241, 245, 249] as [number, number, number],
  surfaceWarm: [254, 252, 251] as [number, number, number],
  // Modern indigo accent — 2025 trend
  accent: [79, 70, 229] as [number, number, number],
  accentLight: [238, 242, 255] as [number, number, number],
  accentDark: [55, 48, 163] as [number, number, number],
  // Secondary accent — emerald
  secondary: [16, 185, 129] as [number, number, number],
  secondaryLight: [236, 253, 245] as [number, number, number],
  // Warm amber for alerts
  amber: [245, 158, 11] as [number, number, number],
  amberBg: [255, 251, 235] as [number, number, number],
  // Subtle rose for highlights
  rose: [244, 63, 94] as [number, number, number],
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
      // ██  HEADER — 2025 Bold Gradient Bar  ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const headerH = 24;
      const hY = yPosition;

      // Modern gradient — deep indigo to purple shift
      const gradStart = headerColor;
      const gradMid = lerpColor(headerColor, THEME.accentDark, 0.4);
      const gradEnd = lerpColor(headerColor, [30, 27, 75], 0.6);
      
      const stripCount = 20;
      for (let i = 0; i < stripCount; i++) {
        const t = i / (stripCount - 1);
        // Smooth cubic easing for gradient
        const eased = t * t * (3 - 2 * t);
        const c = i < stripCount / 2 
          ? lerpColor(gradStart, gradMid, eased * 2)
          : lerpColor(gradMid, gradEnd, (eased - 0.5) * 2);
        pdf.setFillColor(...c);
        const sy = hY + (headerH * i) / stripCount;
        const sh = headerH / stripCount + 0.4;
        pdf.rect(margin, sy, contentWidth, sh, "F");
      }

      // Clean rounded corners overlay
      pdf.setFillColor(...gradStart);
      pdf.roundedRect(margin, hY, contentWidth, headerH, 5, 5, "F");
      
      // Re-apply gradient with rounded mask
      for (let i = 0; i < stripCount; i++) {
        const t = i / (stripCount - 1);
        const eased = t * t * (3 - 2 * t);
        const c = i < stripCount / 2 
          ? lerpColor(gradStart, gradMid, eased * 2)
          : lerpColor(gradMid, gradEnd, (eased - 0.5) * 2);
        pdf.setFillColor(...c);
        const sy = hY + (headerH * i) / stripCount;
        const sh = headerH / stripCount + 0.4;
        // Clip to rounded rect area
        if (i >= 1 && i < stripCount - 1) {
          pdf.rect(margin, sy, contentWidth, sh, "F");
        }
      }

      // Glassmorphism highlight — top edge shine
      pdf.setGState(new (pdf as any).GState({ opacity: 0.15 }));
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(margin + 1, hY + 1, contentWidth - 2, 3, 1.5, 1.5, "F");
      pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

      // Abstract geometric patterns — floating orbs
      pdf.setGState(new (pdf as any).GState({ opacity: 0.06 }));
      pdf.setFillColor(255, 255, 255);
      pdf.circle(pageWidth - margin - 15, hY + headerH * 0.4, 22, "F");
      pdf.circle(pageWidth - margin - 8, hY + 5, 10, "F");
      pdf.circle(margin + 18, hY + headerH - 5, 8, "F");
      pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

      // Bold title — large and prominent
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text(cfg.header_title, margin + 8, hY + 10);
      pdf.text(cfg.header_title, margin + 8.18, hY + 10);
      pdf.text(cfg.header_title, margin + 8.09, hY + 10);

      // Subtitle with pill badge style
      pdf.setFontSize(6.5);
      pdf.setGState(new (pdf as any).GState({ opacity: 0.25 }));
      pdf.setFillColor(255, 255, 255);
      const subW = pdf.getTextWidth(cfg.header_subtitle) + 7;
      pdf.roundedRect(margin + 7, hY + 13, subW, 5, 2.5, 2.5, "F");
      pdf.setGState(new (pdf as any).GState({ opacity: 1 }));
      pdf.setTextColor(...lerpColor(gradStart, [255, 255, 255], 0.9));
      pdf.text(cfg.header_subtitle, margin + 10.5, hY + 16.5);

      // Patent number section — right side with modern layout
      const isApp = patentData?.searchType === "application";
      const displayNumber = isApp
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApp ? "출원번호" : "등록번호";

      // Status indicator dot
      const dotColor = isApp ? THEME.amber : THEME.secondary;
      pdf.setFillColor(...dotColor);
      pdf.circle(pageWidth - margin - 9, hY + 7, 1.8, "F");
      pdf.setGState(new (pdf as any).GState({ opacity: 0.3 }));
      pdf.circle(pageWidth - margin - 9, hY + 7, 3, "F");
      pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

      pdf.setFontSize(5.5);
      pdf.setTextColor(...lerpColor(gradStart, [255, 255, 255], 0.6));
      const nlW = pdf.getTextWidth(numberLabel);
      pdf.text(numberLabel, pageWidth - margin - nlW - 13, hY + 8);

      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      const dnW = pdf.getTextWidth(displayNumber);
      pdf.text(displayNumber, pageWidth - margin - dnW - 9, hY + 14);
      pdf.text(displayNumber, pageWidth - margin - dnW - 8.88, hY + 14);

      pdf.setDrawColor(...lerpColor(gradStart, [255, 255, 255], 0.2));
      pdf.setLineWidth(0.3);
      pdf.line(pageWidth - margin - Math.max(dnW, nlW) - 13, hY + 10, pageWidth - margin - 9, hY + 10);

      yPosition = hY + headerH + 6;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  PATENT TITLE & META — modern card     ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (patentData && cfg.show_patent_meta) {
        const title = patentData.titleKo || patentData.title || "";
        const metaAccent = hexToRgb(cfg.meta_accent_color || "#3278c8");

        // Calculate card height
        let innerH = 5;
        pdf.setFontSize(11.5);
        const titleLines = title ? pdf.splitTextToSize(title, contentWidth - 18) : [];
        const titleLineCount = Math.min(titleLines.length, 2);
        if (title) innerH += titleLineCount * 5 + 1;

        const metaParts: string[] = [];
        if (patentData.assignee) metaParts.push(`출원인: ${patentData.assignee}`);
        if (patentData.inventors?.length) metaParts.push(`발명자: ${patentData.inventors.join(", ")}`);
        if (patentData.filingDate) metaParts.push(`출원일: ${patentData.filingDate}`);
        if (patentData.publicationDate) metaParts.push(`${patentData.registrationNumber ? '등록일' : '공개일'}: ${patentData.publicationDate}`);

        if (metaParts.length > 0) {
          pdf.setFontSize(7.5);
          const metaText = metaParts.join("  ·  ");
          const metaLines = pdf.splitTextToSize(metaText, contentWidth - 16);
          innerH += 4 + metaLines.length * 3.5;
        }
        innerH += 2;

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

        yPosition += 5;

        // Title
        if (title) {
          pdf.setFontSize(10.5);
          pdf.setTextColor(...THEME.text);
          for (let i = 0; i < titleLineCount; i++) {
            const tLine = titleLines[i] + (i === 0 && titleLines.length > 2 ? "…" : "");
            pdf.text(tLine, margin + 7, yPosition + 1.5 + i * 5);
            pdf.text(tLine, margin + 7.12, yPosition + 1.5 + i * 5);
          }
          yPosition += titleLineCount * 5 + 1;
        }

        // Dotted divider
        if (metaParts.length > 0) {
          pdf.setDrawColor(...THEME.border);
          pdf.setLineWidth(0.15);
          pdf.setLineDashPattern([0.8, 0.8], 0);
          pdf.line(margin + 7, yPosition + 0.5, margin + contentWidth - 6, yPosition + 0.5);
          pdf.setLineDashPattern([], 0);
          yPosition += 3.5;

          pdf.setFontSize(7);
          pdf.setTextColor(...THEME.textSecondary);
          const metaText = metaParts.join("  ·  ");
          const metaLines = pdf.splitTextToSize(metaText, contentWidth - 16);
          for (const ml of metaLines) {
            pdf.text(ml, margin + 7, yPosition);
            yPosition += 3.5;
          }
        }

        yPosition = cardStartY + metaCardH + 5;
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
          if (!cfg.show_claims && (sectionTitle.includes("청구항") || sectionTitle.includes("특허 청구"))) { skipSection = true; continue; }

          const bodyPreview = estimateBodyHeight(lines, li + 1, cfg.body_font_size, pageWidth - margin * 2 - 8, cfg.line_height);
          const neededForSection = 18 + bodyPreview;
          checkNewPage(neededForSection);
          yPosition += 7;

          sectionIndex++;

          // ── 2025 Modern Section Header — Bold & Clean ──
          const sectionHeaderH = 11;
          const bandY = yPosition;

          // Subtle shadow layer
          pdf.setFillColor(200, 205, 215);
          pdf.setGState(new (pdf as any).GState({ opacity: 0.12 }));
          pdf.roundedRect(margin + 0.5, bandY + 0.8, contentWidth, sectionHeaderH, 3, 3, "F");
          pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

          // Main background band — clean white with border
          pdf.setFillColor(255, 255, 255);
          pdf.setDrawColor(...THEME.border);
          pdf.setLineWidth(0.25);
          pdf.roundedRect(margin, bandY, contentWidth, sectionHeaderH, 3, 3, "FD");

          // Bold left accent bar — thicker, more prominent
          const accentBarW = 4;
          pdf.setFillColor(...accentColor);
          pdf.roundedRect(margin, bandY, accentBarW, sectionHeaderH, 2, 2, "F");
          // Gradient fade on accent bar
          pdf.setFillColor(...lerpColor(accentColor, THEME.white, 0.15));
          pdf.rect(margin + accentBarW - 1, bandY, 1, sectionHeaderH, "F");

          // Section title — larger, bolder (no number badge)
          const titleX = margin + 10;
          const titleFontH = (cfg.section_title_size + 1) * 0.352778;
          const badgeCY = bandY + sectionHeaderH / 2;
          const titleY = badgeCY + titleFontH * 0.35;
          pdf.setFontSize(cfg.section_title_size + 1);
          pdf.setTextColor(...THEME.text);
          pdf.text(sectionTitle, titleX, titleY);
          pdf.text(sectionTitle, titleX + 0.18, titleY); // faux bold
          pdf.text(sectionTitle, titleX + 0.09, titleY); // extra weight

          // Subtle decorative line extending from title
          const titleW = pdf.getTextWidth(sectionTitle);
          pdf.setDrawColor(...THEME.borderLight);
          pdf.setLineWidth(0.4);
          pdf.line(titleX + titleW + 5, badgeCY, margin + contentWidth - 8, badgeCY);

          yPosition = bandY + sectionHeaderH + 4;

          if (sectionTitle === "발명의 요약" && cfg.show_patent_images) await insertImages();
        } else if (cleanLine.trim()) {
          addWrappedText(cleanLine, cfg.body_font_size, THEME.textBody, cfg.line_height);
          yPosition += 1;
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  DISCLAIMER — Modern Alert Card   ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (cfg.show_disclaimer) {
        checkNewPage(18);
        yPosition += 12;
        const discH = 12;
        const dY = yPosition - 4;

        // Layered shadow for depth
        pdf.setFillColor(250, 240, 210);
        pdf.setGState(new (pdf as any).GState({ opacity: 0.4 }));
        pdf.roundedRect(margin + 0.8, dY + 1, contentWidth, discH, 3, 3, "F");
        pdf.setGState(new (pdf as any).GState({ opacity: 0.2 }));
        pdf.setFillColor(245, 230, 190);
        pdf.roundedRect(margin + 1.2, dY + 1.5, contentWidth, discH, 3, 3, "F");
        pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

        // Main background with border
        pdf.setFillColor(...THEME.amberBg);
        pdf.setDrawColor(240, 210, 150);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, dY, contentWidth, discH, 3, 3, "FD");

        // Bold left accent bar
        pdf.setFillColor(...THEME.amber);
        pdf.roundedRect(margin, dY, 3.5, discH, 1.5, 1.5, "F");

        // Warning icon — modern rounded square
        const iconSize = 5;
        const iconX = margin + 8;
        const iconCY = dY + discH / 2;
        const iconY = iconCY - iconSize / 2;

        pdf.setFillColor(...lerpColor(THEME.amber, THEME.white, 0.4));
        pdf.roundedRect(iconX, iconY, iconSize, iconSize, 1.5, 1.5, "F");
        pdf.setFontSize(8);
        pdf.setTextColor(...THEME.amber);
        const exclW = pdf.getTextWidth("!");
        const exclFontH = 8 * 0.352778;
        pdf.text("!", iconX + iconSize / 2 - exclW / 2, iconCY + exclFontH * 0.35);
        pdf.text("!", iconX + iconSize / 2 - exclW / 2 + 0.08, iconCY + exclFontH * 0.35); // faux bold

        // Disclaimer text — well centered
        pdf.setFontSize(7.5);
        pdf.setTextColor(140, 100, 30);
        const disc = cfg.disclaimer_text;
        const discLines = pdf.splitTextToSize(disc, contentWidth - 20);
        const discTextH = discLines.length * 3.8;
        const discTextStartY = dY + (discH - discTextH) / 2 + 3.8 * 0.75;
        for (let i = 0; i < discLines.length; i++) {
          pdf.text(discLines[i], margin + 16, discTextStartY + i * 3.8);
        }
        yPosition = dY + discH + 4;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  FOOTER — 2025 Clean Minimal      ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        const fy = pageHeight - 9;

        // Subtle footer background gradient
        const footerGradH = 12;
        for (let g = 0; g < 6; g++) {
          const t = g / 5;
          pdf.setFillColor(...lerpColor(THEME.white, THEME.surfaceLight, t * 0.8));
          pdf.rect(0, fy - footerGradH + g * 2, pageWidth, 2.5, "F");
        }

        // Top accent line — gradient fade
        pdf.setDrawColor(...lerpColor(accentColor, THEME.border, 0.5));
        pdf.setLineWidth(0.4);
        pdf.line(margin, fy - 6, pageWidth - margin, fy - 6);

        // Accent square marker
        pdf.setFillColor(...accentColor);
        pdf.roundedRect(margin, fy - 1.5, 3, 3, 0.8, 0.8, "F");

        // Footer text
        pdf.setFontSize(6.5);
        pdf.setTextColor(...THEME.textSecondary);
        pdf.text(cfg.footer_text, margin + 5, fy + 1);

        if (cfg.footer_show_date) {
          const dateText = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
          pdf.setTextColor(...THEME.textMuted);
          pdf.text(dateText, pageWidth - margin - pdf.getTextWidth(dateText), fy + 1);
        }

        if (cfg.footer_show_page) {
          // Modern page indicator — bold current, muted total
          const pgText = `${i}`;
          const pgTotal = ` / ${totalPages}`;
          const pgTotalW = pdf.getTextWidth(pgTotal);
          
          pdf.setFontSize(8);
          const pgW = pdf.getTextWidth(pgText);
          const pgX = (pageWidth - pgW - pgTotalW) / 2;

          // Page number highlight background
          pdf.setFillColor(...THEME.accentLight);
          pdf.roundedRect(pgX - 2, fy - 2.5, pgW + 4, 6, 2, 2, "F");

          pdf.setTextColor(...accentColor);
          pdf.text(pgText, pgX, fy + 1);
          pdf.text(pgText, pgX + 0.12, fy + 1); // faux bold
          
          pdf.setFontSize(6.5);
          pdf.setTextColor(...THEME.textMuted);
          pdf.text(pgTotal, pgX + pgW + 0.5, fy + 1);
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
