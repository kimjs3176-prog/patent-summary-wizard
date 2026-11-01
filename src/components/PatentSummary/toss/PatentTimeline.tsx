import { ACCENT_HEX } from "./helpers";

export function PatentTimeline({
  filingDate,
  publicationDate,
  registrationDate,
  hasRegistration,
  expiryDate,
}: {
  filingDate?: string;
  publicationDate?: string;
  registrationDate?: string;
  hasRegistration: boolean;
  expiryDate?: string;
}) {
  const steps = [
    { key: "file", label: "출원", date: filingDate, done: !!filingDate, color: "#3B82F6" },
    { key: "pub", label: "공개", date: publicationDate, done: !!publicationDate, color: "#F59E0B" },
    { key: "reg", label: "등록", date: registrationDate, done: hasRegistration, color: ACCENT_HEX },
    ...(expiryDate
      ? [{ key: "exp", label: "존속기간 만료", date: expiryDate, done: false, color: "#6B7684" }]
      : []),
  ];
  // Elapsed days from filing to registration (or today if pending)
  const parse = (s?: string) => {
    if (!s) return null;
    const m = s.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (!m) return null;
    return new Date(`${m[1]}-${m[2]}-${m[3]}`);
  };
  const start = parse(filingDate);
  const end = parse(registrationDate) || parse(publicationDate);
  let elapsed: string | null = null;
  if (start && end) {
    const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
    const years = (days / 365).toFixed(1);
    elapsed = `${years}년 (${days.toLocaleString()}일)`;
  }

  return (
    <div className="px-4 sm:px-5 pt-4 pb-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-semibold text-[#6B7684]">출원 · 등록 경과</p>
        {elapsed && (
          <p className="text-[12px] font-semibold text-[#4E5968] tabular-nums">
            소요 <span style={{ color: ACCENT_HEX }}>{elapsed}</span>
          </p>
        )}
      </div>
      <div className="relative">
        {/* base line */}
        <div className="absolute left-[10%] right-[10%] top-[13px] h-[3px] bg-[#E5E8EB] rounded-full" />
        {/* progress gradient line */}
        <div
          className="absolute left-[10%] top-[13px] h-[3px] rounded-full transition-all duration-500"
          style={{
            background: hasRegistration
              ? "linear-gradient(90deg, #3B82F6 0%, #F59E0B 50%, #10B981 100%)"
              : publicationDate
              ? "linear-gradient(90deg, #3B82F6 0%, #F59E0B 100%)"
              : "#3B82F6",
            width: hasRegistration ? "80%" : publicationDate ? "40%" : filingDate ? "0%" : "0%",
          }}
        />
        <div className={`relative grid gap-2 ${steps.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
          {steps.map((s) => (
            <div key={s.key} className="flex flex-col items-center text-center">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center border-[2.5px] bg-white shadow-sm transition-all"
                style={{
                  borderColor: s.done ? s.color : "#D1D6DB",
                  background: s.done ? s.color : "#fff",
                  boxShadow: s.done ? `0 0 0 4px ${s.color}1A` : undefined,
                }}
              >
                {s.done && (
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6.5L5 9L9.5 3.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <p
                className="mt-2 text-[12.5px] font-bold"
                style={{ color: s.done ? s.color : "#6B7684" }}
              >
                {s.label}
              </p>
              <p className="text-[11px] text-[#6B7684] font-medium tabular-nums mt-0.5 min-h-[14px]">
                {s.date || (s.done ? "" : "—")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


