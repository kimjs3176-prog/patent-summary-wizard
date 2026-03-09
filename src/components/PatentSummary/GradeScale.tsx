import type { ScoreConfig } from "@/components/admin/ScoreTrlSettings";

interface GradeScaleProps {
  score: number;
  grades: ScoreConfig["grades"];
}

const GRADE_COLORS: Record<string, { bg: string; text: string }> = {
  S: { bg: "bg-emerald-500", text: "text-emerald-500" },
  A: { bg: "bg-blue-500", text: "text-blue-500" },
  B: { bg: "bg-amber-500", text: "text-amber-500" },
  C: { bg: "bg-orange-500", text: "text-orange-500" },
  D: { bg: "bg-red-400", text: "text-red-400" },
  F: { bg: "bg-red-600", text: "text-red-600" },
};

function getColor(grade: string) {
  return GRADE_COLORS[grade] || { bg: "bg-muted", text: "text-muted-foreground" };
}

export function GradeScale({ score, grades }: GradeScaleProps) {
  const sorted = [...grades].sort((a, b) => b.min - a.min);
  const currentGrade = sorted.find((g) => score >= g.min);

  return (
    <div className="w-full">
      <div className="flex items-center gap-1 sm:gap-1.5">
        {sorted.map((g) => {
          const isActive = currentGrade?.grade === g.grade;
          const colors = getColor(g.grade);

          return (
            <div key={g.grade} className="flex-1 flex flex-col items-center gap-1.5">
              {/* Grade label */}
              <span
                className={`text-xs sm:text-sm font-bold transition-all ${
                  isActive ? `${colors.text} scale-110` : "text-muted-foreground/40"
                }`}
              >
                {g.grade}
              </span>
              {/* Bar segment */}
              <div
                className={`w-full h-2 sm:h-2.5 rounded-full transition-all ${
                  isActive
                    ? `${colors.bg} shadow-sm ring-2 ring-offset-1 ring-offset-background ring-current opacity-100`
                    : `${colors.bg} opacity-20`
                }`}
              />
              {/* Min score */}
              <span
                className={`text-[9px] sm:text-[10px] transition-all ${
                  isActive ? "text-foreground font-semibold" : "text-muted-foreground/40"
                }`}
              >
                {g.min}+
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
