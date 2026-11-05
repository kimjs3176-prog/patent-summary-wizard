import type { PatentSummaryProps as BasePatentSummaryProps } from "../types";
import type { CommercializationDetails } from "../commercialization";
import { ExternalLink, FileText, Printer, RefreshCw, Share2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NATI_TRANSFER_URL } from "@/lib/services";
import { toast } from "sonner";
import { PdfGenerator } from "../PdfGenerator";
import type { useFavoritePatents } from "@/hooks/useFavoritePatents";

interface Props {
  isStreaming: boolean; content: string; patentData: BasePatentSummaryProps["patentData"]; handlePrint: () => Promise<void>; onRegenerate?: () => void; setShareOpen: (open: boolean) => void; favoritesEnabled: boolean; toggleFavorite: ReturnType<typeof useFavoritePatents>["toggleFavorite"]; patentNumber: string; score: number | null; details: CommercializationDetails | null; patentIsFavorite: boolean; featureFlags: NonNullable<BasePatentSummaryProps["featureFlags"]>; printRef: React.RefObject<HTMLDivElement>; allReady: boolean;
}

export function ActionBar({ isStreaming, content, patentData, handlePrint, onRegenerate, setShareOpen, favoritesEnabled, toggleFavorite, patentNumber, score, details, patentIsFavorite, featureFlags, printRef, allReady }: Props) {
  return (
    <>
      {/* Shown from the start (print and regenerate wait for the text): appearing only after streaming pushed the whole report down (layout shift). */}
      {(isStreaming || content) && (
        <div className="flex items-center justify-between flex-wrap gap-2 mb-6 print:hidden">
          <div className="flex items-center gap-1.5">
            <Button asChild size="sm" className="gap-1.5 text-[12.5px] h-9 rounded-full bg-[#191F28] text-white hover:bg-[#333D4B] font-semibold shadow-sm">
              <a href={NATI_TRANSFER_URL} target="_blank" rel="noopener noreferrer" title="NATI(농업기술실용화 정보)에서 기술이전을 신청합니다">
                <ExternalLink className="w-3.5 h-3.5" />
                기술이전 신청
              </a>
            </Button>
            {patentData?.applicationNumber && (
              <Button asChild variant="outline" size="sm" className="gap-1.5 text-[12.5px] h-9 rounded-full font-medium border-[#E5E8EB] text-[#4E5968]">
                <a href={`https://www.kipris.or.kr/khome/detail/newWindow.do?right=kpat&applno=${patentData.applicationNumber}`} target="_blank" rel="noopener noreferrer">
                  <FileText className="w-3.5 h-3.5" />
                  특허상세
                </a>
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={handlePrint} disabled={isStreaming} className="gap-1 text-[12px] h-9 px-2.5 rounded-full text-[#4E5968]">
              <Printer className="w-3.5 h-3.5" /> 인쇄
            </Button>
            {onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isStreaming}
                onClick={() => {
                  if (window.confirm("기존 요약서 캐시를 삭제하고 새로 생성합니다. 진행할까요?")) {
                    onRegenerate();
                  }
                }}
                className="gap-1 text-[12px] h-9 px-2.5 rounded-full text-[#4E5968]"
                title="요약서를 새로 생성합니다"
              >
                <RefreshCw className="w-3.5 h-3.5" /> 재생성
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)} className="gap-1 text-[12px] h-9 px-2.5 rounded-full text-[#4E5968]">
              <Share2 className="w-3.5 h-3.5" /> 공유
            </Button>
            {favoritesEnabled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!patentData) return;
                  toggleFavorite({
                    patentNumber,
                    patentData,
                    commercializationScore: score,
                    commercializationDetails: details,
                    summary: content,
                    addedAt: new Date().toISOString(),
                  });
                  toast.success(patentIsFavorite ? "관심특허에서 제거되었습니다" : "관심특허에 담았습니다");
                }}
                className={`gap-1 text-[12px] h-9 px-2.5 rounded-full ${patentIsFavorite ? "text-[#EF4444]" : "text-[#4E5968]"}`}
              >
                <Heart className={`w-3.5 h-3.5 ${patentIsFavorite ? "fill-current" : ""}`} />
                {patentIsFavorite ? "담김" : "담기"}
              </Button>
            )}
            {featureFlags.pdfEnabled && (
              <PdfGenerator
                content={content}
                patentNumber={patentNumber}
                printRef={printRef}
                ready={allReady}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
