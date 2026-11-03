
import type { CommercializationDetails } from "../commercialization";

import { ACCENT_HEX } from "./helpers";
import { SectionTitle } from "./SectionTitle";

import { Sparkles } from "lucide-react";
import { renderBold } from "./RenderBold";

interface Props {
  details: CommercializationDetails | null;
}

export function AnalysisSection({ details }: Props) {
  return (
    <>
          {details?.analysis && (
            <section id="sec-analysis" data-summary-section data-summary-label="AI 종합 분석" className="report-section mb-8 scroll-mt-24">
              <SectionTitle index="A1" kicker="AI 종합">AI 종합 분석 의견</SectionTitle>
              <div className="report-analysis-panel p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                    <Sparkles className="w-4 h-4" style={{ color: ACCENT_HEX }} />
                  </div>
                  <p className="text-[13px] font-bold" style={{ color: ACCENT_HEX }}>종합 의견</p>
                </div>
                <p className="text-[15px] leading-[1.75] text-[#191F28] font-medium">
                  {renderBold(details.analysis)}
                </p>
              </div>
            </section>
          )}
    </>
  );
}
