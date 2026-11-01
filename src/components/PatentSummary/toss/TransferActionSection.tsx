import { useEffect, useState } from "react";
import { ArrowUpRight, Building2, Copy, FileText, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { PatentSummaryProps as BasePatentSummaryProps } from "../types";
import type { GovtPatentData } from "../GovtPatentInfo";
import { ACCENT_HEX, formatPatentNumber, getPatentStatus } from "./helpers";
import { SectionTitle } from "./SectionTitle";
import { SoftCard } from "./SoftCard";
import { Row } from "./Row";

/** ActionBar의 '기술이전 신청' 버튼이 이 섹션으로 스크롤한다. */
export const TRANSFER_SECTION_ID = "sec-transfer";

// NATI는 특허별 딥링크가 없어 신청 화면으로 보내고, 특허번호는 클립보드로 넘긴다.
const NATI_APPLY_URL = "https://www.nati.or.kr/login.do?selPrgId=xfr_apply";

const digitsOf = (v?: string | null) => (v || "").replace(/\D/g, "");

/** 등록번호(9자리 또는 0000 패딩 13자리)와 출원번호(13자리)를 같은 기준으로 비교한다. */
function samePatent(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const short = a.length === 9 ? a : b.length === 9 ? b : null;
  const long = short === a ? b : a;
  return !!short && long.length === 13 && long.endsWith("0000") && long.startsWith(short);
}

/** 이달의 특허로 등록된 경우 관리자가 입력한 기관 담당 연락처(이미 홈에 공개되는 값)를 찾는다. */
function useFeaturedContact(numbers: string[]): string | null {
  const [contact, setContact] = useState<string | null>(null);
  const key = numbers.join("|");

  useEffect(() => {
    let alive = true;
    setContact(null);
    const wanted = key.split("|").filter(Boolean);
    if (wanted.length === 0) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("featured_patents")
          .select("patent_number, contact_info")
          .eq("is_active", true)
          .not("contact_info", "is", null);
        if (!alive || error || !data) return;
        const hit = data.find((row) => {
          const d = digitsOf(row.patent_number);
          return wanted.some((w) => samePatent(d, w));
        });
        const value = hit?.contact_info?.trim();
        if (value) setContact(value);
      } catch {
        /* 연락처 조회 실패 시 표시하지 않음 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [key]);

  return contact;
}

interface Props {
  patentData: BasePatentSummaryProps["patentData"];
  patentNumber: string;
  ownerChanged: boolean;
  finalOwner: string | null;
  govtPatent: GovtPatentData | null;
}

export function TransferActionSection({ patentData, patentNumber, ownerChanged, finalOwner, govtPatent }: Props) {
  const lookupNumbers = [patentNumber, patentData?.applicationNumber, patentData?.registrationNumber]
    .map(digitsOf)
    .filter(Boolean);
  const contact = useFeaturedContact(patentData ? lookupNumbers : []);

  if (!patentData) return null;

  // NATI 검색창에 붙여 넣을 번호: 등록번호 우선, 없으면 출원번호
  const copyNumber = patentData.registrationNumber
    ? formatPatentNumber(patentData.registrationNumber, "registration")
    : patentData.applicationNumber
      ? formatPatentNumber(patentData.applicationNumber, "application")
      : patentNumber;
  const numberLabel = patentData.registrationNumber ? "등록번호" : "출원번호";
  const status = getPatentStatus(patentData);
  const inactive = status.tone === "inactive";
  const kiprisHref = patentData.applicationNumber
    ? `https://www.kipris.or.kr/khome/detail/newWindow.do?right=kpat&applno=${encodeURIComponent(digitsOf(patentData.applicationNumber))}`
    : null;

  // 링크 이동(기본 동작)은 막지 않고, 같은 클릭에서 번호만 복사한다.
  const copyForNati = () => {
    const done = () => toast.success("특허번호를 복사했습니다. NATI 검색창에 붙여 넣으세요", { description: `${numberLabel} ${copyNumber}` });
    const fallback = () => toast.info(`NATI 검색창에 ${numberLabel} ${copyNumber} 를 입력하세요`);
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(copyNumber).then(done, fallback);
      else fallback();
    } catch {
      fallback();
    }
  };

  const steps: { title: string; desc: React.ReactNode }[] = [
    { title: "보유기관 확인", desc: "위 보유·관리 기관이 기술이전 신청을 검토합니다." },
    {
      title: "NATI에서 신청",
      desc: (
        <>
          NATI(www.nati.or.kr)에 로그인해 {numberLabel} <span className="whitespace-nowrap tabular-nums">{copyNumber}</span>로 기술을 검색하고 신청서를 작성합니다.
        </>
      ),
    },
    { title: "검토 · 계약", desc: "기관 검토 후 실시권 허락(라이선싱) 계약을 체결합니다." },
  ];

  return (
    <section
      id={TRANSFER_SECTION_ID}
      data-summary-section
      data-summary-label="기술이전 안내"
      className="report-section mb-8 scroll-mt-24"
    >
      <SectionTitle kicker="다음 단계">기술이전 안내</SectionTitle>
      <SoftCard className="!p-0 overflow-hidden">
        <div className="px-5 sm:px-6 pt-4 pb-1">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-[#8B95A1]">
            <Building2 className="w-3.5 h-3.5" aria-hidden="true" /> 권리·관리 기관
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {patentData.assignee && <Row label="출원인(보유기관)" value={patentData.assignee} />}
            {ownerChanged && finalOwner && <Row label="최종권리자" value={finalOwner} />}
            {govtPatent?.institution && <Row label="관리기관" value={govtPatent.institution} />}
            {govtPatent && <Row label="구분" value="국유특허" />}
            {contact && <Row label="기술이전 담당" value={contact} />}
          </div>
          {ownerChanged && finalOwner && (
            <p className="mt-1 mb-2 text-[12px] leading-relaxed text-[#B45309]">
              등록원부상 권리가 이전되었습니다. 기술이전은 최종권리자와 협의합니다.
            </p>
          )}
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-3 border-t border-[#E5E8EB] bg-[#F9FAFB]">
          {steps.map((step, i) => (
            <li key={step.title} className="flex items-start gap-2.5 px-5 sm:px-6 py-4 border-b sm:border-b-0 sm:border-r last:border-0 border-[#E5E8EB]">
              <span className="mt-px w-4 shrink-0 text-[14px] font-bold tabular-nums" style={{ color: ACCENT_HEX }}>
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#191F28] leading-snug">{step.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#6B7684] break-keep">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        {inactive && (
          <p className="flex items-start gap-1.5 px-5 sm:px-6 pt-4 text-[12.5px] leading-relaxed text-[#B45309]">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            이 특허는 현재 ‘{status.label}’ 상태로 기술이전 대상이 아닐 수 있습니다. 신청 전 보유기관에 확인하세요.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 px-5 sm:px-6 py-4 print:hidden">
          <a
            href={NATI_APPLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={copyForNati}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-5 text-[14px] font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: ACCENT_HEX }}
            aria-label={`NATI에서 기술이전 신청 (${numberLabel} ${copyNumber} 복사)`}
          >
            <Copy className="w-4 h-4" aria-hidden="true" />
            NATI에서 신청
            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
          </a>
          {kiprisHref && (
            <a
              href={kiprisHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-[#E5E8EB] bg-white px-5 text-[14px] font-semibold text-[#4E5968] transition-colors hover:bg-[#F2F4F6]"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              KIPRIS 상세
            </a>
          )}
          <p className="self-center text-[11.5px] leading-relaxed text-[#8B95A1] sm:ml-auto sm:max-w-[260px]">
            NATI는 특허별 바로가기가 없어 버튼을 누르면 {numberLabel}가 복사됩니다.
          </p>
        </div>
      </SoftCard>
    </section>
  );
}
