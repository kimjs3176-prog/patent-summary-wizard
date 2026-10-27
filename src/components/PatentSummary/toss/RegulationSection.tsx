import type { PatentSummaryProps as BasePatentSummaryProps } from "../types";



import { SectionTitle } from "./SectionTitle";

import { RegulationAnalysis } from "../RegulationAnalysis";

interface Props {
  patentData: BasePatentSummaryProps["patentData"]; isStreaming: boolean; patentNumber: string;
}

export function RegulationSection({ patentData, isStreaming, patentNumber }: Props) {
  return (
    <>
          {patentData && !isStreaming && (
            <section id="sec-regulation" data-summary-section data-summary-label="예상 규제" className="report-section mb-8 scroll-mt-24">
              <SectionTitle index="A3" kicker="규제 분석">사업화 예상 규제</SectionTitle>
              <RegulationAnalysis patentNumber={patentNumber} patentData={patentData} isStreaming={isStreaming} />
            </section>
          )}
    </>
  );
}
