import { useEffect, useRef, useState, useCallback } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";

const MIN = 1;
const MAX = 6;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export interface LightboxItem {
  src: string;
  caption: string;
}

interface Props {
  images: LightboxItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}

export function ImageLightbox({ images, index, onIndexChange, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };

  const current = images[index];
  const total = images.length;

  const reset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const go = useCallback(
    (dir: number) => {
      if (total < 2) return;
      onIndexChange((index + dir + total) % total);
      reset();
    },
    [index, total, onIndexChange, reset],
  );

  const zoomAt = useCallback((px: number, py: number, next: number) => {
    const { zoom: z, offset: o } = stateRef.current;
    const n = clamp(next, MIN, MAX);
    const k = n / z;
    setZoom(n);
    setOffset(n === MIN ? { x: 0, y: 0 } : { x: px - (px - o.x) * k, y: py - (py - o.y) * k });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, stateRef.current.zoom * Math.exp(-dy * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "Tab") {
        const root = panelRef.current;
        if (!root) return;
        const nodes = Array.from(
          root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        ).filter((n) => !n.hasAttribute("disabled") && n.offsetParent !== null);
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !root.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !root.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restoreFocusRef.current?.focus?.();
    };
  }, [onClose, go]);

  const centerZoom = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, stateRef.current.zoom * factor);
  };

  if (!current) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      aria-describedby="lightbox-desc"
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col print:hidden"
    >
      <p id="lightbox-desc" className="sr-only">
        도면 확대 뷰어입니다. 마우스 휠 또는 확대·축소 버튼으로 배율을 조절하고, 확대된 상태에서는 드래그로 이동할 수 있습니다.
        좌우 화살표 키로 도면을 전환하고, ESC 키로 닫습니다.
      </p>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <p id="lightbox-title" className="bp-label truncate">
          {current.caption}
          {total > 1 && <span className="ml-2 opacity-70">{index + 1} / {total}</span>}
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => centerZoom(1 / 1.4)} aria-label="축소" className="p-2 rounded-md hover:bg-muted text-muted-foreground">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span role="status" aria-live="polite" aria-label={`확대 배율 ${Math.round(zoom * 100)}퍼센트`} className="text-[11px] font-mono text-muted-foreground w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => centerZoom(1.4)} aria-label="확대" className="p-2 rounded-md hover:bg-muted text-muted-foreground">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={reset} aria-label="초기화" className="p-2 rounded-md hover:bg-muted text-muted-foreground">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button ref={closeRef} onClick={onClose} aria-label="닫기" className="p-2 rounded-md hover:bg-muted text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-hidden select-none"
          style={{ cursor: zoom > 1 ? "grab" : "zoom-in", touchAction: "none" }}
          onPointerDown={(e) => {
            if (zoom <= 1) return;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setOffset({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
          }}
          onPointerUp={() => { drag.current = null; }}
          onDoubleClick={(e) => {
            const r = containerRef.current!.getBoundingClientRect();
            zoomAt(e.clientX - r.left, e.clientY - r.top, zoom > 1 ? 1 : 2.5);
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              transition: reducedMotion || drag.current ? "none" : "transform 160ms ease-out",
            }}
          >
            <img src={current.src} alt={current.caption} className="max-w-full max-h-full object-contain" draggable={false} />
          </div>
        </div>

        {total > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="이전 도면"
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-card/90 border border-border/60 text-foreground hover:bg-muted"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="다음 도면"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-card/90 border border-border/60 text-foreground hover:bg-muted"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-border/50 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => { onIndexChange(i); reset(); }}
              aria-label={img.caption}
              className={`shrink-0 w-16 h-16 rounded-[4px] border bg-white flex items-center justify-center overflow-hidden transition-colors ${
                i === index ? "border-primary" : "border-border/60 hover:border-border"
              }`}
            >
              <img src={img.src} alt={img.caption} className="max-w-full max-h-full object-contain" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-muted-foreground py-2">
        휠·더블클릭으로 확대 · 드래그로 이동 · ←/→ 도면 전환 · ESC 닫기
      </p>
    </div>
  );
}
