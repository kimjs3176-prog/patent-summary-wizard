import { useEffect, useState, useRef } from "react";
import { FileText } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

type Phase = "enter" | "logo" | "text" | "exit";

// Timing (ms). The splash leaves after MIN_VISIBLE once fonts are ready,
// but never later than MAX_VISIBLE so a slow network can't trap the visitor.
const MIN_VISIBLE = 1900;
const MAX_VISIBLE = 3000;
const EXIT_FADE = 600;
const REDUCED_VISIBLE = 450;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Release the page under the splash: entrance animations start and scrolling unlocks. */
const releasePage = () => {
  document.documentElement.removeAttribute("data-splash");
};

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const reduced = useRef(prefersReducedMotion()).current;
  const [phase, setPhase] = useState<Phase>(reduced ? "text" : "enter");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  // Hand over from the static boot screen in index.html (same background, so no flash).
  useEffect(() => {
    document.documentElement.setAttribute("data-splash", "on");
    const raf = requestAnimationFrame(() => document.getElementById("boot-splash")?.remove());
    return () => {
      cancelAnimationFrame(raf);
      document.getElementById("boot-splash")?.remove();
      releasePage();
    };
  }, []);

  // Phase timeline — runs once, independent of parent re-renders.
  useEffect(() => {
    const timers: number[] = [];
    let cancelled = false;
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const start = performance.now();

    const exit = (why?: string) => {
      console.log('[tl] splash exit', why, Math.round(performance.now() - start));
      if (cancelled) return;
      cancelled = true;
      setPhase("exit");
      releasePage();
      at(reduced ? 250 : EXIT_FADE, () => completeRef.current());
    };

    if (reduced) {
      at(REDUCED_VISIBLE, exit);
    } else {
      at(120, () => setPhase("logo"));
      at(600, () => setPhase("text"));
      const fontsReady: Promise<unknown> = document.fonts?.ready ?? Promise.resolve();
      fontsReady.then(() => {
        const wait = Math.max(0, MIN_VISIBLE - (performance.now() - start));
        at(wait, () => exit('fonts+min'));
      }, () => at(MIN_VISIBLE, () => exit('fontsfail')));
      at(MAX_VISIBLE, () => exit('max'));
    }
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [reduced]);

  // Particle network canvas (skipped for reduced motion).
  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    // Cap pixel density: phones report 3–3.5x, which makes every frame several times heavier.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = window.innerWidth;
    let h = window.innerHeight;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const count = w < 640 ? 24 : 40;
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: 1.5 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      t += 0.006;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      ctx.lineWidth = 0.8;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 19600) {
            const alpha = (1 - Math.sqrt(d2) / 140) * 0.15;
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 2 + p.phase);
        ctx.fillStyle = `rgba(255,255,255,${0.25 * pulse})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [reduced]);

  const entered = phase !== "enter";
  const textVisible = phase === "text" || phase === "exit";
  const exiting = phase === "exit";
  const ease = "cubic-bezier(0.16,1,0.3,1)";
  const anim = (value: string) => (reduced ? "none" : value);

  return (
    <div
      role="status"
      aria-label="Agri IP Summary 불러오는 중"
      className="splash-screen fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        transition: `opacity ${reduced ? 250 : EXIT_FADE}ms cubic-bezier(0.4,0,0.2,1)`,
        opacity: exiting ? 0 : 1,
        pointerEvents: exiting ? "none" : "auto",
      }}
    >
      {!reduced && (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.6 }} aria-hidden="true" />
      )}

      <div aria-hidden="true" className="splash-glow absolute top-1/2 left-1/2 w-[60vw] h-[60vw] max-w-[500px] max-h-[500px] rounded-full pointer-events-none" />

      <div className="flex flex-col items-center relative z-10">
        <div className="relative">
          <div
            className="splash-ring absolute inset-0 rounded-3xl"
            style={{
              transition: anim(`transform 0.8s ${ease}, opacity 0.8s ${ease}`),
              transform: entered ? "scale(1)" : "scale(0.5)",
              opacity: entered ? 1 : 0,
            }}
          />
          <div
            className="splash-logo w-20 h-20 md:w-24 md:h-24 rounded-3xl flex items-center justify-center relative"
            style={{
              transition: anim(`transform 0.8s ${ease}, opacity 0.8s ${ease}`),
              transform: entered ? "translateY(0) scale(1)" : "translateY(30px) scale(0.6)",
              opacity: entered ? 1 : 0,
            }}
          >
            <FileText
              className="w-9 h-9 md:w-11 md:h-11 text-primary-foreground"
              style={{
                transition: anim(`transform 0.6s ${ease} 0.2s`),
                transform: entered ? "scale(1) rotate(0deg)" : "scale(0.5) rotate(-15deg)",
              }}
            />
          </div>
        </div>

        <p
          className="text-primary-foreground text-lg md:text-2xl font-bold tracking-tight mt-6"
          style={{
            transition: anim(`opacity 0.7s ${ease}, transform 0.7s ${ease}`),
            opacity: textVisible ? 0.95 : 0,
            transform: textVisible ? "translateY(0)" : "translateY(12px)",
          }}
        >
          Agri IP Summary (AIS)
        </p>

        <div
          className="mt-3 flex items-center gap-2"
          style={{
            transition: anim(`opacity 0.6s ${ease} 0.15s, transform 0.6s ${ease} 0.15s`),
            opacity: textVisible ? 0.7 : 0,
            transform: textVisible ? "translateY(0)" : "translateY(8px)",
          }}
        >
          <div className="w-6 h-px bg-primary-foreground/40" />
          <span className="text-primary-foreground/80 text-[11px] md:text-xs font-medium tracking-widest">
            농식품분야 특허 AI 기술분석
          </span>
          <div className="w-6 h-px bg-primary-foreground/40" />
        </div>

        <div
          className="mt-8 w-32 h-[3px] rounded-full overflow-hidden bg-primary-foreground/15"
          style={{ transition: anim("opacity 0.5s ease 0.3s"), opacity: textVisible ? 1 : 0 }}
        >
          <div className="splash-progress h-full rounded-full bg-primary-foreground/60" />
        </div>
      </div>
    </div>
  );
}
