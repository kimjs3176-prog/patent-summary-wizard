import React from "react";

/**
 * Kinetic typography rendering of the service name.
 * Composes 4 motion registers:
 *   1) Word-level rise + de-blur (stagger)
 *   2) "AI" continuous glow pulse
 *   3) "기술분석" gradient sweep
 *   4) "서비스" character-level drop with elastic settle
 * Underline accent draws in after the title resolves.
 */
export function KineticHeroTitle() {
  const line1 = ["농식품분야", "특허"];
  const ai = "AI";
  const sweep = "기술분석";
  const tail = "서비스";

  let wordDelay = 0;
  const nextDelay = (step = 0.12) => {
    const d = wordDelay;
    wordDelay += step;
    return d;
  };

  return (
    <h2
      className="font-extrabold text-foreground leading-[1.1] tracking-[-0.03em] px-2 text-[22px] sm:text-[30px] md:text-[44px] lg:text-[52px]"
      aria-label="농식품분야 특허 AI 기술분석 서비스"
    >
      {/* Line 1 — word rise */}
      <span className="block kinetic-underline pb-1">
        {line1.map((w, i) => (
          <span
            key={`l1-${i}`}
            className="kinetic-word mr-[0.35em] last:mr-0"
            style={{ animationDelay: `${nextDelay(0.14)}s` }}
          >
            {w}
          </span>
        ))}
      </span>

      {/* Line 2 — AI glow + gradient sweep + char drop */}
      <span className="block mt-1 md:mt-2">
        <span
          className="kinetic-word mr-[0.3em]"
          style={{ animationDelay: `${nextDelay(0.18)}s` }}
        >
          <span className="kinetic-ai">{ai}</span>
        </span>
        <span
          className="kinetic-word mr-[0.3em]"
          style={{ animationDelay: `${nextDelay(0.16)}s` }}
        >
          <span className="kinetic-sweep">{sweep}</span>
        </span>
        <span className="inline-block align-baseline">
          {tail.split("").map((c, i) => (
            <span
              key={`tail-${i}`}
              className="kinetic-char"
              style={{ animationDelay: `${0.95 + i * 0.07}s` }}
            >
              {c}
            </span>
          ))}
        </span>
      </span>
    </h2>
  );
}

export default KineticHeroTitle;