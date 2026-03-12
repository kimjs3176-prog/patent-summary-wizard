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
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Nodes
    const NODE_COUNT = 28;
    interface Node {
      x: number; y: number; vx: number; vy: number;
      radius: number; phase: number; speed: number;
    }

    const rect = canvas.getBoundingClientRect();
    const nodes: Node[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * rect.width,
      y: Math.random() * rect.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      radius: 2 + Math.random() * 3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.7,
    }));

    const MAX_DIST = 140;
    // primary indigo hsl(239 84% 67%) ≈ rgb(82, 82, 224)
    const PRIMARY_R = 82, PRIMARY_G = 82, PRIMARY_B = 224;
    // accent purple hsl(262 83% 58%) ≈ rgb(138, 43, 226)
    const ACCENT_R = 138, ACCENT_G = 43, ACCENT_B = 226;

    let t = 0;

    const draw = () => {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      ctx.clearRect(0, 0, w, h);
      t += 0.008;

      // Update nodes
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        n.x = Math.max(0, Math.min(w, n.x));
        n.y = Math.max(0, Math.min(h, n.y));
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.25;
            // Pulse along connection
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

            // Data particle traveling along edge
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

      // Draw nodes
      for (const n of nodes) {
        const pulse = 0.6 + 0.4 * Math.sin(t * n.speed * 2 + n.phase);
        // Glow
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius * 4);
        grad.addColorStop(0, `rgba(${PRIMARY_R},${PRIMARY_G},${PRIMARY_B},${0.15 * pulse})`);
        grad.addColorStop(1, `rgba(${PRIMARY_R},${PRIMARY_G},${PRIMARY_B},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 4, 0, Math.PI * 2);
        ctx.fill();

        // Core
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
      style={{ opacity: 0.6 }}
      aria-hidden="true"
    />
  );
};
