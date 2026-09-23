/**
 * CONFETTI — the PARTY command. One short burst on a temporary full-screen
 * canvas, in the site's colours; the canvas removes itself when done.
 * Skipped entirely with "reduce motion".
 */

const COLORS = ["#3ee08f", "#e2848c", "#7fd3ae", "#e9edf1", "#6ea0ff", "#e0a94a"];

export function launchConfetti(origin?: { x: number; y: number }) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "80" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return false;
  }
  ctx.scale(dpr, dpr);

  const ox = origin?.x ?? W / 2;
  const oy = origin?.y ?? H * 0.75;
  const parts = Array.from({ length: 170 }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6; // mostly upwards
    const v = 7 + Math.random() * 9;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      w: 5 + Math.random() * 5,
      h: 3 + Math.random() * 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  });

  const start = performance.now();
  const DURATION = 2600;
  let last = start;
  const tick = (now: number) => {
    const dt = Math.min(2.5, (now - last) / 16.7);
    last = now;
    const t = (now - start) / DURATION;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = Math.max(0, Math.min(1, (1 - t) * 3));
    for (const p of parts) {
      p.vy += 0.28 * dt; // gravity
      p.vx *= Math.pow(0.99, dt); // air
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.scale(1, Math.cos(p.r * 2)); // tumbling paper
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < 1) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
  return true;
}
