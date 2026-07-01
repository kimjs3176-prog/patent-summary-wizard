import { useMemo } from "react";

interface Particle {
  top: string;
  left: string;
  size: number;
  driftDuration: number;
  twinkleDuration: number;
  delay: number;
  blur: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildParticles(count: number): Particle[] {
  const rand = seededRandom(20260701);
  return Array.from({ length: count }, () => {
    const size = 1 + rand() * 2.5; // 1 – 3.5 px
    return {
      top: `${rand() * 100}%`,
      left: `${rand() * 100}%`,
      size,
      driftDuration: 12 + rand() * 10, // 12–22s
      twinkleDuration: 3 + rand() * 3.5, // 3–6.5s
      delay: rand() * -8, // negative → desync start
      blur: size < 1.8 ? 0 : 0.5,
    };
  });
}

interface HeroParticlesProps {
  count?: number;
}

export function HeroParticles({ count = 22 }: HeroParticlesProps) {
  const particles = useMemo(() => buildParticles(count), [count]);
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none">
      {particles.map((p, i) => (
        <span
          key={i}
          className="hero-particle"
          style={{
            top: p.top,
            left: p.left,
            width: `${p.size}px`,
            height: `${p.size}px`,
            filter: p.blur ? `blur(${p.blur}px)` : undefined,
            animationDuration: `${p.driftDuration}s, ${p.twinkleDuration}s`,
            animationDelay: `${p.delay}s, ${p.delay * 0.6}s`,
          }}
        />
      ))}
    </div>
  );
}