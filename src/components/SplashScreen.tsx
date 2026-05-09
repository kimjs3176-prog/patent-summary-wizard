import { useEffect, useRef, useState } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

const TITLE = "농식품분야 특허 AI 기술분석";

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "logo" | "text" | "hold" | "exit">("enter");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const t0 = setTimeout(() => setPhase("logo"), 120);
    const t1 = setTimeout(() => setPhase("text"), 620);
    const t2 = setTimeout(() => setPhase("hold"), 1300);
    const t3 = setTimeout(() => setPhase("exit"), 2100);
    const t4 = setTimeout(() => onComplete(), 2850);
    return () => { [t0, t1, t2, t3, t4].forEach(clearTimeout); };
  }, [onComplete]);

  // Floating sparkle / orb canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    type Orb = { x: number; y: number; vx: number; vy: number; r: number; hue: number; phase: number };
    const orbs: Orb[] = [];
    const count = window.innerWidth < 640 ? 22 : 38;
    for (let i = 0; i < count; i++) {
      orbs.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 1 + Math.random() * 2.4,
        hue: 150 + Math.random() * 30,
        phase: Math.random() * Math.PI * 2,
      });
    }

    let t = 0;
    const w = () => window.innerWidth;
    const h = () => window.innerHeight;

    const draw = () => {
      ctx.clearRect(0, 0, w(), h());
      t += 0.008;

      for (const p of orbs) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = w() + 20;
        if (p.x > w() + 20) p.x = -20;
        if (p.y < -20) p.y = h() + 20;
        if (p.y > h() + 20) p.y = -20;
      }

      // Soft connecting threads
      for (let i = 0; i < orbs.length; i++) {
        for (let j = i + 1; j < orbs.length; j++) {
          const dx = orbs[i].x - orbs[j].x;
          const dy = orbs[i].y - orbs[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 130) {
            const a = (1 - d / 130) * 0.12;
            ctx.strokeStyle = `rgba(255,255,255,${a})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(orbs[i].x, orbs[i].y);
            ctx.lineTo(orbs[j].x, orbs[j].y);
            ctx.stroke();
          }
        }
      }

      // Glowing dots
      for (const p of orbs) {
        const pulse = 0.55 + 0.45 * Math.sin(t * 2.2 + p.phase);
        const r = p.r * pulse;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6);
        grad.addColorStop(0, `rgba(255,255,255,${0.45 * pulse})`);
        grad.addColorStop(0.4, `rgba(220,255,235,${0.15 * pulse})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255,255,255,${0.85 * pulse})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const entered = phase !== "enter";
  const textVisible = phase === "text" || phase === "hold" || phase === "exit";
  const exiting = phase === "exit";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 30% 20%, hsl(160 70% 32%) 0%, hsl(160 75% 22%) 45%, hsl(168 80% 12%) 100%)",
        transition: "opacity 0.75s cubic-bezier(0.4,0,0.2,1), filter 0.75s cubic-bezier(0.4,0,0.2,1)",
        opacity: exiting ? 0 : 1,
        filter: exiting ? "blur(14px)" : "blur(0px)",
      }}
    >
      {/* Animated mesh gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute rounded-full"
          style={{
            top: "-15%", left: "-10%", width: "55vw", height: "55vw",
            background: "radial-gradient(circle, hsl(170 90% 55% / 0.55), transparent 60%)",
            filter: "blur(60px)",
            animation: "splash-blob-a 9s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            bottom: "-20%", right: "-15%", width: "60vw", height: "60vw",
            background: "radial-gradient(circle, hsl(190 85% 50% / 0.45), transparent 60%)",
            filter: "blur(70px)",
            animation: "splash-blob-b 11s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            top: "30%", right: "10%", width: "35vw", height: "35vw",
            background: "radial-gradient(circle, hsl(140 80% 60% / 0.35), transparent 60%)",
            filter: "blur(80px)",
            animation: "splash-blob-c 13s ease-in-out infinite",
          }}
        />
      </div>

      {/* Particle canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.75 }} />

      {/* Subtle noise overlay for texture */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-overlay"
        style={{
          opacity: 0.18,
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>\")",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6">
        {/* Logo: rotating conic ring + glassy badge with animated SVG */}
        <div className="relative w-[112px] h-[112px] md:w-[128px] md:h-[128px] flex items-center justify-center">
          {/* Conic spinner ring */}
          <div
            className="absolute inset-0 rounded-[28px]"
            style={{
              background:
                "conic-gradient(from 0deg, hsl(0 0% 100% / 0) 0deg, hsl(0 0% 100% / 0.85) 90deg, hsl(0 0% 100% / 0) 180deg, hsl(0 0% 100% / 0.55) 270deg, hsl(0 0% 100% / 0) 360deg)",
              WebkitMask:
                "radial-gradient(circle, transparent 56%, black 57%, black 64%, transparent 65%)",
              mask: "radial-gradient(circle, transparent 56%, black 57%, black 64%, transparent 65%)",
              animation: "splash-spin 2.6s linear infinite",
              opacity: entered ? 1 : 0,
              transition: "opacity 0.6s ease",
            }}
          />
          {/* Outer halo */}
          <div
            className="absolute inset-[-18%] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, hsl(0 0% 100% / 0.18), transparent 65%)",
              animation: "splash-halo 3s ease-in-out infinite",
            }}
          />
          {/* Glassy badge */}
          <div
            className="relative w-[78px] h-[78px] md:w-[92px] md:h-[92px] rounded-[22px] flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, hsl(0 0% 100% / 0.28), hsl(0 0% 100% / 0.10))",
              backdropFilter: "blur(22px)",
              border: "1.5px solid hsl(0 0% 100% / 0.35)",
              boxShadow:
                "0 18px 60px hsl(160 70% 10% / 0.45), inset 0 1px 0 hsl(0 0% 100% / 0.4)",
              transform: entered ? "translateY(0) scale(1)" : "translateY(20px) scale(0.7)",
              opacity: entered ? 1 : 0,
              transition: "all 0.85s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <svg viewBox="0 0 48 48" className="w-10 h-10 md:w-12 md:h-12" fill="none">
              <defs>
                <linearGradient id="splash-stroke" x1="0" y1="0" x2="48" y2="48">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#d6fff0" />
                </linearGradient>
              </defs>
              {/* Document outline with draw-on effect */}
              <path
                d="M12 6 H30 L38 14 V40 A2 2 0 0 1 36 42 H12 A2 2 0 0 1 10 40 V8 A2 2 0 0 1 12 6 Z"
                stroke="url(#splash-stroke)"
                strokeWidth="2.4"
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{
                  strokeDasharray: 160,
                  strokeDashoffset: entered ? 0 : 160,
                  transition: "stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1) 0.1s",
                }}
              />
              <path
                d="M30 6 V14 H38"
                stroke="url(#splash-stroke)"
                strokeWidth="2.4"
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{
                  strokeDasharray: 22,
                  strokeDashoffset: entered ? 0 : 22,
                  transition: "stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1) 0.7s",
                }}
              />
              {/* Sparkle */}
              <g
                style={{
                  transformOrigin: "24px 26px",
                  opacity: entered ? 1 : 0,
                  transform: entered ? "scale(1) rotate(0deg)" : "scale(0.2) rotate(-90deg)",
                  transition: "all 0.7s cubic-bezier(0.16,1,0.3,1) 0.9s",
                }}
              >
                <path
                  d="M24 18 L25.6 23.4 L31 25 L25.6 26.6 L24 32 L22.4 26.6 L17 25 L22.4 23.4 Z"
                  fill="#ffffff"
                />
                <circle cx="32" cy="34" r="1.4" fill="#ffffff" />
                <circle cx="17" cy="34" r="1" fill="#ffffff" opacity="0.8" />
              </g>
            </svg>
          </div>
        </div>

        {/* Kinetic title — per-character stagger */}
        <h1 className="mt-7 text-white text-[18px] md:text-[26px] font-bold tracking-tight flex flex-wrap justify-center" aria-label={TITLE}>
          {TITLE.split("").map((ch, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                whiteSpace: ch === " " ? "pre" : "normal",
                opacity: textVisible ? 1 : 0,
                transform: textVisible ? "translateY(0) scale(1)" : "translateY(14px) scale(0.92)",
                filter: textVisible ? "blur(0px)" : "blur(8px)",
                transition: `all 0.55s cubic-bezier(0.16,1,0.3,1) ${0.02 * i}s`,
              }}
            >
              {ch}
            </span>
          ))}
        </h1>

        {/* Subtitle */}
        <div
          className="mt-3.5 flex items-center gap-2.5"
          style={{
            transition: "all 0.6s cubic-bezier(0.16,1,0.3,1) 0.35s",
            opacity: textVisible ? 0.7 : 0,
            transform: textVisible ? "translateY(0)" : "translateY(8px)",
          }}
        >
          <div className="w-7 h-px bg-white/45" />
          <span
            className="text-[10px] md:text-[11px] font-semibold tracking-[0.28em] uppercase"
            style={{
              background: "linear-gradient(90deg, hsl(0 0% 100% / 0.55), #ffffff, hsl(0 0% 100% / 0.55))",
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "splash-shimmer 2.4s linear infinite",
            }}
          >
            AI-Powered Analysis
          </span>
          <div className="w-7 h-px bg-white/45" />
        </div>

        {/* Indeterminate sleek progress */}
        <div
          className="mt-9 w-40 h-[3px] rounded-full overflow-hidden relative"
          style={{
            background: "hsl(0 0% 100% / 0.10)",
            transition: "opacity 0.5s ease 0.4s",
            opacity: textVisible ? 1 : 0,
          }}
        >
          <div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              width: "40%",
              background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.95), transparent)",
              animation: "splash-sweep 1.4s cubic-bezier(0.4,0,0.2,1) infinite",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes splash-spin { to { transform: rotate(360deg); } }
        @keyframes splash-halo {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.12); }
        }
        @keyframes splash-blob-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(8vw, 5vh) scale(1.1); }
        }
        @keyframes splash-blob-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-6vw, -4vh) scale(1.08); }
        }
        @keyframes splash-blob-c {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-4vw, 6vh) scale(1.15); }
        }
        @keyframes splash-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes splash-sweep {
          0% { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
