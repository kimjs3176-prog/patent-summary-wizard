import { useState, type RefObject } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { loadKoreanFont, addKoreanFontToDoc } from "@/lib/koreanFont";

interface TextItem {
  text: string;
  /** px, relative to the captured element */
  x: number;
  y: number;
  width: number;
  fontSize: number;
}

/** Collect every visible text run with its position so the PDF keeps selectable text. */
function collectTextItems(root: HTMLElement): TextItem[] {
  const rootRect = root.getBoundingClientRect();
  const items: TextItem[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  let node = walker.nextNode() as Text | null;
  while (node) {
    const raw = node.nodeValue ?? "";
    if (raw.trim()) {
      const parent = node.parentElement;
      if (parent) {
        const style = window.getComputedStyle(parent);
        if (style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0") {
          const range = document.createRange();
          range.selectNodeContents(node);
          const rects = Array.from(range.getClientRects());
          const fontSize = parseFloat(style.fontSize) || 12;
          // Single-rect nodes keep their full text; wrapped nodes are split per line by ratio.
          const total = raw.length;
          let consumed = 0;
          const widthSum = rects.reduce((sum, r) => sum + r.width, 0) || 1;
          rects.forEach((rect, index) => {
            if (rect.width < 1 || rect.height < 1) return;
            const share = Math.round((rect.width / widthSum) * total);
            const slice =
              rects.length === 1
                ? raw
                : index === rects.length - 1
                  ? raw.slice(consumed)
                  : raw.slice(consumed, consumed + share);
            consumed += share;
            const text = slice.replace(/\s+/g, " ").trim();
            if (!text) return;
            items.push({
              text,
              x: rect.left - rootRect.left,
              y: rect.bottom - rootRect.top - Math.max(1, rect.height * 0.2),
              width: rect.width,
              fontSize,
            });
          });
          range.detach?.();
        }
      }
    }
    node = walker.nextNode() as Text | null;
  }

  return items;
}

interface PdfGeneratorProps {
  content: string;
  patentNumber: string;
  printRef: RefObject<HTMLDivElement | null>;
}

const PRINTING_CLASS = "ais-printing";
const PRINT_TARGET_CLASS = "ais-print-target";
const PDF_CAPTURE_CLASS = "ais-pdf-capture";

interface BlockBound {
  top: number;
  bottom: number;
}

/** Collect boxes (cards, rows, headings, images) that should never be split across pages. */
function collectBlockBounds(root: HTMLElement): BlockBound[] {
  const rootRect = root.getBoundingClientRect();
  const nodes = root.querySelectorAll<HTMLElement>(
    "div,section,article,li,tr,h1,h2,h3,h4,p,img,table,figure",
  );
  const bounds: BlockBound[] = [];
  nodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.height < 8 || rect.width < 8) return;
    bounds.push({ top: rect.top - rootRect.top, bottom: rect.bottom - rootRect.top });
  });
  return bounds;
}

const waitForImages = async (element: HTMLElement) => {
  await Promise.all(
    Array.from(element.querySelectorAll("img")).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
        window.setTimeout(resolve, 2500);
      });
    }),
  );
};

/** Export the visible web report as a real, multi-page A4 PDF file. */
export async function downloadWebSummaryPdf(
  element: HTMLDivElement | null,
  patentNumber: string,
): Promise<boolean> {
  if (!element) return false;

  const safeNumber = patentNumber.replace(/[^0-9A-Za-z가-힣_-]/g, "_");
  const clone = element.cloneNode(true) as HTMLDivElement;
  clone.classList.add(PDF_CAPTURE_CLASS);
  clone.querySelectorAll<HTMLElement>(".print\\:hidden, [data-print-exclude='true']")
    .forEach((node) => node.remove());
  document.body.appendChild(clone);

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await waitForImages(clone);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const textItems = collectTextItems(clone);
    const blocks = collectBlockBounds(clone);
    const cloneWidth = clone.offsetWidth || clone.scrollWidth || 1;

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 8000,
      windowWidth: clone.scrollWidth,
      windowHeight: clone.scrollHeight,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

    let hasKoreanFont = false;
    try {
      const fontBase64 = await loadKoreanFont();
      addKoreanFontToDoc(pdf, fontBase64);
      hasKoreanFont = true;
    } catch (fontError) {
      console.warn("Korean font unavailable for PDF text layer:", fontError);
    }

    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 10;
    const marginY = 10;
    const printableWidth = pageWidth - marginX * 2;
    const printableHeight = pageHeight - marginY * 2;
    const pageSliceHeight = Math.floor(canvas.width * (printableHeight / printableWidth));
    let sourceY = 0;
    let pageIndex = 0;
    const scaleRatio = canvas.width / cloneWidth;
    const minSlice = pageSliceHeight * 0.45;

    /** Pull the page break up to the nearest boundary that does not cut a card or line. */
    const findSafeSlice = (startY: number, maxSlice: number) => {
      if (startY + maxSlice >= canvas.height) return maxSlice;
      let cut = (startY + maxSlice) / scaleRatio;
      const startCss = startY / scaleRatio;
      for (let pass = 0; pass < 12; pass += 1) {
        let highest = Infinity;
        blocks.forEach((b) => {
          if (b.top < cut - 0.5 && b.bottom > cut + 0.5 && b.bottom - b.top < maxSlice / scaleRatio) {
            if (b.top < highest) highest = b.top;
          }
        });
        if (highest === Infinity) break;
        cut = highest - 2;
      }
      const slice = Math.floor((cut - startCss) * scaleRatio);
      if (slice < minSlice || slice > maxSlice) return maxSlice;
      return slice;
    };

    while (sourceY < canvas.height) {
      const maxSlice = Math.min(pageSliceHeight, canvas.height - sourceY);
      const sliceHeight = findSafeSlice(sourceY, maxSlice);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const context = pageCanvas.getContext("2d");
      if (!context) throw new Error("PDF canvas context is unavailable");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      context.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );

      if (pageIndex > 0) pdf.addPage("a4", "portrait");
      const renderedHeight = (sliceHeight * printableWidth) / canvas.width;
      pdf.addImage(
        pageCanvas.toDataURL("image/jpeg", 0.94),
        "JPEG",
        marginX,
        marginY,
        printableWidth,
        renderedHeight,
        undefined,
        "FAST",
      );
      // Invisible text layer over the image so the PDF text stays selectable/copyable.
      if (hasKoreanFont) {
        const canvasScale = canvas.width / cloneWidth;
        const cssToMm = printableWidth / cloneWidth;
        const topCss = sourceY / canvasScale;
        const bottomCss = (sourceY + sliceHeight) / canvasScale;
        pdf.setFont("NotoSansKR", "normal");
        pdf.setTextColor(0, 0, 0);
        textItems.forEach((item) => {
          if (item.y < topCss || item.y > bottomCss) return;
          const sizePt = Math.max(4, item.fontSize * cssToMm * (72 / 25.4));
          pdf.setFontSize(sizePt);
          try {
            pdf.text(item.text, marginX + item.x * cssToMm, marginY + (item.y - topCss) * cssToMm, {
              renderingMode: "invisible",
              maxWidth: Math.max(1, item.width * cssToMm) * 1.6,
            });
          } catch {
            /* skip unrenderable runs */
          }
        });
      }

      sourceY += sliceHeight;
      pageIndex += 1;
    }

    pdf.setProperties({
      title: `AIS 특허요약 ${patentNumber}`,
      subject: "Agri IP Summary AI 기술분석 요약서",
      creator: "Agri IP Summary (AIS)",
    });
    pdf.save(`AIS_특허요약_${safeNumber || "report"}.pdf`);
    return true;
  } catch (error) {
    console.error("Summary PDF export error:", error);
    return false;
  } finally {
    clone.remove();
  }
}

/** Print the visible web report so the saved PDF matches the page. */
export async function printWebSummary(
  element: HTMLDivElement | null,
  patentNumber: string,
): Promise<boolean> {
  if (!element) return false;

  const previousTitle = document.title;
  const safeNumber = patentNumber.replace(/[^0-9A-Za-z가-힣_-]/g, "_");
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.body.classList.remove(PRINTING_CLASS);
    element.classList.remove(PRINT_TARGET_CLASS);
    document.title = previousTitle;
    window.removeEventListener("afterprint", cleanup);
  };

  document.body.classList.add(PRINTING_CLASS);
  element.classList.add(PRINT_TARGET_CLASS);
  document.title = `AIS_특허요약_${safeNumber || "report"}`;
  window.addEventListener("afterprint", cleanup, { once: true });

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await waitForImages(element);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    window.print();
    cleanup();
    return true;
  } catch (error) {
    cleanup();
    console.error("Summary print error:", error);
    return false;
  }
}

export function PdfGenerator({ content, patentNumber, printRef, ready = true }: PdfGeneratorProps) {
  const [isPreparing, setIsPreparing] = useState(false);

  const handlePdfDownload = async () => {
    if (!content || isPreparing || !ready) return;
    setIsPreparing(true);
    const opened = await downloadWebSummaryPdf(printRef.current, patentNumber);
    setIsPreparing(false);
    if (!opened) toast.error("PDF 파일을 만들지 못했습니다. 다시 시도해주세요.");
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePdfDownload}
      className="gap-2"
      disabled={!content || isPreparing}
    >
      <FileDown className="w-4 h-4" />
      {isPreparing ? "PDF 준비 중" : "PDF 다운로드"}
    </Button>
  );
}
