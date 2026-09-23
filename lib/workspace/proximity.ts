/**
 * POINTER PROXIMITY for a few technical marks.
 * ------------------------------------------------------------------
 * Elements with `data-proximity` get a CSS variable `--prox` from 0 (far)
 * to 1 (pointer on top), within ~120 px. CSS decides what that means for
 * each mark (a line extends 2 px, a node leans toward the pointer…).
 * Uses the shared pointer loop; off for touch and reduced motion, and
 * quiet while the visitor is scrolling or dragging something.
 */

import { finePointer, onFrame, reducedMotion } from "./pointer";
import { getState } from "./store";

export function initProximity(): () => void {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-proximity]"));
  if (!els.length || !finePointer() || reducedMotion()) return () => {};

  const visible = new Set<HTMLElement>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement;
      if (e.isIntersecting) visible.add(el);
      else {
        visible.delete(el);
        el.style.setProperty("--prox", "0");
      }
    }
  });
  els.forEach((el) => io.observe(el));

  const stop = onFrame((p) => {
    // Primary interactions win: no tertiary motion while dragging / navigating
    const quiet = p.scrolled || p.down || getState().activity === "interaction" || getState().activity === "navigation";
    for (const el of visible) {
      const r = el.getBoundingClientRect();
      const radius = Number(el.dataset.proximity) || 120;
      const dx = Math.max(r.left - p.x, 0, p.x - r.right);
      const dy = Math.max(r.top - p.y, 0, p.y - r.bottom);
      const d = Math.hypot(dx, dy);
      const prox = quiet || !p.inside ? 0 : Math.max(0, 1 - d / radius);
      const value = prox.toFixed(2);
      if (el.style.getPropertyValue("--prox") !== value) el.style.setProperty("--prox", value);
    }
  });

  return () => {
    stop();
    io.disconnect();
    els.forEach((el) => el.style.removeProperty("--prox"));
  };
}
