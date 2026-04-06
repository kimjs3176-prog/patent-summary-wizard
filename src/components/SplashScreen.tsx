import { useEffect, useState, useRef } from "react";
import { FileText } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "logo" | "text" | "hold" | "exit">("enter");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const t0 = setTimeout(() => setPhase("logo"), 150);
    const t1 = setTimeout(() => setPhase("text"), 700);
    const t2 = setTimeout(() => setPhase("hold"), 1200);
    const t3 = setTimeout(() => setPhase("exit"), 2000);
    const t4 = setTimeout(() => onComplete(), 2700);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);

  // Particle network canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const particles: { x: number; y: number; vx: number; vy: number; r: number; phase: number }[] = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: 1.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }

    let t = 0;
    const w = () => window.innerWidth;
    const h = () => window.innerHeight;

    const draw = () => {
      ctx.clearRect(0, 0, w(), h());
      t += 0.006;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w()) p.vx *= -1;
        if (p.y < 0 || p.y > h()) p.vy *= -1;
      }

      // Connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const alpha = (1 - dist / 140) * 0.15;
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Dots
      for (const p of particles) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 2 + p.phase);
        ctx.fillStyle = `rgba(255,255,255,${0.25 * pulse})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => cancelAnimationFrame(animId);
  }, []);

  const entered = phase !== "enter";
  const textVisible = phase === "text" || phase === "hold" || phase === "exit";
  const exiting = phase === "exit";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: "var(--gradient-accent)",
        transition: "opacity 0.7s cubic-bezier(0.4,0,0.2,1)",
        opacity: exiting ? 0 : 1,
      }}
    >
      {/* Particle network background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.6 }}
      />

      {/* Radial glow behind logo */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[500px] max-h-[500px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, hsl(0 0% 100% / 0.12) 0%, transparent 65%)",
          animation: "splash-glow-pulse 3s ease-in-out infinite",
        }}
      />

      {/* Content container */}
      <div className="flex flex-col items-center relative z-10">
        {/* Logo with ring animation */}
        <div className="relative">
          {/* Expanding ring */}
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)",
              transform: entered ? "scale(1)" : "scale(0.5)",
              opacity: entered ? 1 : 0,
              boxShadow: "0 0 0 3px hsl(0 0% 100% / 0.15), 0 0 40px 10px hsl(0 0% 100% / 0.06)",
            }}
          />
          <div
            className="w-20 h-20 md:w-24 md:h-24 rounded-3xl flex items-center justify-center relative"
            style={{
              background: "hsl(0 0% 100% / 0.18)",
              backdropFilter: "blur(24px)",
              border: "1.5px solid hsl(0 0% 100% / 0.25)",
              transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)",
              transform: entered ? "translateY(0) scale(1)" : "translateY(30px) scale(0.6)",
              opacity: entered ? 1 : 0,
            }}
          >
            <FileText
              className="w-9 h-9 md:w-11 md:h-11 text-white"
              style={{
                transition: "transform 0.6s cubic-bezier(0.16,1,0.3,1) 0.2s",
                transform: entered ? "scale(1) rotate(0deg)" : "scale(0.5) rotate(-15deg)",
              }}
            />
          </div>
        </div>

        {/* Title — staggered character reveal feel */}
        <h1
          className="text-white text-lg md:text-2xl font-bold tracking-tight mt-6"
          style={{
            transition: "all 0.7s cubic-bezier(0.16,1,0.3,1)",
            opacity: textVisible ? 0.95 : 0,
            transform: textVisible ? "translateY(0)" : "translateY(12px)",
            letterSpacing: textVisible ? "-0.01em" : "0.1em",
          }}
        >
          농식품분야 특허 AI 기술분석
        </h1>

        {/* Subtitle line */}
        <div
          className="mt-3 flex items-center gap-2"
          style={{
            transition: "all 0.6s cubic-bezier(0.16,1,0.3,1) 0.15s",
            opacity: textVisible ? 0.5 : 0,
            transform: textVisible ? "translateY(0)" : "translateY(8px)",
          }}
        >
          <div className="w-6 h-px bg-white/40" />
          <span className="text-white/60 text-[11px] md:text-xs font-medium tracking-widest uppercase">
            AI-Powered Analysis
          </span>
          <div className="w-6 h-px bg-white/40" />
        </div>

        {/* Loading bar */}
        <div
          className="mt-8 w-32 h-[3px] rounded-full overflow-hidden"
          style={{
            background: "hsl(0 0% 100% / 0.12)",
            transition: "opacity 0.5s ease 0.3s",
            opacity: textVisible ? 1 : 0,
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background: "hsl(0 0% 100% / 0.6)",
              animation: "splash-progress 1.8s ease-in-out forwards",
              animationDelay: "0.5s",
              width: "0%",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes splash-glow-pulse {
          0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes splash-progress {
          0% { width: 0%; }
          60% { width: 70%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}
