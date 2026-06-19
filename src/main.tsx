import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// ============================================================
// One-time kill switch — forces every existing client to reset
// their (possibly stale) service worker + caches exactly once.
// Bump KILL_SWITCH_VERSION whenever stale SWs are suspected.
// ============================================================
// Bumped 2026-06-19: removed app-shell service worker entirely.
// Existing visitors will unregister the old SW and clear its caches once.
const KILL_SWITCH_VERSION = "2026-06-19-no-sw";
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
        // Bypass HTTP cache on reload — preserve existing query params (e.g. ?patent=...)
        const sep = window.location.search ? "&" : "?";
        window.location.replace(
          window.location.pathname + window.location.search + sep + "_swreset=" + Date.now() + window.location.hash
        );
      }
    };
    run();
  } catch { /* ignore */ }
})();

// Initialize current build signature from the loaded document.
// Combine the main JS bundle hash AND the main CSS hash so we can detect any
// content-hash change even if only styles were rebuilt.
const getLoadedBuild = (): string | null => {
  const script = document.querySelector('script[src*="/assets/index-"]') as HTMLScriptElement | null;
  const link = document.querySelector('link[rel="stylesheet"][href*="/assets/index-"]') as HTMLLinkElement | null;
  const jsM = (script?.src || "").match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/);
  const cssM = (link?.href || "").match(/\/assets\/(index-[A-Za-z0-9_-]+\.css)/);
  const sha =
    (document.querySelector('script[data-commit-sha]') as HTMLScriptElement | null)?.dataset?.commitSha || "";
  if (!jsM && !cssM && !sha) return null;
  return `${sha || "-"}::${jsM?.[1] || "-"}|${cssM?.[1] || "-"}`;
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
  // User actively interacting in the last 30s.
  if (Date.now() - lastInteraction < 30 * 1000) return true;
  // Visible streaming/loading UI present (defensive selectors).
  if (document.querySelector('[data-app-busy="true"], .animate-spin')) return true;
  return false;
};

// True whenever an analysis result is on screen. We must NEVER auto-reload in
// this state — reloading would wipe the in-memory summary and (via the
// ?patent= query param) re-trigger a full analysis from scratch.
const hasVisibleResults = (): boolean => {
  return !!document.querySelector('[data-results-visible="true"]');
};

let pendingReload = false;
const showUpdateToast = (countdownSec: number) => {
  // Lightweight, dependency-free toast so the user sees the auto-refresh.
  try {
    const id = "__app-update-toast__";
    if (document.getElementById(id)) return;
    const el = document.createElement("div");
    el.id = id;
    el.setAttribute("role", "status");
    el.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);" +
      "z-index:2147483647;background:#10B981;color:#fff;padding:10px 16px;" +
      "border-radius:9999px;font:600 13px/1.4 Pretendard,Inter,sans-serif;" +
      "box-shadow:0 8px 24px rgba(16,185,129,.35);" +
      "opacity:0;transition:opacity .25s ease;display:flex;align-items:center;gap:10px;";
    el.textContent = `새 버전이 준비되었습니다. ${countdownSec}초 후 자동 새로고침`;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = "1"; });
    let left = countdownSec;
    const t = setInterval(() => {
      left -= 1;
      if (left <= 0) { clearInterval(t); return; }
      el.textContent = `새 버전이 준비되었습니다. ${left}초 후 자동 새로고침`;
    }, 1000);
  } catch { /* ignore */ }
};

// 결과 화면 등으로 자동 새로고침이 보류된 동안 사용자에게 수동 적용 버튼을 노출.
const showManualUpdateBanner = () => {
  try {
    const id = "__app-update-banner__";
    if (document.getElementById(id)) return;
    const el = document.createElement("div");
    el.id = id;
    el.setAttribute("role", "status");
    el.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);" +
      "z-index:2147483647;background:#10B981;color:#fff;padding:10px 14px 10px 16px;" +
      "border-radius:9999px;font:600 13px/1.4 Pretendard,Inter,sans-serif;" +
      "box-shadow:0 8px 24px rgba(16,185,129,.35);display:flex;align-items:center;gap:10px;" +
      "opacity:0;transition:opacity .25s ease;";
    const label = document.createElement("span");
    label.textContent = "새 버전이 준비되었습니다";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "지금 새로고침";
    btn.style.cssText =
      "background:#fff;color:#047857;border:0;border-radius:9999px;" +
      "padding:5px 12px;font:700 12px/1 Pretendard,Inter,sans-serif;cursor:pointer;";
    btn.onclick = () => { hardReload(); };
    el.appendChild(label);
    el.appendChild(btn);
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = "1"; });
  } catch { /* ignore */ }
};
const hideManualUpdateBanner = () => {
  const el = document.getElementById("__app-update-banner__");
  if (el && el.parentNode) el.parentNode.removeChild(el);
};

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

// Defer reload until the app is idle, but enforce a hard cap so a new
// service worker (skipWaiting + clientsClaim) eventually takes over —
// otherwise the page could run stale JS against a newer SW cache.
// `maxWaitMs` is the absolute upper bound we'll wait before reloading anyway.
const safeReload = (opts: { maxWaitMs?: number; toastSec?: number } = {}) => {
  if (pendingReload) return;
  pendingReload = true;
  const start = Date.now();
  const maxWaitMs = opts.maxWaitMs ?? 45 * 1000; // 45s hard cap
  const toastSec = opts.toastSec ?? 3;

  const fire = () => {
    showUpdateToast(toastSec);
    setTimeout(hardReload, toastSec * 1000);
  };

  const tryReload = () => {
    const waited = Date.now() - start;
    // Hard skip: if the user is viewing an analysis result, do not reload.
    // Reset the pending flag so a future check can try again once results
    // are dismissed.
    if (hasVisibleResults()) {
      pendingReload = false;
      showManualUpdateBanner();
      return;
    }
    hideManualUpdateBanner();
    if (!isAppBusy() || waited >= maxWaitMs) {
      fire();
      return;
    }
    setTimeout(tryReload, 3 * 1000);
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

// ==================== 새 버전 감시 ====================
// 주 자산(JS + CSS) 해시를 동시에 추출해 비교한다. 일부만 변경돼도 즉시 감지.
let consecutiveCheckFailures = 0;
let checkInFlight = false;

const parseBuildSignature = (html: string): string | null => {
  const jsM = html.match(/src="\/assets\/(index-[A-Za-z0-9_-]+\.js)"/);
  const cssM = html.match(/href="\/assets\/(index-[A-Za-z0-9_-]+\.css)"/);
  const shaM = html.match(/data-commit-sha="([a-f0-9]{6,40})"/i);
  if (!jsM && !cssM && !shaM) return null;
  return `${shaM?.[1] || "-"}::${jsM?.[1] || "-"}|${cssM?.[1] || "-"}`;
};

const checkForUpdate = async () => {
  if (checkInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  checkInFlight = true;
  try {
    const res = await fetch(`${window.location.origin}/?_v=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
    });
    if (!res.ok) {
      consecutiveCheckFailures++;
      return;
    }
    const html = await res.text();
    const latest = parseBuildSignature(html);
    if (!latest) {
      consecutiveCheckFailures++;
      return;
    }
    consecutiveCheckFailures = 0;
    const current = (window as any).__APP_BUILD__;
    if (!current) {
      (window as any).__APP_BUILD__ = latest;
      return;
    }
    if (current !== latest) {
      console.info(`[update] new build detected: ${current} → ${latest}`);
      (window as any).__APP_BUILD__ = latest;
      // SW가 있으면 업데이트 강제 → controllerchange가 hardReload 트리거.
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
            if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
            // controllerchange가 안 와도 보장
            setTimeout(safeReload, 2000);
            return;
          }
        } catch { /* fall through */ }
      }
      safeReload();
    }
  } catch {
    consecutiveCheckFailures++;
  } finally {
    checkInFlight = false;
  }
};

// 백오프: 연속 실패 시 다음 체크까지 대기시간 증가(최대 5분).
const scheduleNextCheck = () => {
  const base = 45 * 1000; // 45초
  const backoff = Math.min(consecutiveCheckFailures, 6); // 최대 6배
  const delay = base * Math.max(1, backoff || 1);
  setTimeout(async () => { await checkForUpdate(); scheduleNextCheck(); }, delay);
};

// 첫 체크는 빠르게(3초), 이후 주기적 + 이벤트 기반 재확인.
setTimeout(() => { checkForUpdate().finally(scheduleNextCheck); }, 3 * 1000);
window.addEventListener("focus", checkForUpdate);
window.addEventListener("online", checkForUpdate);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkForUpdate();
});

// 동적 import 실패(= 보통 스테일 빌드, 새 청크 경로 사라짐) 시 즉시 업데이트 시도.
const looksLikeChunkLoadError = (msg: string) => {
  const m = (msg || "").toLowerCase();
  return (
    m.includes("failed to fetch dynamically imported module") ||
    m.includes("error loading dynamically imported module") ||
    m.includes("importing a module script failed") ||
    m.includes("chunkloaderror") ||
    (m.includes("loading chunk") && m.includes("failed"))
  );
};
window.addEventListener("error", (e) => {
  const msg = e?.message || (e?.error && (e.error as Error).message) || "";
  if (looksLikeChunkLoadError(msg)) {
    console.warn("[update] chunk load error — forcing version check");
    checkForUpdate();
  }
});
window.addEventListener("unhandledrejection", (e) => {
  const reason: any = e?.reason;
  const msg = typeof reason === "string" ? reason : reason?.message || "";
  if (looksLikeChunkLoadError(msg)) {
    console.warn("[update] chunk load rejection — forcing version check");
    checkForUpdate();
  }
});
