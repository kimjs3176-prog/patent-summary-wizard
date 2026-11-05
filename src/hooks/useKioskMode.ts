import { useEffect, useState } from "react";

const STORAGE_KEY = "kiosk-mode-enabled";
const EVENT = "kiosk-mode-change";

export function useKioskMode() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setEnabled(!!detail);
    };
    window.addEventListener(EVENT, handler as EventListener);
    return () => window.removeEventListener(EVENT, handler as EventListener);
  }, []);

  const toggle = () => {
    const next = !enabled;
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* storage blocked: keep in memory */ }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
    setEnabled(next);
  };

  return { enabled, toggle };
}