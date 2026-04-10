import { Check, Database, Brain, FileText } from "lucide-react";

export type AnalysisStep = "idle" | "fetching" | "scoring" | "summarizing" | "done";

interface AnalysisProgressStepperProps {
  currentStep: AnalysisStep;
}

const steps = [
  { key: "fetching" as const, label: "특허정보 조회", icon: Database, desc: "KIPRIS에서 데이터 수집" },
  { key: "scoring" as const, label: "사업화 점수 분석", icon: Brain, desc: "AI 기술성·시장성·사업성 평가" },
  { key: "summarizing" as const, label: "AI 요약 생성", icon: FileText, desc: "특허 분석 보고서 작성" },
];

const stepOrder: AnalysisStep[] = ["fetching", "scoring", "summarizing", "done"];

export function AnalysisProgressStepper({ currentStep }: AnalysisProgressStepperProps) {
  if (currentStep === "idle") return null;

  const currentIdx = stepOrder.indexOf(currentStep);

  return (
    <div className="w-full max-w-xl mx-auto mb-12 animate-fade-up">
      <div className="rounded-3xl border border-border/30 bg-card/70 backdrop-blur-2xl p-7" style={{ boxShadow: 'var(--shadow-frosted)' }}>
        <div className="flex items-center justify-between gap-3">
          {steps.map((step, idx) => {
            const isActive = stepOrder[idx] === currentStep;
            const isCompleted = currentIdx > idx || currentStep === "done";

            return (
              <div key={step.key} className="flex-1 flex flex-col items-center text-center relative">
                {/* Connector line */}
                {idx > 0 && (
                  <div className="absolute top-5 -left-1/2 w-full h-0.5 -z-10">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        background: isCompleted
                          ? 'var(--gradient-accent)'
                          : 'hsl(var(--border) / 0.3)',
                      }}
                    />
                  </div>
                )}

                {/* Icon circle */}
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-2.5 transition-all duration-600 ${
                    isCompleted
                      ? 'text-white shadow-md'
                      : isActive
                      ? 'text-white shadow-lg scale-110'
                      : 'bg-muted/60 text-muted-foreground/50'
                  }`}
                  style={
                    isCompleted || isActive
                      ? { background: 'var(--gradient-accent)', boxShadow: '0 4px 16px hsl(158 64% 40% / 0.2)' }
                      : undefined
                  }
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : isActive ? (
                    <step.icon className="w-5 h-5" style={{ animation: 'breathe 2s ease-in-out infinite' }} />
                  ) : (
                    <step.icon className="w-4 h-4" />
                  )}
                </div>

                {/* Label */}
                <p className={`text-[13px] font-semibold transition-colors duration-400 ${isActive ? 'text-foreground' : isCompleted ? 'text-primary' : 'text-muted-foreground/50'}`}>
                  {step.label}
                </p>
                <p className={`text-[11px] mt-0.5 transition-colors duration-400 hidden sm:block ${isActive ? 'text-muted-foreground' : 'text-muted-foreground/40'}`}>
                  {step.desc}
                </p>

                {/* Active spinner */}
                {isActive && (
                  <div className="mt-2.5">
                    <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
