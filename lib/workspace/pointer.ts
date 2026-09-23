/**
 * SHARED POINTER + FRAME LOOP
 * ------------------------------------------------------------------
 * One set of window listeners and one requestAnimationFrame loop for all
 * pointer-driven effects (CAD cursor, HUD, status-bar coordinates, case
 * preview, icon proximity). Subscribers never add their own mousemove
 * listeners or loops.
 *
 * A frame runs only when the pointer moved, the page scrolled, or a
 * subscriber asked for another frame (e.g. something is still easing).
 */

export type PointerSnapshot = {
  x: number; // clientX
  y: number; // clientY
  target: Element | null;
  type: string; // "mouse" | "pen" | "touch"
  /** Pointer is over the page (not left the window). */
  inside: boolean;
  /** Primary button pressed. */
  down: boolean;
  /** Moved since the last frame (false when only the page scrolled). */
  moved: boolean;
  /** Page scrolled since the last frame. */
  scrolled: boolean;
  time: number;
};

/** Return true to request another frame. */
export type FrameHandler = (p: PointerSnapshot, dt: number) => boolean | void;

const handlers = new Set<FrameHandler>();
const snapshot: PointerSnapshot = {
  x: -1,
  y: -1,
  target: null,
  type: "mouse",
  inside: false,
  down: false,
  moved: false,
  scrolled: false,
  time: 0,
};

let frame = 0;
let last = 0;
let started = false;
let wantsMore = false;

function schedule() {
  if (!frame) frame = requestAnimationFrame(tick);
}

function tick(now: number) {
  frame = 0;
  const dt = last ? Math.min(64, now - last) : 16;
  last = now;
  snapshot.time = now;
  wantsMore = false;
  // After a scroll the element under a stationary pointer changes
  if (snapshot.scrolled && snapshot.inside && snapshot.x >= 0) {
    snapshot.target = document.elementFromPoint(snapshot.x, snapshot.y);
  }
  for (const h of handlers) {
    if (h(snapshot, dt)) wantsMore = true;
  }
  snapshot.moved = false;
  snapshot.scrolled = false;
  if (wantsMore) schedule();
  else last = 0;
}

function onMove(e: PointerEvent) {
  snapshot.x = e.clientX;
  snapshot.y = e.clientY;
  snapshot.target = e.target as Element | null;
  snapshot.type = e.pointerType || "mouse";
  snapshot.inside = true;
  snapshot.moved = true;
  schedule();
}
function onDown(e: PointerEvent) {
  snapshot.down = true;
  onMove(e);
}
function onUp(e: PointerEvent) {
  snapshot.down = false;
  onMove(e);
}
function onLeave(e: PointerEvent) {
  if (e.relatedTarget) return;
  snapshot.inside = false;
  snapshot.moved = true;
  schedule();
}
function onScroll() {
  snapshot.scrolled = true;
  schedule();
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
}

/** Subscribe a per-frame handler. Returns an unsubscribe function. */
export function onFrame(handler: FrameHandler): () => void {
  start();
  handlers.add(handler);
  schedule();
  return () => {
    handlers.delete(handler);
  };
}

/** Ask for one more frame (e.g. when state changed without pointer movement). */
export function requestFrame() {
  if (started) schedule();
}

export function getPointer(): Readonly<PointerSnapshot> {
  return snapshot;
}

export const finePointer = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
