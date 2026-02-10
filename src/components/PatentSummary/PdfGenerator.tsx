import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { PatentData } from "./types";
import { loadKoreanFont, addKoreanFontToDoc } from "@/lib/koreanFont";
import { CommercializationDetails } from "./TechnologyCommercializationScore";

interface PdfGeneratorProps {
  content: string;
  patentNumber: string;
  patentData?: PatentData | null;
  printRef: React.RefObject<HTMLDivElement | null>;
  commercializationDetails?: CommercializationDetails | null;
  commercializationScore?: number | null;
}

// ===== Color helpers =====
function getScoreColorRgb(value: number): [number, number, number] {
  if (value >= 80) return [76, 175, 80];
  if (value >= 60) return [33, 150, 243];
  if (value >= 40) return [255, 193, 7];
  return [244, 67, 54];
}

function getGradeLabel(value: number): string {
  if (value >= 90) return "S";
  if (value >= 80) return "A";
  if (value >= 70) return "B";
  if (value >= 60) return "C";
  if (value >= 50) return "D";
  return "F";
}

function getScoreLabel(value: number): string {
  if (value >= 90) return "매우 우수";
  if (value >= 80) return "우수";
  if (value >= 70) return "양호";
  if (value >= 60) return "보통";
  if (value >= 50) return "미흡";
  return "개선 필요";
}

function getTrlStageLabel(trl: number): string {
  if (trl <= 3) return "기초연구";
  if (trl <= 6) return "실험/시험";
  return "실용화/상용화";
}

// Theme colors matching web CSS
const THEME = {
  bgDark: [30, 38, 30] as [number, number, number],       // --background approx
  cardBg: [38, 46, 36] as [number, number, number],        // --card approx
  cardBgLight: [45, 55, 43] as [number, number, number],   // --secondary approx
  primary: [76, 140, 60] as [number, number, number],      // --primary green
  accent: [210, 140, 40] as [number, number, number],      // --accent orange
  text: [235, 232, 225] as [number, number, number],       // --foreground
  textMuted: [140, 140, 130] as [number, number, number],  // --muted-foreground
  textDim: [180, 178, 170] as [number, number, number],
  border: [255, 255, 255] as [number, number, number],     // for alpha overlay
  headerGreen: [34, 85, 64] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

export function PdfGenerator({ 
  content, 
  patentNumber, 
  patentData,
  commercializationDetails,
  commercializationScore
}: PdfGeneratorProps) {
  const handlePdfDownload = async () => {
    if (!content) {
      toast.error("PDF 생성에 실패했습니다.");
      return;
    }

    toast.info("PDF 생성 중... (폰트 로딩 중)");

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
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      let yPosition = margin;

      // ===== Utility functions =====
      const checkNewPage = (neededHeight: number) => {
        if (yPosition + neededHeight > pageHeight - margin - 12) {
          pdf.addPage();
          // Draw page background
          pdf.setFillColor(THEME.bgDark[0], THEME.bgDark[1], THEME.bgDark[2]);
          pdf.rect(0, 0, pageWidth, pageHeight, "F");
          yPosition = margin;
          return true;
        }
        return false;
      };

      const drawCard = (x: number, y: number, w: number, h: number, r: number = 4) => {
        // Card background
        pdf.setFillColor(THEME.cardBg[0], THEME.cardBg[1], THEME.cardBg[2]);
        pdf.setDrawColor(60, 70, 58);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, y, w, h, r, r, "FD");
      };

      const drawSubCard = (x: number, y: number, w: number, h: number) => {
        pdf.setFillColor(THEME.cardBgLight[0], THEME.cardBgLight[1], THEME.cardBgLight[2]);
        pdf.setDrawColor(60, 70, 58);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(x, y, w, h, 3, 3, "FD");
      };

      const drawProgressBar = (x: number, y: number, w: number, h: number, pct: number, color: [number, number, number]) => {
        // Background
        pdf.setFillColor(50, 55, 48);
        pdf.roundedRect(x, y, w, h, h / 2, h / 2, "F");
        // Fill
        if (pct > 0) {
          pdf.setFillColor(color[0], color[1], color[2]);
          const fillW = Math.max(h, (pct / 100) * w);
          pdf.roundedRect(x, y, fillW, h, h / 2, h / 2, "F");
        }
      };

      const addWrappedText = (text: string, fontSize: number, color: [number, number, number], lineHeight: number = 1.6, indentX: number = margin + 5) => {
        pdf.setFontSize(fontSize);
        pdf.setTextColor(color[0], color[1], color[2]);
        const maxW = pageWidth - indentX - margin - 2;
        const lines = pdf.splitTextToSize(text, maxW);
        const lineHeightMm = fontSize * 0.352778 * lineHeight;

        for (const line of lines) {
          checkNewPage(lineHeightMm);
          pdf.text(line, indentX, yPosition);
          yPosition += lineHeightMm;
        }
      };

      const getProxiedImageUrl = (imageUrl: string) => {
        const base = import.meta.env.VITE_SUPABASE_URL;
        return `${base}/functions/v1/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      };

      const loadImageForPdf = async (imageUrl: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> => {
        try {
          const proxied = getProxiedImageUrl(imageUrl);
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

      // ===== PAGE BACKGROUND =====
      pdf.setFillColor(THEME.bgDark[0], THEME.bgDark[1], THEME.bgDark[2]);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");

      // ===== HEADER BAR =====
      // Gradient-like header
      pdf.setFillColor(THEME.headerGreen[0], THEME.headerGreen[1], THEME.headerGreen[2]);
      pdf.roundedRect(margin, yPosition, contentWidth, 24, 4, 4, "F");
      // Subtle overlay
      pdf.setFillColor(0, 0, 0);
      pdf.roundedRect(margin, yPosition, contentWidth, 24, 4, 4, "F");
      // Re-draw with proper color
      pdf.setFillColor(34, 75, 55);
      pdf.roundedRect(margin, yPosition, contentWidth, 24, 4, 4, "F");

      // Title icon area
      pdf.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
      pdf.roundedRect(margin + 5, yPosition + 4, 8, 8, 2, 2, "F");
      pdf.setFontSize(5);
      pdf.setTextColor(255, 255, 255);
      pdf.text("🌾", margin + 6.5, yPosition + 9.5);

      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text("농식품 특허 요약서", margin + 16, yPosition + 10);

      pdf.setFontSize(7);
      pdf.setTextColor(180, 210, 190);
      pdf.text("Agri-Food Patent Summary Report", margin + 16, yPosition + 16);

      // Patent number on right
      const isApplicationSearch = patentData?.searchType === "application";
      const displayNumber = isApplicationSearch
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApplicationSearch ? "출원번호" : "등록번호";

      pdf.setFontSize(7);
      pdf.setTextColor(180, 210, 190);
      const lblW = pdf.getTextWidth(numberLabel);
      pdf.text(numberLabel, pageWidth - margin - lblW - 5, yPosition + 9);

      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      const numW = pdf.getTextWidth(displayNumber);
      pdf.text(displayNumber, pageWidth - margin - numW - 5, yPosition + 16);

      yPosition += 30;

      // ===== 1. PATENT INFO CARD =====
      if (patentData) {
        const inventionTitle = patentData.titleKo || patentData.title || "정보 없음";
        
        // Calculate card height dynamically
        const infoItems: { label: string; value: string }[] = [];
        if (patentData.assignee) infoItems.push({ label: "출원인", value: patentData.assignee });
        if (patentData.inventors?.length) infoItems.push({ label: "발명자", value: patentData.inventors.join(", ") });
        if (patentData.filingDate) infoItems.push({ label: "출원일", value: patentData.filingDate });
        if (patentData.publicationDate) infoItems.push({ label: "공개일", value: patentData.publicationDate });
        
        const infoRowCount = Math.ceil(infoItems.length / 3);
        const cardHeight = 38 + infoRowCount * 22;
        
        checkNewPage(cardHeight + 2);
        drawCard(margin, yPosition, contentWidth, cardHeight);
        
        const cardX = margin + 6;
        let cy = yPosition + 6;

        // Section header with icon
        pdf.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
        pdf.roundedRect(cardX, cy - 1, 7, 7, 1.5, 1.5, "F");
        pdf.setFontSize(4);
        pdf.setTextColor(255, 255, 255);
        pdf.text("📄", cardX + 1.5, cy + 4);

        pdf.setFontSize(11);
        pdf.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
        pdf.text("특허 정보", cardX + 10, cy + 4);
        cy += 10;

        // Divider line
        pdf.setDrawColor(60, 70, 58);
        pdf.setLineWidth(0.2);
        pdf.line(cardX, cy, margin + contentWidth - 6, cy);
        cy += 4;

        // Number badge
        const badgeText = `${numberLabel}: ${displayNumber}`;
        pdf.setFillColor(THEME.accent[0], THEME.accent[1], THEME.accent[2]);
        const badgeW = pdf.getTextWidth(badgeText) * 0.352778 * 8 + 8;
        pdf.roundedRect(cardX, cy, Math.min(badgeW, 65), 6, 1.5, 1.5, "F");
        pdf.setFontSize(7);
        pdf.setTextColor(30, 25, 15);
        pdf.text(badgeText, cardX + 2, cy + 4.2);
        cy += 9;

        // Title
        pdf.setFontSize(12);
        pdf.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
        const titleLines = pdf.splitTextToSize(inventionTitle, contentWidth - 16);
        for (let i = 0; i < Math.min(titleLines.length, 2); i++) {
          pdf.text(titleLines[i] + (i === 0 && titleLines.length > 2 ? "..." : ""), cardX, cy + 4);
          cy += 5.5;
        }
        cy += 2;

        // Info sub-cards in grid
        const subCardW = (contentWidth - 18) / Math.min(infoItems.length, 3);
        infoItems.forEach((item, idx) => {
          const col = idx % 3;
          const row = Math.floor(idx / 3);
          const sx = cardX + col * (subCardW + 2);
          const sy = cy + row * 20;
          
          drawSubCard(sx, sy, subCardW - 2, 18);
          
          pdf.setFontSize(6.5);
          pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
          pdf.text(item.label, sx + 3, sy + 5.5);
          
          pdf.setFontSize(8);
          pdf.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
          const valLines = pdf.splitTextToSize(item.value, subCardW - 8);
          pdf.text(valLines[0], sx + 3, sy + 12);
        });

        yPosition += cardHeight + 4;
      }

      // ===== 2. COMMERCIALIZATION SCORE CARD =====
      if (commercializationScore !== null && commercializationScore !== undefined && commercializationDetails) {
        const scoreCardH = 72;
        checkNewPage(scoreCardH + 2);
        drawCard(margin, yPosition, contentWidth, scoreCardH);
        
        const cx = margin + 6;
        let cy = yPosition + 6;

        // Header
        pdf.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
        pdf.roundedRect(cx, cy - 1, 7, 7, 1.5, 1.5, "F");
        pdf.setFontSize(4);
        pdf.setTextColor(255, 255, 255);
        pdf.text("✨", cx + 1.2, cy + 4);

        pdf.setFontSize(11);
        pdf.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
        pdf.text("AI 기술사업화점수", cx + 10, cy + 4);

        pdf.setFontSize(7);
        pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
        pdf.text("Technology Commercialization Score", cx + 55, cy + 4);
        cy += 10;

        pdf.setDrawColor(60, 70, 58);
        pdf.setLineWidth(0.2);
        pdf.line(cx, cy, margin + contentWidth - 6, cy);
        cy += 6;

        // Main score
        const scoreColor = getScoreColorRgb(commercializationScore);
        pdf.setFontSize(32);
        pdf.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
        pdf.text(String(commercializationScore), cx + 2, cy + 10);
        
        pdf.setFontSize(14);
        pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
        const scoreNumW = pdf.getTextWidth(String(commercializationScore)) * 32 / 14;
        pdf.text("/ 100", cx + 4 + scoreNumW * 0.45, cy + 10);

        // Grade badge
        const gradeX = cx + 50;
        pdf.setFontSize(22);
        pdf.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
        pdf.text(getGradeLabel(commercializationScore), gradeX, cy + 6);
        pdf.setFontSize(9);
        pdf.text(getScoreLabel(commercializationScore), gradeX, cy + 12);

        cy += 16;

        // Full-width progress bar
        drawProgressBar(cx, cy, contentWidth - 14, 3, commercializationScore, scoreColor);
        cy += 7;

        // Sub-score cards (3 columns)
        const subW = (contentWidth - 20) / 3;
        const subScores = [
          { label: "기술성", score: commercializationDetails.technologyScore },
          { label: "시장성", score: commercializationDetails.marketScore },
          { label: "사업성", score: commercializationDetails.businessScore },
        ];

        subScores.forEach((item, idx) => {
          const sx = cx + idx * (subW + 2);
          drawSubCard(sx, cy, subW, 20);
          
          pdf.setFontSize(6.5);
          pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
          pdf.text(item.label, sx + 3, cy + 5);

          const sc = getScoreColorRgb(item.score);
          pdf.setFontSize(13);
          pdf.setTextColor(sc[0], sc[1], sc[2]);
          pdf.text(String(item.score), sx + 3, cy + 13);
          pdf.setFontSize(7);
          pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
          pdf.text("점", sx + 3 + pdf.getTextWidth(String(item.score)) * 13 / 7 * 0.14 + 10, cy + 13);

          // Mini progress bar
          drawProgressBar(sx + 3, cy + 16, subW - 8, 2, item.score, sc);
        });

        cy += 24;

        // Analysis text
        if (commercializationDetails.analysis) {
          drawSubCard(cx, cy, contentWidth - 14, 12);
          pdf.setFontSize(6.5);
          pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
          pdf.text("AI 분석 의견", cx + 3, cy + 4);
          pdf.setFontSize(7.5);
          pdf.setTextColor(THEME.textDim[0], THEME.textDim[1], THEME.textDim[2]);
          const analysisLines = pdf.splitTextToSize(commercializationDetails.analysis, contentWidth - 22);
          pdf.text(analysisLines[0] || "", cx + 3, cy + 9);
        }

        yPosition += scoreCardH + 4;
      }

      // ===== 3. AI SUMMARY CONTENT =====
      {
        // Card header for AI summary
        checkNewPage(20);
        const summaryHeaderH = 16;
        drawCard(margin, yPosition, contentWidth, summaryHeaderH);

        pdf.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
        pdf.roundedRect(margin + 6, yPosition + 3.5, 7, 7, 1.5, 1.5, "F");
        pdf.setFontSize(4);
        pdf.setTextColor(255, 255, 255);
        pdf.text("🤖", margin + 7.2, yPosition + 8.5);

        pdf.setFontSize(11);
        pdf.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
        pdf.text("AI 종합 요약", margin + 16, yPosition + 9);

        pdf.setFontSize(7);
        pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
        pdf.text(`${numberLabel}: ${patentNumber}`, margin + 50, yPosition + 9);

        yPosition += summaryHeaderH + 2;
      }

      // Parse and render content
      const lines = content.split("\n");
      let skipSection = false;
      let imageInserted = false;
      let trlInserted = false;

      const insertRepresentativeImage = async () => {
        if (!patentData?.representativeImage || imageInserted) return false;
        const img = await loadImageForPdf(patentData.representativeImage);
        if (!img) return false;

        const imgWidth = 60;
        const imgHeight = 45;
        checkNewPage(imgHeight + 10);

        // Center image with white background
        const imgX = (pageWidth - imgWidth) / 2;
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(imgX - 2, yPosition - 1, imgWidth + 4, imgHeight + 2, 3, 3, "F");
        pdf.addImage(img.dataUrl, img.format, imgX, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 2;

        pdf.setFontSize(7);
        pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
        const captionText = "【대표 도면】";
        const cw = pdf.getTextWidth(captionText);
        pdf.text(captionText, (pageWidth - cw) / 2, yPosition);
        yPosition += 6;

        imageInserted = true;
        return true;
      };

      // Insert TRL in the "기술성숙도 및 상용화 전망" section
      const insertTrlSection = () => {
        if (!commercializationDetails?.trl || trlInserted) return;
        trlInserted = true;

        const trl = commercializationDetails.trl;
        const trlCardH = commercializationDetails.trlReason ? 52 : 40;
        checkNewPage(trlCardH + 4);

        drawCard(margin, yPosition, contentWidth, trlCardH);
        const cx = margin + 6;
        let cy = yPosition + 6;

        // Header
        pdf.setFillColor(THEME.accent[0], THEME.accent[1], THEME.accent[2]);
        pdf.roundedRect(cx, cy - 1, 7, 7, 1.5, 1.5, "F");
        pdf.setFontSize(4);
        pdf.setTextColor(255, 255, 255);
        pdf.text("📊", cx + 1.2, cy + 4);

        pdf.setFontSize(11);
        pdf.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
        pdf.text("기술성숙도 (TRL)", cx + 10, cy + 4);

        pdf.setFontSize(7);
        pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
        pdf.text("Technology Readiness Level", cx + 55, cy + 4);
        cy += 10;

        pdf.setDrawColor(60, 70, 58);
        pdf.setLineWidth(0.2);
        pdf.line(cx, cy, margin + contentWidth - 6, cy);
        cy += 5;

        // TRL level display
        const trlColor = trl <= 3 ? [156, 39, 176] : trl <= 6 ? [251, 191, 36] : [74, 222, 128];
        pdf.setFillColor(trlColor[0], trlColor[1], trlColor[2]);
        pdf.roundedRect(cx, cy, 10, 10, 2, 2, "F");
        pdf.setFontSize(14);
        pdf.setTextColor(255, 255, 255);
        pdf.text(String(trl), cx + 3, cy + 7.5);

        pdf.setFontSize(10);
        pdf.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
        pdf.text(`TRL ${trl} - ${getTrlStageLabel(trl)}`, cx + 14, cy + 5);

        pdf.setFontSize(7);
        pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
        pdf.text(`상용화까지 ${9 - trl} 단계`, cx + 14, cy + 10);
        cy += 14;

        // TRL progress segments
        const segBarW = contentWidth - 14;
        const segW = segBarW / 9;
        for (let i = 1; i <= 9; i++) {
          const sx = cx + (i - 1) * segW;
          if (i <= 3) {
            pdf.setFillColor(i <= trl ? 156 : 60, i <= trl ? 39 : 65, i <= trl ? 176 : 58);
          } else if (i <= 6) {
            pdf.setFillColor(i <= trl ? 251 : 60, i <= trl ? 191 : 65, i <= trl ? 36 : 58);
          } else {
            pdf.setFillColor(i <= trl ? 74 : 60, i <= trl ? 222 : 65, i <= trl ? 128 : 58);
          }
          pdf.roundedRect(sx, cy, segW - 0.8, 4, 1, 1, "F");
          
          pdf.setFontSize(5);
          pdf.setTextColor(i <= trl ? 255 : 100, i <= trl ? 255 : 100, i <= trl ? 255 : 100);
          pdf.text(String(i), sx + segW / 2 - 1, cy + 3);
        }
        cy += 6;

        // Stage labels
        const stageW = segBarW / 3;
        const stages = [
          { label: "기초연구", range: "TRL 1-3", active: trl <= 3, color: [156, 39, 176] },
          { label: "개발/실증", range: "TRL 4-6", active: trl >= 4 && trl <= 6, color: [251, 191, 36] },
          { label: "상용화", range: "TRL 7-9", active: trl >= 7, color: [74, 222, 128] },
        ];
        stages.forEach((s, idx) => {
          const sx = cx + idx * stageW;
          if (s.active) {
            pdf.setFillColor(s.color[0], s.color[1], s.color[2]);
            pdf.roundedRect(sx, cy, stageW - 2, 7, 1.5, 1.5, "F");
            pdf.setFontSize(6);
            pdf.setTextColor(255, 255, 255);
          } else {
            pdf.setFillColor(50, 55, 48);
            pdf.roundedRect(sx, cy, stageW - 2, 7, 1.5, 1.5, "F");
            pdf.setFontSize(6);
            pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
          }
          pdf.text(`${s.label} ${s.range}`, sx + 2, cy + 5);
        });
        cy += 10;

        // TRL reason
        if (commercializationDetails.trlReason) {
          drawSubCard(cx, cy, contentWidth - 14, 12);
          pdf.setFontSize(6.5);
          pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
          pdf.text("TRL 추정 근거", cx + 3, cy + 4);
          pdf.setFontSize(7.5);
          pdf.setTextColor(THEME.textDim[0], THEME.textDim[1], THEME.textDim[2]);
          const reasonLines = pdf.splitTextToSize(commercializationDetails.trlReason, contentWidth - 22);
          for (let i = 0; i < Math.min(reasonLines.length, 2); i++) {
            pdf.text(reasonLines[i], cx + 3, cy + 8.5 + i * 3.5);
          }
        }

        yPosition += trlCardH + 4;
      };

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
          yPosition += 3;
          
          // Small green accent dot (reduced from 3x8 bar to 2x5 dot)
          pdf.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
          pdf.roundedRect(margin + 2, yPosition - 3.5, 2, 5, 1, 1, "F");
          
          pdf.setFontSize(10);
          pdf.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
          pdf.text(sectionTitle, margin + 6, yPosition);
          yPosition += 5;

          // Insert image after 발명의 요약
          if (sectionTitle === "발명의 요약") {
            await insertRepresentativeImage();
          }

          // Insert TRL in 기술성숙도 section
          if (sectionTitle.includes("기술성숙도") || sectionTitle.includes("상용화 전망")) {
            insertTrlSection();
          }
        } else if (cleanLine.trim()) {
          addWrappedText(cleanLine, 9, THEME.textDim, 1.6);
          yPosition += 0.5;
        }
      }

      // If TRL wasn't inserted within a matching section, insert it at the end of content
      if (!trlInserted && commercializationDetails?.trl) {
        yPosition += 3;
        insertTrlSection();
      }

      // ===== DISCLAIMER =====
      {
        checkNewPage(8);
        yPosition += 2;
        pdf.setFontSize(7);
        pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
        const disclaimer = "※ 본 분석은 특허명세서를 바탕으로 실시하여 실제 연구 및 개발 단계와는 상이할 수 있음";
        const dw = pdf.getTextWidth(disclaimer);
        pdf.text(disclaimer, (pageWidth - dw) / 2, yPosition);
        yPosition += 6;
      }

      // ===== FOOTER on all pages =====
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        
        // Draw background if not first page (first page already drawn)
        if (i > 1) {
          // Background already drawn via checkNewPage
        }

        const footerY = pageHeight - 8;
        
        pdf.setDrawColor(60, 70, 58);
        pdf.setLineWidth(0.2);
        pdf.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

        pdf.setFontSize(6.5);
        pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
        pdf.text("© 농식품 특허 1페이지 요약 서비스 | AI 기반 특허 분석", margin, footerY);

        const dateText = `생성일: ${new Date().toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`;
        const dateW = pdf.getTextWidth(dateText);
        pdf.text(dateText, pageWidth - margin - dateW, footerY);

        // Page number
        const pageText = `${i} / ${totalPages}`;
        const pageTextW = pdf.getTextWidth(pageText);
        pdf.text(pageText, (pageWidth - pageTextW) / 2, footerY);
      }

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
