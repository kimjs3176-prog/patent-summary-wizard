import { renderBold } from "./RenderBold";

export function ScoreRow({ label, value, color, reason }: { label: string; value: number; color: string; reason?: string }) {
  // 세 점수를 한 줄에 나란히: 위에 점수 타일·이름, 아래 근거 (점수는 타일 숫자로만 — 카드 폭만큼 늘어지는 막대는 두지 않는다)
  const border = `${color}26`; // ~15% opacity
  return (
    <div
      className="min-w-0 rounded-[14px] p-4 border bg-white"
      style={{ borderColor: border }}
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <div
          className="pdf-shape-center shrink-0 w-[44px] h-[44px] rounded-[12px] flex items-center justify-center"
          style={{ background: color }}
        >
          <span className="text-[20px] font-bold tabular-nums leading-none text-white">{value}</span>
        </div>
        <p className="text-[14px] font-bold text-[#191F28] leading-none">{label}</p>
        <span className="text-[11px] text-[#6B7684] font-semibold">/ 100</span>
      </div>
      {reason && (
        <p className="score-reason text-[12.5px] leading-[1.7] text-[#4E5968]">
          {renderBold(reason)}
        </p>
      )}
    </div>
  );
}

