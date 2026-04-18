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

// ─── Magazine-Grade Design System ───
const THEME = {
  text: [12, 14, 22] as [number, number, number],
  textSecondary: [45, 55, 75] as [number, number, number],
  textMuted: [110, 120, 140] as [number, number, number],
  textBody: [25, 32, 48] as [number, number, number],
  border: [210, 216, 224] as [number, number, number],
  borderLight: [235, 238, 243] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  paper: [252, 251, 249] as [number, number, number],
  paperDark: [245, 243, 240] as [number, number, number],
  // Strong editorial ink
  navy: [12, 28, 56] as [number, number, number],
  navyLight: [35, 60, 100] as [number, number, number],
  // Magazine emerald
  emerald: [6, 95, 70] as [number, number, number],
  emeraldDark: [4, 70, 52] as [number, number, number],
  emeraldBg: [232, 248, 242] as [number, number, number],
  gold: [180, 145, 60] as [number, number, number],
  goldLight: [220, 195, 120] as [number, number, number],
  goldBg: [255, 250, 235] as [number, number, number],
  teal: [0, 128, 115] as [number, number, number],
  tealLight: [230, 248, 246] as [number, number, number],
  amber: [190, 130, 20] as [number, number, number],
  amberBg: [255, 250, 235] as [number, number, number],
  // Score grade colors (S/A/B/C)
  gradeS: [200, 50, 70] as [number, number, number],
  gradeA: [220, 110, 30] as [number, number, number],
  gradeB: [30, 130, 200] as [number, number, number],
  gradeC: [100, 110, 130] as [number, number, number],
};

// Section color palette — chromatic index for editorial sections
const SECTION_PALETTE: [number, number, number][] = [
  [6, 95, 70],     // emerald
  [200, 80, 40],   // burnt orange
  [40, 80, 160],   // royal blue
  [150, 50, 110],  // magenta
  [180, 145, 60],  // gold
  [0, 120, 130],   // teal
  [120, 60, 160],  // purple
  [200, 50, 70],   // crimson
];

const getGradeColor = (score: number): [number, number, number] => {
  if (score >= 85) return THEME.gradeS;
  if (score >= 75) return THEME.gradeA;
  if (score >= 65) return THEME.gradeB;
  return THEME.gradeC;
};
const getGradeLetter = (score: number): string => {
  if (score >= 85) return "S";
  if (score >= 75) return "A";
  if (score >= 65) return "B";
  return "C";
};

export function PdfGenerator({
  content,
  patentNumber,
  patentData,
  layoutConfig,
  commercializationDetails,
  commercializationScore,
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

      const footerReserve = 16;

      const checkNewPage = (neededHeight: number) => {
        if (yPosition + neededHeight > pageHeight - margin - footerReserve) {
          pdf.addPage();
          yPosition = margin + 4;
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

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  COVER HEADER — Light & Clean Style     ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      const headerH = 28;
      const hY = yPosition - 2;

      // Light warm paper background
      pdf.setFillColor(...THEME.paper);
      pdf.rect(0, 0, pageWidth, headerH + margin, "F");

      // Single clean bottom border — navy thin line
      pdf.setDrawColor(...THEME.navy);
      pdf.setLineWidth(0.6);
      pdf.line(margin, headerH + margin - 1, pageWidth - margin, headerH + margin - 1);

      // Left vertical accent bar — teal/green
      const accentBarColor = hexToRgb(cfg.header_bg_color);
      pdf.setFillColor(...accentBarColor);
      pdf.rect(margin, hY + 5, 2, headerH - 6, "F");

      // Main title — dark navy on light background
      pdf.setFontSize(16);
      pdf.setTextColor(...THEME.navy);
      const titleX = margin + 8;
      pdf.text(cfg.header_title, titleX, hY + 14);
      pdf.text(cfg.header_title, titleX + 0.15, hY + 14); // faux bold
      pdf.text(cfg.header_title, titleX + 0.07, hY + 14);

      // Subtitle
      pdf.setFontSize(7.5);
      pdf.setTextColor(...THEME.textMuted);
      pdf.text(cfg.header_subtitle, titleX, hY + 20);

      // Patent number — right aligned
      const isApp = patentData?.searchType === "application";
      const displayNumber = isApp
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApp ? "출원번호" : "등록번호";

      // Number label
      pdf.setFontSize(6);
      pdf.setTextColor(...THEME.textMuted);
      const nlW = pdf.getTextWidth(numberLabel);
      pdf.text(numberLabel, pageWidth - margin - nlW, hY + 11);

      // Thin separator
      pdf.setDrawColor(...THEME.border);
      pdf.setLineWidth(0.25);
      const sepStartX = pageWidth - margin - Math.max(nlW, pdf.getTextWidth(displayNumber)) - 2;
      pdf.line(sepStartX, hY + 13.5, pageWidth - margin, hY + 13.5);

      // Number value
      pdf.setFontSize(11);
      pdf.setTextColor(...THEME.navy);
      const dnW = pdf.getTextWidth(displayNumber);
      pdf.text(displayNumber, pageWidth - margin - dnW, hY + 19);
      pdf.text(displayNumber, pageWidth - margin - dnW + 0.1, hY + 19);

      // Date
      pdf.setFontSize(5.5);
      pdf.setTextColor(...THEME.textMuted);
      const genDate = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
      const gdW = pdf.getTextWidth(genDate);
      pdf.text(genDate, pageWidth - margin - gdW, hY + 24);

      yPosition = headerH + margin + 5;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  PATENT INFO CARD — Book meta block   ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (patentData && cfg.show_patent_meta) {
        const title = patentData.titleKo || patentData.title || "";
        const metaAccent = hexToRgb(cfg.meta_accent_color || "#3278c8");

        // Calculate card height
        let innerH = 6;
        pdf.setFontSize(11);
        const titleLines = title ? pdf.splitTextToSize(title, contentWidth - 16) : [];
        const titleLineCount = Math.min(titleLines.length, 2);
        if (title) innerH += titleLineCount * 5.5 + 2;

        const metaParts: string[] = [];
        if (patentData.assignee) metaParts.push(`출원인: ${patentData.assignee}`);
        if (patentData.inventors?.length) metaParts.push(`발명자: ${patentData.inventors.join(", ")}`);
        if (patentData.filingDate) metaParts.push(`출원일: ${patentData.filingDate}`);
        if (patentData.publicationDate) metaParts.push(`${patentData.registrationNumber ? '등록일' : '공개일'}: ${patentData.publicationDate}`);

        if (metaParts.length > 0) {
          pdf.setFontSize(7.5);
          const metaText = metaParts.join("  |  ");
          const metaLines = pdf.splitTextToSize(metaText, contentWidth - 14);
          innerH += 4 + metaLines.length * 3.8;
        }
        innerH += 2;

        const cardStartY = yPosition;
        const metaCardH = innerH;

        // Elegant card — warm paper background with fine border
        pdf.setFillColor(...THEME.paper);
        pdf.setDrawColor(...THEME.border);
        pdf.setLineWidth(0.35);
        pdf.roundedRect(margin, yPosition, contentWidth, metaCardH, 2, 2, "FD");

        // Top gold accent line inside card
        pdf.setFillColor(...THEME.gold);
        pdf.rect(margin + 6, yPosition, contentWidth - 12, 0.8, "F");

        // Left accent bar — teal/blue
        pdf.setFillColor(...metaAccent);
        pdf.rect(margin, yPosition, 2.5, metaCardH, "F");

        yPosition += 5;

        // Title — editorial weight
        if (title) {
          pdf.setFontSize(10.5);
          pdf.setTextColor(...THEME.text);
          for (let i = 0; i < titleLineCount; i++) {
            const tLine = titleLines[i] + (i === 0 && titleLines.length > 2 ? "…" : "");
            pdf.text(tLine, margin + 7, yPosition + 2 + i * 5.5);
            pdf.text(tLine, margin + 7.12, yPosition + 2 + i * 5.5); // faux bold
          }
          yPosition += titleLineCount * 5.5 + 2;
        }

        // Fine separator
        if (metaParts.length > 0) {
          pdf.setDrawColor(...THEME.borderLight);
          pdf.setLineWidth(0.2);
          pdf.line(margin + 7, yPosition + 0.5, margin + contentWidth - 6, yPosition + 0.5);
          yPosition += 4;

          pdf.setFontSize(7.5);
          pdf.setTextColor(...THEME.textSecondary);
          const metaText = metaParts.join("  |  ");
          const metaLines = pdf.splitTextToSize(metaText, contentWidth - 14);
          for (const ml of metaLines) {
            pdf.text(ml, margin + 7, yPosition);
            yPosition += 3.8;
          }
        }

        yPosition = cardStartY + metaCardH + 6;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  CONTENT SECTIONS                   ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
          const imgH = 48;
          const gap = 4;
          const totalW = contentWidth - 6;
          const imgW = (totalW - gap * (imagesToUse.length - 1)) / imagesToUse.length;

          for (let i = 0; i < imagesToUse.length; i++) {
            const img = await loadImageForPdf(imagesToUse[i]);
            if (!img) continue;
            const imgX = margin + 3 + i * (imgW + gap);
            // Clean border frame
            pdf.setFillColor(255, 255, 255);
            pdf.setDrawColor(...THEME.border);
            pdf.setLineWidth(0.3);
            pdf.roundedRect(imgX, yPosition, imgW, imgH, 1.5, 1.5, "FD");
            pdf.addImage(img.dataUrl, img.format, imgX + 1.5, yPosition + 1.5, imgW - 3, imgH - 3);
          }
          yPosition += imgH + 3;
        } else {
          const img = await loadImageForPdf(imagesToUse[0]);
          if (img) {
            const imgW = 68;
            const imgH = 52;
            const imgX = (pageWidth - imgW) / 2;
            pdf.setFillColor(255, 255, 255);
            pdf.setDrawColor(...THEME.border);
            pdf.setLineWidth(0.3);
            pdf.roundedRect(imgX, yPosition, imgW, imgH, 1.5, 1.5, "FD");
            pdf.addImage(img.dataUrl, img.format, imgX + 2, yPosition + 2, imgW - 4, imgH - 4);
            yPosition += imgH + 3;
          }
        }

        // Caption
        pdf.setFontSize(6.5);
        pdf.setTextColor(...THEME.textMuted);
        const cap = imagesToUse.length > 1 ? "〈 특허 도면 〉" : "〈 대표 도면 〉";
        const capW = pdf.getTextWidth(cap);
        pdf.text(cap, (pageWidth - capW) / 2, yPosition + 1);
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
          if (!cfg.show_claims && (sectionTitle.includes("청구항") || sectionTitle.includes("특허 청구"))) { skipSection = true; continue; }

          const bodyPreview = estimateBodyHeight(lines, li + 1, cfg.body_font_size, pageWidth - margin * 2 - 8, cfg.line_height);
          const neededForSection = 18 + bodyPreview;
          checkNewPage(neededForSection);
          yPosition += 6;

          sectionIndex++;

          // ── Publication-style Section Header ──
          const sectionHeaderH = 9;
          const bandY = yPosition;

          // Clean horizontal rule above
          pdf.setDrawColor(...THEME.border);
          pdf.setLineWidth(0.3);
          pdf.line(margin, bandY - 1, margin + contentWidth, bandY - 1);

          // Left accent — thick vertical bar with gold trim
          pdf.setFillColor(...accentColor);
          pdf.rect(margin, bandY, 3, sectionHeaderH, "F");
          // Gold cap on accent bar
          pdf.setFillColor(...THEME.gold);
          pdf.rect(margin, bandY, 3, 1.2, "F");

          // Section title — clean, bold, editorial
          const stitleX = margin + 8;
          const titleFontH = (cfg.section_title_size + 0.5) * 0.352778;
          const centerY = bandY + sectionHeaderH / 2;
          const stitleY = centerY + titleFontH * 0.35;
          pdf.setFontSize(cfg.section_title_size + 0.5);
          pdf.setTextColor(...THEME.navy);
          pdf.text(sectionTitle, stitleX, stitleY);
          pdf.text(sectionTitle, stitleX + 0.15, stitleY); // faux bold

          // Subtle extending rule after title
          const stW = pdf.getTextWidth(sectionTitle);
          pdf.setDrawColor(...THEME.borderLight);
          pdf.setLineWidth(0.25);
          pdf.line(stitleX + stW + 4, centerY, margin + contentWidth, centerY);

          yPosition = bandY + sectionHeaderH + 4;

          if (sectionTitle === "발명의 요약" && cfg.show_patent_images) await insertImages();
        } else if (cleanLine.trim()) {
          addWrappedText(cleanLine, cfg.body_font_size, THEME.textBody, cfg.line_height);
          yPosition += 1;
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  DISCLAIMER — Refined Alert Bar       ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (cfg.show_disclaimer) {
        checkNewPage(22);
        yPosition += 10;

        // Dynamically size the disclaimer box based on text length
        pdf.setFontSize(8.5);
        const disc = cfg.disclaimer_text;
        const discMaxW = contentWidth - 20;
        const discLines = pdf.splitTextToSize(disc, discMaxW);
        const discLineH = 4.2;
        const discPadY = 5;
        const discH = Math.max(14, discLines.length * discLineH + discPadY * 2);
        const dY = yPosition - 3;

        // Clean white background with visible border
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(...THEME.border);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(margin, dY, contentWidth, discH, 2.5, 2.5, "FD");

        // Left accent bar — uses header accent color
        const disclaimerAccent = hexToRgb(cfg.header_bg_color);
        pdf.setFillColor(...disclaimerAccent);
        pdf.rect(margin, dY, 3, discH, "F");

        // "참고" label — bold, dark
        pdf.setFontSize(8);
        pdf.setTextColor(...THEME.navy);
        const labelX = margin + 8;
        const labelY = dY + discPadY + 1;
        pdf.text("참고", labelX, labelY);
        pdf.text("참고", labelX + 0.12, labelY); // faux bold

        // Thin separator after label
        const labelW = pdf.getTextWidth("참고");
        pdf.setDrawColor(...THEME.borderLight);
        pdf.setLineWidth(0.2);
        pdf.line(labelX + labelW + 3, labelY - 1.5, labelX + labelW + 3, labelY + 1.5);

        // Disclaimer text — larger, darker, more readable
        pdf.setFontSize(8.5);
        pdf.setTextColor(...THEME.textSecondary);
        const discTextStartX = labelX + labelW + 7;
        const discLinesAdjusted = pdf.splitTextToSize(disc, contentWidth - (discTextStartX - margin) - 6);
        for (let i = 0; i < discLinesAdjusted.length; i++) {
          pdf.text(discLinesAdjusted[i], discTextStartX, labelY + i * discLineH);
        }
        yPosition = dY + discH + 4;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  KIPRIS 특허상세보기 링크                    ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (patentData?.applicationNumber) {
        checkNewPage(14);
        const kiprisUrl = `https://www.kipris.or.kr/khome/detail/newWindow.do?right=kpat&applno=${patentData.applicationNumber}`;
        const linkY = yPosition + 2;

        // Link icon + text
        pdf.setFontSize(7.5);
        pdf.setTextColor(...THEME.navy);
        const linkLabel = "🔗 특허상세보기 (KIPRIS)";
        pdf.text(linkLabel, margin, linkY);
        pdf.text(linkLabel, margin + 0.12, linkY); // faux bold

        pdf.setFontSize(6.5);
        pdf.setTextColor(...THEME.textMuted);
        pdf.textWithLink(kiprisUrl, margin, linkY + 5, { url: kiprisUrl });

        // Underline the URL
        const urlW = pdf.getTextWidth(kiprisUrl);
        pdf.setDrawColor(...THEME.textMuted);
        pdf.setLineWidth(0.2);
        pdf.line(margin, linkY + 5.5, margin + urlW, linkY + 5.5);

        yPosition = linkY + 12;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  FOOTER — Book-style running footer       ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        const fy = pageHeight - 10;

        // Clean top rule — thin navy line
        pdf.setDrawColor(...THEME.navy);
        pdf.setLineWidth(0.4);
        pdf.line(margin, fy - 3, pageWidth - margin, fy - 3);

        // Secondary thin line for book feel
        pdf.setDrawColor(...THEME.borderLight);
        pdf.setLineWidth(0.15);
        pdf.line(margin, fy - 1.8, pageWidth - margin, fy - 1.8);

        // Footer text — left side
        pdf.setFontSize(6.5);
        pdf.setTextColor(...THEME.textSecondary);
        pdf.text(cfg.footer_text, margin, fy + 2);

        // Date — right side
        if (cfg.footer_show_date) {
          const dateText = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
          pdf.setTextColor(...THEME.textMuted);
          pdf.text(dateText, pageWidth - margin - pdf.getTextWidth(dateText), fy + 2);
        }

        // Page number — centered, book style
        if (cfg.footer_show_page) {
          const pgText = `— ${i} / ${totalPages} —`;
          pdf.setFontSize(7);
          pdf.setTextColor(...THEME.textMuted);
          const pgW = pdf.getTextWidth(pgText);
          pdf.text(pgText, (pageWidth - pgW) / 2, fy + 2);
        }

        // Side margin decorative line (book gutter hint) — only on non-cover pages
        if (i > 1) {
          pdf.setDrawColor(...THEME.borderLight);
          pdf.setLineWidth(0.15);
          pdf.line(margin - 2, margin, margin - 2, pageHeight - margin);
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
