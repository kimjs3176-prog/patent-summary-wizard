import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { PatentData } from "./types";
import { loadKoreanFont, addKoreanFontToDoc } from "@/lib/koreanFont";
import { DEFAULT_PDF_CONFIG, type PdfLayoutConfig } from "@/components/admin/PdfLayoutSettings";

interface PdfGeneratorV2Props {
  content: string;
  patentNumber: string;
  patentData?: PatentData | null;
  printRef: React.RefObject<HTMLDivElement | null>;
  layoutConfig?: PdfLayoutConfig;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
};

// ─── Ver2 Design System — Structured Infographic ───
const V2 = {
  headerBg: [30, 41, 76] as [number, number, number],
  headerBadgeBg: [55, 75, 130] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  text: [18, 18, 24] as [number, number, number],
  textSecondary: [80, 85, 100] as [number, number, number],
  textMuted: [140, 145, 160] as [number, number, number],
  border: [210, 216, 224] as [number, number, number],
  borderLight: [235, 238, 243] as [number, number, number],
  cardBg: [248, 249, 251] as [number, number, number],
  accent: [0, 128, 100] as [number, number, number],
  accentLight: [230, 248, 243] as [number, number, number],
  navy: [30, 41, 76] as [number, number, number],
  navyLight: [55, 75, 130] as [number, number, number],
  gold: [180, 145, 60] as [number, number, number],
  red: [200, 60, 60] as [number, number, number],
  blue: [50, 100, 200] as [number, number, number],
  // Donut chart colors
  chart1: [50, 60, 80] as [number, number, number],
  chart2: [80, 95, 120] as [number, number, number],
  chart3: [120, 135, 160] as [number, number, number],
  chart4: [180, 190, 205] as [number, number, number],
};

// Parse AI summary content into structured sections
function parseSummaryContent(content: string): Record<string, string[]> {
  const sections: Record<string, string[]> = {};
  let currentSection = "";
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.startsWith("## ")) {
      currentSection = line.replace("## ", "").replace(/\*\*/g, "").trim();
      sections[currentSection] = [];
    } else if (currentSection && line.trim()) {
      const clean = line.replace(/^\s*[-•]\s+/, "").replace(/^\s*\d+\.\s+/, "").replace(/\*\*/g, "").trim();
      if (clean) sections[currentSection].push(clean);
    }
  }
  return sections;
}

// Extract keywords from patent data
function extractKeywords(patentData?: PatentData | null, content?: string): string[] {
  const keywords: string[] = [];
  // From IPC
  if (patentData?.classifications?.length) {
    keywords.push(patentData.classifications[0]);
  }
  // From title
  if (patentData?.titleKo || patentData?.title) {
    const title = patentData.titleKo || patentData.title || "";
    // Extract meaningful words (2+ chars Korean)
    const words = title.match(/[\uAC00-\uD7AF]{2,}/g) || [];
    keywords.push(...words.slice(0, 5));
  }
  // Remove duplicates
  return [...new Set(keywords)].slice(0, 6);
}

export function PdfGeneratorV2({
  content,
  patentNumber,
  patentData,
  layoutConfig,
}: PdfGeneratorV2Props) {
  const cfg = { ...DEFAULT_PDF_CONFIG, ...layoutConfig };

  const handlePdfDownload = async () => {
    if (!content) {
      toast.error("PDF 생성에 실패했습니다.");
      return;
    }
    toast.info("PDF(Ver2) 생성 중...");

    try {
      const koreanFontBase64 = await loadKoreanFont();
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      addKoreanFontToDoc(pdf, koreanFontBase64);

      const pageW = pdf.internal.pageSize.getWidth(); // 210
      const pageH = pdf.internal.pageSize.getHeight(); // 297
      const M = cfg.page_margin; // margin
      const CW = pageW - M * 2; // content width
      let y = 0;

      const headerColor = hexToRgb(cfg.header_bg_color);
      const accentColor = hexToRgb(cfg.section_accent_color);
      const sections = parseSummaryContent(content);
      const keywords = extractKeywords(patentData, content);

      const isApp = patentData?.searchType === "application";
      const displayNumber = isApp
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;

      // Helper: faux bold
      const boldText = (text: string, x: number, yy: number, size: number, color: [number, number, number]) => {
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
        pdf.text(text, x, yy);
        pdf.text(text, x + 0.12, yy);
      };

      const normalText = (text: string, x: number, yy: number, size: number, color: [number, number, number]) => {
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
        pdf.text(text, x, yy);
      };

      // Wrapped text returning new y
      const wrappedText = (text: string, x: number, yy: number, maxW: number, size: number, color: [number, number, number], lh: number = 4): number => {
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
        const lines = pdf.splitTextToSize(text, maxW);
        for (const line of lines) {
          pdf.text(line, x, yy);
          yy += lh;
        }
        return yy;
      };

      // ════════════════════════════════════════
      // ██  HEADER — Dark Navy Band            ██
      // ════════════════════════════════════════
      const headerH = 32;
      pdf.setFillColor(...headerColor);
      pdf.rect(0, 0, pageW, headerH, "F");

      // Badge: "PATENT SUMMARY"
      const badgeX = M;
      const badgeY = 6;
      pdf.setFillColor(255, 255, 255, 0.15 as any);
      // Semi-transparent badge
      const badgeW = 36;
      pdf.setFillColor(headerColor[0] + 30, headerColor[1] + 30, headerColor[2] + 40);
      pdf.roundedRect(badgeX, badgeY, badgeW, 5, 1, 1, "F");
      pdf.setFontSize(5.5);
      pdf.setTextColor(220, 225, 240);
      pdf.text("PATENT SUMMARY", badgeX + 2, badgeY + 3.5);

      // Patent number — right aligned
      pdf.setFontSize(8);
      pdf.setTextColor(180, 190, 210);
      const pnW = pdf.getTextWidth(displayNumber);
      pdf.text(displayNumber, pageW - M - pnW, badgeY + 3.5);

      // Title
      const title = patentData?.titleKo || patentData?.title || patentNumber;
      pdf.setFontSize(15);
      pdf.setTextColor(...V2.white);
      const titleLines = pdf.splitTextToSize(title, CW - 10);
      let titleY = 16;
      for (let i = 0; i < Math.min(titleLines.length, 2); i++) {
        pdf.text(titleLines[i], M, titleY + i * 6);
        pdf.text(titleLines[i], M + 0.12, titleY + i * 6); // faux bold
      }

      // Meta info row at bottom of header
      const metaY = headerH - 4;
      pdf.setFontSize(6);
      pdf.setTextColor(200, 210, 230);
      const metaItems: string[] = [];
      if (patentData?.inventors?.length) {
        const inv = patentData.inventors.length > 4
          ? patentData.inventors.slice(0, 4).join(", ") + ` 등 ${patentData.inventors.length}명`
          : patentData.inventors.join(", ");
        metaItems.push(`👤 ${inv}`);
      }
      if (patentData?.assignee) metaItems.push(`🏢 ${patentData.assignee}`);
      if (patentData?.filingDate) metaItems.push(`📅 출원 ${patentData.filingDate}`);
      if (patentData?.classifications?.length) metaItems.push(`🔬 ${patentData.classifications[0]}`);

      let metaX = M;
      for (const item of metaItems) {
        pdf.text(item, metaX, metaY);
        metaX += pdf.getTextWidth(item) + 6;
        if (metaX > pageW - M - 20) break;
      }

      y = headerH + 6;

      // ════════════════════════════════════════
      // ██  발명 개요 (Summary)                 ██
      // ════════════════════════════════════════
      const summarySection = sections["발명의 요약"] || sections["기술 분야"] || Object.values(sections)[0] || [];
      if (summarySection.length > 0) {
        boldText("발명 개요", M, y + 3, 9, V2.text);

        // Thin underline
        pdf.setDrawColor(...V2.border);
        pdf.setLineWidth(0.3);
        pdf.line(M, y + 5, M + CW, y + 5);
        y += 10;

        const summaryText = summarySection.join(" ").substring(0, 300);
        // Card with left green border
        const sumCardH = 18;
        pdf.setFillColor(...V2.cardBg);
        pdf.setDrawColor(...V2.borderLight);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(M, y, CW, sumCardH, 1.5, 1.5, "FD");
        // Left accent bar
        pdf.setFillColor(...accentColor);
        pdf.rect(M, y, 2.5, sumCardH, "F");

        y += 5;
        y = wrappedText(summaryText, M + 7, y, CW - 14, 8, V2.textSecondary, 4);
        y = Math.max(y, y) + 4;
      }

      // ════════════════════════════════════════
      // ██  기술적 효과 / 권리 범위 (2 cards)    ██
      // ════════════════════════════════════════
      const techFeatures = sections["기술적 특징"] || [];
      const marketTrends = sections["시장동향"] || [];

      if (techFeatures.length > 0 || marketTrends.length > 0) {
        const halfW = (CW - 4) / 2;
        const cardH = 22;

        // Left card: 기술적 효과
        pdf.setFillColor(...V2.cardBg);
        pdf.setDrawColor(...V2.borderLight);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(M, y, halfW, cardH, 1.5, 1.5, "FD");
        // Small badge
        pdf.setFillColor(...accentColor);
        pdf.roundedRect(M + 4, y + 3, 2, 2, 0.5, 0.5, "F");
        boldText("⚡ 기술적 효과", M + 8, y + 5, 7.5, V2.text);
        const techText = techFeatures.slice(0, 2).join(", ").substring(0, 120);
        wrappedText(techText || "—", M + 6, y + 11, halfW - 12, 7, V2.textSecondary, 3.5);

        // Right card: 권리 범위
        const rx = M + halfW + 4;
        pdf.setFillColor(...V2.cardBg);
        pdf.setDrawColor(...V2.borderLight);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(rx, y, halfW, cardH, 1.5, 1.5, "FD");
        pdf.setFillColor(...V2.gold);
        pdf.roundedRect(rx + 4, y + 3, 2, 2, 0.5, 0.5, "F");
        boldText("🔒 권리 범위", rx + 8, y + 5, 7.5, V2.text);
        const marketText = marketTrends.slice(0, 2).join(", ").substring(0, 120);
        wrappedText(marketText || "—", rx + 6, y + 11, halfW - 12, 7, V2.textSecondary, 3.5);

        y += cardH + 4;
      }

      // ════════════════════════════════════════
      // ██  과제 및 해결수단                      ██
      // ════════════════════════════════════════
      const agriSection = sections["농산업 활용 특장점"] || [];
      const trlSection = sections["기술 성숙도 및 상용화 전망"] || [];

      if (agriSection.length > 0 || trlSection.length > 0) {
        boldText("과제 및 해결수단", M, y + 3, 9, V2.text);
        pdf.setDrawColor(...V2.border);
        pdf.setLineWidth(0.3);
        pdf.line(M, y + 5, M + CW, y + 5);
        y += 10;

        const halfW = (CW - 8) / 2;
        const problemCardH = 30;

        // Left: 기존 문제점
        pdf.setFillColor(...V2.cardBg);
        pdf.setDrawColor(...V2.borderLight);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(M, y, halfW, problemCardH, 1.5, 1.5, "FD");
        boldText("⚠ 기존 문제점", M + 5, y + 5, 7, V2.red);
        let py = y + 10;
        for (const item of agriSection.slice(0, 3)) {
          const bullet = `• ${item.substring(0, 60)}`;
          py = wrappedText(bullet, M + 5, py, halfW - 10, 6.5, V2.textSecondary, 3.5);
        }

        // Arrow between
        const arrowX = M + halfW + 2;
        pdf.setFontSize(10);
        pdf.setTextColor(...V2.textMuted);
        pdf.text("→", arrowX, y + problemCardH / 2 + 2);

        // Right: 해결수단
        const rx = M + halfW + 8;
        pdf.setFillColor(...V2.cardBg);
        pdf.setDrawColor(...V2.borderLight);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(rx, y, halfW, problemCardH, 1.5, 1.5, "FD");
        boldText("✓ 해결수단", rx + 5, y + 5, 7, V2.accent);
        let sy = y + 10;
        for (const item of trlSection.slice(0, 3)) {
          const bullet = `• ${item.substring(0, 60)}`;
          sy = wrappedText(bullet, rx + 5, sy, halfW - 10, 6.5, V2.textSecondary, 3.5);
        }

        y += problemCardH + 4;
      }

      // ════════════════════════════════════════
      // ██  핵심 구성요소 (2×2 Grid)             ██
      // ════════════════════════════════════════
      // Build from content sections
      const allSectionKeys = Object.keys(sections).filter(k =>
        !["특허 기본 정보", "발명의 요약", "기술 분야", "기술적 특징", "시장동향", "농산업 활용 특장점", "기술 성숙도 및 상용화 전망"].includes(k)
      );
      const gridItems = allSectionKeys.slice(0, 4).map((key, idx) => ({
        num: idx + 1,
        title: key,
        desc: (sections[key] || []).slice(0, 1).join("").substring(0, 60),
      }));

      if (gridItems.length > 0) {
        boldText("핵심 구성요소", M, y + 3, 9, V2.text);
        pdf.setDrawColor(...V2.border);
        pdf.setLineWidth(0.3);
        pdf.line(M, y + 5, M + CW, y + 5);
        y += 10;

        const halfW = (CW - 4) / 2;
        const cellH = 16;

        for (let i = 0; i < gridItems.length; i++) {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const cx = M + col * (halfW + 4);
          const cy = y + row * (cellH + 3);

          pdf.setFillColor(...V2.cardBg);
          pdf.setDrawColor(...V2.borderLight);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(cx, cy, halfW, cellH, 1.5, 1.5, "FD");

          // Number badge
          pdf.setFillColor(...V2.navy);
          pdf.roundedRect(cx + 4, cy + 3, 6, 6, 1, 1, "F");
          pdf.setFontSize(7);
          pdf.setTextColor(...V2.white);
          const numStr = String(gridItems[i].num);
          pdf.text(numStr, cx + 4 + (6 - pdf.getTextWidth(numStr)) / 2, cy + 7);

          // Title & desc
          boldText(gridItems[i].title, cx + 14, cy + 6, 7.5, V2.text);
          normalText(gridItems[i].desc, cx + 14, cy + 11, 6, V2.textSecondary);
        }

        const rows = Math.ceil(gridItems.length / 2);
        y += rows * (cellH + 3) + 2;
      }

      // ════════════════════════════════════════
      // ██  하단 영역: 기술 키워드 + 권리일정      ██
      // ════════════════════════════════════════
      const bottomY = y + 2;
      const halfW = (CW - 6) / 2;

      // Left: 핵심 기술 키워드
      if (keywords.length > 0) {
        boldText("핵심 기술 키워드", M, bottomY + 3, 8, V2.text);
        let tagX = M;
        let tagY = bottomY + 8;
        for (const kw of keywords) {
          const tw = pdf.getTextWidth(kw) + 6;
          if (tagX + tw > M + halfW) {
            tagX = M;
            tagY += 7;
          }
          pdf.setFillColor(...V2.cardBg);
          pdf.setDrawColor(...V2.border);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(tagX, tagY - 3, tw + 2, 6, 1.5, 1.5, "FD");
          normalText(kw, tagX + 4, tagY + 0.5, 6.5, V2.navy);
          tagX += tw + 4;
        }
        y = tagY + 8;
      }

      // Right: 권리 일정 (Timeline)
      const tlX = M + halfW + 6;
      const tlY = bottomY;
      boldText("권리 일정", tlX, tlY + 3, 8, V2.text);

      const timelineItems = [
        { num: "1", label: "우선일", value: "—" },
        { num: "2", label: "출원일", value: patentData?.filingDate || "—" },
        { num: "3", label: "공개일", value: patentData?.publicationDate || "—" },
        { num: "4", label: "등록일", value: patentData?.registrationNumber ? (patentData?.publicationDate || "—") : "—" },
      ];

      const tlItemW = halfW / 4;
      for (let i = 0; i < timelineItems.length; i++) {
        const ix = tlX + i * tlItemW;
        const iy = tlY + 8;

        // Number circle
        pdf.setFillColor(...V2.navy);
        pdf.roundedRect(ix + (tlItemW - 6) / 2, iy, 6, 5, 1, 1, "F");
        pdf.setFontSize(6);
        pdf.setTextColor(...V2.white);
        const ns = timelineItems[i].num;
        pdf.text(ns, ix + (tlItemW - pdf.getTextWidth(ns)) / 2, iy + 3.5);

        // Value + label
        normalText(timelineItems[i].value, ix + 1, iy + 10, 5.5, V2.text);
        normalText(timelineItems[i].label, ix + 1 + (tlItemW - pdf.getTextWidth(timelineItems[i].label)) / 2, iy + 14, 5, V2.textMuted);
      }

      y = Math.max(y, tlY + 26);

      // ════════════════════════════════════════
      // ██  DISCLAIMER                          ██
      // ════════════════════════════════════════
      if (cfg.show_disclaimer && y < pageH - 30) {
        y += 4;
        pdf.setDrawColor(...V2.border);
        pdf.setLineWidth(0.3);
        pdf.line(M, y, M + CW, y);
        y += 3;
        normalText(cfg.disclaimer_text, M, y + 2, 6, V2.textMuted);
        y += 6;
      }

      // ════════════════════════════════════════
      // ██  FOOTER                              ██
      // ════════════════════════════════════════
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        const fy = pageH - 8;

        pdf.setDrawColor(...V2.border);
        pdf.setLineWidth(0.3);
        pdf.line(M, fy - 2, pageW - M, fy - 2);

        // Left: IPC
        if (patentData?.ipc) {
          normalText(`IPC: ${patentData.ipc.split(",")[0].trim()}`, M, fy + 1, 6, V2.textMuted);
        }

        // Center: AI 자동 생성
        if (cfg.footer_show_date) {
          const dateStr = `AI 자동 생성 · ${new Date().toLocaleDateString("ko-KR")}`;
          const dw = pdf.getTextWidth(dateStr);
          normalText(dateStr, (pageW - dw) / 2, fy + 1, 6, V2.textMuted);
        }

        // Right: patent number
        pdf.setFontSize(6);
        const pnStr = displayNumber;
        const pw = pdf.getTextWidth(pnStr);
        normalText(pnStr, pageW - M - pw, fy + 1, 6, V2.textMuted);
      }

      pdf.save(`특허요약v2_${patentNumber}.pdf`);
      toast.success("PDF(Ver2)가 다운로드되었습니다!");
    } catch (error) {
      console.error("PDF V2 generation error:", error);
      toast.error("PDF 생성 중 오류가 발생했습니다.");
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePdfDownload} className="gap-2" disabled={!content}>
      <FileDown className="w-4 h-4" />
      PDF 다운로드
    </Button>
  );
}
