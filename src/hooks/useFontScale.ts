import { useEffect, useState } from "react";

const STORAGE_KEY = "font-scale";
const EVENT = "font-scale-change";
const originalInlineSizes = new WeakMap<HTMLElement, string>();
const scaledElements = new Set<HTMLElement>();
let activeScale = 1;
let observer: MutationObserver | null = null;
let resizeTimer: number | null = null;

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

function restoresOriginalSizes() {
  scaledElements.forEach((element) => {
    const original = originalInlineSizes.get(element);
    if (original) element.style.fontSize = original;
    else element.style.removeProperty("font-size");
  });
  scaledElements.clear();
}

function containsVisibleText(element: HTMLElement) {
  if (element.matches("input, textarea, select, button")) return true;
  return Array.from(element.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
  );
}

function refreshScaledText() {
  if (typeof document === "undefined") return;

  observer?.disconnect();
  restoresOriginalSizes();

  if (activeScale > 1) {
    const elements = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
      .filter(containsVisibleText);
    const baseSizes = elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize));

    elements.forEach((element, index) => {
      const baseSize = baseSizes[index];
      if (!Number.isFinite(baseSize)) return;
      originalInlineSizes.set(element, element.style.fontSize);
      element.style.fontSize = `${baseSize * activeScale}px`;
      scaledElements.add(element);
    });
  }

  if (activeScale > 1) {
    observer?.observe(document.body, { childList: true, subtree: true });
  }
}

function ensureObserver() {
  if (observer || typeof MutationObserver === "undefined") return;
  observer = new MutationObserver(() => window.requestAnimationFrame(refreshScaledText));
  window.addEventListener("resize", () => {
    if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refreshScaledText, 120);
  });
}

export function applyFontScale(scale: number) {
  if (typeof document === "undefined") return;
  activeScale = scale;
  document.documentElement.style.removeProperty("font-size");
  document.documentElement.dataset.fontScale = String(scale);
  ensureObserver();
  refreshScaledText();
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
