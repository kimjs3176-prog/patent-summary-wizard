import { useEffect, useRef, useState, useCallback } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

const MIN = 1;
const MAX = 6;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface Props {
  src: string;
  caption?: string;
  onClose: () => void;
}

export function ImageLightbox({ src, caption, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };

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
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const centerZoom = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, stateRef.current.zoom * factor);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col print:hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <p className="bp-label truncate">{caption || "도면"}</p>
        <div className="flex items-center gap-1">
          <button onClick={() => centerZoom(1 / 1.4)} aria-label="축소" className="p-2 rounded-md hover:bg-muted text-muted-foreground">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => centerZoom(1.4)} aria-label="확대" className="p-2 rounded-md hover:bg-muted text-muted-foreground">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            aria-label="초기화"
            className="p-2 rounded-md hover:bg-muted text-muted-foreground"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={onClose} aria-label="닫기" className="p-2 rounded-md hover:bg-muted text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative select-none"
        style={{ cursor: zoom > 1 ? (drag.current ? "grabbing" : "grab") : "zoom-in", touchAction: "none" }}
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
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
        >
          <img src={src} alt={caption || "도면 확대"} className="max-w-full max-h-full object-contain" draggable={false} />
        </div>
      </div>
      <p className="text-center text-[11px] text-muted-foreground py-2">휠·더블클릭으로 확대 · 드래그로 이동 · ESC 닫기</p>
    </div>
  );
}
