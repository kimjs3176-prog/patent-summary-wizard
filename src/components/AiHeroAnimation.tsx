import { useEffect, useRef } from "react";

/**
 * Animated neural-network / AI brain visual for the hero section.
 * Pure canvas – no extra dependencies.
 */
export const AiHeroAnimation = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let w = 0;
    let h = 0;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const NODE_COUNT = 31;
    interface Node {
      x: number; y: number; vx: number; vy: number;
      radius: number; phase: number; speed: number;
    }

    const nodes: Node[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.38,
      vy: (Math.random() - 0.5) * 0.38,
      radius: 2.2 + Math.random() * 3.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.33 + Math.random() * 0.77,
    }));

    const MAX_DIST = 150;
    const PRIMARY_R = 82, PRIMARY_G = 82, PRIMARY_B = 224;
    const ACCENT_R = 138, ACCENT_G = 43, ACCENT_B = 226;

    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      t += 0.008;

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        n.x = Math.max(0, Math.min(w, n.x));
        n.y = Math.max(0, Math.min(h, n.y));
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.28;
            const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i * 0.5);
            const r = Math.round(PRIMARY_R + (ACCENT_R - PRIMARY_R) * pulse);
            const g = Math.round(PRIMARY_G + (ACCENT_G - PRIMARY_G) * pulse);
            const b = Math.round(PRIMARY_B + (ACCENT_B - PRIMARY_B) * pulse);
            ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();

            if (alpha > 0.12 && Math.sin(t * 2 + j) > 0.3) {
              const progress = (Math.sin(t * nodes[j].speed * 2 + j) + 1) / 2;
              const px = nodes[i].x + (nodes[j].x - nodes[i].x) * progress;
              const py = nodes[i].y + (nodes[j].y - nodes[i].y) * progress;
              ctx.fillStyle = `rgba(${ACCENT_R},${ACCENT_G},${ACCENT_B},${alpha * 2.5})`;
              ctx.beginPath();
              ctx.arc(px, py, 1.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      for (const n of nodes) {
        const pulse = 0.6 + 0.4 * Math.sin(t * n.speed * 2 + n.phase);
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius * 4);
        grad.addColorStop(0, `rgba(${PRIMARY_R},${PRIMARY_G},${PRIMARY_B},${0.15 * pulse})`);
        grad.addColorStop(1, `rgba(${PRIMARY_R},${PRIMARY_G},${PRIMARY_B},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${PRIMARY_R},${PRIMARY_G},${PRIMARY_B},${0.5 + 0.3 * pulse})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * pulse, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.7 }}
      aria-hidden="true"
    />
  );
};