/**
 * CAD CURSOR + CONTEXT HUD
 * ------------------------------------------------------------------
 * ONE cursor system and ONE heads-up display for the whole site.
 *
 * CAD spaces
 *   Any element with `data-cad-space="<id>"` is drawing space (the hero,
 *   the Spatial Quantity Engine viewport). Only there is the native cursor
 *   replaced; everywhere else the browser cursor is untouched.
 *
 * Cursor modes (decided from what is under the pointer)
 *   cad          empty drawing space → full crosshair + pickbox
 *   interactive  links / buttons      → small target marker
 *   select       engineering objects  → selection crosshair
 *   text         real text / inputs   → native I-beam, custom cursor hidden
 *   grab         the ViewCube         → native grab / grabbing
 *   hidden       outside CAD spaces
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
};

type SpaceTransform = (clientX: number, clientY: number) => { x: number; y: number };

const PRIORITY: HudSlot[] = ["operation", "drag", "selected", "hover", "control", "point"];
const OFFSET = 18;

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

type Els = {
  root: HTMLElement;
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
  let lastRect = { l: 0, t: 0, w: 0, h: 0 };

  const unsubscribe = onFrame((p: PointerSnapshot) => {
    const target = p.inside ? p.target : null;
    const spaceEl = target?.closest<HTMLElement>("[data-cad-space]") ?? null;
    const space = spaceEl?.dataset.cadSpace;

    // ----- cursor mode -----
    const nextMode: CursorMode = !fine || p.type === "touch" || !spaceEl ? "hidden" : modeFor(target!);
    if (nextMode !== mode) {
      mode = nextMode;
      root.dataset.mode = mode;
    }

    // ----- crosshair (clipped to the CAD space) -----
    if (spaceEl && fine) {
      const r = spaceEl.getBoundingClientRect();
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
    const showHud = !!content && (mode !== "hidden" && mode !== "text" ? true : hasSlot("drag") || hasSlot("operation"));
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
    const structure = [c.title, ...(c.rows?.map((r) => r[0]) ?? []), (c.lines ?? []).length].join("|");
    const values = [...(c.lines ?? []), ...(c.rows?.map((r) => r[1]) ?? [])];
    if (structure !== hudKey) {
      hudKey = structure;
      e.inner.innerHTML =
        `<span class="hud-title">${esc(c.title)}</span>` +
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
    delete document.documentElement.dataset.cadCursor;
    root.dataset.mode = "hidden";
    els.hud.dataset.visible = "false";
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
  if (el.matches("input, textarea, [contenteditable='true']")) return "text";
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
      if (!space || !currentCoords || mode === "text" || mode === "hidden") return null;
      return { title: "SPECIFY POINT", rows: [["X", coord(currentCoords.x)], ["Y", coord(currentCoords.y)]] };
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
