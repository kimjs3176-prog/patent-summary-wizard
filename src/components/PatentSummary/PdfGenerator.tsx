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

      const isApp = patentData?.searchType === "application";
      const displayNumber = isApp
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApp ? "출원번호" : "등록번호";

      // ===== HELPER: wrapped text =====
      const addWrappedText = (text: string, fontSize: number, color: [number, number, number], lineHeight = 1.7, indentX = margin + 2, maxY?: number): boolean => {
        const maxW = pageWidth - indentX - margin - 2;
        const lhMm = fontSize * 0.352778 * lineHeight;
        const segments = text.split(/(\*\*[^*]+\*\*)/g);
        const plainText = text.replace(/\*\*/g, '');
        pdf.setFontSize(fontSize);
        const wrappedLines = pdf.splitTextToSize(plainText, maxW);

        let charIdx = 0;
        for (const wLine of wrappedLines) {
          if (maxY && yPosition + lhMm > maxY) return false; // overflow

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
        return true;
      };

      // ===== HELPER: section header band =====
      const drawSectionHeader = (title: string) => {
        yPosition += 4;
        const sectionHeaderH = 8;
        const bandY = yPosition - 4;
        pdf.setFillColor(THEME.sectionBg[0], THEME.sectionBg[1], THEME.sectionBg[2]);
        pdf.roundedRect(margin, bandY, contentWidth, sectionHeaderH, 1.5, 1.5, "F");
        pdf.setFillColor(...accentColor);
        pdf.roundedRect(margin, bandY, 2.5, sectionHeaderH, 0.8, 0.8, "F");
        pdf.setFontSize(cfg.section_title_size);
        pdf.setTextColor(...accentColor);
        pdf.text(title, margin + 6, yPosition);
        pdf.text(title, margin + 6 + 0.2, yPosition); // bold sim
        yPosition += sectionHeaderH + 2;
      };

      // ===== HELPER: load image =====
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

      // =============================================
      // PAGE 1: Header + Patent Info + Score + TRL
      // =============================================

      // ── Header Bar ──
      const headerH = 18;
      pdf.setFillColor(...headerColor);
      pdf.roundedRect(margin, yPosition, contentWidth, headerH, 3, 3, "F");
      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      pdf.text(cfg.header_title, margin + 7, yPosition + 7.5);
      pdf.setFontSize(7);
      pdf.setTextColor(220, 240, 230);
      pdf.text(cfg.header_subtitle, margin + 7, yPosition + 12.5);

      pdf.setFontSize(6.5);
      pdf.setTextColor(200, 230, 215);
      pdf.text(numberLabel, pageWidth - margin - pdf.getTextWidth(numberLabel) - 7, yPosition + 7);
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text(displayNumber, pageWidth - margin - pdf.getTextWidth(displayNumber) - 7, yPosition + 12);
      yPosition += headerH + 5;

      // ── Patent Meta Card ──
      if (patentData && cfg.show_patent_meta) {
        const title = patentData.titleKo || patentData.title || "";
        const metaBg = hexToRgb(cfg.meta_bg_color || "#e6f3ff");
        const metaAccent = hexToRgb(cfg.meta_accent_color || "#3278c8");

        let innerH = 5;
        pdf.setFontSize(11);
        const titleLines = title ? pdf.splitTextToSize(title, contentWidth - 14) : [];
        const titleLineCount = Math.min(titleLines.length, 2);
        if (title) innerH += titleLineCount * 5 + 2;

        const metaParts: string[] = [];
        if (patentData.assignee) metaParts.push(`출원인: ${patentData.assignee}`);
        if (patentData.inventors?.length) metaParts.push(`발명자: ${patentData.inventors.join(", ")}`);
        if (patentData.filingDate) metaParts.push(`출원일: ${patentData.filingDate}`);
        if (patentData.publicationDate) metaParts.push(`${patentData.registrationNumber ? '등록일' : '공개일'}: ${patentData.publicationDate}`);

        if (metaParts.length > 0) {
          pdf.setFontSize(7);
          const metaText = metaParts.join("  |  ");
          const metaLines = pdf.splitTextToSize(metaText, contentWidth - 14);
          innerH += 3 + metaLines.length * 3.2;
        }
        innerH += 2;

        const cardStartY = yPosition;
        pdf.setFillColor(...metaBg);
        pdf.setDrawColor(190, 215, 240);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, yPosition, contentWidth, innerH, 2, 2, "FD");
        pdf.setFillColor(...metaAccent);
        pdf.rect(margin, yPosition, 2.5, innerH, "F");

        yPosition += 5;
        if (title) {
          pdf.setFontSize(11);
          pdf.setTextColor(...THEME.text);
          for (let i = 0; i < titleLineCount; i++) {
            pdf.text(titleLines[i] + (i === 0 && titleLines.length > 2 ? "..." : ""), margin + 6, yPosition + 2 + i * 5);
          }
          yPosition += titleLineCount * 5 + 2;
        }
        if (metaParts.length > 0) {
          pdf.setFontSize(7);
          pdf.setTextColor(...THEME.textMuted);
          const metaText = metaParts.join("  |  ");
          const metaLines = pdf.splitTextToSize(metaText, contentWidth - 10);
          for (const ml of metaLines) {
            pdf.text(ml, margin + 6, yPosition + 3);
            yPosition += 3.2;
          }
        }
        yPosition = cardStartY + innerH + 5;
      }

      // ── Patent Images (compact, side by side) ──
      if (cfg.show_patent_images && patentData) {
        const imagesToUse = patentData.images?.slice(0, 3) || (patentData.representativeImage ? [patentData.representativeImage] : []);
        if (imagesToUse.length > 0) {
          const imgH = 32;
          const gap = 2;
          const totalW = contentWidth - 4;
          const imgW = imagesToUse.length > 1
            ? (totalW - gap * (imagesToUse.length - 1)) / imagesToUse.length
            : 50;
          const startX = imagesToUse.length === 1 ? (pageWidth - imgW) / 2 : margin + 2;

          for (let i = 0; i < imagesToUse.length; i++) {
            const img = await loadImageForPdf(imagesToUse[i]);
            if (!img) continue;
            const imgX = startX + i * (imgW + gap);
            pdf.setDrawColor(...THEME.border);
            pdf.setLineWidth(0.2);
            pdf.roundedRect(imgX - 0.5, yPosition - 0.5, imgW + 1, imgH + 1, 1, 1, "D");
            pdf.addImage(img.dataUrl, img.format, imgX, yPosition, imgW, imgH);
          }
          yPosition += imgH + 1.5;
          pdf.setFontSize(5.5);
          pdf.setTextColor(...THEME.textMuted);
          const cap = "【특허 도면】";
          pdf.text(cap, (pageWidth - pdf.getTextWidth(cap)) / 2, yPosition);
          yPosition += 4;
        }
      }

      // ── Commercialization Score Section ──
      if (commercializationScore != null && commercializationDetails) {
        drawSectionHeader("AI 기술사업화점수");

        const scoreColor: [number, number, number] = commercializationScore >= 80 ? [16, 185, 129]
          : commercializationScore >= 60 ? [59, 130, 246]
          : commercializationScore >= 40 ? [245, 158, 11]
          : [239, 68, 68];

        const gradeLabel = commercializationScore >= 80 ? "매우 우수" : commercializationScore >= 60 ? "우수" : commercializationScore >= 40 ? "보통" : "미흡";
        const gradeLetter = commercializationScore >= 80 ? "S" : commercializationScore >= 60 ? "A" : commercializationScore >= 40 ? "B" : "C";

        // Score display
        pdf.setFontSize(22);
        pdf.setTextColor(...scoreColor);
        pdf.text(`${commercializationScore}`, margin + 4, yPosition + 2);
        pdf.setFontSize(9);
        pdf.setTextColor(...THEME.textMuted);
        pdf.text("/ 100", margin + 4 + pdf.getTextWidth(`${commercializationScore}`) + 2, yPosition + 2);
        
        pdf.setFontSize(14);
        pdf.setTextColor(...scoreColor);
        pdf.text(gradeLetter, margin + 55, yPosition);
        pdf.setFontSize(8);
        pdf.text(gradeLabel, margin + 55, yPosition + 5);

        yPosition += 10;

        // Sub-scores bar
        const subScores = [
          { label: "기술성", score: commercializationDetails.technologyScore },
          { label: "시장성", score: commercializationDetails.marketScore },
          { label: "사업성", score: commercializationDetails.businessScore },
        ];

        const barW = (contentWidth - 8) / 3;
        subScores.forEach((sub, i) => {
          const bx = margin + 2 + i * (barW + 2);
          // Label
          pdf.setFontSize(7);
          pdf.setTextColor(...THEME.textMuted);
          pdf.text(sub.label, bx, yPosition);
          // Bar bg
          pdf.setFillColor(230, 233, 240);
          pdf.roundedRect(bx, yPosition + 1, barW - 2, 3, 1, 1, "F");
          // Bar fill
          const subColor: [number, number, number] = sub.score >= 80 ? [16, 185, 129] : sub.score >= 60 ? [59, 130, 246] : sub.score >= 40 ? [245, 158, 11] : [239, 68, 68];
          pdf.setFillColor(...subColor);
          pdf.roundedRect(bx, yPosition + 1, (barW - 2) * sub.score / 100, 3, 1, 1, "F");
          // Score text
          pdf.setFontSize(7);
          pdf.setTextColor(...THEME.text);
          pdf.text(`${sub.score}`, bx + barW - 6, yPosition);
        });
        yPosition += 8;

        // Sub-score reasons (compact)
        const reasons = [
          { label: "기술성", reason: commercializationDetails.technologyReason },
          { label: "시장성", reason: commercializationDetails.marketReason },
          { label: "사업성", reason: commercializationDetails.businessReason },
        ].filter(r => r.reason);

        if (reasons.length > 0) {
          for (const r of reasons) {
            pdf.setFontSize(7);
            pdf.setTextColor(...accentColor);
            pdf.text(`▸ ${r.label}:`, margin + 3, yPosition);
            pdf.setFontSize(7);
            pdf.setTextColor(...THEME.textBody);
            const reasonLines = pdf.splitTextToSize(r.reason!, contentWidth - 25);
            const line1 = reasonLines[0] || "";
            pdf.text(line1, margin + 18, yPosition);
            yPosition += 3.5;
            if (reasonLines.length > 1) {
              pdf.text(reasonLines[1] + (reasonLines.length > 2 ? "..." : ""), margin + 3, yPosition);
              yPosition += 3.5;
            }
          }
          yPosition += 1;
        }

        // Analysis opinion (compact)
        if (commercializationDetails.analysis) {
          pdf.setFillColor(248, 250, 252);
          const analysisLines = pdf.splitTextToSize(commercializationDetails.analysis, contentWidth - 10);
          const maxAnalysisLines = Math.min(analysisLines.length, 3);
          const boxH = maxAnalysisLines * 3.5 + 4;
          pdf.roundedRect(margin, yPosition, contentWidth, boxH, 1.5, 1.5, "F");
          pdf.setFontSize(6.5);
          pdf.setTextColor(...THEME.textMuted);
          pdf.text("AI 분석 의견", margin + 3, yPosition + 3);
          pdf.setFontSize(7);
          pdf.setTextColor(...THEME.textBody);
          for (let i = 0; i < maxAnalysisLines; i++) {
            pdf.text(analysisLines[i] + (i === maxAnalysisLines - 1 && analysisLines.length > maxAnalysisLines ? "..." : ""), margin + 3, yPosition + 7 + i * 3.5);
          }
          yPosition += boxH + 3;
        }
      }

      // ── TRL Section ──
      if (commercializationDetails?.trl) {
        drawSectionHeader("기술성숙도(TRL)");

        const trl = commercializationDetails.trl;
        const trlLabels = ["기본원리", "개념정립", "핵심기능 검증", "실험실 검증", "유사환경 검증", "파일럿 시험", "시제품 시연", "실제 시스템 완성", "상용화"];
        const trlLabel = trlLabels[trl - 1] || "";

        // TRL badge + label
        const badgeColor: [number, number, number] = trl <= 3 ? [239, 68, 68] : trl <= 6 ? [245, 158, 11] : [16, 185, 129];
        pdf.setFillColor(...badgeColor);
        pdf.roundedRect(margin + 2, yPosition - 4, 12, 12, 2, 2, "F");
        pdf.setFontSize(14);
        pdf.setTextColor(255, 255, 255);
        pdf.text(`${trl}`, margin + 2 + 6 - pdf.getTextWidth(`${trl}`) / 2, yPosition + 4);

        pdf.setFontSize(9);
        pdf.setTextColor(...THEME.text);
        pdf.text(`TRL ${trl} - ${trlLabel}`, margin + 17, yPosition);
        
        const stageName = trl <= 3 ? "기초연구 단계" : trl <= 6 ? "개발/실증 단계" : "상용화 준비 단계";
        pdf.setFontSize(7);
        pdf.setTextColor(...THEME.textMuted);
        pdf.text(stageName, margin + 17, yPosition + 4.5);

        pdf.setFontSize(7);
        const remainText = `상용화까지 ${9 - trl} 단계`;
        pdf.text(remainText, pageWidth - margin - pdf.getTextWidth(remainText) - 2, yPosition + 1);

        yPosition += 10;

        // Gradient progress bar
        const barY = yPosition;
        const barH = 4;
        pdf.setFillColor(230, 233, 240);
        pdf.roundedRect(margin + 2, barY, contentWidth - 4, barH, 1.5, 1.5, "F");

        // Draw filled portion with gradient simulation (multiple segments)
        const filledW = (contentWidth - 4) * (trl / 9);
        const segCount = 20;
        const segW = filledW / segCount;
        for (let s = 0; s < segCount; s++) {
          const t = s / segCount;
          const r = Math.round(252 - t * 236);
          const g = Math.round(165 + t * (150 - 165) * (t < 0.3 ? 1 : -1));
          const b = Math.round(165 * (1 - t) + 105 * t);
          // Simple gradient: red → amber → green
          const gr = t < 0.3 ? Math.round(252 - t * 200) : t < 0.6 ? Math.round(251 - t * 50) : Math.round(16 + (1 - t) * 30);
          const gg = t < 0.3 ? Math.round(165 + t * 200) : t < 0.6 ? Math.round(191 + t * 10) : Math.round(185 - (1 - t) * 20);
          const gb = t < 0.3 ? Math.round(165 - t * 100) : t < 0.6 ? Math.round(24 + t * 10) : Math.round(129 - (1 - t) * 30);
          pdf.setFillColor(gr, gg, gb);
          pdf.rect(margin + 2 + s * segW, barY, segW + 0.5, barH, "F");
        }
        // Round the ends
        pdf.setFillColor(230, 233, 240);
        pdf.roundedRect(margin + 2, barY, contentWidth - 4, barH, 1.5, 1.5, "S");

        yPosition += barH + 3;

        // Level dots
        for (let lv = 1; lv <= 9; lv++) {
          const dotX = margin + 2 + (contentWidth - 4) * ((lv - 0.5) / 9);
          const isActive = lv <= trl;
          const isCurrent = lv === trl;
          if (isCurrent) {
            pdf.setFillColor(...badgeColor);
            pdf.circle(dotX, yPosition, 1.5, "F");
          } else if (isActive) {
            pdf.setFillColor(120, 130, 140);
            pdf.circle(dotX, yPosition, 0.8, "F");
          } else {
            pdf.setFillColor(200, 210, 220);
            pdf.circle(dotX, yPosition, 0.8, "F");
          }
          pdf.setFontSize(5.5);
          pdf.setTextColor(isCurrent ? badgeColor[0] : 150, isCurrent ? badgeColor[1] : 155, isCurrent ? badgeColor[2] : 160);
          pdf.text(`${lv}`, dotX - pdf.getTextWidth(`${lv}`) / 2, yPosition + 3.5);
        }
        yPosition += 7;

        // Stage cards
        const stageW = (contentWidth - 8) / 3;
        const stageData = [
          { name: "기초연구", range: "TRL 1-3", active: trl <= 3, color: [254, 226, 226] as [number, number, number] },
          { name: "개발/실증", range: "TRL 4-6", active: trl >= 4 && trl <= 6, color: [254, 243, 199] as [number, number, number] },
          { name: "상용화", range: "TRL 7-9", active: trl >= 7, color: [209, 250, 229] as [number, number, number] },
        ];
        stageData.forEach((st, i) => {
          const sx = margin + 2 + i * (stageW + 2);
          if (st.active) {
            pdf.setFillColor(...st.color);
          } else {
            pdf.setFillColor(245, 247, 250);
          }
          pdf.roundedRect(sx, yPosition, stageW, 8, 1.5, 1.5, "F");
          pdf.setFontSize(7);
          pdf.setTextColor(st.active ? 50 : 160, st.active ? 55 : 165, st.active ? 60 : 170);
          pdf.text(st.name, sx + stageW / 2 - pdf.getTextWidth(st.name) / 2, yPosition + 3.5);
          pdf.setFontSize(5.5);
          pdf.text(st.range, sx + stageW / 2 - pdf.getTextWidth(st.range) / 2, yPosition + 6.5);
        });
        yPosition += 11;

        // TRL Reason
        if (commercializationDetails.trlReason) {
          pdf.setFillColor(245, 250, 248);
          const trlReasonLines = pdf.splitTextToSize(commercializationDetails.trlReason, contentWidth - 10);
          const maxLines = Math.min(trlReasonLines.length, 3);
          const boxH = maxLines * 3.5 + 4;
          pdf.roundedRect(margin, yPosition, contentWidth, boxH, 1.5, 1.5, "F");
          pdf.setFontSize(6.5);
          pdf.setTextColor(...THEME.textMuted);
          pdf.text("TRL 추정 근거", margin + 3, yPosition + 3);
          pdf.setFontSize(7);
          pdf.setTextColor(...THEME.textBody);
          for (let i = 0; i < maxLines; i++) {
            pdf.text(trlReasonLines[i] + (i === maxLines - 1 && trlReasonLines.length > maxLines ? "..." : ""), margin + 3, yPosition + 7 + i * 3.5);
          }
          yPosition += boxH + 2;
        }
      }

      // =============================================
      // PAGE 2: AI 종합 요약
      // =============================================
      pdf.addPage();
      yPosition = margin;

      // Page 2 mini-header
      const miniHeaderH = 10;
      pdf.setFillColor(...headerColor);
      pdf.roundedRect(margin, yPosition, contentWidth, miniHeaderH, 2, 2, "F");
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text("AI 종합 요약", margin + 5, yPosition + 6.5);
      pdf.setFontSize(6.5);
      pdf.setTextColor(200, 230, 215);
      pdf.text(displayNumber, pageWidth - margin - pdf.getTextWidth(displayNumber) - 5, yPosition + 6.5);
      yPosition += miniHeaderH + 5;

      // Parse and render AI summary content (fit within single page)
      const lines = content.split("\n");
      let skipSection = false;
      const maxContentY = pageHeight - margin - 18; // leave room for footer + disclaimer

      const isDuplicatePatentInfo = (text: string): boolean => {
        return (
          /등록번호[는:\s]/.test(text) || /출원번호[는:\s]/.test(text) ||
          text.includes("발명의 명칭은") || text.includes("출원인/권리자는") ||
          text.includes("출원일/등록일은") || text.includes("발명자는") ||
          (displayNumber && text.includes(displayNumber))
        );
      };

      let overflowed = false;

      for (let li = 0; li < lines.length; li++) {
        if (overflowed) break;
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

          if (yPosition + 12 > maxContentY) { overflowed = true; break; }
          drawSectionHeader(sectionTitle);
        } else if (cleanLine.trim()) {
          const ok = addWrappedText(cleanLine, cfg.body_font_size, THEME.textBody, cfg.line_height, margin + 2, maxContentY);
          if (!ok) { overflowed = true; break; }
          yPosition += 1;
        }
      }

      // Disclaimer on page 2
      if (cfg.show_disclaimer) {
        // Position near bottom
        const discY = pageHeight - margin - 12;
        if (yPosition < discY) yPosition = discY;
        const discH = 7;
        pdf.setFillColor(255, 248, 230);
        pdf.setDrawColor(240, 220, 180);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, yPosition, contentWidth, discH, 1.5, 1.5, "FD");
        pdf.setFontSize(6);
        pdf.setTextColor(140, 110, 50);
        const disc = `⚠ ${cfg.disclaimer_text}`;
        pdf.text(disc, (pageWidth - pdf.getTextWidth(disc)) / 2, yPosition + 4);
      }

      // Footer on all pages
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        const fy = pageHeight - 5;
        pdf.setFillColor(THEME.sectionBg[0], THEME.sectionBg[1], THEME.sectionBg[2]);
        pdf.rect(0, fy - 4, pageWidth, 10, "F");
        pdf.setDrawColor(...THEME.border);
        pdf.setLineWidth(0.2);
        pdf.line(margin, fy - 2.5, pageWidth - margin, fy - 2.5);
        pdf.setFontSize(5.5);
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
