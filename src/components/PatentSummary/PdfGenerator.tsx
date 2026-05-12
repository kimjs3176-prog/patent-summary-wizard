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

// ─── Toss-style Minimal Design System ───
const T = {
  textDark: [31, 41, 55] as [number, number, number],       // #1F2937
  textBody: [55, 65, 81] as [number, number, number],       // #374151
  textMuted: [107, 114, 128] as [number, number, number],   // #6B7280
  textFaint: [156, 163, 175] as [number, number, number],   // #9CA3AF
  divider: [229, 231, 235] as [number, number, number],     // #E5E7EB
  dividerLight: [243, 244, 246] as [number, number, number],// #F3F4F6
  bandBg: [248, 250, 252] as [number, number, number],      // #F8FAFC
  white: [255, 255, 255] as [number, number, number],
  // Brand emerald (overridden by cfg)
  brand: [16, 173, 127] as [number, number, number],        // #10AD7F
  brandSoft: [220, 247, 238] as [number, number, number],   // #DCF7EE
  brandDeep: [13, 138, 102] as [number, number, number],    // #0D8A66
};

export function PdfGenerator({
  content,
  patentNumber,
  patentData,
  commercializationScore,
  commercializationDetails,
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
      const margin = Math.max(16, cfg.page_margin);
      const contentWidth = pageWidth - margin * 2;
      let yPosition = margin + 4;

      // brand color (use cfg.section_accent_color or header_bg_color)
      const brand = hexToRgb(cfg.section_accent_color || "#10AD7F");
      const brandSoft: [number, number, number] = [
        Math.round(brand[0] + (255 - brand[0]) * 0.86),
        Math.round(brand[1] + (255 - brand[1]) * 0.86),
        Math.round(brand[2] + (255 - brand[2]) * 0.86),
      ];

      const footerReserve = 14;

      const checkNewPage = (neededHeight: number) => {
        if (yPosition + neededHeight > pageHeight - margin - footerReserve) {
          pdf.addPage();
          yPosition = margin + 4;
          return true;
        }
        return false;
      };

      const drawText = (
        text: string,
        x: number,
        y: number,
        opts: { size?: number; color?: [number, number, number]; bold?: boolean; align?: "left" | "right" | "center" } = {}
      ) => {
        const { size = 9, color = T.textBody, bold = false, align = "left" } = opts;
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
        let xPos = x;
        if (align === "right") xPos = x - pdf.getTextWidth(text);
        else if (align === "center") xPos = x - pdf.getTextWidth(text) / 2;
        pdf.text(text, xPos, y);
        if (bold) pdf.text(text, xPos + 0.13, y);
      };

      // ── Inline bold text renderer ──
      const addWrappedText = (
        text: string,
        fontSize: number,
        color: [number, number, number],
        lineHeight = 1.65,
        indentX = margin
      ) => {
        const maxW = pageWidth - indentX - margin;
        const lhMm = fontSize * 0.352778 * lineHeight;
        const segments = text.split(/(\*\*[^*]+\*\*)/g);
        const plainText = text.replace(/\*\*/g, "");
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
            const isBold = seg.startsWith("**") && seg.endsWith("**");
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
              remaining = "";
            } else {
              if (remaining) lineSegments.push({ text: remaining, bold: false });
              charIdx += remaining.length;
              remaining = "";
            }
          }
          for (const ls of lineSegments) {
            pdf.setFontSize(fontSize);
            pdf.setTextColor(...(ls.bold ? T.textDark : color));
            pdf.text(ls.text, xPos, yPosition);
            if (ls.bold) pdf.text(ls.text, xPos + 0.13, yPosition);
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
        } catch {
          return null;
        }
      };

      const isApp = patentData?.searchType === "application";
      const displayNumber = isApp
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApp ? "출원번호" : "등록번호";
      const dateLabel = isApp ? "출원" : "등록";
      const dateValue = (isApp ? patentData?.filingDate : patentData?.publicationDate) || patentData?.filingDate || "";

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  HEADER — Pill badge + Big title         ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // Pill badge: "특허 요약 리포트"
      const badgeText = "특허 요약 리포트";
      pdf.setFontSize(7.5);
      const badgeTextW = pdf.getTextWidth(badgeText);
      const badgeW = badgeTextW + 8;
      const badgeH = 6.2;
      const badgeY = yPosition;
      pdf.setFillColor(...brandSoft);
      pdf.roundedRect(margin, badgeY, badgeW, badgeH, badgeH / 2, badgeH / 2, "F");
      pdf.setTextColor(...brand);
      pdf.text(badgeText, margin + 4, badgeY + 4.4);
      pdf.text(badgeText, margin + 4.1, badgeY + 4.4);

      yPosition = badgeY + badgeH + 6;

      // Title — large, bold, multi-line
      const title = patentData?.titleKo || patentData?.title || "특허 요약";
      pdf.setFontSize(18);
      const titleLines = pdf.splitTextToSize(title, contentWidth).slice(0, 3);
      for (const tLine of titleLines) {
        checkNewPage(8);
        pdf.setTextColor(...T.textDark);
        pdf.setFontSize(18);
        pdf.text(tLine, margin, yPosition);
        pdf.text(tLine, margin + 0.18, yPosition);
        yPosition += 8;
      }

      yPosition += 1;

      // Meta line
      const metaParts: string[] = [];
      metaParts.push(`${numberLabel} ${displayNumber}`);
      if (patentData?.assignee) metaParts.push(patentData.assignee);
      if (dateValue) metaParts.push(`${dateValue} ${dateLabel}`);
      const metaText = metaParts.join(" · ");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...T.textFaint);
      const metaLines = pdf.splitTextToSize(metaText, contentWidth);
      for (const ml of metaLines) {
        checkNewPage(5);
        pdf.text(ml, margin, yPosition);
        yPosition += 4.4;
      }

      yPosition += 4;

      // Thin divider
      pdf.setDrawColor(...T.divider);
      pdf.setLineWidth(0.25);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  STAT BAND — TRL · Score · Filing date  ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const trlVal = commercializationDetails?.trl;
      const scoreVal = commercializationScore != null ? Math.round(commercializationScore) : null;
      const grade = scoreVal == null ? "" : scoreVal >= 85 ? "S" : scoreVal >= 75 ? "A" : scoreVal >= 65 ? "B" : "C";

      type Stat = { label: string; main: string; sub?: string };
      const stats: Stat[] = [];
      if (trlVal != null) stats.push({ label: "TRL", main: `${trlVal}`, sub: "단계" });
      if (scoreVal != null && cfg.show_commercialization_score) stats.push({ label: "상용화 점수", main: `${scoreVal}`, sub: `점 · ${grade}` });
      if (patentData?.filingDate) stats.push({ label: "출원일", main: patentData.filingDate.replace(/-/g, ".") });
      else if (patentData?.assignee) stats.push({ label: "출원인", main: patentData.assignee.length > 12 ? patentData.assignee.slice(0, 12) + "…" : patentData.assignee });

      if (stats.length > 0) {
        const bandH = 22;
        checkNewPage(bandH + 8);
        const bY = yPosition;
        pdf.setFillColor(...T.bandBg);
        pdf.roundedRect(margin, bY, contentWidth, bandH, 3, 3, "F");

        const colW = contentWidth / stats.length;
        for (let i = 0; i < stats.length; i++) {
          const s = stats[i];
          const cx = margin + colW * i + colW / 2;
          // label
          drawText(s.label, cx, bY + 7.2, { size: 7.2, color: T.textMuted, align: "center" });
          // main + sub on same baseline
          pdf.setFontSize(15);
          pdf.setTextColor(...T.textDark);
          const mainW = pdf.getTextWidth(s.main);
          let subW = 0;
          if (s.sub) {
            pdf.setFontSize(8.5);
            subW = pdf.getTextWidth(" " + s.sub);
          }
          const totalW = mainW + subW;
          const startX = cx - totalW / 2;
          pdf.setFontSize(15);
          pdf.setTextColor(...T.textDark);
          pdf.text(s.main, startX, bY + 16);
          pdf.text(s.main, startX + 0.18, bY + 16);
          if (s.sub) {
            pdf.setFontSize(8.5);
            pdf.setTextColor(...T.textMuted);
            pdf.text(" " + s.sub, startX + mainW, bY + 16);
          }

          // divider
          if (i < stats.length - 1) {
            pdf.setDrawColor(...T.divider);
            pdf.setLineWidth(0.2);
            pdf.line(margin + colW * (i + 1), bY + 4, margin + colW * (i + 1), bY + bandH - 4);
          }
        }
        yPosition = bY + bandH + 10;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  CONTENT SECTIONS                        ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const lines = content.split("\n");
      let skipSection = false;
      let imageInserted = false;

      const insertImages = async () => {
        if (imageInserted) return;
        const imagesToUse = patentData?.images?.slice(0, 3) || (patentData?.representativeImage ? [patentData.representativeImage] : []);
        if (imagesToUse.length === 0) return;

        checkNewPage(56);
        yPosition += 2;

        if (imagesToUse.length > 1) {
          const imgH = 46;
          const gap = 5;
          const totalW = contentWidth;
          const imgW = (totalW - gap * (imagesToUse.length - 1)) / imagesToUse.length;
          for (let i = 0; i < imagesToUse.length; i++) {
            const img = await loadImageForPdf(imagesToUse[i]);
            if (!img) continue;
            const imgX = margin + i * (imgW + gap);
            pdf.setFillColor(...T.dividerLight);
            pdf.roundedRect(imgX, yPosition, imgW, imgH, 2, 2, "F");
            pdf.addImage(img.dataUrl, img.format, imgX + 1.5, yPosition + 1.5, imgW - 3, imgH - 3);
          }
          yPosition += imgH + 4;
        } else {
          const img = await loadImageForPdf(imagesToUse[0]);
          if (img) {
            const imgW = 70;
            const imgH = 52;
            const imgX = (pageWidth - imgW) / 2;
            pdf.setFillColor(...T.dividerLight);
            pdf.roundedRect(imgX, yPosition, imgW, imgH, 2, 2, "F");
            pdf.addImage(img.dataUrl, img.format, imgX + 2, yPosition + 2, imgW - 4, imgH - 4);
            yPosition += imgH + 4;
          }
        }
        imageInserted = true;
      };

      const isDuplicatePatentInfo = (text: string): boolean => {
        return (
          /등록번호[는:\s]/.test(text) ||
          /출원번호[는:\s]/.test(text) ||
          text.includes("발명의 명칭은") ||
          text.includes("출원인/권리자는") ||
          text.includes("출원일/등록일은") ||
          text.includes("발명자는") ||
          (!!displayNumber && text.includes(displayNumber))
        );
      };

      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        if (line.startsWith("## 특허 기본 정보")) {
          skipSection = true;
          continue;
        }
        if (skipSection && line.startsWith("## ")) skipSection = false;
        if (skipSection) continue;
        if (isDuplicatePatentInfo(line)) continue;

        const cleanLine = line.replace(/^\s*[-•]\s+/, "").replace(/^\s*\d+\.\s+/, "");

        if (line.startsWith("## ")) {
          const sectionTitle = line.replace("## ", "").replace(/\*\*/g, "").trim();
          if (sectionTitle === "특허 기본 정보") {
            skipSection = true;
            continue;
          }
          if (sectionTitle.includes("AI 종합") || sectionTitle.includes("종합 요약") || sectionTitle.includes("종합요약")) continue;
          if (!cfg.show_trl && (sectionTitle.includes("기술성숙도") || sectionTitle.includes("TRL"))) continue;
          if (!cfg.show_claims && (sectionTitle.includes("청구항") || sectionTitle.includes("특허 청구"))) {
            skipSection = true;
            continue;
          }

          // Section header: green vertical bar + title
          checkNewPage(18);
          yPosition += 4;
          const headerY = yPosition;
          // Left vertical bar
          pdf.setFillColor(...brand);
          pdf.rect(margin, headerY - 4.6, 1.6, 5.6, "F");
          // Title
          pdf.setFontSize(12);
          pdf.setTextColor(...T.textDark);
          pdf.text(sectionTitle, margin + 4, headerY);
          pdf.text(sectionTitle, margin + 4.18, headerY);

          yPosition = headerY + 5.5;

          if (
            (sectionTitle === "발명요약 및 특징" ||
              sectionTitle === "발명의 요약" ||
              sectionTitle === "발명의 요약 및 기술적 특징") &&
            cfg.show_patent_images
          ) {
            await insertImages();
          }
        } else if (cleanLine.trim()) {
          addWrappedText(cleanLine, cfg.body_font_size, T.textBody, cfg.line_height, margin);
          yPosition += 1.4;
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  AI COMMERCIALIZATION SCORE DETAIL       ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (
        cfg.show_commercialization_score &&
        commercializationScore != null &&
        commercializationDetails &&
        (commercializationDetails.technologyScore != null ||
          commercializationDetails.marketScore != null ||
          commercializationDetails.businessScore != null)
      ) {
        const subs = [
          { label: "기술성", v: commercializationDetails.technologyScore },
          { label: "시장성", v: commercializationDetails.marketScore },
          { label: "사업성", v: commercializationDetails.businessScore },
        ].filter((s) => typeof s.v === "number");

        let analysisLines: string[] = [];
        if (commercializationDetails.analysis) {
          pdf.setFontSize(8.5);
          analysisLines = pdf.splitTextToSize(commercializationDetails.analysis.replace(/\*\*/g, ""), contentWidth - 8).slice(0, 6);
        }

        const blockH = 6 + (subs.length ? 16 : 0) + (analysisLines.length ? analysisLines.length * 4 + 4 : 0);
        checkNewPage(blockH + 14);

        // Section header
        yPosition += 6;
        const headerY = yPosition;
        pdf.setFillColor(...brand);
        pdf.rect(margin, headerY - 4.6, 1.6, 5.6, "F");
        pdf.setFontSize(12);
        pdf.setTextColor(...T.textDark);
        pdf.text("AI 사업화 분석", margin + 4, headerY);
        pdf.text("AI 사업화 분석", margin + 4.18, headerY);
        yPosition = headerY + 6;

        // Sub scores
        if (subs.length) {
          const colGap = 6;
          const colW = (contentWidth - colGap * (subs.length - 1)) / subs.length;
          for (let i = 0; i < subs.length; i++) {
            const s = subs[i];
            const x = margin + i * (colW + colGap);
            // label
            drawText(s.label, x, yPosition, { size: 7.5, color: T.textMuted });
            // value
            const vStr = `${Math.round(s.v as number)}`;
            pdf.setFontSize(11);
            pdf.setTextColor(...T.textDark);
            const vW = pdf.getTextWidth(vStr);
            pdf.text(vStr, x + colW - vW - 8, yPosition);
            pdf.text(vStr, x + colW - vW - 7.85, yPosition);
            drawText("/100", x + colW - 6, yPosition, { size: 6.8, color: T.textFaint });
            // bar
            const barY = yPosition + 2;
            pdf.setFillColor(...T.dividerLight);
            pdf.roundedRect(x, barY, colW, 1.8, 0.9, 0.9, "F");
            pdf.setFillColor(...brand);
            pdf.roundedRect(x, barY, Math.max(2, colW * ((s.v as number) / 100)), 1.8, 0.9, 0.9, "F");
          }
          yPosition += 11;
        }

        // Analysis text
        if (analysisLines.length) {
          pdf.setFontSize(8.5);
          pdf.setTextColor(...T.textBody);
          for (const ln of analysisLines) {
            checkNewPage(5);
            pdf.text(ln, margin, yPosition);
            yPosition += 4;
          }
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  DISCLAIMER                              ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (cfg.show_disclaimer) {
        checkNewPage(18);
        yPosition += 8;
        pdf.setFontSize(7.5);
        pdf.setTextColor(...T.textFaint);
        const dLines = pdf.splitTextToSize(cfg.disclaimer_text, contentWidth);
        for (const ln of dLines) {
          checkNewPage(5);
          pdf.text(ln, margin, yPosition);
          yPosition += 3.6;
        }
      }

      // KIPRIS link
      if (patentData?.applicationNumber) {
        checkNewPage(10);
        yPosition += 4;
        const kiprisUrl = `https://www.kipris.or.kr/khome/detail/newWindow.do?right=kpat&applno=${patentData.applicationNumber}`;
        pdf.setFontSize(7.5);
        pdf.setTextColor(...brand);
        pdf.textWithLink("→ KIPRIS 특허상세보기", margin, yPosition, { url: kiprisUrl });
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  FOOTER                                  ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        const fy = pageHeight - 9;
        // very light divider
        pdf.setDrawColor(...T.dividerLight);
        pdf.setLineWidth(0.2);
        pdf.line(margin, fy - 3.5, pageWidth - margin, fy - 3.5);

        pdf.setFontSize(7);
        pdf.setTextColor(...T.textFaint);
        pdf.text(cfg.footer_text || "농식품분야 특허 AI 기술요약", margin, fy);

        const dateText = cfg.footer_show_date
          ? new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\.\s/g, ".").replace(/\.$/, "")
          : "";
        const pageText = cfg.footer_show_page ? `${i}` : "";
        const right = [dateText, pageText].filter(Boolean).join(" · ");
        if (right) {
          const rW = pdf.getTextWidth(right);
          pdf.text(right, pageWidth - margin - rW, fy);
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
