import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Auto-reload when a new SW takes control (after deploy)
if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

// Periodic version check (every 2 minutes) — compares index.html hash signature
const checkForUpdate = async () => {
  try {
    const res = await fetch(`${window.location.origin}/?_v=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
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
      // Soft notify and reload
      window.location.reload();
    }
  } catch { /* ignore */ }
};
setTimeout(checkForUpdate, 3000);
setInterval(checkForUpdate, 2 * 60 * 1000);
window.addEventListener("focus", checkForUpdate);
