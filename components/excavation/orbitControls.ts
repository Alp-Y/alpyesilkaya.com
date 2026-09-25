import type { SurfaceScene } from "./surfaceScene";

/** Orbit / pan / zoom for mouse and touch (with pinch), tap to inspect. */
export function bindControls(canvas: HTMLCanvasElement, s: SurfaceScene, onTap: (hit: ReturnType<SurfaceScene["pick"]>) => void) {
  const pointers = new Map<number, { x: number; y: number; type: string }>();
  let mode: "orbit" | "pan" | null = null;
  let engaged = false;
  let pinch: { d: number; mx: number; my: number } | null = null;
  let down: { x: number; y: number; t: number } | null = null;

  const onDown = (e: PointerEvent) => {
    engaged = true;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      mode = e.button === 2 || e.shiftKey ? "pan" : "orbit";
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      mode = null;
    }
    canvas.dataset.cursor = "grabbing";
  };
  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { ...prev, x: e.clientX, y: e.clientY });
    if (pointers.size >= 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (d > 0 && pinch.d > 0) s.zoom(pinch.d / d);
      s.pan(mx - pinch.mx, my - pinch.my);
      pinch = { d, mx, my };
      return;
    }
    if (!mode) return;
    // touch: vertical drags belong to the page (touch-action: pan-y), sideways ones orbit
    if (mode === "pan") s.pan(dx, dy);
    else s.orbit(dx, prev.type === "touch" ? 0 : dy);
  };
  const onUp = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      // a short, still press is a tap: inspect what is under it
      if (down && p && Math.hypot(p.x - down.x, p.y - down.y) < 6 && performance.now() - down.t < 350) {
        const r = canvas.getBoundingClientRect();
        onTap(s.pick(p.x - r.left, p.y - r.top));
      }
      mode = null;
      down = null;
      canvas.dataset.cursor = "grab";
    }
  };
  const onWheel = (e: WheelEvent) => {
    if (!engaged) return; // never take over page scrolling before the visitor has clicked in
    e.preventDefault();
    s.zoom(Math.exp(e.deltaY * 0.0012));
  };
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse") engaged = false;
  };
  const onDbl = () => s.resetView();
  const noMenu = (e: Event) => e.preventDefault();
  const onKey = (e: KeyboardEvent) => {
    const k: Record<string, () => void> = {
      ArrowLeft: () => s.orbit(-20, 0),
      ArrowRight: () => s.orbit(20, 0),
      ArrowUp: () => s.orbit(0, -20),
      ArrowDown: () => s.orbit(0, 20),
      "+": () => s.zoom(0.85),
      "=": () => s.zoom(0.85),
      "-": () => s.zoom(1.18),
      "0": () => s.resetView(),
    };
    const f = k[e.key];
    if (f) {
      e.preventDefault();
      f();
    }
  };
  canvas.tabIndex = 0;
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("dblclick", onDbl);
  canvas.addEventListener("contextmenu", noMenu);
  canvas.addEventListener("keydown", onKey);
  return () => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("dblclick", onDbl);
    canvas.removeEventListener("contextmenu", noMenu);
    canvas.removeEventListener("keydown", onKey);
  };
}
