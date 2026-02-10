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

// White-background theme
const THEME = {
  bg: [255, 255, 255] as [number, number, number],
  cardBg: [248, 250, 248] as [number, number, number],
  cardBgLight: [243, 246, 243] as [number, number, number],
  primary: [56, 120, 50] as [number, number, number],
  accent: [180, 120, 30] as [number, number, number],
  text: [25, 30, 25] as [number, number, number],
  textMuted: [100, 105, 100] as [number, number, number],
  textBody: [40, 45, 40] as [number, number, number],
  border: [210, 215, 210] as [number, number, number],
  headerGreen: [34, 85, 55] as [number, number, number],
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
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      let yPosition = margin;

      // ===== Utility functions =====
      const checkNewPage = (neededHeight: number) => {
        if (yPosition + neededHeight > pageHeight - margin - 12) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      const drawCard = (x: number, y: number, w: number, h: number, r: number = 3) => {
        pdf.setFillColor(THEME.cardBg[0], THEME.cardBg[1], THEME.cardBg[2]);
        pdf.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, y, w, h, r, r, "FD");
      };

      const drawSubCard = (x: number, y: number, w: number, h: number) => {
        pdf.setFillColor(THEME.cardBgLight[0], THEME.cardBgLight[1], THEME.cardBgLight[2]);
        pdf.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(x, y, w, h, 2, 2, "FD");
      };

      const drawProgressBar = (x: number, y: number, w: number, h: number, pct: number, color: [number, number, number]) => {
        pdf.setFillColor(230, 232, 230);
        pdf.roundedRect(x, y, w, h, h / 2, h / 2, "F");
        if (pct > 0) {
          pdf.setFillColor(color[0], color[1], color[2]);
          const fillW = Math.max(h, (pct / 100) * w);
          pdf.roundedRect(x, y, fillW, h, h / 2, h / 2, "F");
        }
      };

      const addWrappedText = (text: string, fontSize: number, color: [number, number, number], lineHeight: number = 1.65, indentX: number = margin + 5) => {
        pdf.setFontSize(fontSize);
        pdf.setTextColor(color[0], color[1], color[2]);
        const maxW = pageWidth - indentX - margin - 2;
        const lines = pdf.splitTextToSize(text, maxW);
        const lineHeightMm = fontSize * 0.352778 * lineHeight;

        for (const line of lines) {
          checkNewPage(lineHeightMm + 1);
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

      // ===== HEADER BAR =====
      pdf.setFillColor(THEME.headerGreen[0], THEME.headerGreen[1], THEME.headerGreen[2]);
      pdf.roundedRect(margin, yPosition, contentWidth, 22, 3, 3, "F");

      pdf.setFontSize(13);
      pdf.setTextColor(255, 255, 255);
      pdf.text("농식품 특허 요약서", margin + 8, yPosition + 9);

      pdf.setFontSize(7);
      pdf.setTextColor(200, 225, 210);
      pdf.text("Agri-Food Patent Summary Report", margin + 8, yPosition + 15);

      const isApplicationSearch = patentData?.searchType === "application";
      const displayNumber = isApplicationSearch
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApplicationSearch ? "출원번호" : "등록번호";

      pdf.setFontSize(7);
      pdf.setTextColor(200, 225, 210);
      const lblW = pdf.getTextWidth(numberLabel);
      pdf.text(numberLabel, pageWidth - margin - lblW - 5, yPosition + 9);

      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      const numW = pdf.getTextWidth(displayNumber);
      pdf.text(displayNumber, pageWidth - margin - numW - 5, yPosition + 15);

      yPosition += 28;

      // ===== 1. PATENT INFO CARD =====
      if (patentData) {
        const inventionTitle = patentData.titleKo || patentData.title || "정보 없음";
        
        const infoItems: { label: string; value: string }[] = [];
        if (patentData.assignee) infoItems.push({ label: "출원인", value: patentData.assignee });
        if (patentData.inventors?.length) infoItems.push({ label: "발명자", value: patentData.inventors.join(", ") });
        if (patentData.filingDate) infoItems.push({ label: "출원일", value: patentData.filingDate });
        if (patentData.publicationDate) infoItems.push({ label: "공개일", value: patentData.publicationDate });
        
        // Calculate height dynamically
        pdf.setFontSize(12);
        const titleLines = pdf.splitTextToSize(inventionTitle, contentWidth - 16);
        const titleH = Math.min(titleLines.length, 2) * 5.5;
        const infoRowCount = Math.ceil(infoItems.length / 3);
        const cardHeight = 32 + titleH + infoRowCount * 22;
        
        checkNewPage(cardHeight + 2);
        drawCard(margin, yPosition, contentWidth, cardHeight);
        
        const cardX = margin + 6;
        let cy = yPosition + 6;

        // Section header
        pdf.setFontSize(11);
        pdf.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
        pdf.text("📄 특허 정보", cardX, cy + 4);
        cy += 9;

        // Divider
        pdf.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
        pdf.setLineWidth(0.2);
        pdf.line(cardX, cy, margin + contentWidth - 6, cy);
        cy += 4;

        // Number badge
        const badgeText = `${numberLabel}: ${displayNumber}`;
        pdf.setFillColor(THEME.accent[0], THEME.accent[1], THEME.accent[2]);
        const badgeW = Math.min(pdf.getTextWidth(badgeText) + 8, 70);
        pdf.roundedRect(cardX, cy, badgeW, 6, 1.5, 1.5, "F");
        pdf.setFontSize(7);
        pdf.setTextColor(255, 255, 255);
        pdf.text(badgeText, cardX + 2, cy + 4.2);
        cy += 9;

        // Title
        pdf.setFontSize(12);
        pdf.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
        for (let i = 0; i < Math.min(titleLines.length, 2); i++) {
          pdf.text(titleLines[i] + (i === 0 && titleLines.length > 2 ? "..." : ""), cardX, cy + 4);
          cy += 5.5;
        }
        cy += 2;

        // Info sub-cards in grid
        const colCount = Math.min(infoItems.length, 3);
        const subCardW = (contentWidth - 18) / colCount;
        infoItems.forEach((item, idx) => {
          const col = idx % 3;
          const row = Math.floor(idx / 3);
          const sx = cardX + col * (subCardW + 2);
          const sy = cy + row * 20;
          
          drawSubCard(sx, sy, subCardW - 2, 18);
          
          pdf.setFontSize(7);
          pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
          pdf.text(item.label, sx + 3, sy + 6);
          
          pdf.setFontSize(8.5);
          pdf.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
          const valLines = pdf.splitTextToSize(item.value, subCardW - 8);
          pdf.text(valLines[0], sx + 3, sy + 12.5);
        });

        yPosition += cardHeight + 4;
      }

      // ===== 2. COMMERCIALIZATION SCORE CARD =====
      if (commercializationScore !== null && commercializationScore !== undefined && commercializationDetails) {
        // Calculate dynamic height
        const hasAnalysis = !!commercializationDetails.analysis;
        let analysisH = 0;
        if (hasAnalysis) {
          pdf.setFontSize(8.5);
          const analysisLines = pdf.splitTextToSize(commercializationDetails.analysis, contentWidth - 22);
          analysisH = 8 + analysisLines.length * 3.5;
        }
        const scoreCardH = 68 + (hasAnalysis ? analysisH : 0);
        
        checkNewPage(scoreCardH + 2);
        drawCard(margin, yPosition, contentWidth, scoreCardH);
        
        const cx = margin + 6;
        let cy = yPosition + 6;

        // Header
        pdf.setFontSize(11);
        pdf.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
        pdf.text("✨ AI 기술사업화점수", cx, cy + 4);

        pdf.setFontSize(7);
        pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
        pdf.text("Technology Commercialization Score", cx + 52, cy + 4);
        cy += 9;

        pdf.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
        pdf.setLineWidth(0.2);
        pdf.line(cx, cy, margin + contentWidth - 6, cy);
        cy += 6;

        // Main score
        const scoreColor = getScoreColorRgb(commercializationScore);
        pdf.setFontSize(30);
        pdf.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
        pdf.text(String(commercializationScore), cx + 2, cy + 10);
        
        pdf.setFontSize(13);
        pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
        const scoreTextW = pdf.getTextWidth(String(commercializationScore)) * 30 / 13;
        pdf.text("/ 100", cx + 4 + scoreTextW * 0.45, cy + 10);

        // Grade
        const gradeX = cx + 50;
        pdf.setFontSize(20);
        pdf.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
        pdf.text(getGradeLabel(commercializationScore), gradeX, cy + 6);
        pdf.setFontSize(9);
        pdf.text(getScoreLabel(commercializationScore), gradeX, cy + 12);

        cy += 16;

        // Progress bar
        drawProgressBar(cx, cy, contentWidth - 14, 3, commercializationScore, scoreColor);
        cy += 7;

        // Sub-scores
        const subW = (contentWidth - 20) / 3;
        const subScores = [
          { label: "기술성", score: commercializationDetails.technologyScore },
          { label: "시장성", score: commercializationDetails.marketScore },
          { label: "사업성", score: commercializationDetails.businessScore },
        ];

        subScores.forEach((item, idx) => {
          const sx = cx + idx * (subW + 2);
          drawSubCard(sx, cy, subW, 20);
          
          pdf.setFontSize(7);
          pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
          pdf.text(item.label, sx + 3, cy + 5.5);

          const sc = getScoreColorRgb(item.score);
          pdf.setFontSize(13);
          pdf.setTextColor(sc[0], sc[1], sc[2]);
          pdf.text(String(item.score), sx + 3, cy + 13);
          pdf.setFontSize(7);
          pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
          const numTextW = pdf.getTextWidth(String(item.score));
          pdf.text("점", sx + 3 + numTextW + 1, cy + 13);

          drawProgressBar(sx + 3, cy + 16, subW - 8, 2, item.score, sc);
        });

        cy += 24;

        // Analysis
        if (hasAnalysis) {
          drawSubCard(cx, cy, contentWidth - 14, analysisH);
          pdf.setFontSize(7);
          pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
          pdf.text("AI 분석 의견", cx + 3, cy + 4.5);
          pdf.setFontSize(8.5);
          pdf.setTextColor(THEME.textBody[0], THEME.textBody[1], THEME.textBody[2]);
          const analysisLines = pdf.splitTextToSize(commercializationDetails.analysis, contentWidth - 22);
          for (let i = 0; i < analysisLines.length; i++) {
            pdf.text(analysisLines[i], cx + 3, cy + 9 + i * 3.5);
          }
        }

        yPosition += scoreCardH + 4;
      }

      // ===== 3. AI SUMMARY CONTENT =====
      {
        checkNewPage(18);
        const summaryHeaderH = 14;
        drawCard(margin, yPosition, contentWidth, summaryHeaderH);

        pdf.setFontSize(11);
        pdf.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
        pdf.text("🤖 AI 종합 요약", margin + 6, yPosition + 8.5);

        pdf.setFontSize(7);
        pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
        pdf.text(`${numberLabel}: ${patentNumber}`, margin + 48, yPosition + 8.5);

        yPosition += summaryHeaderH + 3;
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

        const imgX = (pageWidth - imgWidth) / 2;
        pdf.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(imgX - 2, yPosition - 1, imgWidth + 4, imgHeight + 2, 2, 2, "D");
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
        const hasTrlReason = !!commercializationDetails.trlReason;
        
        // Calculate dynamic height
        let trlReasonH = 0;
        if (hasTrlReason) {
          pdf.setFontSize(8.5);
          const reasonLines = pdf.splitTextToSize(commercializationDetails.trlReason!, contentWidth - 22);
          trlReasonH = 8 + reasonLines.length * 3.5;
        }
        const trlCardH = 52 + (hasTrlReason ? trlReasonH : 0);
        
        checkNewPage(trlCardH + 4);
        drawCard(margin, yPosition, contentWidth, trlCardH);
        const cx = margin + 6;
        let cy = yPosition + 6;

        // Header
        pdf.setFontSize(11);
        pdf.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
        pdf.text("📊 기술성숙도 (TRL)", cx, cy + 4);

        pdf.setFontSize(7);
        pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
        pdf.text("Technology Readiness Level", cx + 48, cy + 4);
        cy += 9;

        pdf.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
        pdf.setLineWidth(0.2);
        pdf.line(cx, cy, margin + contentWidth - 6, cy);
        cy += 5;

        // TRL level display
        const trlColor: [number, number, number] = trl <= 3 ? [156, 39, 176] : trl <= 6 ? [251, 191, 36] : [74, 222, 128];
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
            pdf.setFillColor(i <= trl ? 156 : 230, i <= trl ? 39 : 232, i <= trl ? 176 : 230);
          } else if (i <= 6) {
            pdf.setFillColor(i <= trl ? 251 : 230, i <= trl ? 191 : 232, i <= trl ? 36 : 230);
          } else {
            pdf.setFillColor(i <= trl ? 74 : 230, i <= trl ? 222 : 232, i <= trl ? 128 : 230);
          }
          pdf.roundedRect(sx, cy, segW - 0.8, 4, 1, 1, "F");
          
          pdf.setFontSize(5);
          pdf.setTextColor(i <= trl ? 255 : 160, i <= trl ? 255 : 160, i <= trl ? 255 : 160);
          pdf.text(String(i), sx + segW / 2 - 1, cy + 3);
        }
        cy += 6;

        // Stage labels
        const stageW = segBarW / 3;
        const stages = [
          { label: "기초연구", range: "TRL 1-3", active: trl <= 3, color: [156, 39, 176] as [number, number, number] },
          { label: "개발/실증", range: "TRL 4-6", active: trl >= 4 && trl <= 6, color: [251, 191, 36] as [number, number, number] },
          { label: "상용화", range: "TRL 7-9", active: trl >= 7, color: [74, 222, 128] as [number, number, number] },
        ];
        stages.forEach((s, idx) => {
          const sx = cx + idx * stageW;
          if (s.active) {
            pdf.setFillColor(s.color[0], s.color[1], s.color[2]);
            pdf.roundedRect(sx, cy, stageW - 2, 7, 1.5, 1.5, "F");
            pdf.setFontSize(6);
            pdf.setTextColor(255, 255, 255);
          } else {
            pdf.setFillColor(240, 242, 240);
            pdf.roundedRect(sx, cy, stageW - 2, 7, 1.5, 1.5, "F");
            pdf.setFontSize(6);
            pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
          }
          pdf.text(`${s.label} ${s.range}`, sx + 2, cy + 5);
        });
        cy += 10;

        // TRL reason
        if (hasTrlReason) {
          drawSubCard(cx, cy, contentWidth - 14, trlReasonH);
          pdf.setFontSize(7);
          pdf.setTextColor(THEME.textMuted[0], THEME.textMuted[1], THEME.textMuted[2]);
          pdf.text("TRL 추정 근거", cx + 3, cy + 4.5);
          pdf.setFontSize(8.5);
          pdf.setTextColor(THEME.textBody[0], THEME.textBody[1], THEME.textBody[2]);
          const reasonLines = pdf.splitTextToSize(commercializationDetails.trlReason!, contentWidth - 22);
          for (let i = 0; i < reasonLines.length; i++) {
            pdf.text(reasonLines[i], cx + 3, cy + 9 + i * 3.5);
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
          
          // Small green accent dot
          pdf.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
          pdf.roundedRect(margin + 2, yPosition - 3.5, 1.5, 4, 0.75, 0.75, "F");
          
          pdf.setFontSize(10.5);
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
          addWrappedText(cleanLine, 9.5, THEME.textBody, 1.65);
          yPosition += 0.8;
        }
      }

      // If TRL wasn't inserted within a matching section, insert it at end
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

        const footerY = pageHeight - 8;
        
        pdf.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
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
