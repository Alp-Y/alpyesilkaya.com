"use client";

import { useEffect, useMemo, useRef } from "react";

export type OrbitApi = { zoomIn: () => void; zoomOut: () => void; reset: () => void };

/**
 * 3D orbit for a flat drawing (like orbiting a plan in CAD): drag sideways to
 * spin it, drag up or down to tilt it, zoom with the +/− buttons, a pinch,
 * or the wheel once you have pressed on it (the page never stops scrolling
 * just because the pointer passes over). Double-click puts it back.
 * On touch, vertical drags still scroll the page (touch-action: pan-y);
 * sideways drags spin.
 *
 * `area` receives the pointer; `target` is the element that turns.
 */
export function usePlanOrbit(area: React.RefObject<HTMLElement | null>, target: React.RefObject<HTMLElement | null>): OrbitApi {
  const ctrl = useRef<ReturnType<typeof createPlanOrbit> | null>(null);

  useEffect(() => {
    if (!area.current || !target.current) return;
    const c = createPlanOrbit(area.current, target.current);
    ctrl.current = c;
    return () => {
      c.destroy();
      ctrl.current = null;
    };
  }, [area, target]);

  return useMemo(
    () => ({
      zoomIn: () => ctrl.current?.zoom(1.35),
      zoomOut: () => ctrl.current?.zoom(1 / 1.35),
      reset: () => ctrl.current?.reset(),
    }),
    [],
  );
}

/** The orbit itself: plain DOM, no React. */
function createPlanOrbit(el: HTMLElement, turn: HTMLElement) {
  const v = { spin: 0, tilt: 0, scale: 1 };
  const apply = (smooth = false) => {
    turn.style.transition = smooth ? "transform 450ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "none";
    turn.style.transform = `perspective(1400px) rotateX(${v.tilt}deg) rotateZ(${v.spin}deg) scale(${v.scale})`;
  };
  const zoom = (f: number, smooth = true) => {
    v.scale = Math.min(3.5, Math.max(0.6, v.scale * f));
    apply(smooth);
  };
  const reset = () => {
    v.spin = 0;
    v.tilt = 0;
    v.scale = 1;
    apply(true);
  };

  const pointers = new Map<number, { x: number; y: number; type: string }>();
  let pinch = 0;
  let engaged = false;
  const down = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    engaged = true;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    el.setPointerCapture(e.pointerId);
    el.dataset.cursor = "grabbing";
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const move = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { ...prev, x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0 && d > 0) zoom(d / pinch, false);
      pinch = d;
      return;
    }
    v.spin += dx * 0.35;
    if (prev.type !== "touch") v.tilt = Math.min(62, Math.max(0, v.tilt - dy * 0.3));
    apply();
  };
  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (!pointers.size) el.dataset.cursor = "grab";
  };
  const wheel = (e: WheelEvent) => {
    if (!engaged && !e.ctrlKey) return; // a trackpad pinch always zooms; the wheel only once you've pressed on it
    e.preventDefault();
    zoom(Math.exp(-e.deltaY * 0.0015), false);
  };
  const leave = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && !pointers.size) engaged = false;
  };

  el.dataset.cursor = "grab";
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("pointerleave", leave);
  el.addEventListener("wheel", wheel, { passive: false });
  el.addEventListener("dblclick", reset);

  return {
    zoom,
    reset,
    destroy() {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("dblclick", reset);
    },
  };
}
