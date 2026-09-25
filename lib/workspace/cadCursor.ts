/**
 * CAD CURSOR + CONTEXT HUD
 * ------------------------------------------------------------------
 * ONE cursor system and ONE heads-up display for the whole site.
 *
 ONE cursor, everywhere (mouse / pen). The native cursor never shows:
 *   the same crosshair + pickbox is used on every page and section, so it
 *   never "switches" between the CAD cursor and the system arrow.
 *
 * CAD spaces
 *   Elements with `data-cad-space="<id>"` are drawing space (the hero, the
 *   Quantity by Area Calculator drawing). There the crosshair is clipped to the
 *   space and the HUD reads drawing coordinates; elsewhere the crosshair
 *   spans the window and there are no coordinates.
 *
 * Cursor modes (decided from what is under the pointer)
 *   cad          empty space           → crosshair + pickbox
 *   interactive  links / buttons       → small target marker
 *   select       engineering objects   → selection crosshair
 *   text         inputs / real text    → CAD I-beam
 *   grab         the ViewCube          → target marker
 *   hidden       pointer left the window, or touch
 *   Elements can force a mode with `data-cursor="text" | "select" | …`.
 *
 * HUD priority (highest wins, deterministic)
 *   operation > drag > selected > hover > control > point
 *   Components publish context with `setHud(slot, content, space?)`;
 *   controls can simply carry `data-hud="VIEW|TOP"`.
 *
 * Coordinates are drawing coordinates, never screen pixels. Each space
 * converts screen → drawing with its own transform (see registerSpace).
 */

import { coord } from "../format";
import { finePointer, onFrame, requestFrame, type PointerSnapshot } from "./pointer";

export type CursorMode = "cad" | "text" | "interactive" | "select" | "grab" | "grabbing" | "hidden";
export type HudSlot = "operation" | "drag" | "selected" | "hover" | "control" | "point";
export type HudContent = {
  title: string;
  /** Plain value lines, e.g. ["A01-N", "1,842.32 m²"] */
  lines?: string[];
  /** Label / value rows, e.g. [["AREA", "1,842.32 m²"], ["DEPTH", "1.25 m"]] */
  rows?: [string, string][];
  /** A quiet readout: one dim line, no box, shown only once the pointer rests */
  quiet?: boolean;
};

type SpaceTransform = (clientX: number, clientY: number) => { x: number; y: number };

const PRIORITY: HudSlot[] = ["operation", "drag", "selected", "hover", "control", "point"];
const OFFSET = 18;
/** The plain coordinate readout waits until the pointer has rested this long (ms). */
const REST = 650;

/** Keyed by "slot@space" ("slot@*" = any space), so different spaces never overwrite each other. */
const contexts = new Map<string, HudContent>();
const hasSlot = (slot: HudSlot) => [...contexts.keys()].some((k) => k.startsWith(`${slot}@`));
const transforms = new Map<string, SpaceTransform>();

/** Publish (or clear with null) a HUD context. `space` limits it to one CAD space. */
export function setHud(slot: HudSlot, content: HudContent | null, space?: string) {
  const key = `${slot}@${space ?? "*"}`;
  if (content) contexts.set(key, content);
  else contexts.delete(key);
  requestFrame();
}

/** Let a CAD space supply its own screen → drawing transform (e.g. from an SVG's CTM). */
export function registerSpace(id: string, transform: SpaceTransform): () => void {
  transforms.set(id, transform);
  return () => {
    if (transforms.get(id) === transform) transforms.delete(id);
  };
}

/** Current drawing coordinates, for the status bar. null outside CAD spaces. */
let currentCoords: { x: number; y: number; space: string } | null = null;
export function getCoords() {
  return currentCoords;
}

/* ================================================================== */

/**
 * WINDOW / CROSSING SELECTION (as in AutoCAD / Civil 3D)
 *   press on empty drawing space and drag:
 *   left → right   WINDOW    blue, solid     selects what is fully inside
 *   right → left   CROSSING  green, dashed   selects what it touches
 * On release a `cad:selection` event is dispatched on document with
 * { space, mode, rect: { left, top, right, bottom } } in client pixels;
 * each CAD space decides what that selects.
 */
export type SelectionDetail = {
  space: string;
  mode: "window" | "crossing";
  rect: { left: number; top: number; right: number; bottom: number };
};

type Els = {
  root: HTMLElement;
  select: HTMLElement;
  frame: HTMLElement;
  h: HTMLElement;
  v: HTMLElement;
  marker: HTMLElement;
  hud: HTMLElement;
  inner: HTMLElement;
};

export function initCadCursor(): () => void {
  const root = document.querySelector<HTMLElement>("[data-cad-cursor]");
  if (!root) return () => {};
  const els: Els = {
    root,
    select: root.querySelector("[data-cc-select]")!,
    frame: root.querySelector("[data-cc-frame]")!,
    h: root.querySelector("[data-cc-h]")!,
    v: root.querySelector("[data-cc-v]")!,
    marker: root.querySelector("[data-cc-marker]")!,
    hud: root.querySelector("[data-hud]")!,
    inner: root.querySelector("[data-hud-inner]")!,
  };

  const fine = finePointer();
  if (fine) document.documentElement.dataset.cadCursor = "on";

  let mode: CursorMode = "hidden";
  let hudKey = "";
  let hudVisible = false;
  let hudPos = { x: -9999, y: -9999 };
  let lastMove = 0;
  let restTimer = 0;
  let lastRect = { l: 0, t: 0, w: 0, h: 0 };
  // selection drag state
  let pressSeq = 0;
  let sel: { space: string; el: HTMLElement; x: number; y: number; active: boolean } | null = null;
  let suppressClickUntil = 0;
  const onClickCapture = (e: MouseEvent) => {
    if (performance.now() < suppressClickUntil) {
      e.stopPropagation();
      e.preventDefault();
      suppressClickUntil = 0;
    }
  };
  window.addEventListener("click", onClickCapture, true);

  const unsubscribe = onFrame((p: PointerSnapshot) => {
    // ----- window / crossing selection -----
    if (fine && p.type !== "touch") {
      if (p.down && p.press.seq !== pressSeq) {
        pressSeq = p.press.seq;
        const t = p.press.target;
        const sp = t?.closest<HTMLElement>("[data-cad-space]");
        const m = t ? modeFor(t) : "hidden";
        sel = sp && (m === "cad" || m === "select") && !t?.closest("[data-viewcube]") ? { space: sp.dataset.cadSpace!, el: sp, x: p.press.x, y: p.press.y, active: false } : null;
      }
      if (sel && p.down) {
        const dx = p.x - sel.x;
        const dy = p.y - sel.y;
        if (!sel.active && Math.hypot(dx, dy) > 5) {
          sel.active = true;
          els.select.dataset.active = "true";
          document.documentElement.dataset.selecting = "true";
          window.getSelection()?.removeAllRanges();
        }
        if (sel.active) {
          const kind = dx >= 0 ? "window" : "crossing";
          els.select.dataset.kind = kind;
          const l = Math.min(p.x, sel.x);
          const t = Math.min(p.y, sel.y);
          els.select.style.transform = `translate3d(${l}px, ${t}px, 0)`;
          els.select.style.width = `${Math.abs(dx)}px`;
          els.select.style.height = `${Math.abs(dy)}px`;
          // size in drawing units, when the space knows its scale
          const tf = transforms.get(sel.space) ?? defaultTransform(sel.el);
          const a = tf(sel.x, sel.y);
          const b = tf(p.x, p.y);
          const rows: [string, string][] = [["W", coord(Math.abs(b.x - a.x))], ["H", coord(Math.abs(b.y - a.y))]];
          contexts.set("operation@*", { title: kind === "window" ? "WINDOW" : "CROSSING", lines: [kind === "window" ? "SELECTS FULLY INSIDE" : "SELECTS WHAT IT TOUCHES"], rows });
        }
      } else if (sel && !p.down) {
        if (sel.active) {
          const detail: SelectionDetail = {
            space: sel.space,
            mode: p.x >= sel.x ? "window" : "crossing",
            rect: { left: Math.min(p.x, sel.x), top: Math.min(p.y, sel.y), right: Math.max(p.x, sel.x), bottom: Math.max(p.y, sel.y) },
          };
          suppressClickUntil = performance.now() + 400;
          document.dispatchEvent(new CustomEvent<SelectionDetail>("cad:selection", { detail }));
        }
        sel = null;
        els.select.dataset.active = "false";
        delete document.documentElement.dataset.selecting;
        contexts.delete("operation@*");
      }
    }

    const target = p.inside ? p.target : null;
    const spaceEl = target?.closest<HTMLElement>("[data-cad-space]") ?? null;
    const space = spaceEl?.dataset.cadSpace;

    // ----- cursor mode -----
    const nextMode: CursorMode = !fine || p.type === "touch" || !target ? "hidden" : modeFor(target);
    if (nextMode !== mode) {
      mode = nextMode;
      root.dataset.mode = mode;
    }

    // ----- crosshair (clipped to the CAD space, or the window elsewhere) -----
    if (fine && target) {
      const r = spaceEl ? spaceEl.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, bottom: window.innerHeight };
      const top = Math.max(r.top, 0);
      const bottom = Math.min(r.bottom, window.innerHeight);
      if (r.left !== lastRect.l || top !== lastRect.t || r.width !== lastRect.w || bottom - top !== lastRect.h) {
        lastRect = { l: r.left, t: top, w: r.width, h: bottom - top };
        els.frame.style.transform = `translate3d(${r.left}px, ${top}px, 0)`;
        els.frame.style.width = `${r.width}px`;
        els.frame.style.height = `${Math.max(0, bottom - top)}px`;
      }
      els.h.style.transform = `translate3d(0, ${p.y - top}px, 0)`;
      els.v.style.transform = `translate3d(${p.x - r.left}px, 0, 0)`;
      els.marker.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    }

    // ----- drawing coordinates -----
    if (spaceEl && space) {
      const t = transforms.get(space) ?? defaultTransform(spaceEl);
      const c = t(p.x, p.y);
      currentCoords = { ...c, space };
    } else {
      currentCoords = null;
    }

    // ----- HUD content (priority) -----
    const content = resolveHud(target, space, mode);
    // The coordinate readout is a quiet extra: it keeps out of the way while you explore,
    // and appears once the pointer rests (one more frame is asked for when it has)
    const now = performance.now();
    if (p.moved || p.scrolled) lastMove = now;
    let resting = true;
    if (content?.quiet && now - lastMove < REST) {
      resting = false;
      clearTimeout(restTimer);
      restTimer = window.setTimeout(requestFrame, REST - (now - lastMove) + 16);
    }
    const showHud = !!content && resting && (mode !== "hidden" && mode !== "text" ? true : hasSlot("drag") || hasSlot("operation"));
    if (showHud !== hudVisible) {
      hudVisible = showHud;
      els.hud.dataset.visible = String(showHud);
    }
    if (content) renderHud(els, content);

    // ----- HUD position: beside the pointer, never under it, never off-screen -----
    let busy = false;
    if (hudVisible) {
      const w = els.hud.offsetWidth;
      const h = els.hud.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight - statusBarHeight();
      let x = p.x + OFFSET;
      let y = p.y + OFFSET;
      if (x + w > vw - 8) x = p.x - OFFSET - w;
      if (y + h > vh - 8) y = p.y - OFFSET - h;
      x = Math.max(8, x);
      y = Math.max(8, y);
      // During a drag the readout is steadier: it eases instead of chasing every pixel
      const anchored = hasSlot("drag");
      if (anchored && hudPos.x > -9999) {
        hudPos.x += (x - hudPos.x) * 0.35;
        hudPos.y += (y - hudPos.y) * 0.35;
        busy = Math.abs(x - hudPos.x) > 0.5 || Math.abs(y - hudPos.y) > 0.5;
      } else {
        hudPos = { x, y };
      }
      els.hud.style.transform = `translate3d(${Math.round(hudPos.x)}px, ${Math.round(hudPos.y)}px, 0)`;
    } else {
      hudPos = { x: -9999, y: -9999 };
    }
    return busy;
  });

  function renderHud(e: Els, c: HudContent) {
    const structure = [c.quiet ? "quiet" : "", c.title, ...(c.rows?.map((r) => r[0]) ?? []), (c.lines ?? []).length].join("|");
    const values = [...(c.lines ?? []), ...(c.rows?.map((r) => r[1]) ?? [])];
    if (structure !== hudKey) {
      hudKey = structure;
      e.hud.dataset.quiet = String(!!c.quiet);
      e.inner.innerHTML =
        (c.title ? `<span class="hud-title">${esc(c.title)}</span>` : "") +
        (c.lines ?? []).map((l) => `<span class="hud-line num" data-v>${esc(l)}</span>`).join("") +
        (c.rows ?? [])
          .map((r) => `<span class="hud-row"><span class="hud-label">${esc(r[0])}</span><span class="num" data-v>${esc(r[1])}</span></span>`)
          .join("");
      // Readout change: a quick fade, the instrument itself stays put
      e.hud.classList.remove("hud-swap");
      void e.hud.offsetWidth;
      e.hud.classList.add("hud-swap");
    } else {
      const nodes = e.inner.querySelectorAll<HTMLElement>("[data-v]");
      nodes.forEach((n, i) => {
        if (n.textContent !== values[i]) n.textContent = values[i];
      });
    }
  }

  return () => {
    unsubscribe();
    window.removeEventListener("click", onClickCapture, true);
    contexts.delete("operation@*");
    delete document.documentElement.dataset.selecting;
    delete document.documentElement.dataset.cadCursor;
    root.dataset.mode = "hidden";
    els.hud.dataset.visible = "false";
    clearTimeout(restTimer);
  };
}

/* ---------------- helpers ---------------- */

function modeFor(target: Element): CursorMode {
  const el = target.closest<HTMLElement>(
    "[data-cursor], input, textarea, select, [contenteditable='true'], a, button, [role='button'], label, summary",
  );
  if (!el) return "cad";
  const explicit = el.dataset.cursor as CursorMode | undefined;
  if (explicit) return explicit;
  if (el.matches("input:not([type='checkbox']):not([type='radio']):not([type='file']), textarea, [contenteditable='true']")) return "text";
  return "interactive";
}

function resolveHud(target: Element | null, space: string | undefined, mode: CursorMode): HudContent | null {
  for (const slot of PRIORITY) {
    if (slot === "control") {
      const control = target?.closest<HTMLElement>("[data-hud]");
      if (control && space) {
        const [title, ...lines] = (control.dataset.hud ?? "").split("|");
        return { title, lines };
      }
      continue;
    }
    if (slot === "point") {
      // Only inside a model's demonstration area ([data-coord-area]), never over the plain sheet
      if (!space || !currentCoords || mode === "text" || mode === "hidden" || !target?.closest("[data-coord-area]")) return null;
      return { title: "", quiet: true, rows: [["X", coord(currentCoords.x)], ["Y", coord(currentCoords.y)]] };
    }
    // A drag / operation is shown wherever the pointer is; other context only in its own space
    const own = space ? contexts.get(`${slot}@${space}`) : undefined;
    const any = contexts.get(`${slot}@*`);
    const global = slot === "drag" || slot === "operation" ? [...contexts.entries()].find(([k]) => k.startsWith(`${slot}@`))?.[1] : undefined;
    const ctx = own ?? any ?? global;
    if (ctx) return ctx;
  }
  return null;
}

/** Default transform: metres from the space's origin mark (bottom-left), 1 px = 0.1 m, Y up. */
function defaultTransform(space: HTMLElement): SpaceTransform {
  const origin = space.querySelector<HTMLElement>("[data-cad-origin]") ?? space;
  const scale = Number(space.dataset.cadScale ?? 0.1);
  return (cx, cy) => {
    const o = origin.getBoundingClientRect();
    return { x: (cx - o.left) * scale, y: (o.bottom - cy) * scale };
  };
}

function statusBarHeight() {
  return window.innerWidth >= 900 ? 30 : 0;
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
