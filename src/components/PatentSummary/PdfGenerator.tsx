import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { PatentData } from "./types";
import { loadKoreanFont, addKoreanFontToDoc } from "@/lib/koreanFont";
import { CommercializationDetails } from "./TechnologyCommercializationScore";
import { DEFAULT_PDF_CONFIG, TOSS_TEMPLATE_VERSION, type PdfLayoutConfig } from "@/components/admin/PdfLayoutSettings";

interface PdfGeneratorProps {
  content: string;
  patentNumber: string;
  patentData?: PatentData | null;
  printRef: React.RefObject<HTMLDivElement | null>;
  commercializationDetails?: CommercializationDetails | null;
  layoutConfig?: PdfLayoutConfig;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
};

// Citation markers like [^1] are kept as inline tokens; they get rendered
// as superscript numerals (small font, raised baseline) inside addWrappedText.
// For places that don't use the inline renderer we just strip the marker
// brackets so the digit remains, e.g. "[^1]" → "1".
const stripCitationBrackets = (text: string): string =>
  text ? text.replace(/\[\^(\d+)\]/g, "$1") : text;
// ─── Toss-style Minimal Design System ───
const T = {
  textDark: [17, 24, 39] as [number, number, number],         // #111827 (darker for legibility)
  textBody: [31, 41, 55] as [number, number, number],         // #1F2937 (darker body)
  textMuted: [75, 85, 99] as [number, number, number],        // #4B5563
  textFaint: [107, 114, 128] as [number, number, number],     // #6B7280
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
  commercializationDetails,
  layoutConfig,
}: PdfGeneratorProps) {
  // Force the latest Toss-style visual template. If the saved layoutConfig
  // was created before the current template version, drop its stale visual
  // fields (colors, sizes, margins) and only keep visibility/text toggles.
  const STYLE_KEYS: (keyof PdfLayoutConfig)[] = [
    "header_bg_color",
    "section_accent_color",
    "meta_accent_color",
    "body_font_size",
    "line_height",
    "page_margin",
    "section_title_size",
  ];
  const isLatestTemplate = layoutConfig?.template_version === TOSS_TEMPLATE_VERSION;
  const sanitizedLayout: Partial<PdfLayoutConfig> = !layoutConfig
    ? {}
    : isLatestTemplate
      ? layoutConfig
      : Object.fromEntries(
          Object.entries(layoutConfig).filter(([k]) => !STYLE_KEYS.includes(k as keyof PdfLayoutConfig))
        );
  const baseCfg = { ...DEFAULT_PDF_CONFIG, ...sanitizedLayout, template_version: TOSS_TEMPLATE_VERSION };

  const handlePdfDownload = async () => {
    if (!content) {
      toast.error("PDF 생성에 실패했습니다.");
      return;
    }

    toast.info("PDF 생성 중... (폰트 로딩 중)");

    try {
      const koreanFontBase64 = await loadKoreanFont();

      // ── Auto-fit to 2 pages ──
      // Generate the document, count pages, and if it overflows shrink the
      // font/line-height/margin and re-render. Up to 5 attempts.
      let cfg = { ...baseCfg };
      let pdf!: jsPDF;
      let pageWidth = 0;
      let pageHeight = 0;
      let margin = 0;
      let pageHeadsOut: Record<number, string> = {};
      let outlineOut: { title: string; page: number }[] = [];
      let brandOut: [number, number, number] = [16, 173, 127];
      let docTitleOut = "특허 요약";
      const TARGET_PAGES = 2;
      const MAX_ATTEMPTS = 5;


      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
        precision: 16,
        putOnlyUsedFonts: true,
      });
      addKoreanFontToDoc(pdf, koreanFontBase64);

      pageWidth = pdf.internal.pageSize.getWidth();
      pageHeight = pdf.internal.pageSize.getHeight();
      margin = Math.max(10, cfg.page_margin);
      const contentWidth = pageWidth - margin * 2;
      // Top reserve matches the section-block rhythm used elsewhere
      // (sections start with `yPosition += 6` after a divider/gap),
      // so we keep ~6mm above the badge for visual consistency.
      let yPosition = margin + 6;

      // brand color (use cfg.section_accent_color or header_bg_color)
      const brand = hexToRgb(cfg.section_accent_color || "#10AD7F");
      const brandSoft: [number, number, number] = [
        Math.round(brand[0] + (255 - brand[0]) * 0.86),
        Math.round(brand[1] + (255 - brand[1]) * 0.86),
        Math.round(brand[2] + (255 - brand[2]) * 0.86),
      ];

      const footerReserve = 14;
      // Running head reserve on continuation pages (book anatomy: 러닝 헤드)
      const headReserve = 10;

      const pageHeads: Record<number, string> = {};

      const checkNewPage = (neededHeight: number) => {
        if (yPosition + neededHeight > pageHeight - margin - footerReserve) {
          pdf.addPage();
          yPosition = margin + headReserve;
          pageHeads[pdf.getNumberOfPages()] = runningHeadTitle;
          return true;
        }
        return false;
      };


      // Space left on the current page for body content
      const spaceLeft = () => pageHeight - margin - footerReserve - yPosition;


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

      // ── Blueprint helpers (mirrors the web report styling) ──
      // Mono kicker/index labels use a built-in monospace face; Korean text
      // keeps the embedded Noto font.
      const KOREAN_FONT = pdf.getFont().fontName;
      const drawMono = (
        text: string,
        x: number,
        y: number,
        opts: { size?: number; color?: [number, number, number]; align?: "left" | "right" } = {}
      ) => {
        const { size = 6.8, color = T.textFaint, align = "left" } = opts;
        // Courier has no Hangul glyphs → fall back to the embedded Korean font
        const isAscii = !/[^\x00-\x7F]/.test(text);
        pdf.setFont(isAscii ? "courier" : KOREAN_FONT, "normal");
        pdf.setFontSize(size);
        pdf.setTextColor(...color);

        const w = pdf.getTextWidth(text);
        pdf.text(text, align === "right" ? x - w : x, y);
        pdf.setFont(KOREAN_FONT, "normal");
        return w;
      };

      const dottedRule = (y: number, x1 = margin, x2 = pageWidth - margin) => {
        pdf.setDrawColor(...T.divider);
        pdf.setLineWidth(0.2);
        const step = 1.1;
        for (let x = x1; x < x2; x += step) {
          pdf.line(x, y, Math.min(x + 0.5, x2), y);
        }
      };

      const cornerMarks = (x: number, y: number, w: number, h: number, len = 3) => {
        pdf.setDrawColor(...brand);
        pdf.setLineWidth(0.4);
        pdf.line(x, y, x + len, y); pdf.line(x, y, x, y + len);
        pdf.line(x + w - len, y, x + w, y); pdf.line(x + w, y, x + w, y + len);
        pdf.line(x, y + h - len, x, y + h); pdf.line(x, y + h, x + len, y + h);
        pdf.line(x + w - len, y + h, x + w, y + h); pdf.line(x + w, y + h - len, x + w, y + h);
      };

      let sectionIndex = 0;
      // Section register → PDF bookmarks (outline) + running head context
      const outlineEntries: { title: string; page: number }[] = [];
      let runningHeadTitle = "";

      const sectionHeader = (title: string) => {
        yPosition += 6;
        sectionIndex += 1;
        const headerY = yPosition;
        const idx = `§${String(sectionIndex).padStart(2, "0")}`;
        const idxW = drawMono(idx, margin, headerY, { size: 7.6, color: brand });
        pdf.setFontSize(cfg.section_title_size + 0.5);
        pdf.setTextColor(...T.textDark);
        pdf.text(title, margin + idxW + 3, headerY);
        pdf.text(title, margin + idxW + 3.08, headerY);
        dottedRule(headerY + 2.4);
        outlineEntries.push({ title: `${idx} ${title}`, page: pdf.getNumberOfPages() });
        runningHeadTitle = title;
        return headerY;
      };


      // ── Inline bold text renderer ──
      const SUP_TOKEN_RE = /(\*\*[^*]+\*\*|\[\^\d+\])/g;

      const addWrappedText = (
        rawText: string,
        fontSize: number,
        color: [number, number, number],
        lineHeight = 1.65,
        indentX = margin
      ) => {
        const text = rawText;
        const maxW = pageWidth - indentX - margin;
        const lhMm = fontSize * 0.352778 * lineHeight;
        // Tokenize: keep bold spans, citation markers, and plain text as
        // separate segments. Plain text used for wrapping has bold delimiters
        // removed and citation markers reduced to bare digits so wrapping
        // measurements stay close to the rendered result.
        const segments = text.split(SUP_TOKEN_RE).filter((s) => s !== undefined && s !== "");
        const plainText = text
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/\[\^(\d+)\]/g, "$1");
        pdf.setFontSize(fontSize);
        const wrappedLines = pdf.splitTextToSize(plainText, maxW);

        // ── Widow / orphan control (book typesetting) ──
        // Never leave a single line of a paragraph alone at the bottom of a
        // page, nor carry a single line over to the next page.
        if (wrappedLines.length >= 2) {
          const fits = Math.max(0, Math.floor(spaceLeft() / lhMm));
          if (fits > 0 && fits < wrappedLines.length && (fits === 1 || wrappedLines.length - fits === 1)) {
            pdf.addPage();
            yPosition = margin + headReserve;
            pageHeads[pdf.getNumberOfPages()] = runningHeadTitle;
          }
        }

        let charIdx = 0;

        for (const wLine of wrappedLines) {
          checkNewPage(lhMm + 1);
          let xPos = indentX;
          let remaining = wLine;
          type Kind = "plain" | "bold" | "sup";
          const lineSegments: { text: string; kind: Kind }[] = [];
          let segCharCount = 0;
          for (const seg of segments) {
            if (!remaining) break;
            const isBold = seg.startsWith("**") && seg.endsWith("**");
            const supMatch = /^\[\^(\d+)\]$/.exec(seg);
            const isSup = !!supMatch;
            const cleanSeg = isBold ? seg.slice(2, -2) : isSup ? supMatch![1] : seg;
            const kind: Kind = isBold ? "bold" : isSup ? "sup" : "plain";
            if (segCharCount + cleanSeg.length <= charIdx) {
              segCharCount += cleanSeg.length;
              continue;
            }
            const startInSeg = Math.max(0, charIdx - segCharCount);
            const availableFromSeg = cleanSeg.substring(startInSeg);
            if (availableFromSeg.length <= remaining.length && remaining.startsWith(availableFromSeg)) {
              if (availableFromSeg) lineSegments.push({ text: availableFromSeg, kind });
              remaining = remaining.substring(availableFromSeg.length);
              segCharCount += cleanSeg.length;
              charIdx = segCharCount;
            } else if (remaining.length < availableFromSeg.length && availableFromSeg.startsWith(remaining)) {
              if (remaining) lineSegments.push({ text: remaining, kind });
              charIdx += remaining.length;
              remaining = "";
            } else {
              if (remaining) lineSegments.push({ text: remaining, kind: "plain" });
              charIdx += remaining.length;
              remaining = "";
            }
          }
          for (const ls of lineSegments) {
            if (ls.kind === "sup") {
              const supSize = Math.max(5.5, fontSize * 0.62);
              pdf.setFontSize(supSize);
              pdf.setTextColor(...T.textMuted);
              // Raise baseline ~35% of body font height
              const supY = yPosition - fontSize * 0.352778 * 0.42;
              pdf.text(ls.text, xPos, supY);
              xPos += pdf.getTextWidth(ls.text) + 0.2;
              pdf.setFontSize(fontSize);
            } else {
              pdf.setFontSize(fontSize);
              pdf.setTextColor(...(ls.kind === "bold" ? T.textDark : color));
              pdf.text(ls.text, xPos, yPosition);
              if (ls.kind === "bold") pdf.text(ls.text, xPos + 0.13, yPosition);
              xPos += pdf.getTextWidth(ls.text);
            }
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
          const rawDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("FileReader failed"));
            reader.readAsDataURL(blob);
          });
          // ── Upscale to ~300 DPI for print-grade quality ──
          // Render the source bitmap into a high-resolution canvas so that
          // when jsPDF embeds it at small physical dimensions (mm), the
          // effective pixel density meets booklet print standards (≥300 DPI).
          try {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
              const im = new Image();
              im.crossOrigin = "anonymous";
              im.onload = () => resolve(im);
              im.onerror = () => reject(new Error("Image decode failed"));
              im.src = rawDataUrl;
            });
            // Target ~300 DPI at the largest physical width we render (~80mm)
            // → 80mm / 25.4 * 300 ≈ 945px. Use 1400px as a safe ceiling so
            // line art (KIPRIS drawings) stays crisp without bloating files.
            const TARGET_PX = 1400;
            const scale = Math.min(
              4,
              Math.max(1, TARGET_PX / Math.max(img.naturalWidth, img.naturalHeight))
            );
            const w = Math.round(img.naturalWidth * scale);
            const h = Math.round(img.naturalHeight * scale);
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = "high";
              // White matte for transparent PNGs (avoids gray on print)
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, w, h);
              ctx.drawImage(img, 0, 0, w, h);
              // PNG preserves crisp lines/text in patent drawings
              const hiResDataUrl = canvas.toDataURL("image/png");
              return { dataUrl: hiResDataUrl, format: "PNG" };
            }
          } catch {
            // Fall through to raw data URL if upscaling fails
          }
          return { dataUrl: rawDataUrl, format: ct.includes("png") ? "PNG" : "JPEG" };
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

      // Blueprint document head: mono kicker rail + doc id
      const badgeY = yPosition;
      const badgeH = 6.2;
      pdf.setFillColor(...brand);
      pdf.rect(margin, badgeY + 1.2, 6, 0.6, "F");
      drawMono("AI TECH ANALYSIS REPORT", margin + 8, badgeY + 3, { size: 7, color: brand });
      drawMono(
        `DOC / ${String(displayNumber).replace(/[^0-9A-Za-z-]/g, "")}`,
        pageWidth - margin,
        badgeY + 3,
        { size: 6.6, color: T.textFaint, align: "right" }
      );
      dottedRule(badgeY + 5.4);

      // Title — large, bold, multi-line.
      // Auto-shrink the font so long titles wrap naturally without truncation,
      // and scale the badge↔title and title↔meta gaps to the resulting block.
      const title = patentData?.titleKo || patentData?.title || "특허 요약";
      const titleCandidates: Array<{ size: number; lh: number; maxLines: number }> = [
        { size: 18, lh: 8.0, maxLines: 2 },
        { size: 16, lh: 7.2, maxLines: 3 },
        { size: 14, lh: 6.4, maxLines: 4 },
        { size: 12.5, lh: 5.8, maxLines: 5 },
      ];
      let titleSize = 18;
      let titleLh = 8.0;
      let titleLines: string[] = [];
      for (const c of titleCandidates) {
        pdf.setFontSize(c.size);
        const wrapped = pdf.splitTextToSize(title, contentWidth);
        if (wrapped.length <= c.maxLines || c === titleCandidates[titleCandidates.length - 1]) {
          titleSize = c.size;
          titleLh = c.lh;
          titleLines = wrapped.slice(0, c.maxLines);
          break;
        }
      }

      // Scale head → title gap with title block height
      const badgeToTitleGap = titleLines.length <= 1 ? 9 : titleLines.length === 2 ? 11 : 13;
      yPosition = badgeY + badgeH + badgeToTitleGap;

      pdf.setFontSize(titleSize);
      for (const tLine of titleLines) {
        checkNewPage(titleLh);
        pdf.setTextColor(...T.textDark);
        pdf.setFontSize(titleSize);
        pdf.text(tLine, margin, yPosition);
        pdf.text(tLine, margin + 0.18, yPosition);
        yPosition += titleLh;
      }

      // Scale title → info box gap with the wrapped title length
      yPosition += titleLines.length <= 1 ? 3.5 : titleLines.length === 2 ? 4.5 : 5.5;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  INFO BOX — grouped patent metadata      ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const trlVal = commercializationDetails?.trl;

      type Field = { label: string; value: string };
      const fields: Field[] = [];
      const push = (label: string, value?: string | null) => {
        if (value && String(value).trim()) fields.push({ label, value: String(value).trim() });
      };
      push(numberLabel, String(displayNumber));
      if (!isApp && patentData?.applicationNumber) push("출원번호", patentData.applicationNumber);
      push("출원인", patentData?.assignee);
      push("출원일", patentData?.filingDate?.replace(/-/g, "."));
      if (dateValue && !isApp) push(`${dateLabel}일`, dateValue.replace(/-/g, "."));
      push("발명자", patentData?.inventors?.slice(0, 3).join(", "));
      push("IPC", patentData?.classifications?.slice(0, 2).join(", "));
      if (trlVal != null) push("TRL", `${trlVal}단계`);

      if (fields.length > 0) {
        const cols = 2;
        const rows = Math.ceil(fields.length / cols);
        const padY = 5.2;
        const rowH = 7.2;
        const boxH = padY * 2 + rows * rowH - 1.6;
        checkNewPage(boxH + 8);
        const bY = yPosition;
        pdf.setFillColor(...T.bandBg);
        pdf.rect(margin, bY, contentWidth, boxH, "F");
        cornerMarks(margin, bY, contentWidth, boxH);

        const colW = contentWidth / cols;
        const labelW = 20;
        for (let i = 0; i < fields.length; i++) {
          const c = i % cols;
          const r = Math.floor(i / cols);
          const x = margin + colW * c + 6;
          const y = bY + padY + r * rowH + 3.2;
          drawMono(fields[i].label, x, y, { size: 6.6, color: T.textFaint });
          pdf.setFontSize(8.6);
          pdf.setTextColor(...T.textDark);
          const vLines = pdf.splitTextToSize(fields[i].value, colW - labelW - 12);
          pdf.text(vLines[0] + (vLines.length > 1 ? "…" : ""), x + labelW, y);
        }

        // column divider
        if (fields.length > 1) {
          pdf.setDrawColor(...T.divider);
          pdf.setLineWidth(0.2);
          const xD = margin + colW;
          for (let yD = bY + 4; yD < bY + boxH - 4; yD += 1.2) {
            pdf.line(xD, yD, xD, Math.min(yD + 0.6, bY + boxH - 4));
          }
        }
        yPosition = bY + boxH + 9;
      } else {
        dottedRule(yPosition);
        yPosition += 8;
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
            pdf.addImage(img.dataUrl, img.format, imgX + 1.5, yPosition + 1.5, imgW - 3, imgH - 3, undefined, "SLOW");
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
            pdf.addImage(img.dataUrl, img.format, imgX + 2, yPosition + 2, imgW - 4, imgH - 4, undefined, "SLOW");
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

          // ── Auto-balanced gap between section title and body ──
          // Lookahead first so we can both (a) scale the gap to body length
          // and (b) reserve enough page space to keep the title with at
          // least the first lines of body — preventing orphaned headings.
          let firstParagraph = "";
          for (let lk = li + 1; lk < lines.length; lk++) {
            const peek = lines[lk];
            if (peek.startsWith("## ")) break;
            if (isDuplicatePatentInfo(peek)) continue;
            const cleanPeek = peek.replace(/^\s*[-•]\s+/, "").replace(/^\s*\d+\.\s+/, "").trim();
            if (!cleanPeek) {
              if (firstParagraph) break; // blank line ends first paragraph
              continue;
            }
            firstParagraph += (firstParagraph ? " " : "") + cleanPeek.replace(/\*\*/g, "");
            if (firstParagraph.length > 240) break;
          }
          let gapAfterTitle = 7.5;
          let firstBodyLineCount = 0;
          if (firstParagraph) {
            pdf.setFontSize(cfg.body_font_size);
            const wrapped = pdf.splitTextToSize(firstParagraph, contentWidth);
            firstBodyLineCount = wrapped.length;
            const lineCount = Math.min(wrapped.length, 8);
            // 1 line → 6.5mm, 2 → 7.5mm, 3 → 8.5mm, 4+ → up to 11mm
            gapAfterTitle = Math.min(11, 5.5 + lineCount * 1.0);
          }

          // Keep-with-next: reserve title block + gap + at least the first
          // 2 body lines (or all of them if fewer) so the heading never
          // ends up alone at the bottom of a page.
          const bodyLhMm = cfg.body_font_size * 0.352778 * cfg.line_height;
          const keepWithNextLines = Math.min(firstBodyLineCount || 2, 2);
          // If this section triggers image insertion before body, also
          // reserve the image strip height so the title is not orphaned
          // above an image-only page break.
          const willInsertImagesHere =
            !imageInserted &&
            cfg.show_patent_images &&
            (sectionTitle === "발명요약 및 특징" ||
              sectionTitle === "발명의 요약" ||
              sectionTitle === "발명의 요약 및 기술적 특징") &&
            (patentData?.images?.length || patentData?.representativeImage);
          const imageReserve = willInsertImagesHere ? 56 : 0;
          const reserved =
            6 /* pre-title gap */ +
            gapAfterTitle +
            keepWithNextLines * bodyLhMm +
            imageReserve +
            2;
          checkNewPage(reserved);

          // Blueprint section header: §NN index + title + dotted rule
          const headerY = sectionHeader(sectionTitle);
          yPosition = headerY + gapAfterTitle + 1.5;

          if (
            (sectionTitle === "발명요약 및 특징" ||
              sectionTitle === "발명의 요약" ||
              sectionTitle === "발명의 요약 및 기술적 특징") &&
            cfg.show_patent_images
          ) {
            await insertImages();
          }
        } else if (cleanLine.trim()) {
          addWrappedText(cleanLine, cfg.body_font_size, T.textDark, cfg.line_height, margin);
          yPosition += 1.4;
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
        const dLines = pdf.splitTextToSize(stripCitationBrackets(cfg.disclaimer_text), contentWidth);
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

      // ── End of build attempt: check fit and retry if overflow ──
      pageHeadsOut = pageHeads;
      outlineOut = outlineEntries;
      brandOut = brand;
      docTitleOut = patentData?.titleKo || patentData?.title || "특허 요약";
      const pageCount = pdf.getNumberOfPages();
      if (pageCount <= TARGET_PAGES || attempt === MAX_ATTEMPTS - 1) break;
      // Shrink for next attempt — favor margin/line-height before font.
      cfg = {
        ...cfg,
        page_margin: Math.max(10, +(cfg.page_margin * 0.9).toFixed(1)),
        line_height: Math.max(1.25, +(cfg.line_height * 0.95).toFixed(2)),
        body_font_size: Math.max(8.5, +(cfg.body_font_size * 0.94).toFixed(2)),
        section_title_size: Math.max(10, +(cfg.section_title_size * 0.96).toFixed(2)),
      };
      } // end for-loop

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ██  RUNNING SYSTEM — running head + folio   ██
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const bodyFont = pdf.getFont().fontName;
      const totalPages = pdf.getNumberOfPages();
      const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);

        // Running head (continuation pages only — the opener carries the title block)
        if (i > 1) {
          const hy = margin + 3.2;
          pdf.setFontSize(6.8);
          pdf.setTextColor(...T.textFaint);
          pdf.text(truncate(docTitleOut, 34), margin, hy);
          const head = pageHeadsOut[i];
          if (head) {
            pdf.setFontSize(6.8);
            const t = truncate(head, 22);
            pdf.text(t, pageWidth - margin - pdf.getTextWidth(t), hy);
          }
          pdf.setDrawColor(...T.dividerLight);
          pdf.setLineWidth(0.2);
          pdf.line(margin, hy + 2.2, pageWidth - margin, hy + 2.2);
          pdf.setFillColor(...brandOut);
          pdf.rect(margin, hy + 2.1, 8, 0.4, "F");
        }

        const fy = pageHeight - 9;
        // very light divider
        pdf.setDrawColor(...T.dividerLight);
        pdf.setLineWidth(0.2);
        pdf.line(margin, fy - 3.5, pageWidth - margin, fy - 3.5);

        pdf.setFontSize(7);
        pdf.setTextColor(...T.textFaint);
        pdf.text(cfg.footer_text || "Agri IP Summary (AIS)", margin, fy);

        const dateText = cfg.footer_show_date
          ? new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\.\s/g, ".").replace(/\.$/, "")
          : "";
        if (dateText) {
          pdf.setFontSize(7);
          const dW = pdf.getTextWidth(dateText);
          const folioW = cfg.footer_show_page ? 18 : 0;
          pdf.text(dateText, pageWidth - margin - folioW - dW, fy);
        }
        // Folio in monospace: "03 / 05"
        if (cfg.footer_show_page) {
          const folio = `${String(i).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`;
          pdf.setFont("courier", "normal");
          pdf.setFontSize(7);
          pdf.setTextColor(...T.textMuted);
          pdf.text(folio, pageWidth - margin - pdf.getTextWidth(folio), fy);
          pdf.setFont(bodyFont, "normal");
        }
      }

      // Document metadata + section bookmarks (navigable outline)
      pdf.setProperties({
        title: `${docTitleOut} · 특허 AI 분석 요약서`,
        subject: `특허 ${patentNumber} AI 기술분석 요약`,
        author: "Agri IP Summary (AIS)",
        keywords: "특허, AI 분석, 기술이전, 농식품",
        creator: "Agri IP Summary (AIS)",
      });
      try {
        for (const e of outlineOut) {
          pdf.outline.add(null, e.title, { pageNumber: e.page });

        }
      } catch {
        /* outline is best-effort */
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
