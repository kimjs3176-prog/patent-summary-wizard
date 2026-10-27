import { renderBold } from "./RenderBold";

export function ScoreRow({ label, value, color, reason }: { label: string; value: number; color: string; reason?: string }) {
  // 가로 배치: 좌측 라운드 스퀘어 점수 타일 + 우측 라벨/근거
  const border = `${color}26`; // ~15% opacity
  return (
    <div
      className="min-w-0 flex items-start gap-3.5 rounded-[14px] p-4 sm:p-[18px] border bg-white"
      style={{ borderColor: border }}
    >
      <div
        className="pdf-shape-center shrink-0 w-[58px] h-[58px] sm:w-[64px] sm:h-[64px] rounded-[14px] flex items-center justify-center"
        style={{ background: color }}
      >
        <span className="text-[24px] sm:text-[27px] font-bold tabular-nums leading-none text-white">
          {value}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 mb-1.5">
          <p className="text-[14px] sm:text-[15px] font-bold text-[#191F28] leading-none">{label}</p>
          <span className="text-[11px] text-[#8B95A1] font-semibold">/ 100</span>
        </div>
        <div className="h-[6px] rounded-full bg-[#F1F3F5] overflow-hidden mb-2.5">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${value}%`, background: color }}
          />
        </div>
        {reason && (
          <p className="text-[12.5px] sm:text-[13px] leading-[1.75] text-[#4E5968]">
            {renderBold(reason)}
          </p>
        )}
      </div>
    </div>
  );
}

