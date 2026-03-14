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

// ─── 2025 Design System — Editorial Modernism ───
// Trends: Bold asymmetry, generous whitespace, color blocking, organic warmth
const THEME = {
  // Deep ink — rich and confident
  ink: [12, 17, 29] as [number, number, number],
  inkSoft: [30, 41, 59] as [number, number, number],
  // Reading-optimized body
  body: [42, 48, 64] as [number, number, number],
  caption: [100, 116, 139] as [number, number, number],
  muted: [148, 163, 184] as [number, number, number],
  // Sophisticated neutrals — warm undertone (2025 trend: warm minimalism)
  rule: [200, 206, 216] as [number, number, number],
  ruleLight: [230, 233, 238] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  cream: [250, 249, 247] as [number, number, number],
  warmGray: [243, 241, 238] as [number, number, number],
  // Signature accent — deep forest green (2025 trend: nature-inspired palettes)
  forest: [22, 78, 55] as [number, number, number],
  forestLight: [34, 110, 78] as [number, number, number],
  forestBg: [240, 249, 244] as [number, number, number],
  // Warm terracotta secondary (2025 trend: earthy warmth)
  terra: [180, 90, 50] as [number, number, number],
  terraBg: [254, 247, 242] as [number, number, number],
  // Deep slate for structure
  slate: [30, 41, 59] as [number, number, number],
  slateMid: [51, 65, 85] as [number, number, number],
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
      const brandColor = hexToRgb(cfg.header_bg_color);
      const sectionColor = hexToRgb(cfg.section_accent_color);

      const footerReserve = 16;

      const checkNewPage = (neededHeight: number) => {
        if (yPosition + neededHeight > pageHeight - margin - footerReserve) {
          pdf.addPage();
          yPosition = margin + 6;
          // Running header thin line on subsequent pages
          pdf.setDrawColor(...THEME.ruleLight);
          pdf.setLineWidth(0.2);
          pdf.line(margin, margin + 2, pageWidth - margin, margin + 2);
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

      // ── Inline bold text renderer ──
      const addWrappedText = (text: string, fontSize: number, color: [number, number, number], lineHeight = 1.7, indentX = margin + 5) => {
        const maxW = pageWidth - indentX - margin - 4;
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
            if (segCharCount + cleanSeg.length <= charIdx) { segCharCount += cleanSeg.length; continue; }
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
            pdf.setTextColor(...(ls.bold ? THEME.ink : color));
            pdf.text(ls.text, xPos, yPosition);
            if (ls.bold) pdf.text(ls.text, xPos + 0.14, yPosition);
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

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  HEADER — 2025 Color Block + Bold Typography   ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      const headerH = 34;

      // Warm cream full bleed background
      pdf.setFillColor(...THEME.cream);
      pdf.rect(0, 0, pageWidth, headerH + margin + 2, "F");

      // Color block strip — left side, brand color (asymmetric layout, 2025 trend)
      pdf.setFillColor(...brandColor);
      pdf.rect(0, 0, 8, headerH + margin + 2, "F");

      // Thin accent line below color block
      pdf.setFillColor(...lerpColor(brandColor, THEME.white, 0.5));
      pdf.rect(8, 0, 1.5, headerH + margin + 2, "F");

      // Bottom border — double rule (editorial tradition)
      pdf.setDrawColor(...THEME.ink);
      pdf.setLineWidth(0.7);
      pdf.line(margin, headerH + margin, pageWidth - margin, headerH + margin);
      pdf.setDrawColor(...THEME.rule);
      pdf.setLineWidth(0.2);
      pdf.line(margin, headerH + margin + 1.5, pageWidth - margin, headerH + margin + 1.5);

      // Title — oversized bold (2025: bold statement typography)
      const titleX = margin + 2;
      pdf.setFontSize(18);
      pdf.setTextColor(...THEME.ink);
      pdf.text(cfg.header_title, titleX, margin + 10);
      pdf.text(cfg.header_title, titleX + 0.18, margin + 10);
      pdf.text(cfg.header_title, titleX + 0.09, margin + 10);

      // Subtitle — spaced, uppercase feel
      pdf.setFontSize(7);
      pdf.setTextColor(...THEME.caption);
      pdf.text(cfg.header_subtitle, titleX, margin + 16);

      // Decorative small brand dot after subtitle
      pdf.setFillColor(...brandColor);
      const subW = pdf.getTextWidth(cfg.header_subtitle);
      pdf.circle(titleX + subW + 3, margin + 15, 1.2, "F");

      // Patent number — right column, structured block
      const isApp = patentData?.searchType === "application";
      const displayNumber = isApp
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApp ? "출원번호" : "등록번호";

      // Label chip — small colored badge
      pdf.setFontSize(5.5);
      const nlW = pdf.getTextWidth(numberLabel);
      pdf.setFillColor(...lerpColor(brandColor, THEME.white, 0.85));
      pdf.roundedRect(pageWidth - margin - nlW - 5, margin + 4, nlW + 4, 4.5, 1.5, 1.5, "F");
      pdf.setTextColor(...lerpColor(brandColor, THEME.ink, 0.6));
      pdf.text(numberLabel, pageWidth - margin - nlW - 3, margin + 7.2);

      // Number — bold mono-style
      pdf.setFontSize(12);
      pdf.setTextColor(...THEME.ink);
      const dnW = pdf.getTextWidth(displayNumber);
      pdf.text(displayNumber, pageWidth - margin - dnW, margin + 15);
      pdf.text(displayNumber, pageWidth - margin - dnW + 0.12, margin + 15);

      // Date — right aligned, subtle
      const genDate = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
      pdf.setFontSize(6);
      pdf.setTextColor(...THEME.muted);
      const gdW = pdf.getTextWidth(genDate);
      pdf.text(genDate, pageWidth - margin - gdW, margin + headerH - 4);

      yPosition = headerH + margin + 7;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  PATENT INFO — 2025 Structured Data Card    ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (patentData && cfg.show_patent_meta) {
        const title = patentData.titleKo || patentData.title || "";
        const metaAccent = hexToRgb(cfg.meta_accent_color || "#3278c8");

        // Calculate card height
        let innerH = 7;
        pdf.setFontSize(11);
        const titleLines = title ? pdf.splitTextToSize(title, contentWidth - 14) : [];
        const titleLineCount = Math.min(titleLines.length, 2);
        if (title) innerH += titleLineCount * 5.5 + 3;

        // Build structured meta items
        const metaItems: { label: string; value: string }[] = [];
        if (patentData.assignee) metaItems.push({ label: "출원인", value: patentData.assignee });
        if (patentData.inventors?.length) metaItems.push({ label: "발명자", value: patentData.inventors.join(", ") });
        if (patentData.filingDate) metaItems.push({ label: "출원일", value: patentData.filingDate });
        if (patentData.publicationDate) metaItems.push({ label: patentData.registrationNumber ? "등록일" : "공개일", value: patentData.publicationDate });

        if (metaItems.length > 0) innerH += 5 + Math.ceil(metaItems.length / 2) * 5;
        innerH += 2;

        const cardStartY = yPosition;
        const metaCardH = innerH;

        // Card — warm gray bg, no border, organic feel (2025: borderless cards)
        pdf.setFillColor(...THEME.warmGray);
        pdf.roundedRect(margin, yPosition, contentWidth, metaCardH, 3, 3, "F");

        // Top accent stripe — brand color
        pdf.setFillColor(...brandColor);
        pdf.roundedRect(margin, yPosition, contentWidth, 2.5, 3, 3, "F");
        pdf.setFillColor(...THEME.warmGray);
        pdf.rect(margin, yPosition + 2, contentWidth, 1.5, "F");

        yPosition += 7;

        // Title — large, confident
        if (title) {
          pdf.setFontSize(10.5);
          pdf.setTextColor(...THEME.ink);
          for (let i = 0; i < titleLineCount; i++) {
            const tLine = titleLines[i] + (i === 0 && titleLines.length > 2 ? "…" : "");
            pdf.text(tLine, margin + 6, yPosition + i * 5.5);
            pdf.text(tLine, margin + 6.12, yPosition + i * 5.5);
          }
          yPosition += titleLineCount * 5.5 + 3;
        }

        // Meta items — 2-column grid layout (2025: structured data presentation)
        if (metaItems.length > 0) {
          const colW = (contentWidth - 12) / 2;
          let col = 0;
          let rowY = yPosition;

          for (const item of metaItems) {
            const itemX = margin + 6 + col * (colW + 2);

            // Label — small, muted, uppercase feel
            pdf.setFontSize(6);
            pdf.setTextColor(...THEME.caption);
            pdf.text(item.label, itemX, rowY);

            // Value — clear, readable
            pdf.setFontSize(8);
            pdf.setTextColor(...THEME.inkSoft);
            const valLines = pdf.splitTextToSize(item.value, colW - 2);
            pdf.text(valLines[0], itemX, rowY + 3.5);

            col++;
            if (col >= 2) {
              col = 0;
              rowY += 5;
            }
          }
          if (col > 0) rowY += 5;
        }

        yPosition = cardStartY + metaCardH + 6;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  CONTENT SECTIONS                ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const lines = content.split("\n");
      let skipSection = false;
      let imageInserted = false;
      let sectionIndex = 0;

      const insertImages = async () => {
        if (imageInserted) return;
        const imagesToUse = patentData?.images?.slice(0, 3) || (patentData?.representativeImage ? [patentData.representativeImage] : []);
        if (imagesToUse.length === 0) return;

        checkNewPage(60);
        yPosition += 2;

        if (imagesToUse.length > 1) {
          const imgH = 48;
          const gap = 5;
          const totalW = contentWidth - 4;
          const imgW = (totalW - gap * (imagesToUse.length - 1)) / imagesToUse.length;

          for (let i = 0; i < imagesToUse.length; i++) {
            const img = await loadImageForPdf(imagesToUse[i]);
            if (!img) continue;
            const imgX = margin + 2 + i * (imgW + gap);
            // Warm shadow effect
            pdf.setFillColor(...THEME.warmGray);
            pdf.roundedRect(imgX + 1, yPosition + 1.5, imgW, imgH, 2, 2, "F");
            // Image frame
            pdf.setFillColor(255, 255, 255);
            pdf.setDrawColor(...THEME.ruleLight);
            pdf.setLineWidth(0.25);
            pdf.roundedRect(imgX, yPosition, imgW, imgH, 2, 2, "FD");
            pdf.addImage(img.dataUrl, img.format, imgX + 2, yPosition + 2, imgW - 4, imgH - 4);
          }
          yPosition += imgH + 3;
        } else {
          const img = await loadImageForPdf(imagesToUse[0]);
          if (img) {
            const imgW = 65;
            const imgH = 50;
            const imgX = (pageWidth - imgW) / 2;
            pdf.setFillColor(...THEME.warmGray);
            pdf.roundedRect(imgX + 1, yPosition + 1.5, imgW, imgH, 2, 2, "F");
            pdf.setFillColor(255, 255, 255);
            pdf.setDrawColor(...THEME.ruleLight);
            pdf.setLineWidth(0.25);
            pdf.roundedRect(imgX, yPosition, imgW, imgH, 2, 2, "FD");
            pdf.addImage(img.dataUrl, img.format, imgX + 2.5, yPosition + 2.5, imgW - 5, imgH - 5);
            yPosition += imgH + 3;
          }
        }

        // Caption — centered with flanking dots
        pdf.setFontSize(6.5);
        pdf.setTextColor(...THEME.muted);
        const cap = imagesToUse.length > 1 ? "특허 도면" : "대표 도면";
        const capW = pdf.getTextWidth(cap);
        const capX = (pageWidth - capW) / 2;
        pdf.setFillColor(...THEME.muted);
        pdf.circle(capX - 4, yPosition + 0.5, 0.6, "F");
        pdf.text(cap, capX, yPosition + 1.5);
        pdf.circle(capX + capW + 4, yPosition + 0.5, 0.6, "F");
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
          yPosition += 8;

          sectionIndex++;

          // ── 2025 Section Header — Color Block Accent ──
          const shH = 8;
          const bandY = yPosition;

          // Small colored square block — visual anchor (2025: geometric color blocking)
          pdf.setFillColor(...sectionColor);
          pdf.roundedRect(margin, bandY, 5, shH, 1.5, 1.5, "F");

          // Section number inside block
          pdf.setFontSize(7);
          pdf.setTextColor(255, 255, 255);
          const numStr = String(sectionIndex);
          const numW = pdf.getTextWidth(numStr);
          pdf.text(numStr, margin + 2.5 - numW / 2, bandY + shH / 2 + 1.2);

          // Section title — bold, large
          const stitleX = margin + 9;
          const stFontH = (cfg.section_title_size + 1) * 0.352778;
          const stCY = bandY + shH / 2;
          const stitleY = stCY + stFontH * 0.35;
          pdf.setFontSize(cfg.section_title_size + 1);
          pdf.setTextColor(...THEME.ink);
          pdf.text(sectionTitle, stitleX, stitleY);
          pdf.text(sectionTitle, stitleX + 0.16, stitleY); // faux bold

          // Extending rule — thin, elegant
          const stW = pdf.getTextWidth(sectionTitle);
          pdf.setDrawColor(...THEME.ruleLight);
          pdf.setLineWidth(0.3);
          pdf.line(stitleX + stW + 4, stCY, margin + contentWidth, stCY);

          // Small accent dot at end of rule
          pdf.setFillColor(...THEME.rule);
          pdf.circle(margin + contentWidth, stCY, 0.7, "F");

          yPosition = bandY + shH + 5;

          if (sectionTitle === "발명의 요약" && cfg.show_patent_images) await insertImages();
        } else if (cleanLine.trim()) {
          addWrappedText(cleanLine, cfg.body_font_size, THEME.body, cfg.line_height);
          yPosition += 1;
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  DISCLAIMER — 2025 Clean Info Block        ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (cfg.show_disclaimer) {
        checkNewPage(22);
        yPosition += 10;

        pdf.setFontSize(8.5);
        const disc = cfg.disclaimer_text;
        const discMaxW = contentWidth - 18;
        const discLines = pdf.splitTextToSize(disc, discMaxW);
        const discLineH = 4.2;
        const discPadY = 5;
        const discH = Math.max(14, discLines.length * discLineH + discPadY * 2);
        const dY = yPosition - 3;

        // Warm background — borderless card
        pdf.setFillColor(...THEME.warmGray);
        pdf.roundedRect(margin, dY, contentWidth, discH, 2.5, 2.5, "F");

        // Left accent — brand color bar
        pdf.setFillColor(...brandColor);
        pdf.roundedRect(margin, dY, 3, discH, 1.5, 1.5, "F");

        // "참고" label
        pdf.setFontSize(7.5);
        pdf.setTextColor(...THEME.ink);
        const labelX = margin + 8;
        const labelY = dY + discPadY + 1;
        pdf.text("참고", labelX, labelY);
        pdf.text("참고", labelX + 0.1, labelY);

        // Vertical separator
        const labelW = pdf.getTextWidth("참고");
        pdf.setDrawColor(...THEME.rule);
        pdf.setLineWidth(0.2);
        pdf.line(labelX + labelW + 3, labelY - 2, labelX + labelW + 3, labelY + 2);

        // Text
        pdf.setFontSize(8.5);
        pdf.setTextColor(...THEME.caption);
        const discTextStartX = labelX + labelW + 7;
        const discLinesAdj = pdf.splitTextToSize(disc, contentWidth - (discTextStartX - margin) - 5);
        for (let i = 0; i < discLinesAdj.length; i++) {
          pdf.text(discLinesAdj[i], discTextStartX, labelY + i * discLineH);
        }
        yPosition = dY + discH + 4;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  FOOTER — 2025 Magazine-Style Running Footer  ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        const fy = pageHeight - 10;

        // Left color block strip — consistent with header
        pdf.setFillColor(...brandColor);
        pdf.rect(0, fy - 6, 8, 20, "F");
        pdf.setFillColor(...lerpColor(brandColor, THEME.white, 0.5));
        pdf.rect(8, fy - 6, 1.5, 20, "F");

        // Top rule — single clean line
        pdf.setDrawColor(...THEME.ink);
        pdf.setLineWidth(0.35);
        pdf.line(margin, fy - 4, pageWidth - margin, fy - 4);

        // Footer text — left
        pdf.setFontSize(6.5);
        pdf.setTextColor(...THEME.caption);
        pdf.text(cfg.footer_text, margin, fy + 1);

        // Date — right
        if (cfg.footer_show_date) {
          const dateText = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
          pdf.setTextColor(...THEME.muted);
          pdf.text(dateText, pageWidth - margin - pdf.getTextWidth(dateText), fy + 1);
        }

        // Page number — centered with brand color highlight
        if (cfg.footer_show_page) {
          pdf.setFontSize(7.5);
          const pgNum = String(i);
          const pgNumW = pdf.getTextWidth(pgNum);
          const pgCX = pageWidth / 2;

          // Small brand-colored circle behind number
          pdf.setFillColor(...lerpColor(brandColor, THEME.white, 0.85));
          pdf.circle(pgCX, fy - 0.3, 3.5, "F");

          pdf.setTextColor(...lerpColor(brandColor, THEME.ink, 0.5));
          pdf.text(pgNum, pgCX - pgNumW / 2, fy + 1);

          // Total pages
          pdf.setFontSize(5.5);
          pdf.setTextColor(...THEME.muted);
          const totalTxt = `/ ${totalPages}`;
          pdf.text(totalTxt, pgCX + 4, fy + 1);
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
