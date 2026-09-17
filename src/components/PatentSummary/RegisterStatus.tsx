import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, FileClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface License {
  holder?: string;
  cause?: string;
  region?: string;
  content?: string;
  startDate?: string;
  endDate?: string;
}

interface RegisterData {
  registrationDate?: string;
  claimCount?: string;
  expiryDate?: string;
  remainingYears?: number | null;
  lastDisposition?: string;
  lastAnnuity?: number | null;
  owners?: { name?: string; isFinal?: boolean; changeReason?: string; changeDate?: string }[];
  rights?: { kind?: string; date?: string; reason?: string }[];
  exclusiveLicenses?: License[];
  ordinaryLicenses?: License[];
}

interface Props {
  registrationNumber?: string;
}

const Item = ({ label, value }: { label: string; value: string }) => (
  <div className="py-2.5 flex items-start justify-between gap-4 border-b border-[#F2F4F6] last:border-0">
    <span className="text-[12.5px] text-[#8B95A1] font-medium shrink-0">{label}</span>
    <span className="text-[13px] text-[#191F28] font-semibold text-right">{value}</span>
  </div>
);

const LicenseRow = ({ tone, lic }: { tone: "exclusive" | "ordinary"; lic: License }) => (
  <div className="rounded-[8px] bg-[#F9FAFB] px-3 py-2.5">
    <div className="flex items-center gap-2 mb-1">
      <span
        className="text-[10.5px] font-bold px-1.5 py-0.5 rounded"
        style={
          tone === "exclusive"
            ? { background: "#FFF1E8", color: "#D9480F" }
            : { background: "#E7F6EF", color: "#0B8A5A" }
        }
      >
        {tone === "exclusive" ? "전용실시권" : "통상실시권"}
      </span>
      <span className="text-[13px] font-semibold text-[#191F28] truncate">{lic.holder}</span>
    </div>
    <p className="text-[12px] text-[#4E5968] leading-[1.5]">
      {[lic.cause, lic.region, lic.content].filter(Boolean).join(" · ") || "세부 내용 비공개"}
      {lic.startDate && ` (${lic.startDate}${lic.endDate ? ` ~ ${lic.endDate}` : ""})`}
    </p>
  </div>
);

/** 공공데이터포털 등록원부 실시간 정보로 권리 상태·실시권 현황을 보여준다. */
export function RegisterStatus({ registrationNumber }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RegisterData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!registrationNumber) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const { data: res, error } = await supabase.functions.invoke("patent-register", {
          body: { registrationNumber },
        });
        if (cancelled) return;
        if (error || !res?.success || !res?.found) {
          setFailed(true);
          setData(null);
        } else {
          setData(res.data as RegisterData);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [registrationNumber]);

  if (!registrationNumber) return null;
  if (!loading && (failed || !data)) return null;

  const exclusive = data?.exclusiveLicenses ?? [];
  const ordinary = data?.ordinaryLicenses ?? [];
  const licensed = exclusive.length + ordinary.length > 0;
  const finalOwner = data?.owners?.find((o) => o.isFinal) ?? data?.owners?.[0];
  const alive = (data?.remainingYears ?? 0) > 0;

  return (
    <div className="rounded-[12px] border border-[#E5E8EB] bg-white overflow-hidden">
      <div className="px-4 sm:px-5 py-2.5 flex items-center gap-2 border-b border-[#F2F4F6]">
        <ShieldCheck className="w-4 h-4 text-[#0B8A5A] shrink-0" />
        <p className="text-[11.5px] text-[#8B95A1] font-medium">특허 등록원부 기반 권리 현황 (공공데이터포털)</p>
      </div>

      <div className="px-4 sm:px-5 py-3">
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-[#8B95A1] py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> 등록원부를 확인하는 중입니다...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              {data?.lastDisposition && <Item label="최종 처분" value={data.lastDisposition} />}
              {data?.expiryDate && (
                <Item
                  label="존속기간 만료"
                  value={`${data.expiryDate}${
                    data.remainingYears != null ? ` (${alive ? `약 ${data.remainingYears}년 남음` : "만료"})` : ""
                  }`}
                />
              )}
              {data?.claimCount && <Item label="청구항 수" value={`${data.claimCount}개`} />}
              {data?.lastAnnuity ? <Item label="연차료 납입" value={`${data.lastAnnuity}년차까지 납입`} /> : null}
              {finalOwner?.name && <Item label="현재 권리자" value={finalOwner.name} />}
              <Item
                label="실시권 설정"
                value={
                  licensed
                    ? `전용 ${exclusive.length}건 · 통상 ${ordinary.length}건`
                    : "등록된 실시권 없음 (기술이전 가능)"
                }
              />
            </div>

            {licensed && (
              <div className="mt-3 space-y-2">
                {exclusive.map((l, i) => (
                  <LicenseRow key={`e${i}`} tone="exclusive" lic={l} />
                ))}
                {ordinary.map((l, i) => (
                  <LicenseRow key={`o${i}`} tone="ordinary" lic={l} />
                ))}
              </div>
            )}

            {data?.rights?.length ? (
              <div className="mt-3 pt-3 border-t border-dashed border-[#E5E8EB]">
                <p className="text-[12px] text-[#8B95A1] font-semibold mb-1.5 flex items-center gap-1.5">
                  <FileClock className="w-3.5 h-3.5" /> 권리 변동 이력
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.rights.slice(0, 6).map((r, i) => (
                    <span
                      key={i}
                      className="text-[11.5px] px-2 py-1 rounded-[6px] bg-[#F2F4F6] text-[#4E5968] font-medium"
                    >
                      {r.date ? `${r.date} ` : ""}
                      {r.kind}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="mt-3 text-[11px] text-[#B0B8C1] leading-[1.5]">
              등록원부 기재 기준이며, 실시 대가(유상·무상) 정보는 원부에 공시되지 않습니다. 미등록 통상실시권은 표시되지
              않을 수 있습니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
