import { useEffect, useState, useRef, type CSSProperties } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

// Timing (ms). The intro leaves after MIN_VISIBLE once fonts are ready,
// but never later than MAX_VISIBLE so a slow network can't trap the visitor.
// The CSS timeline (sheet drawing → scan → wordmark) finishes at about 2.0 s,
// then the finished frame rests briefly before the exit starts.
const MIN_VISIBLE = 2600;
const MAX_VISIBLE = 3600;
// Exit: the content settles first, then the whole panel dissolves (a slight zoom) over the page beneath.
const EXIT_MS = 1000;
const REDUCED_VISIBLE = 450;
const REDUCED_EXIT_MS = 250;

const WORDMARK = "Agri IP Summary";
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
          : `opacity ${EXIT_MS - 150}ms cubic-bezier(0.4,0,0.2,1) 150ms, transform ${EXIT_MS}ms cubic-bezier(0.22,1,0.36,1)`,
        transform: exiting && !reduced ? "scale(1.04)" : "scale(1)",
        opacity: exiting ? 0 : 1,
        pointerEvents: exiting ? "none" : "auto",
      }}
    >
      <div aria-hidden="true" className="splash-grid absolute inset-0" />
      <div aria-hidden="true" className="splash-glow absolute left-1/2 top-1/2 pointer-events-none" />
      <span aria-hidden="true" className="bp-mark bp-mark-tl" />
      <span aria-hidden="true" className="bp-mark bp-mark-tr" />
      <span aria-hidden="true" className="bp-mark bp-mark-bl" />
      <span aria-hidden="true" className="bp-mark bp-mark-br" />

      <div className="splash-stage relative z-10 flex flex-col items-center px-6">
        {/* The datasheet draws itself, then a scan beam reads it. */}
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
        </div>

        <p className="splash-wordmark mt-7 text-[26px] sm:text-[34px] md:text-[40px]">
          {WORDMARK.split("").map((ch, i) => (
            <span key={i} className="splash-letter" style={{ "--i": i } as CSSProperties}>
              {ch === " " ? " " : ch}
            </span>
          ))}
        </p>

        <p className="splash-kicker mt-3">AIS · 농식품 특허 AI 기술분석</p>

        <div className="splash-progress mt-10" aria-hidden="true"><i /></div>
      </div>
    </div>
  );
}
