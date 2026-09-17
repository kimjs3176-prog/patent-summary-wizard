import { useState, type RefObject } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface PdfGeneratorProps {
  content: string;
  patentNumber: string;
  printRef: RefObject<HTMLDivElement | null>;
}

const PRINTING_CLASS = "ais-printing";
const PRINT_TARGET_CLASS = "ais-print-target";
const PDF_CAPTURE_CLASS = "ais-pdf-capture";

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
    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 10;
    const marginY = 10;
    const printableWidth = pageWidth - marginX * 2;
    const printableHeight = pageHeight - marginY * 2;
    const pageSliceHeight = Math.floor(canvas.width * (printableHeight / printableWidth));
    let sourceY = 0;
    let pageIndex = 0;

    while (sourceY < canvas.height) {
      const sliceHeight = Math.min(pageSliceHeight, canvas.height - sourceY);
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

export function PdfGenerator({ content, patentNumber, printRef }: PdfGeneratorProps) {
  const [isPreparing, setIsPreparing] = useState(false);

  const handlePdfDownload = async () => {
    if (!content || isPreparing) return;
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
