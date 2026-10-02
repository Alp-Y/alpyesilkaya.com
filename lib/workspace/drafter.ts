/**
 * DRAFTER
 * ------------------------------------------------------------------
 * A second, autonomous CAD cursor (accent green, so it is never mistaken
 * for the visitor's own) that constructs the page as it scrolls into view.
 * lib/effects.ts hands it every [data-reveal] / [data-observe] element that
 * enters the screen. The cursor only draws the pieces that matter, so it is
 * easy to follow: a few calm stops per screen, never a dash between details.
 *
 *   data-reveal="draw"    LINE     pick the start, pull the line to its end
 *   data-reveal="rise"    RECTANG  drag a rubber band, the block shows ghosted
 *                                  inside it, then commits with corner grips
 *   data-reveal="lines"   MTEXT    a caret sweeps each line, text appears behind it
 *   everything small      (labels, icons, frames) appears on its own with its
 *                         usual staged fade, without the cursor going there
 *
 * Opening
 *   On the first load the cursor opens the drawing itself: it glides to the
 *   file tab in the header and clicks it, the tab lights up, the grid regenerates
 *   outwards from the click, and it goes straight on to draft the sheet.
 *
 * Fast scrolling
 *   Nobody waits for the cursor. Scroll quickly and the screen is regenerated
 *   instead (REGEN): a scan line sweeps down and everything appears behind it.
 *
 * Special pieces
 *   data-draft-kind       "type"  a label typed out, its last characters still decoding
 *                         "para"  a paragraph written line by line behind a caret
 *                         "array" its children are copied into place one after another
 *                         "rect"  drawn as a block whatever its reveal type
 *   data-draft-id / data-draft-with
 *                         pieces marked data-draft-with="x" wait for the piece with
 *                         data-draft-id="x", then drop in around it one by one with
 *                         grips (the hero viewport and the blocks that sit in it)
 *   data-draft            a component supplies its own drawing script with
 *                         registerDraft() (the hero model: survey points, the
 *                         ground profile, the design line, then the 3D volumes)
 *   data-draft-fx="hatch" after a block is drawn, a hatch sweeps across it
 *   Drawn rules get station ticks, and a mark with data-play plays once the
 *   block it sits in has been drawn.
 *
 * How it works
 *   Everything is driven per frame with inline styles, then handed back to
 *   the normal CSS by adding .is-in (the same end state as before). So the
 *   stylesheet needs no special mode, and without this module (reduced
 *   motion, or a script failure) the usual reveals still work.
 *
 * Pace
 *   One cursor, one queue. When a lot is waiting (the hero) it speeds up
 *   so a whole screen takes about BUDGET ms. Elements already scrolled past
 *   just appear. Tune the constants below.
 *
 * Markup: components/Drafter.tsx (rendered once in the layout).
 */

import { onFrame, reducedMotion, requestFrame } from "./pointer";

/** Longest a waiting queue should take to draw, in ms (it speeds up to fit). */
const BUDGET = 6500;
/** ...but never faster than this fraction of the normal durations. */
const MIN_SPEED = 0.6;
/** How long the cursor stays after its last command, in ms. */
const LINGER = 700;
/** The pause after a piece is finished, before the cursor moves on, in ms. */
const DWELL = 60;
/** Scrolling faster than this (px per ms) regenerates the screen instead of drawing it. */
const RUSH_SPEED = 2.4;
/** How long the regeneration sweep takes, top to bottom, in ms. */
const REGEN_MS = 420;
/** Opacity of a block while its rubber band is still being dragged. */
const GHOST = 0.4;

type Kind = "rect" | "frame" | "line" | "text" | "place" | "insert" | "script" | "type" | "array" | "para";
/** Time each command takes at normal speed, in ms. */
const OP: Record<Kind, number> = { rect: 540, frame: 620, line: 480, text: 540, place: 120, insert: 120, script: 0, type: 700, array: 700, para: 800 };
/** The kinds the cursor draws itself. The rest appear on their own. */
const DRAWN: ReadonlySet<Kind> = new Set<Kind>(["rect", "frame", "line", "text", "script", "type", "array", "para"]);

/** The opening plays once per page load, not on every navigation. */
let booted = false;
/** Rough time to travel between two elements, used only for the pace estimate. */
const TRAVEL = 420;

const PENDING = "[data-reveal]:not(.is-in), [data-observe]:not(.is-in)";

export type Pt = { x: number; y: number };
export type Step = {
  cmd: string;
  tool?: "cross" | "text";
  ms: number;
  /** Where the command starts (client coordinates, read fresh every frame). */
  from: () => Pt;
  /** Where it ends. Without it the cursor stays put (a click). */
  to?: () => Pt;
  /** Instead of a straight move from → to: where the cursor is at t (0 → 1). */
  path?: (t: number) => Pt;
  /** Keeps its own pace: never sped up when a lot is waiting. */
  fixed?: boolean;
  /** Even progress (typing) instead of easing in and out. */
  linear?: boolean;
  begin?: () => void;
  /** t runs 0 → 1; returns the value shown in the cursor tag. */
  draw?: (t: number, at: Pt, start: Pt) => string | void;
  end?: () => void;
};
type Job = { el: HTMLElement; kind: Kind; key: number; deadline?: number };

/** What a component's own drawing script gets to work with. */
export type DraftTools = {
  el: HTMLElement;
  /** A layer over the page for sketch geometry (client coordinates). Emptied when the script ends. */
  svg: SVGSVGElement;
  /** Show the element itself now (it stays hidden until the script calls this, or ends). */
  reveal: () => void;
};
/** Returns the steps to draw the element, or null to let it appear the plain way. */
export type DraftScript = (tools: DraftTools) => Step[] | null;

const scripts = new WeakMap<HTMLElement, DraftScript>();
/** How long the drafter waits for a [data-draft] element's script (it may load late). */
const SCRIPT_WAIT = 3500;

/**
 * Give an element marked [data-draft] its own drawing script. If the drafter
 * gets to the element and no script arrives in time (or it returns null), the
 * element appears the plain way and a "draft:skipped" event fires on it.
 */
export function registerDraft(el: HTMLElement, script: DraftScript): () => void {
  scripts.set(el, script);
  requestFrame();
  return () => {
    if (scripts.get(el) === script) scripts.delete(el);
  };
}

export type Drafter = {
  /** Hand over elements that just came into view. */
  enqueue: (els: HTMLElement[]) => void;
  stop: () => void;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const onScreen = (p: Pt): Pt => ({
  x: clamp(p.x, 6, window.innerWidth - 6),
  y: clamp(p.y, 6, window.innerHeight - 6),
});

function kindOf(el: HTMLElement): Kind {
  if (el.hasAttribute("data-draft")) return "script";
  const forced = el.dataset.draftKind;
  if (forced === "type" || forced === "array" || forced === "rect" || forced === "para") return forced;
  const reveal = el.dataset.reveal;
  if (reveal === "draw") return "line";
  if (reveal === "lines") return el.querySelector(".line > span") ? "text" : "insert";
  if (reveal === "frame") return "frame";
  if (reveal === "rise") {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    return h < 30 || w * h < 9000 ? "place" : "rect";
  }
  return "insert";
}

/** The elements whose inline styles a job touches. */
const nodesOf = (el: HTMLElement) => [el, ...el.querySelectorAll<HTMLElement>(".line > span")];

function clearInline(el: HTMLElement) {
  for (const n of nodesOf(el)) {
    n.style.transition = "";
    n.style.transform = "";
    n.style.clipPath = "";
    n.style.opacity = "";
  }
  for (const c of Array.from(el.children) as HTMLElement[]) if (c.style) c.style.opacity = "";
}

/** Anything nested inside a finished element follows with its normal entrance. */
function releaseChildren(el: HTMLElement) {
  el.querySelectorAll<HTMLElement>(PENDING).forEach((c) => c.classList.add("is-in"));
}

/** Plain reveal: the element plays its own CSS entrance (no waiting on staged delays). */
function reveal(el: HTMLElement, immediate: boolean) {
  if (immediate) {
    el.style.setProperty("--delay", "0ms");
    el.style.setProperty("--i", "0");
  }
  el.classList.add("is-in");
  releaseChildren(el);
  announce(el);
}

/** Tells the drafter a piece is in, so anything waiting for it ([data-draft-with]) can follow. */
function announce(el: HTMLElement) {
  if (el.dataset.draftId) document.dispatchEvent(new CustomEvent("draft:done", { detail: el.dataset.draftId }));
}

/**
 * Hand a drawn element back to the stylesheet: it is already in its final
 * state, so .is-in is added with transitions off (nothing replays).
 */
function commit(el: HTMLElement) {
  const nodes = nodesOf(el);
  nodes.forEach((n) => (n.style.transition = "none"));
  el.style.setProperty("--delay", "0ms");
  // it has just been drawn: its own CSS fade must not play on top of that
  if (el.dataset.reveal === "fade") el.style.animation = "none";
  el.classList.add("is-in");
  nodes.forEach((n) => {
    n.style.transform = "";
    n.style.clipPath = "";
    n.style.opacity = "";
  });
  // a mark that plays a sequence ([data-play]) plays it now that it can be seen
  if (el.matches("[data-play]")) el.classList.remove("play");
  void el.offsetWidth;
  if (el.matches("[data-play]")) el.classList.add("play");
  nodes.forEach((n) => (n.style.transition = ""));
  releaseChildren(el);
  announce(el);
}

export function initDrafter(): Drafter | null {
  if (reducedMotion()) return null;
  const root = document.querySelector<HTMLElement>("[data-drafter]");
  const cursor = root?.querySelector<HTMLElement>("[data-dr-cursor]");
  const band = root?.querySelector<HTMLElement>("[data-dr-band]");
  const cmdOut = root?.querySelector<HTMLElement>("[data-dr-cmd]");
  const valOut = root?.querySelector<HTMLElement>("[data-dr-val]");
  const marks = document.querySelector<HTMLElement>("[data-dr-marks]");
  const sketch = root?.querySelector<SVGSVGElement>("[data-dr-sketch]");
  const regenLine = root?.querySelector<HTMLElement>("[data-dr-regen]");
  if (!root || !cursor || !band || !cmdOut || !valOut || !marks || !sketch || !regenLine) return null;
  const html = document.documentElement;

  // The opening is armed here (before the first paint with effects on), so the
  // grid waits hidden for its regeneration instead of flashing in first.
  let intro = !booted && window.scrollY < 80 && !!document.querySelector("[data-hero]");
  if (intro) html.dataset.boot = "wait";

  const queue: Job[] = [];
  const timers = new Set<number>();
  let job: Job | null = null;
  let steps: Step[] = [];
  let step: Step | null = null;
  let phase: "travel" | "op" = "travel";
  let t0 = 0;
  let dur = 0;
  let origin: Pt = { x: 0, y: 0 };
  let pos: Pt | null = null;
  let speed = 1;
  let idleAt = 0;
  let restUntil = 0;
  let rushUntil = 0;
  let lastY = window.scrollY;
  let lastScrollAt = 0;
  let lastRegen = 0;
  let calmUntil = 0;

  // Pieces that wait for another piece ([data-draft-with] → [data-draft-id])
  const doneIds = new Set<string>();
  const held = new Map<string, HTMLElement[]>();
  const release = (id: string) => {
    doneIds.add(id);
    const els = held.get(id) ?? [];
    held.delete(id);
    // they drop in one after another
    els
      .filter((el) => el.isConnected && !el.classList.contains("is-in"))
      .forEach((el, i) => {
        later(() => {
          reveal(el, true);
        }, 140 + i * 170);
      });
  };
  const onDone = (e: Event) => release((e as CustomEvent<string>).detail);
  document.addEventListener("draft:done", onDone);
  const onAnchor = (e: MouseEvent) => {
    if ((e.target as Element | null)?.closest?.('a[href*="#"]')) calmUntil = performance.now() + 1600;
  };
  document.addEventListener("click", onAnchor, true);
  let visible = false;
  let stopped = false;

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  /* ---------- overlay ---------- */
  let lastCmd = "";
  let lastVal = "";
  const setTag = (cmd: string, val = "") => {
    if (cmd !== lastCmd) cmdOut.textContent = lastCmd = cmd;
    if (val !== lastVal) valOut.textContent = lastVal = val;
  };
  const moveCursor = (p: Pt) => {
    cursor.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    const flipX = String(p.x > window.innerWidth - 190);
    const flipY = String(p.y > window.innerHeight - 60);
    if (cursor.dataset.flipX !== flipX) cursor.dataset.flipX = flipX;
    if (cursor.dataset.flipY !== flipY) cursor.dataset.flipY = flipY;
  };
  const show = (on: boolean) => {
    if (visible === on) return;
    visible = on;
    root.dataset.on = String(on);
  };
  const setBand = (a: Pt | null, b?: Pt) => {
    if (!a || !b) {
      band.dataset.on = "false";
      return;
    }
    band.style.transform = `translate3d(${Math.min(a.x, b.x).toFixed(1)}px, ${Math.min(a.y, b.y).toFixed(1)}px, 0)`;
    band.style.width = `${Math.abs(b.x - a.x).toFixed(1)}px`;
    band.style.height = `${Math.abs(b.y - a.y).toFixed(1)}px`;
    band.dataset.on = "true";
  };
  /** A short-lived mark left on the sheet (page coordinates, so it scrolls with the content). */
  // (No outlines or grips are left around a finished piece: only the cursor's own
  // pick, a hatch and the station ticks, so nothing frames the content.)
  type MarkType = "ping" | "hatch" | "ticks";
  const mark = (type: MarkType, x: number, y: number, w = 0, h = 0, life = 900) => {
    const m = document.createElement("span");
    m.dataset.m = type;
    m.style.left = `${x + window.scrollX}px`;
    m.style.top = `${y + window.scrollY}px`;
    m.style.width = `${w}px`;
    m.style.height = `${h}px`;
    marks.appendChild(m);
    later(() => m.remove(), life);
  };

  /** The small extras: [data-draft-fx] on a block picks what happens once it is drawn. */
  const fx = (el: HTMLElement, r: DOMRect) => {
    const kind = el.dataset.draftFx;
    if (kind === "hatch") {
      mark("hatch", r.left, r.top, r.width, r.height, 1100);
    }
  };

  /* ---------- the commands ---------- */
  function plan(el: HTMLElement, kind: Kind): Step[] {
    const st = el.style;
    const box = () => el.getBoundingClientRect();

    if (kind === "rect" || kind === "frame") {
      return [
        {
          cmd: "RECTANG",
          ms: OP[kind],
          begin: () => {
            st.transition = "none";
            st.clipPath = "inset(0 100% 100% 0)";
            if (kind === "rect") {
              st.transform = "none";
              st.opacity = String(GHOST);
            }
          },
          from: () => {
            const r = box();
            return onScreen({ x: r.left, y: r.top });
          },
          to: () => {
            const r = box();
            return onScreen({ x: r.right, y: r.bottom });
          },
          draw: (t, at, start) => {
            const r = box();
            st.clipPath = `inset(0 ${(r.width * (1 - t)).toFixed(1)}px ${(r.height * (1 - t)).toFixed(1)}px 0)`;
            setBand(start, at);
            return `${Math.round(r.width * t)} × ${Math.round(r.height * t)}`;
          },
          end: () => {
            setBand(null);
            commit(el);
            if (kind === "rect") fx(el, box());
            if (kind === "rect") el.animate([{ opacity: GHOST }, { opacity: 1 }], { duration: 420, easing: "ease-out" });
          },
        },
      ];
    }

    if (kind === "line") {
      const vertical = el.dataset.axis === "y";
      const start = (): Pt => {
        const r = box();
        return vertical ? { x: r.left + r.width / 2, y: r.top } : { x: r.left, y: r.top + r.height / 2 };
      };
      const finish = (): Pt => {
        const a = start();
        return vertical ? { x: a.x, y: a.y + el.offsetHeight } : { x: a.x + el.offsetWidth, y: a.y };
      };
      return [
        {
          cmd: "LINE",
          ms: OP.line,
          begin: () => {
            st.transition = "none";
            st.transform = vertical ? "scaleY(0)" : "scaleX(0)";
          },
          from: () => onScreen(start()),
          to: () => onScreen(finish()),
          draw: (t) => {
            st.transform = vertical ? `scaleY(${t.toFixed(4)})` : `scaleX(${t.toFixed(4)})`;
            return `L = ${Math.round((vertical ? el.offsetHeight : el.offsetWidth) * t)}`;
          },
          end: () => {
            const a = start();
            const b = finish();
            // station ticks ripple along a long rule
            if (!vertical && b.x - a.x > 240) mark("ticks", a.x, a.y - 7, b.x - a.x, 7, 1300);
            commit(el);
          },
        },
      ];
    }

    if (kind === "text") {
      const spans = Array.from(el.querySelectorAll<HTMLElement>(".line > span"));
      return spans.map((span, i): Step => {
        // where the words start and end inside the line (measured once, when the line is reached)
        let m: { l: number; r: number; w: number } | null = null;
        const measure = () => {
          if (m) return m;
          const sr = span.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(span);
          const rr = range.getBoundingClientRect();
          m = rr.width > 0 ? { l: rr.left - sr.left, r: rr.right - sr.left, w: sr.width } : { l: 0, r: sr.width, w: sr.width };
          return m;
        };
        const at = (t: number): Pt => {
          const sr = span.getBoundingClientRect();
          const { l, r } = measure();
          return { x: sr.left + l + (r - l) * t, y: sr.top + sr.height / 2 };
        };
        return {
          cmd: "MTEXT",
          tool: "text",
          ms: OP.text,
          begin: () => {
            if (i === 0) {
              for (const s of spans) {
                s.style.transition = "none";
                s.style.transform = "none";
                s.style.clipPath = "inset(0 100% 0 0)";
              }
            }
            cursor!.style.setProperty("--caret", `${Math.round(span.getBoundingClientRect().height * 0.86)}px`);
          },
          from: () => onScreen(at(0)),
          to: () => onScreen(at(1)),
          draw: (t) => {
            const { l, r, w } = measure();
            const x = l + (r - l) * t;
            span.style.clipPath = `inset(-0.3em ${(w - x).toFixed(1)}px -0.3em -0.3em)`;
          },
          end: () => {
            span.style.clipPath = "";
            if (i === spans.length - 1) commit(el);
          },
        };
      });
    }

    if (kind === "place") {
      return [
        {
          cmd: "INSERT",
          ms: OP.place,
          begin: () => {
            st.transition = "none";
            st.transform = "none";
          },
          from: () => {
            const r = box();
            return onScreen({ x: r.left + Math.min(10, r.width / 2), y: r.top + r.height / 2 });
          },
          end: () => {
            commit(el);
            el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
          },
        },
      ];
    }

    if (kind === "type") {
      // Typed out like a command, the last characters still decoding as it goes.
      // The typing happens in a copy laid over the label (its own text is never
      // touched); the real label takes over when the line is complete.
      const text = (el.textContent ?? "").trim();
      const chars = Math.max(1, text.length);
      const GLYPHS = "/\\<>#=+01";
      let ghost: HTMLElement | null = null;
      const textBox = () => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const rr = range.getBoundingClientRect();
        return rr.width > 0 ? rr : box();
      };
      const at = (t: number): Pt => {
        const r = textBox();
        return { x: r.left + (r.width * Math.round(chars * t)) / chars, y: r.top + r.height / 2 };
      };
      return [
        {
          cmd: "TEXT",
          tool: "text",
          linear: true,
          ms: clamp(chars * 34, 360, 900),
          begin: () => {
            st.transition = "none";
            st.transform = "none";
            const cs = getComputedStyle(el);
            ghost = document.createElement("span");
            ghost.dataset.ghost = "";
            ghost.style.fontFamily = cs.fontFamily;
            ghost.style.fontSize = cs.fontSize;
            ghost.style.fontWeight = cs.fontWeight;
            ghost.style.letterSpacing = cs.letterSpacing;
            ghost.style.textTransform = cs.textTransform;
            ghost.style.color = cs.color;
            root!.appendChild(ghost);
            cursor!.style.setProperty("--caret", `${Math.round(textBox().height * 1.1)}px`);
          },
          from: () => at(0),
          path: at,
          draw: (t) => {
            if (!ghost) return;
            const r = textBox();
            const n = Math.round(chars * t);
            let tail = "";
            for (let i = 0; i < Math.min(3, chars - n); i++) tail += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
            ghost.textContent = text.slice(0, n);
            const live = document.createElement("i");
            live.textContent = tail;
            ghost.appendChild(live);
            ghost.style.transform = `translate3d(${r.left.toFixed(1)}px, ${r.top.toFixed(1)}px, 0)`;
          },
          end: () => {
            ghost?.remove();
            ghost = null;
            const r = textBox();
            mark("ticks", r.left, r.bottom + 3, r.width, 5, 1300); // a rule of ticks runs under it
            commit(el);
          },
        },
      ];
    }

    if (kind === "para") {
      // A paragraph written line by line: the caret runs along each line and the
      // words appear behind it (the text is uncovered, never changed).
      type Line = { top: number; bottom: number; left: number; right: number };
      let lines: Line[] | null = null;
      let total = 0;
      const measure = () => {
        if (lines) return lines;
        const er = box();
        const range = document.createRange();
        range.selectNodeContents(el);
        const out: Line[] = [];
        for (const r of Array.from(range.getClientRects())) {
          if (r.width < 1) continue;
          const last = out[out.length - 1];
          const mid = (r.top + r.bottom) / 2 - er.top;
          if (last && mid > last.top && mid < last.bottom) {
            last.left = Math.min(last.left, r.left - er.left);
            last.right = Math.max(last.right, r.right - er.left);
          } else {
            out.push({ top: r.top - er.top, bottom: r.bottom - er.top, left: r.left - er.left, right: r.right - er.left });
          }
        }
        if (!out.length) out.push({ top: 0, bottom: er.height, left: 0, right: er.width });
        total = out.reduce((sum, l) => sum + (l.right - l.left), 0);
        lines = out;
        return out;
      };
      /** Which line the caret is on at t, and how far along it. */
      const where = (t: number) => {
        const ls = measure();
        let d = total * t;
        for (let k = 0; k < ls.length; k++) {
          const w = ls[k].right - ls[k].left;
          if (d <= w || k === ls.length - 1) return { k, x: ls[k].left + Math.min(d, w) };
          d -= w;
        }
        return { k: 0, x: 0 };
      };
      const at = (t: number): Pt => {
        const r = box();
        const { k, x } = where(t);
        const l = measure()[k];
        return { x: r.left + x, y: r.top + (l.top + l.bottom) / 2 };
      };
      return [
        {
          cmd: "MTEXT",
          tool: "text",
          ms: clamp((el.textContent ?? "").length * 12, 480, 1000),
          begin: () => {
            st.transition = "none";
            st.transform = "none";
            st.opacity = "1";
            st.clipPath = "inset(0 100% 100% 0)";
            const l = measure()[0];
            cursor!.style.setProperty("--caret", `${Math.round((l.bottom - l.top) * 0.9)}px`);
          },
          from: () => at(0),
          path: at,
          draw: (t) => {
            const { k, x } = where(t);
            const l = measure()[k];
            const W = box().width + 8;
            // everything above the caret's line, plus that line up to the caret
            st.clipPath = `polygon(-8px -8px, ${W}px -8px, ${W}px ${l.top.toFixed(1)}px, ${x.toFixed(1)}px ${l.top.toFixed(1)}px, ${x.toFixed(1)}px ${l.bottom.toFixed(1)}px, -8px ${l.bottom.toFixed(1)}px)`;
          },
          end: () => commit(el),
        },
      ];
    }

    if (kind === "array") {
      // its children are set down one after another, left to right
      const kids = (Array.from(el.children) as HTMLElement[]).filter((c) => c.offsetWidth > 0);
      if (!kids.length) return [];
      return kids.map(
        (kid, i): Step => ({
          cmd: i === 0 ? "INSERT" : "COPY",
          ms: 90,
          begin: () => {
            if (i > 0) return;
            st.transition = "none";
            st.transform = "none";
            st.opacity = "1";
            kids.forEach((k) => (k.style.opacity = "0"));
          },
          from: () => {
            const r = kid.getBoundingClientRect();
            return onScreen({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
          },
          draw: () => `${i + 1} / ${kids.length}`,
          end: () => {
            kid.style.opacity = "";
            // copied across from the one before it (the first simply lands)
            const prev = kids[i - 1];
            const dx = prev ? prev.getBoundingClientRect().left - kid.getBoundingClientRect().left : 0;
            kid.animate(
              [
                { opacity: prev ? 0.35 : 0, transform: prev ? `translateX(${dx.toFixed(1)}px)` : "translateY(6px)" },
                { opacity: 1, transform: "none" },
              ],
              { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
            );
            if (i === kids.length - 1) commit(el);
          },
        }),
      );
    }

    if (kind === "script") {
      const script = scripts.get(el);
      const own = script?.({ el, svg: sketch!, reveal: () => reveal(el, true) });
      if (own?.length) return own;
      el.dispatchEvent(new CustomEvent("draft:skipped"));
      // ...and it falls through to a plain INSERT
    }

    // insert: the piece has an entrance of its own (fade, wipe, drawn axes), so just place it
    return [
      {
        cmd: "INSERT",
        ms: OP.insert,
        from: () => {
          const r = box();
          return onScreen({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
        },
        end: () => {
          if (kind === "script") sketch!.replaceChildren();
          reveal(el, true);
        },
      },
    ];
  }

  /* ---------- fast scrolling: regenerate instead of drawing ---------- */
  /** Everything given appears behind a scan line that sweeps down the screen. */
  function regen(els: HTMLElement[], now: number) {
    const H = window.innerHeight;
    let any = false;
    for (const el of els) {
      if (!el.isConnected || el.classList.contains("is-in")) continue;
      any = true;
      const top = clamp(el.getBoundingClientRect().top / H, 0, 1);
      el.style.setProperty("--delay", `${Math.round(top * REGEN_MS)}ms`);
      el.style.setProperty("--i", "0");
      if (el.hasAttribute("data-draft")) el.dispatchEvent(new CustomEvent("draft:skipped"));
      el.classList.add("is-in");
      releaseChildren(el);
      announce(el);
    }
    if (!any || now - lastRegen < REGEN_MS + 200) return;
    lastRegen = now;
    regenLine!.animate(
      [
        { transform: "translate3d(0, 0, 0)", opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 1, offset: 0.8 },
        { transform: `translate3d(0, ${H}px, 0)`, opacity: 0 },
      ],
      { duration: REGEN_MS + 180, easing: "linear" },
    );
  }

  /** Drop what is being drawn and what is waiting: all of it is regenerated at once. */
  function flush(now: number) {
    const els = queue.map((q) => q.el);
    queue.length = 0;
    if (job) {
      clearInline(job.el);
      els.unshift(job.el);
    }
    endIntro();
    setBand(null);
    sketch!.replaceChildren();
    root!.querySelectorAll("[data-ghost]").forEach((g) => g.remove());
    job = null;
    steps = [];
    step = null;
    restUntil = 0;
    regen(els, now);
  }

  /* ---------- the opening: the drawing is opened and regenerated ---------- */
  function endIntro() {
    if (root!.dataset.intro === "true") root!.dataset.intro = "false";
    if (html.dataset.boot === "wait") html.dataset.boot = "in";
  }
  later(endIntro, 2500); // whatever happens, the grid never stays hidden
  /** The file tab in the header ("name.dwg"), if it is showing at this screen size. */
  const fileTab = () => {
    const tab = document.querySelector<HTMLElement>("[data-file-tab]");
    return tab && tab.offsetWidth > 0 ? tab : null;
  };
  /** Where the cursor comes in from: out in the sheet, crosshair spanning the screen. */
  const introStart = (): Pt => ({ x: window.innerWidth * 0.56, y: window.innerHeight * 0.52 });
  function introSteps(): Step[] {
    const target = (): Pt => {
      // (phones have no file tab: there it opens from the logo)
      const tab = fileTab() ?? document.querySelector<HTMLElement>("[data-home-link]");
      if (!tab) return { x: window.innerWidth / 2, y: window.innerHeight * 0.3 };
      const r = tab.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    return [
      {
        // it goes straight to the drawing's file tab and clicks it
        cmd: "OPEN",
        ms: 240,
        fixed: true,
        begin: () => {
          root!.dataset.intro = "true"; // the crosshair spans the whole screen on the way
        },
        from: target,
        draw: () => fileTab()?.textContent?.trim() || "drawing",
        end: () => {
          const tab = fileTab();
          const p = target();
          if (tab) tab.dataset.opened = "true"; // the tab lights up: the drawing is open
          // the grid regenerates outwards from the click, the crosshair draws back in,
          // and the cursor goes straight on to draft the sheet
          html.style.setProperty("--boot-x", `${p.x.toFixed(0)}px`);
          html.style.setProperty("--boot-y", `${p.y.toFixed(0)}px`);
          endIntro();
          html.dataset.boot = "in";
        },
      },
    ];
  }

  /* ---------- the queue ---------- */
  const drawable = (el: HTMLElement) => {
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return false; // not displayed at this screen size
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  };

  /** Take the next step (or the next element). False when there is nothing left to draw. */
  function next(now: number): boolean {
    while (!steps.length) {
      if (job?.kind === "script") {
        // a component's script has finished: clear its sketch, make sure the piece shows
        sketch!.replaceChildren();
        sketch!.style.opacity = "";
        if (!job.el.classList.contains("is-in")) reveal(job.el, true);
      }
      job = null;
      const j = queue.shift();
      if (!j) return false;
      if (!j.el.isConnected || j.el.classList.contains("is-in")) continue;
      if (!drawable(j.el)) {
        if (j.kind === "script") j.el.dispatchEvent(new CustomEvent("draft:skipped"));
        reveal(j.el, false);
        continue;
      }
      if (j.kind === "script" && !scripts.has(j.el) && now < (j.deadline ??= now + SCRIPT_WAIT)) {
        // its script has not arrived yet (it loads with the 3D scene): do the rest first
        queue.push(j);
        if (queue.every((q) => q.kind === "script" && !scripts.has(q.el))) return false;
        continue;
      }
      let planned: Step[] = [];
      try {
        planned = plan(j.el, j.kind);
      } catch {
        planned = [];
      }
      if (!planned.length) {
        reveal(j.el, false);
        continue;
      }
      job = j;
      steps = planned;
    }
    step = steps.shift()!;
    step.begin?.();
    const target = step.from();
    // first command after a pause: the cursor comes in from just off the element
    origin = pos ?? onScreen({ x: target.x - 90, y: target.y - 60 });
    const dist = Math.hypot(target.x - origin.x, target.y - origin.y);
    // an unhurried glide: short hops stay quick, a move across the screen takes its time
    dur = clamp(120 + dist * 0.5, 160, 700) * (step.fixed ? 1 : speed);
    t0 = now;
    phase = "travel";
    const tool = step.tool ?? "cross";
    if (root!.dataset.tool !== tool) root!.dataset.tool = tool;
    setTag(step.cmd);
    show(true);
    return true;
  }

  /** If a step throws, the element is simply shown: nothing may stay hidden. */
  function bail() {
    setBand(null);
    sketch!.replaceChildren();
    if (job) {
      clearInline(job.el);
      reveal(job.el, false);
    }
    job = null;
    steps = [];
    step = null;
  }

  const stopFrames = onFrame((p) => {
    if (stopped) return false;
    const now = p.time;
    if (p.scrolled) {
      const y = window.scrollY;
      // (a jump after a pause counts too: a long way in one frame is fast)
      const v = Math.abs(y - lastY) / clamp(now - lastScrollAt, 8, 50);
      lastY = y;
      lastScrollAt = now;
      // ...unless a menu link or button is taking the visitor to a section: that
      // section is where they want to be, so it is drawn for them when they arrive
      if (v > RUSH_SPEED && performance.now() > calmUntil) rushUntil = now + 250;
    }
    if (now < rushUntil && (step || steps.length || queue.length)) flush(now);
    if (!step && now < restUntil) return true; // a short rest on the piece just finished
    if (!step && !next(now)) {
      const waiting = queue.length > 0; // a script that has not arrived yet
      if (!visible) return waiting;
      if (!idleAt) idleAt = now;
      if (now - idleAt > LINGER) {
        show(false);
        pos = null;
        return waiting;
      }
      return true;
    }
    idleAt = 0;
    const s = step!;
    try {
      const t = dur <= 0 ? 1 : Math.min(1, (now - t0) / dur);
      if (phase === "travel") {
        pos = lerp(origin, onScreen(s.from()), easeInOut(t));
        moveCursor(pos);
        if (t >= 1) {
          phase = "op";
          t0 = now;
          dur = s.ms * (s.fixed ? 1 : speed);
          mark("ping", pos.x, pos.y);
        }
      } else {
        const a = onScreen(s.from());
        const e = s.linear ? t : easeInOut(t);
        pos = s.path ? onScreen(s.path(e)) : s.to ? lerp(a, s.to(), e) : a;
        const val = s.draw?.(e, pos, a);
        setTag(s.cmd, val || "");
        moveCursor(pos);
        if (t >= 1) {
          if (s.to) mark("ping", pos.x, pos.y);
          s.end?.();
          step = null;
          if (!steps.length) restUntil = now + DWELL;
        }
      }
    } catch {
      bail();
    }
    return true;
  });

  return {
    enqueue(els) {
      const batch: Job[] = [];
      for (const el of els) {
        if (el.classList.contains("is-in")) continue;
        // inside something that is still to be drawn: it appears with its parent
        if (el.parentElement?.closest(PENDING)) {
          later(() => el.classList.add("is-in"), 6000); // safety net
          continue;
        }
        const cs = getComputedStyle(el);
        const staged = (parseFloat(cs.getPropertyValue("--delay")) || 0) + (parseFloat(cs.getPropertyValue("--i")) || 0) * 60;
        // The hero keeps the order it was staged in. Everywhere else: top to bottom
        // (in 40 px rows), so a heading is always drawn before what sits under it.
        const row = Math.round((el.getBoundingClientRect().top + window.scrollY) / 40);
        const key = el.closest("[data-hero]") ? staged : 1e6 + row * 2000 + staged;
        // it sits in a piece that is still to be drawn (the hero viewport): wait for that
        const waitsFor = el.dataset.draftWith;
        if (waitsFor && !doneIds.has(waitsFor) && performance.now() >= rushUntil) {
          held.set(waitsFor, [...(held.get(waitsFor) ?? []), el]);
          later(() => el.classList.add("is-in"), 12000); // safety net
          continue;
        }
        const kind = kindOf(el);
        if (!DRAWN.has(kind)) {
          // a small piece: it fades in by itself, on its usual staged timing
          reveal(el, false);
          continue;
        }
        batch.push({ el, kind, key });
      }
      // by key, then reading order
      batch.sort(
        (a, b) => a.key - b.key || (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1),
      );
      if (performance.now() < rushUntil) {
        regen(batch.map((b) => b.el), performance.now());
        return;
      }
      if (intro && !job && !step && batch.length) {
        intro = false;
        booted = true;
        steps = introSteps();
        pos = introStart();
        moveCursor(pos);
      }
      queue.push(...batch);
      // One pace for everything now waiting: a full screen takes about BUDGET ms
      const cost = (q: Job) => OP[q.kind] * (q.kind === "text" ? 2 : 1) + TRAVEL;
      const waiting = queue.reduce((sum, q) => sum + cost(q), job ? cost(job) / 2 : 0);
      speed = clamp(BUDGET / waiting, MIN_SPEED, 1);
      requestFrame();
    },
    stop() {
      stopped = true;
      stopFrames();
      document.removeEventListener("click", onAnchor, true);
      document.removeEventListener("draft:done", onDone);
      if (root.dataset.intro === "true") root.dataset.intro = "false";
      if (html.dataset.boot === "wait") delete html.dataset.boot;
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      if (job) clearInline(job.el); // back to hidden, so a fresh start can draw it again
      queue.length = 0;
      steps = [];
      step = null;
      job = null;
      marks.replaceChildren();
      sketch.replaceChildren();
      setBand(null);
      show(false);
    },
  };
}
