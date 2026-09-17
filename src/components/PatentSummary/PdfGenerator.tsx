import { useState, type RefObject } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PdfGeneratorProps {
  content: string;
  patentNumber: string;
  printRef: RefObject<HTMLDivElement | null>;
}

const PRINTING_CLASS = "ais-printing";
const PRINT_TARGET_CLASS = "ais-print-target";

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
    const opened = await printWebSummary(printRef.current, patentNumber);
    setIsPreparing(false);
    if (!opened) toast.error("PDF 인쇄 화면을 열지 못했습니다. 다시 시도해주세요.");
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
