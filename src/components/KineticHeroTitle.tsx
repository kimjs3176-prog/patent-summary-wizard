import React from "react";

/**
 * Refined kinetic typography — restrained, editorial.
 *  • Words fade-up with gentle stagger (no rotateX/blur)
 *  • "AI" gets gradient + breathing accent + a small drop-pulse dot
 *  • "기술분석" carries a static dark→emerald gradient
 *  • "서비스" lands character-by-character with a soft micro-stagger
 *  • No underline. Composition is centered, single typographic block.
 */
export function KineticHeroTitle() {
  const words = ["농식품분야", "특허"];
  const tail = "서비스";

  return (
    <h2
      className="font-extrabold text-foreground leading-[1.05] tracking-[-0.035em] text-center text-[24px] sm:text-[32px] md:text-[46px] lg:text-[54px]"
      aria-label="농식품분야 특허 AI 기술분석 서비스"
    >
      {/* Line 1 */}
      <span className="block">
        {words.map((w, i) => (
          <span
            key={`w-${i}`}
            className="kinetic-word"
            style={{
              animationDelay: `${0.05 + i * 0.12}s`,
              marginRight: i === words.length - 1 ? 0 : "0.32em",
            }}
          >
            {w}
          </span>
        ))}
      </span>

      {/* Line 2 — accent line */}
      <span className="block mt-1.5 md:mt-3">
        <span
          className="kinetic-word relative"
          style={{ animationDelay: "0.32s", marginRight: "0.28em" }}
        >
          <span className="kinetic-ai">AI</span>
          <span className="kinetic-dot" aria-hidden />
        </span>
        <span
          className="kinetic-word"
          style={{ animationDelay: "0.46s", marginRight: "0.22em" }}
        >
          <span className="kinetic-accent">기술분석</span>
        </span>
        <span className="inline-block">
          {tail.split("").map((c, i) => (
            <span
              key={`t-${i}`}
              className="kinetic-char"
              style={{ animationDelay: `${0.7 + i * 0.06}s` }}
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