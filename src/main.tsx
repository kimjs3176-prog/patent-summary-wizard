import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// ============================================================
// One-time kill switch — forces every existing client to reset
// their (possibly stale) service worker + caches exactly once.
// Bump KILL_SWITCH_VERSION whenever stale SWs are suspected.
// ============================================================
const KILL_SWITCH_VERSION = "2026-05-09-a";
(() => {
  try {
    const key = "sw-kill-switch";
    if (localStorage.getItem(key) === KILL_SWITCH_VERSION) return;
    const run = async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
        }
      } finally {
        localStorage.setItem(key, KILL_SWITCH_VERSION);
        // Bypass HTTP cache on reload
        window.location.replace(window.location.pathname + "?_swreset=" + Date.now());
      }
    };
    run();
  } catch { /* ignore */ }
})();

// Initialize current build signature from the loaded document (so first check can detect a new version)
const getLoadedBuild = (): string | null => {
  const script = document.querySelector('script[src*="/assets/index-"]') as HTMLScriptElement | null;
  const src = script?.src || "";
  const m = src.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/);
  return m ? m[1] : null;
};
(window as any).__APP_BUILD__ = (window as any).__APP_BUILD__ || getLoadedBuild();

// ----- Idle / busy detection -----
// We want to avoid yanking the page out from under the user (esp. while a
// long-running summary analysis is streaming). Track last interaction and
// expose a flag that other code (usePatentSummary, etc.) can set.
let lastInteraction = Date.now();
const markInteraction = () => { lastInteraction = Date.now(); };
["mousemove", "keydown", "scroll", "touchstart", "click"].forEach((ev) =>
  window.addEventListener(ev, markInteraction, { passive: true })
);

const isAppBusy = (): boolean => {
  // Explicit busy flag (set by analysis hooks).
  if ((window as any).__APP_BUSY__ === true) return true;
  // Any in-flight network request to our edge functions = treat as busy.
  if ((window as any).__APP_INFLIGHT__ > 0) return true;
  // User actively interacting in the last 90s.
  if (Date.now() - lastInteraction < 90 * 1000) return true;
  // Visible streaming/loading UI present (defensive selectors).
  if (document.querySelector('[data-app-busy="true"], .animate-spin')) return true;
  return false;
};

let pendingReload = false;
const hardReload = () => {
  const done = () => window.location.reload();
  if ("caches" in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .finally(done);
  } else {
    done();
  }
};

// Defer reload until the app is genuinely idle, so we never interrupt
// an in-progress patent analysis or reading session.
const safeReload = () => {
  if (pendingReload) return;
  pendingReload = true;
  const tryReload = () => {
    if (!isAppBusy()) {
      hardReload();
      return;
    }
    setTimeout(tryReload, 15 * 1000);
  };
  tryReload();
};

// Auto-reload when a new SW takes control (after deploy) — but only when idle.
if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    safeReload();
  });

  // When a waiting worker appears, activate it immediately
  navigator.serviceWorker.ready.then((reg) => {
    const promote = (sw: ServiceWorker | null) => {
      if (sw && sw.state === "installed" && navigator.serviceWorker.controller) {
        sw.postMessage({ type: "SKIP_WAITING" });
      }
    };
    if (reg.waiting) promote(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", () => promote(nw));
    });
  }).catch(() => { /* ignore */ });
}

// Periodic version check — compares index.html asset hash signature
const checkForUpdate = async () => {
  try {
    const res = await fetch(`${window.location.origin}/?_v=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
    });
    if (!res.ok) return;
    const html = await res.text();
    const match = html.match(/src="\/assets\/(index-[A-Za-z0-9_-]+\.js)"/);
    if (!match) return;
    const latest = match[1];
    const current = (window as any).__APP_BUILD__;
    if (!current) {
      (window as any).__APP_BUILD__ = latest;
      return;
    }
    if (current !== latest) {
      (window as any).__APP_BUILD__ = latest;
      // Ask SW to update; controllerchange will trigger hardReload.
      // If no SW, reload directly.
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
            if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
            // Fallback in case controllerchange never fires
            setTimeout(safeReload, 2000);
            return;
          }
        } catch { /* fall through */ }
      }
      safeReload();
    }
  } catch { /* ignore */ }
};
// Reduced cadence: first check after 30s, then every 5 minutes. Combined with
// safeReload(), this avoids interrupting active analysis sessions.
setTimeout(checkForUpdate, 30 * 1000);
setInterval(checkForUpdate, 5 * 60 * 1000);
window.addEventListener("focus", checkForUpdate);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkForUpdate();
});
