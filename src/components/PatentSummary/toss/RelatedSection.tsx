import type { PatentSummaryProps as BasePatentSummaryProps } from "../types";


import { ACCENT_HEX } from "./helpers";
import { SectionTitle } from "./SectionTitle";
import { SoftCard } from "./SoftCard";
import { Link2 } from "lucide-react";
import { RelatedPatentsCompact } from "../RelatedPatentsCompact";

interface Props {
  patentData: BasePatentSummaryProps["patentData"]; onRelatedPatentClick: BasePatentSummaryProps["onRelatedPatentClick"];
}

export function RelatedSection({ patentData, onRelatedPatentClick }: Props) {
  return (
    <>
          {patentData && (
            <section id="sec-related" data-summary-section data-summary-label="관련 특허" className="report-section mb-8 scroll-mt-24">
              <SectionTitle index="A2" kicker="관련 특허"><span className="inline-flex items-center gap-2"><Link2 className="w-5 h-5" style={{ color: ACCENT_HEX }} />기능·특징이 유사한 특허</span></SectionTitle>
              <SoftCard className="!p-3">
                <RelatedPatentsCompact patentData={patentData} onPatentClick={onRelatedPatentClick} />
              </SoftCard>
            </section>
          )}
    </>
  );
}
