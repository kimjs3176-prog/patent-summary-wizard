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
  commercializationScore,
}: PdfGeneratorProps) {
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
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      let yPosition = margin;

      const checkNewPage = (neededHeight: number) => {
        if (yPosition + neededHeight > pageHeight - margin - 8) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Estimate height of upcoming body text after a section header
      const estimateBodyHeight = (linesArr: string[], startIdx: number, fontSize: number, maxW: number, lineHeight: number): number => {
        let h = 0;
        const lhMm = fontSize * 0.352778 * lineHeight;
        for (let i = startIdx; i < linesArr.length; i++) {
          const l = linesArr[i];
          if (l.startsWith("## ")) break; // next section
          const clean = l.replace(/\*\*/g, "").replace(/^\s*[-•]\s+/, "").replace(/^\s*\d+\.\s+/, "");
          if (!clean.trim()) continue;
          pdf.setFontSize(fontSize);
          const wrapped = pdf.splitTextToSize(clean, maxW);
          h += wrapped.length * lhMm + 0.5;
          if (h > 25) break; // only need first few lines to prevent orphan headers
        }
        return Math.min(h, 30); // cap at 30mm for lookahead
      };

      const drawCard = (x: number, y: number, w: number, h: number, r = 2.5) => {
        pdf.setFillColor(...THEME.cardBg);
        pdf.setDrawColor(...THEME.border);
        pdf.setLineWidth(0.25);
        pdf.roundedRect(x, y, w, h, r, r, "FD");
      };

      const drawSubCard = (x: number, y: number, w: number, h: number) => {
        pdf.setFillColor(...THEME.cardBgLight);
        pdf.setDrawColor(...THEME.border);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
      };

      const drawProgressBar = (x: number, y: number, w: number, h: number, pct: number, color: [number, number, number]) => {
        pdf.setFillColor(230, 232, 230);
        pdf.roundedRect(x, y, w, h, h / 2, h / 2, "F");
        if (pct > 0) {
          pdf.setFillColor(...color);
          pdf.roundedRect(x, y, Math.max(h, (pct / 100) * w), h, h / 2, h / 2, "F");
        }
      };

      const addWrappedText = (text: string, fontSize: number, color: [number, number, number], lineHeight = 1.6, indentX = margin + 5) => {
        pdf.setFontSize(fontSize);
        pdf.setTextColor(...color);
        const maxW = pageWidth - indentX - margin - 2;
        const lines = pdf.splitTextToSize(text, maxW);
        const lhMm = fontSize * 0.352778 * lineHeight;
        for (const line of lines) {
          checkNewPage(lhMm + 1);
          pdf.text(line, indentX, yPosition);
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
      pdf.setFillColor(...THEME.headerGreen);
      pdf.roundedRect(margin, yPosition, contentWidth, 18, 2.5, 2.5, "F");

      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      pdf.text("농식품 특허 요약서", margin + 6, yPosition + 7.5);

      pdf.setFontSize(6.5);
      pdf.setTextColor(200, 225, 210);
      pdf.text("Agri-Food Patent Summary Report", margin + 6, yPosition + 12.5);

      const isApp = patentData?.searchType === "application";
      const displayNumber = isApp
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApp ? "출원번호" : "등록번호";

      pdf.setFontSize(6.5);
      pdf.setTextColor(200, 225, 210);
      pdf.text(numberLabel, pageWidth - margin - pdf.getTextWidth(numberLabel) - 4, yPosition + 7.5);
      pdf.setFontSize(8.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text(displayNumber, pageWidth - margin - pdf.getTextWidth(displayNumber) - 4, yPosition + 12.5);

      yPosition += 22;

      // ===== 1. PATENT INFO =====
      if (patentData) {
        const title = patentData.titleKo || patentData.title || "정보 없음";
        const infoItems: { label: string; value: string }[] = [];
        if (patentData.assignee) infoItems.push({ label: "출원인", value: patentData.assignee });
        if (patentData.inventors?.length) infoItems.push({ label: "발명자", value: patentData.inventors.join(", ") });
        if (patentData.filingDate) infoItems.push({ label: "출원일", value: patentData.filingDate });
        if (patentData.publicationDate) infoItems.push({ label: "공개일", value: patentData.publicationDate });

        pdf.setFontSize(11);
        const titleLines = pdf.splitTextToSize(title, contentWidth - 14);
        const titleH = Math.min(titleLines.length, 2) * 5;
        const rowCount = Math.ceil(infoItems.length / 4);
        const cardH = 26 + titleH + rowCount * 16;

        checkNewPage(cardH + 2);
        drawCard(margin, yPosition, contentWidth, cardH);
        const cx = margin + 5;
        let cy = yPosition + 5;

        pdf.setFontSize(10);
        pdf.setTextColor(...THEME.text);
        pdf.text("📄 특허 정보", cx, cy + 3.5);
        cy += 7;

        pdf.setDrawColor(...THEME.border);
        pdf.setLineWidth(0.2);
        pdf.line(cx, cy, margin + contentWidth - 5, cy);
        cy += 3;

        // Badge
        const badgeText = `${numberLabel}: ${displayNumber}`;
        pdf.setFontSize(6.5);
        const badgeW = Math.min(pdf.getTextWidth(badgeText) + 6, 65);
        pdf.setFillColor(...THEME.accent);
        pdf.roundedRect(cx, cy, badgeW, 5, 1.2, 1.2, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.text(badgeText, cx + 2, cy + 3.5);
        cy += 7;

        // Title
        pdf.setFontSize(11);
        pdf.setTextColor(...THEME.text);
        for (let i = 0; i < Math.min(titleLines.length, 2); i++) {
          pdf.text(titleLines[i] + (i === 0 && titleLines.length > 2 ? "..." : ""), cx, cy + 3.5);
          cy += 5;
        }
        cy += 1;

        // Info grid (4 columns for compactness)
        const colCount = Math.min(infoItems.length, 4);
        const subW = (contentWidth - 12) / colCount;
        infoItems.forEach((item, idx) => {
          const col = idx % 4;
          const row = Math.floor(idx / 4);
          const sx = cx + col * (subW + 0.5);
          const sy = cy + row * 15;
          drawSubCard(sx, sy, subW - 1, 13);
          pdf.setFontSize(6.5);
          pdf.setTextColor(...THEME.textMuted);
          pdf.text(item.label, sx + 2.5, sy + 4.5);
          pdf.setFontSize(8);
          pdf.setTextColor(...THEME.text);
          const valLines = pdf.splitTextToSize(item.value, subW - 7);
          pdf.text(valLines[0], sx + 2.5, sy + 9.5);
        });

        yPosition += cardH + 3;
      }

      // ===== 2. COMMERCIALIZATION SCORE =====
      if (commercializationScore != null && commercializationDetails) {
        const hasAnalysis = !!commercializationDetails.analysis;
        let analysisH = 0;
        if (hasAnalysis) {
          pdf.setFontSize(8);
          const aLines = pdf.splitTextToSize(commercializationDetails.analysis, contentWidth - 18);
          analysisH = 7 + aLines.length * 3.2;
        }
        const scoreCardH = 55 + (hasAnalysis ? analysisH : 0);

        checkNewPage(scoreCardH + 2);
        drawCard(margin, yPosition, contentWidth, scoreCardH);
        const cx = margin + 5;
        let cy = yPosition + 5;

        // Header
        pdf.setFontSize(10);
        pdf.setTextColor(...THEME.text);
        pdf.text("✨ AI 기술사업화점수", cx, cy + 3.5);
        pdf.setFontSize(6.5);
        pdf.setTextColor(...THEME.textMuted);
        pdf.text("Technology Commercialization Score", cx + 46, cy + 3.5);
        cy += 7;
        pdf.setDrawColor(...THEME.border);
        pdf.setLineWidth(0.2);
        pdf.line(cx, cy, margin + contentWidth - 5, cy);
        cy += 4;

        // Main score - FIX: proper width calculation to avoid overlap
        const scoreColor = getScoreColorRgb(commercializationScore);
        const scoreStr = String(commercializationScore);

        pdf.setFontSize(24);
        pdf.setTextColor(...scoreColor);
        pdf.text(scoreStr, cx + 2, cy + 8);
        const scoreW = pdf.getTextWidth(scoreStr);

        pdf.setFontSize(10);
        pdf.setTextColor(...THEME.textMuted);
        pdf.text("/ 100", cx + 2 + scoreW + 2, cy + 8);

        // Grade - positioned far right to avoid overlap
        const gradeX = cx + 55;
        pdf.setFontSize(16);
        pdf.setTextColor(...scoreColor);
        pdf.text(getGradeLabel(commercializationScore), gradeX, cy + 5);
        pdf.setFontSize(8);
        pdf.text(getScoreLabel(commercializationScore), gradeX, cy + 10);

        cy += 13;

        // Progress bar
        drawProgressBar(cx, cy, contentWidth - 12, 2.5, commercializationScore, scoreColor);
        cy += 5;

        // Sub-scores
        const subW = (contentWidth - 14) / 3;
        const subScores = [
          { label: "기술성", score: commercializationDetails.technologyScore },
          { label: "시장성", score: commercializationDetails.marketScore },
          { label: "사업성", score: commercializationDetails.businessScore },
        ];
        subScores.forEach((item, idx) => {
          const sx = cx + idx * (subW + 1);
          drawSubCard(sx, cy, subW - 0.5, 16);

          pdf.setFontSize(6.5);
          pdf.setTextColor(...THEME.textMuted);
          pdf.text(item.label, sx + 2.5, cy + 4.5);

          const sc = getScoreColorRgb(item.score);
          pdf.setFontSize(11);
          pdf.setTextColor(...sc);
          pdf.text(String(item.score), sx + 2.5, cy + 10.5);

          const numW = pdf.getTextWidth(String(item.score));
          pdf.setFontSize(6.5);
          pdf.setTextColor(...THEME.textMuted);
          pdf.text("점", sx + 2.5 + numW + 1, cy + 10.5);

          drawProgressBar(sx + 2.5, cy + 13, subW - 6, 1.5, item.score, sc);
        });
        cy += 19;

        // Analysis
        if (hasAnalysis) {
          drawSubCard(cx, cy, contentWidth - 12, analysisH);
          pdf.setFontSize(6.5);
          pdf.setTextColor(...THEME.textMuted);
          pdf.text("AI 분석 의견", cx + 2.5, cy + 4);
          pdf.setFontSize(8);
          pdf.setTextColor(...THEME.textBody);
          const aLines = pdf.splitTextToSize(commercializationDetails.analysis, contentWidth - 18);
          for (let i = 0; i < aLines.length; i++) {
            pdf.text(aLines[i], cx + 2.5, cy + 8 + i * 3.2);
          }
        }

        yPosition += scoreCardH + 3;
      }

      // ===== 3. AI SUMMARY =====
      {
        checkNewPage(12);
        const hdrH = 11;
        drawCard(margin, yPosition, contentWidth, hdrH);
        pdf.setFontSize(10);
        pdf.setTextColor(...THEME.text);
        pdf.text("🤖 AI 종합 요약", margin + 5, yPosition + 7);
        pdf.setFontSize(6.5);
        pdf.setTextColor(...THEME.textMuted);
        pdf.text(`${numberLabel}: ${patentNumber}`, margin + 42, yPosition + 7);
        yPosition += hdrH + 2;
      }

      // Parse content
      const lines = content.split("\n");
      let skipSection = false;
      let imageInserted = false;
      let trlInserted = false;

      const insertImage = async () => {
        if (!patentData?.representativeImage || imageInserted) return;
        const img = await loadImageForPdf(patentData.representativeImage);
        if (!img) return;

        const imgW = 55;
        const imgH = 42;
        checkNewPage(imgH + 8);

        const imgX = (pageWidth - imgW) / 2;
        pdf.setDrawColor(...THEME.border);
        pdf.setLineWidth(0.25);
        pdf.roundedRect(imgX - 1.5, yPosition - 0.5, imgW + 3, imgH + 1, 1.5, 1.5, "D");
        pdf.addImage(img.dataUrl, img.format, imgX, yPosition, imgW, imgH);
        yPosition += imgH + 2;

        pdf.setFontSize(6.5);
        pdf.setTextColor(...THEME.textMuted);
        const cap = "【대표 도면】";
        pdf.text(cap, (pageWidth - pdf.getTextWidth(cap)) / 2, yPosition);
        yPosition += 4;
        imageInserted = true;
      };

      const insertTrl = () => {
        if (!commercializationDetails?.trl || trlInserted) return;
        trlInserted = true;

        const trl = commercializationDetails.trl;
        const hasTrlReason = !!commercializationDetails.trlReason;
        let reasonH = 0;
        if (hasTrlReason) {
          pdf.setFontSize(8);
          const rLines = pdf.splitTextToSize(commercializationDetails.trlReason!, contentWidth - 18);
          reasonH = 7 + rLines.length * 3.2;
        }
        const trlCardH = 44 + (hasTrlReason ? reasonH : 0);

        checkNewPage(trlCardH + 3);
        drawCard(margin, yPosition, contentWidth, trlCardH);
        const cx = margin + 5;
        let cy = yPosition + 5;

        pdf.setFontSize(10);
        pdf.setTextColor(...THEME.text);
        pdf.text("📊 기술성숙도 (TRL)", cx, cy + 3.5);
        pdf.setFontSize(6.5);
        pdf.setTextColor(...THEME.textMuted);
        pdf.text("Technology Readiness Level", cx + 44, cy + 3.5);
        cy += 7;

        pdf.setDrawColor(...THEME.border);
        pdf.setLineWidth(0.2);
        pdf.line(cx, cy, margin + contentWidth - 5, cy);
        cy += 4;

        // TRL badge
        const trlColor: [number, number, number] = trl <= 3 ? [156, 39, 176] : trl <= 6 ? [251, 191, 36] : [74, 222, 128];
        pdf.setFillColor(...trlColor);
        pdf.roundedRect(cx, cy, 8, 8, 1.5, 1.5, "F");
        pdf.setFontSize(12);
        pdf.setTextColor(255, 255, 255);
        pdf.text(String(trl), cx + 2.5, cy + 6);

        pdf.setFontSize(9);
        pdf.setTextColor(...THEME.text);
        pdf.text(`TRL ${trl} - ${getTrlStageLabel(trl)}`, cx + 11, cy + 4);
        pdf.setFontSize(6.5);
        pdf.setTextColor(...THEME.textMuted);
        pdf.text(`상용화까지 ${9 - trl} 단계`, cx + 11, cy + 8);
        cy += 11;

        // Progress segments
        const segBarW = contentWidth - 12;
        const segW = segBarW / 9;
        for (let i = 1; i <= 9; i++) {
          const sx = cx + (i - 1) * segW;
          const active = i <= trl;
          if (i <= 3) pdf.setFillColor(active ? 156 : 230, active ? 39 : 232, active ? 176 : 230);
          else if (i <= 6) pdf.setFillColor(active ? 251 : 230, active ? 191 : 232, active ? 36 : 230);
          else pdf.setFillColor(active ? 74 : 230, active ? 222 : 232, active ? 128 : 230);
          pdf.roundedRect(sx, cy, segW - 0.6, 3.5, 0.8, 0.8, "F");
          pdf.setFontSize(4.5);
          pdf.setTextColor(active ? 255 : 160, active ? 255 : 160, active ? 255 : 160);
          pdf.text(String(i), sx + segW / 2 - 0.8, cy + 2.6);
        }
        cy += 5;

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
            pdf.setFillColor(...s.color);
            pdf.roundedRect(sx, cy, stageW - 1.5, 6, 1.2, 1.2, "F");
            pdf.setFontSize(5.5);
            pdf.setTextColor(255, 255, 255);
          } else {
            pdf.setFillColor(240, 242, 240);
            pdf.roundedRect(sx, cy, stageW - 1.5, 6, 1.2, 1.2, "F");
            pdf.setFontSize(5.5);
            pdf.setTextColor(...THEME.textMuted);
          }
          pdf.text(`${s.label} ${s.range}`, sx + 1.5, cy + 4.2);
        });
        cy += 8;

        if (hasTrlReason) {
          drawSubCard(cx, cy, contentWidth - 12, reasonH);
          pdf.setFontSize(6.5);
          pdf.setTextColor(...THEME.textMuted);
          pdf.text("TRL 추정 근거", cx + 2.5, cy + 4);
          pdf.setFontSize(8);
          pdf.setTextColor(...THEME.textBody);
          const rLines = pdf.splitTextToSize(commercializationDetails.trlReason!, contentWidth - 18);
          for (let i = 0; i < rLines.length; i++) {
            pdf.text(rLines[i], cx + 2.5, cy + 8 + i * 3.2);
          }
        }

        yPosition += trlCardH + 3;
      };

      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        if (line.startsWith("## 특허 기본 정보")) { skipSection = true; continue; }
        if (skipSection && line.startsWith("## ")) skipSection = false;
        if (skipSection) continue;

        if (
          line.includes("등록번호는") || line.includes("출원번호는") ||
          line.includes("발명의 명칭은") || line.includes("출원인/권리자는") ||
          line.includes("출원일/등록일은") || line.includes("발명자는")
        ) continue;

        const cleanLine = line.replace(/\*\*/g, "").replace(/^\s*[-•]\s+/, "").replace(/^\s*\d+\.\s+/, "");

        if (line.startsWith("## ")) {
          const sectionTitle = line.replace("## ", "").replace(/\*\*/g, "");
          if (sectionTitle === "특허 기본 정보") { skipSection = true; continue; }

          // Estimate header + first body paragraph height to prevent orphan headers
          const bodyPreview = estimateBodyHeight(lines, li + 1, 9, pageWidth - margin - margin - 7, 1.55);
          const neededForSection = 8 + bodyPreview;
          checkNewPage(neededForSection);
          yPosition += 2;

          // Small green accent dot
          pdf.setFillColor(...THEME.primary);
          pdf.roundedRect(margin + 2, yPosition - 3, 1.2, 3.5, 0.6, 0.6, "F");

          pdf.setFontSize(9.5);
          pdf.setTextColor(...THEME.primary);
          pdf.text(sectionTitle, margin + 5, yPosition);
          yPosition += 4;

          if (sectionTitle === "발명의 요약") await insertImage();
          if (sectionTitle.includes("기술성숙도") || sectionTitle.includes("상용화 전망")) insertTrl();
        } else if (cleanLine.trim()) {
          addWrappedText(cleanLine, 9, THEME.textBody, 1.55);
          yPosition += 0.5;
        }
      }

      // Fallback TRL
      if (!trlInserted && commercializationDetails?.trl) {
        yPosition += 2;
        insertTrl();
      }

      // Disclaimer
      {
        checkNewPage(6);
        yPosition += 1;
        pdf.setFontSize(6.5);
        pdf.setTextColor(...THEME.textMuted);
        const disc = "※ 본 분석은 특허명세서를 바탕으로 실시하여 실제 연구 및 개발 단계와는 상이할 수 있음";
        pdf.text(disc, (pageWidth - pdf.getTextWidth(disc)) / 2, yPosition);
        yPosition += 4;
      }

      // Footer
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        const fy = pageHeight - 7;
        pdf.setDrawColor(...THEME.border);
        pdf.setLineWidth(0.2);
        pdf.line(margin, fy - 2, pageWidth - margin, fy - 2);
        pdf.setFontSize(6);
        pdf.setTextColor(...THEME.textMuted);
        pdf.text("© 농식품 특허 요약 서비스 | AI 기반 특허 분석", margin, fy);
        const dateText = `생성일: ${new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}`;
        pdf.text(dateText, pageWidth - margin - pdf.getTextWidth(dateText), fy);
        const pg = `${i} / ${totalPages}`;
        pdf.text(pg, (pageWidth - pdf.getTextWidth(pg)) / 2, fy);
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
