import { useEffect, useState } from "react";

const STORAGE_KEY = "font-scale";
const EVENT = "font-scale-change";

export const FONT_SCALES = [1, 1.15, 1.3] as const;
export type FontScale = (typeof FONT_SCALES)[number];

export const FONT_SCALE_LABELS: Record<number, string> = {
  1: "기본",
  1.15: "크게",
  1.3: "아주 크게",
};

function read(): FontScale {
  if (typeof window === "undefined") return 1;
  const raw = Number(localStorage.getItem(STORAGE_KEY));
  return (FONT_SCALES as readonly number[]).includes(raw) ? (raw as FontScale) : 1;
}

export function applyFontScale(scale: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${16 * scale}px`;
}

export function useFontScale() {
  const [scale, setScaleState] = useState<FontScale>(read);

  useEffect(() => {
    applyFontScale(scale);
  }, [scale]);

  useEffect(() => {
    const handler = (e: Event) => setScaleState((e as CustomEvent<FontScale>).detail);
    window.addEventListener(EVENT, handler as EventListener);
    return () => window.removeEventListener(EVENT, handler as EventListener);
  }, []);

  const setScale = (next: FontScale) => {
    localStorage.setItem(STORAGE_KEY, String(next));
    setScaleState(next);
    applyFontScale(next);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  };

  const cycle = () => {
    const idx = FONT_SCALES.indexOf(scale);
    setScale(FONT_SCALES[(idx + 1) % FONT_SCALES.length]);
  };

  return { scale, setScale, cycle, label: FONT_SCALE_LABELS[scale] };
}
