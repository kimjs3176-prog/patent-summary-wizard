import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
  title?: string;
}

export function SplashScreen({ onComplete, title = "특허 기술이전 길잡이" }: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 100);
    const t2 = setTimeout(() => setPhase("exit"), 1600);
    const t3 = setTimeout(() => onComplete(), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: "var(--gradient-accent)",
        transition: "opacity 0.6s cubic-bezier(0.4,0,0.2,1), transform 0.6s cubic-bezier(0.4,0,0.2,1)",
        opacity: phase === "exit" ? 0 : 1,
        transform: phase === "exit" ? "scale(1.05)" : "scale(1)",
      }}
    >
      {/* Ambient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] rounded-full blur-[120px] opacity-30" style={{ background: "hsl(0 0% 100% / 0.25)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-[30vw] h-[30vw] rounded-full blur-[100px] opacity-20" style={{ background: "hsl(184 48% 44% / 0.3)" }} />
      </div>

      <div
        className="flex flex-col items-center gap-5 relative z-10"
        style={{
          transition: "opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)",
          opacity: phase === "enter" ? 0 : phase === "exit" ? 0 : 1,
          transform: phase === "enter" ? "translateY(24px) scale(0.92)" : phase === "exit" ? "translateY(-16px) scale(0.96)" : "translateY(0) scale(1)",
        }}
      >
        {/* Logo icon */}
        <div
          className="w-16 h-16 md:w-20 md:h-20 rounded-3xl flex items-center justify-center shadow-2xl"
          style={{
            background: "hsl(0 0% 100% / 0.2)",
            backdropFilter: "blur(20px)",
            border: "1px solid hsl(0 0% 100% / 0.3)",
          }}
        >
          <FileText className="w-8 h-8 md:w-10 md:h-10 text-white" />
        </div>

        {/* Title */}
        <h1 className="text-white text-lg md:text-xl font-bold tracking-tight opacity-90">
          {title}
        </h1>

        {/* Subtle loading dots */}
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/50"
              style={{
                animation: "splash-dot 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes splash-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
