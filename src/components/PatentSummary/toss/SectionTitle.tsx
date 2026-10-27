
export function SectionTitle({ children, kicker, index }: { children: React.ReactNode; kicker?: string; index?: string }) {
  return (
    <div className="report-section-title mb-4">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="report-section-rule" aria-hidden="true" />
        {index && (
          <span className="report-section-index font-mono text-[10px] font-bold tabular-nums">
            {index}
          </span>
        )}
        {kicker && <span className="bp-kicker">{kicker}</span>}
      </div>
      <h2 className="text-[20px] sm:text-[22px] font-bold text-[#191F28] leading-[1.35]">
        {children}
      </h2>
    </div>
  );
}

