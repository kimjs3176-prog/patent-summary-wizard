import { useEffect, useState, useRef, type CSSProperties } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

// Timing (ms). The intro leaves after MIN_VISIBLE once fonts are ready,
// but never later than MAX_VISIBLE so a slow network can't trap the visitor.
// The CSS timeline (sheet drawing → scan → insights → readout) finishes at about 2.3 s.
const MIN_VISIBLE = 2500;
const MAX_VISIBLE = 3500;
const EXIT_MS = 720;
const REDUCED_VISIBLE = 450;
const REDUCED_EXIT_MS = 250;

const WORDMARK = "Agri IP Summary";
const STEPS = ["특허 불러오기", "AI 기술 분석", "요약서 작성"];
// Insight tags that "come out" of the datasheet once the scan has read it.
const INSIGHTS: { label: string; className: string }[] = [
  { label: "TRL 7 · 상용화", className: "splash-tag-a" },
  { label: "시장 규모 ↗", className: "splash-tag-b" },
  { label: "핵심 키워드 3", className: "splash-tag-c" },
];
// Datasheet line art: [x, y, length, weight]. Stroke order is top to bottom, like a page being written.
const SHEET_LINES: [number, number, number, number][] = [
  [22, 44, 52, 5],
  [22, 62, 76, 2.5],
  [22, 72, 64, 2.5],
  [22, 82, 72, 2.5],
  [22, 92, 46, 2.5],
];
const SHEET_BARS: [number, number][] = [
  [24, 16],
  [40, 26],
  [56, 20],
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Release the page under the intro: entrance animations start and scrolling unlocks. */
const releasePage = () => {
  document.documentElement.removeAttribute("data-splash");
};

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const reduced = useRef(prefersReducedMotion()).current;
  const [exiting, setExiting] = useState(false);
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

  // Exit timeline — runs once, independent of parent re-renders. The entrance is pure CSS.
  useEffect(() => {
    const timers: number[] = [];
    let done = false;
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const start = performance.now();

    const exit = () => {
      if (done) return;
      done = true;
      setExiting(true);
      releasePage();
      at(reduced ? REDUCED_EXIT_MS : EXIT_MS, () => completeRef.current());
    };

    if (reduced) {
      at(REDUCED_VISIBLE, exit);
    } else {
      const fontsReady: Promise<unknown> = document.fonts?.ready ?? Promise.resolve();
      fontsReady.then(() => {
        const wait = Math.max(0, MIN_VISIBLE - (performance.now() - start));
        at(wait, exit);
      }, () => at(MIN_VISIBLE, exit));
      at(MAX_VISIBLE, exit);
    }
    return () => { done = true; timers.forEach(clearTimeout); };
  }, [reduced]);

  // Constellation canvas: accent-coloured nodes drifting over the blueprint grid (skipped for reduced motion).
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

    const count = w < 640 ? 18 : 34;
    const nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: 1.2 + Math.random() * 1.8,
      phase: Math.random() * Math.PI * 2,
    }));
    const MAX_DIST = 150;
    // --home-hero-accent (158 62% 72%) in rgb
    const ACCENT = "152,228,196";

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      t += 0.006;

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }

      ctx.lineWidth = 0.8;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < MAX_DIST * MAX_DIST) {
            const alpha = (1 - Math.sqrt(d2) / MAX_DIST) * 0.16;
            ctx.strokeStyle = `rgba(${ACCENT},${alpha})`;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 2 + n.phase);
        ctx.fillStyle = `rgba(${ACCENT},${0.35 * pulse})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * pulse, 0, Math.PI * 2);
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

  const sheetArt = (
    <>
      <path d="M10 4H86L112 30V146H10Z" pathLength={1} className="splash-draw" style={{ "--d": "0.05s" } as CSSProperties} />
      <path d="M86 4V30H112" pathLength={1} className="splash-draw" style={{ "--d": "0.4s" } as CSSProperties} />
      {SHEET_LINES.map(([x, y, len, weight], i) => (
        <line
          key={`l${i}`}
          x1={x} y1={y} x2={x + len} y2={y}
          pathLength={1}
          strokeWidth={weight}
          className="splash-draw"
          style={{ "--d": `${0.3 + i * 0.09}s` } as CSSProperties}
        />
      ))}
      {SHEET_BARS.map(([x, height], i) => (
        <rect
          key={`b${i}`}
          x={x} y={134 - height} width={10} height={height} rx={1.5}
          pathLength={1}
          className="splash-draw"
          style={{ "--d": `${0.72 + i * 0.08}s` } as CSSProperties}
        />
      ))}
      <circle cx={92} cy={118} r={13} pathLength={1} className="splash-draw" style={{ "--d": "0.9s" } as CSSProperties} />
      <path d="M85.5 118.5L90 123L99 113.5" pathLength={1} strokeWidth={2.4} className="splash-draw" style={{ "--d": "1.05s" } as CSSProperties} />
    </>
  );

  return (
    <div
      role="status"
      aria-label="Agri IP Summary 불러오는 중"
      data-exiting={exiting ? "" : undefined}
      className={`splash-screen fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden${reduced ? " splash-reduced" : ""}`}
      style={{
        transition: reduced
          ? `opacity ${REDUCED_EXIT_MS}ms ease-out`
          : `transform ${EXIT_MS}ms cubic-bezier(0.76,0,0.24,1), opacity ${EXIT_MS}ms ease-in`,
        transform: exiting && !reduced ? "translateY(-100%)" : "translateY(0)",
        opacity: exiting && reduced ? 0 : 1,
        pointerEvents: exiting ? "none" : "auto",
      }}
    >
      <div aria-hidden="true" className="splash-grid absolute inset-0" />
      {!reduced && (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
      )}
      <div aria-hidden="true" className="splash-glow absolute left-1/2 top-1/2 pointer-events-none" />
      <div aria-hidden="true" className="splash-sweep" />
      <span aria-hidden="true" className="bp-mark bp-mark-tl" />
      <span aria-hidden="true" className="bp-mark bp-mark-tr" />
      <span aria-hidden="true" className="bp-mark bp-mark-bl" />
      <span aria-hidden="true" className="bp-mark bp-mark-br" />

      <div className="splash-stage relative z-10 flex flex-col items-center px-6">
        {/* The datasheet draws itself, a scan beam reads it, and the insights come out. */}
        <div aria-hidden="true" className="splash-sheet-wrap relative">
          <svg viewBox="0 0 120 150" className="splash-sheet" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <clipPath id="splash-reveal-clip">
                <rect className="splash-reveal" x={0} y={0} width={120} height={150} />
              </clipPath>
              <linearGradient id="splash-beam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="hsl(158 62% 72%)" stopOpacity="0" />
                <stop offset="0.55" stopColor="hsl(158 62% 72%)" stopOpacity="0.85" />
                <stop offset="1" stopColor="hsl(158 62% 72%)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g className="splash-ink" stroke="hsl(150 25% 97% / 0.55)" strokeWidth={1.5}>{sheetArt}</g>
            <g className="splash-ink splash-ink-accent" stroke="hsl(158 62% 72%)" strokeWidth={1.5} clipPath="url(#splash-reveal-clip)">{sheetArt}</g>
            <rect className="splash-beam" x={2} y={-14} width={116} height={28} fill="url(#splash-beam)" />
          </svg>
          {INSIGHTS.map((tag) => (
            <span key={tag.label} className={`splash-tag ${tag.className}`}>
              <i />
              {tag.label}
            </span>
          ))}
        </div>

        <p className="splash-wordmark mt-7 text-[26px] sm:text-[34px] md:text-[40px]">
          {WORDMARK.split("").map((ch, i) => (
            <span key={i} className="splash-letter" style={{ "--i": i } as CSSProperties}>
              {ch === " " ? " " : ch}
            </span>
          ))}
        </p>

        <p className="splash-kicker mt-3">
          <span className="splash-kicker-text">AIS · 농식품 특허 AI 기술분석</span>
          <span className="splash-caret" aria-hidden="true" />
        </p>

        <ol className="splash-steps mt-9" aria-hidden="true">
          {STEPS.map((label, i) => (
            <li key={label} className="splash-step" style={{ "--i": i } as CSSProperties}>
              <span className="splash-step-no">0{i + 1}</span>
              <span className="splash-step-dot" />
              <span className="splash-step-label">{label}</span>
            </li>
          ))}
        </ol>
        <div className="splash-progress mt-3" aria-hidden="true"><i /></div>
      </div>
    </div>
  );
}
