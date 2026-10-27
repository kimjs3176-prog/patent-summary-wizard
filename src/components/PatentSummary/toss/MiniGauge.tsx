
// 종합 사업화 점수 — 라운드 스퀘어 타일
export function MiniGauge({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 80 ? "#10B981" : pct >= 65 ? "#3B82F6" : pct >= 50 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-3 shrink-0">
      <div
        className="pdf-shape-center w-[68px] h-[68px] sm:w-[76px] sm:h-[76px] rounded-[16px] flex items-center justify-center"
        style={{ background: color }}
      >
        <span className="text-[30px] sm:text-[34px] font-bold tabular-nums leading-none text-white">{score}</span>
      </div>
      <span className="text-[11px] text-[#8B95A1] font-semibold">/ 100</span>
    </div>
  );
}


