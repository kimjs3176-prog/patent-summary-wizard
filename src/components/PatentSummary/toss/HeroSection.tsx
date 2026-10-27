import type { PatentSummaryProps as BasePatentSummaryProps } from "../types";

import type { GovtPatentData } from "../GovtPatentInfo";
import { formatPatentNumber } from "./helpers";


import { PatentStatusBadge } from "./PatentStatusBadge";
import { GovtPatentBadges } from "../GovtPatentInfo";

interface Props {
  patentData: BasePatentSummaryProps["patentData"]; title: string; patentNumber: string; govtPatent: GovtPatentData | null;
}

export function HeroSection({ patentData, title, patentNumber, govtPatent }: Props) {
  return (
    <>
          <section className="report-hero relative -mx-5 sm:-mx-7 px-5 sm:px-7 pt-7 pb-6 mb-8">
            <div className="flex items-center justify-between gap-4 mb-4">
              <span className="report-hero-label">AI SUMMARY</span>
              <PatentStatusBadge data={patentData} />
            </div>
            <h1 className="text-[24px] sm:text-[28px] font-bold leading-[1.35] mb-3">
              {title}
            </h1>
            <p className="font-mono text-[12px] font-medium mb-5 tabular-nums">
              {patentData?.searchType === 'application' ? '출원번호' : '등록번호'} · {formatPatentNumber(patentNumber, patentData?.searchType === 'application' ? 'application' : 'registration')}
            </p>
            <GovtPatentBadges data={govtPatent} />
          </section>
    </>
  );
}
