import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 (or `from`) to `target` using rAF.
 * Uses easeOutCubic for a smooth, decelerating count-up feel.
 */
export function useCountUp(target: number | null | undefined, duration = 1100, from = 0): number {
  const [value, setValue] = useState<number>(from);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef<number>(from);

  useEffect(() => {
    if (target == null || isNaN(target)) {
      setValue(from);
      return;
    }

    // Start from current displayed value for smooth re-animations
    fromRef.current = value;
    startRef.current = null;

    const tick = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = fromRef.current + (target - fromRef.current) * eased;
      setValue(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}
