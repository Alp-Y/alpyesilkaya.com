/**
 * INSPECTION LIGHT — the drawing brightens very slightly where you look.
 * ------------------------------------------------------------------
 * One fixed layer (.workspace-light, see globals.css): a faint luminance
 * and slightly stronger grid lines, masked to ~240 px around the pointer.
 * Driven by the shared pointer loop (no own listeners), mouse/pen only.
 */

import { finePointer, onFrame } from "./pointer";

export function initLight(): () => void {
  const el = document.querySelector<HTMLElement>(".workspace-light");
  if (!el || !finePointer()) return () => {};
  let visible = false;
  return onFrame((p) => {
    const show = p.inside && p.type !== "touch";
    if (show !== visible) {
      visible = show;
      el.dataset.on = String(show);
    }
    if (show && p.moved) {
      el.style.setProperty("--lx", `${p.x}px`);
      el.style.setProperty("--ly", `${p.y}px`);
    }
  });
}
