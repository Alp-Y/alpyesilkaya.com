/**
 * DRAFTER
 * ------------------------------------------------------------------
 * Two autonomous CAD cursors (one green, one teal, so they are never mistaken
 * for the visitor's own) that construct the page as it scrolls into view.
 * lib/effects.ts hands over every [data-reveal] / [data-observe] element that
 * enters the screen. They only draw the pieces that matter, each at a calm
 * pace; working side by side is what makes the page come together quickly.
 * In the hero (wide screens) one takes the text column on the left and the
 * other the viewport on the right; everywhere else they share one queue.
 *
 * Two characters, so they never look like one cursor doubled:
 *   the DRAFTER (green)   works by hand. It goes straight to a piece, drags
 *                         blocks out as rectangles, pulls lines from their start,
 *                         types text behind a caret and copies items one by one.
 *   the MODELLER (teal)   works in ortho. It travels along the axes, sets blocks
 *                         down from a point so they grow outwards, extends lines
 *                         from their middle, places headings whole and lays out
 *                         a row in one sweep. It is a little brisker.
 *   When both are free to choose, each picks something different from what the
 *   other is doing at that moment.
 *
 *   data-reveal="draw"    LINE     pick the start, pull the line to its end
 *   data-reveal="rise"    RECTANG  drag a rubber band, the block shows ghosted
 *                                  inside it, then commits with corner grips
 *   data-reveal="lines"   MTEXT    a caret sweeps each line, text appears behind it
 *   everything small      (labels, icons, frames) appears on its own with its
 *                         usual staged fade, without the cursor going there
 *
 * Fast scrolling
 *   Nobody waits for the cursors. Scroll quickly and the screen is regenerated
 *   instead: the first time a scan line sweeps down and everything appears
 *   behind it; after that each piece is plotted in from its left edge and a
 *   short command-line note (REGEN n OBJECTS) says what happened, with no line.
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
 *   Each cursor keeps an even pace. When a lot is waiting they speed up a
 *   little so a whole screen takes about BUDGET ms. Elements already scrolled past
 *   just appear. Tune the constants below.
 *
 * Markup: components/Drafter.tsx (rendered once in the layout).
 */

import { onFrame, reducedMotion, requestFrame } from "./pointer";

/** Longest a waiting queue should take to draw, in ms (it speeds up to fit). */
const BUDGET = 12000;
/** ...but never faster than this fraction of the normal durations. */
const MIN_SPEED = 0.85;
/** How long the cursor stays after its last command, in ms. */
const LINGER = 700;
/** The pause after a piece is finished, before the cursor moves on, in ms. */
const DWELL = 120;
/** Scrolling faster than this (px per ms) regenerates the screen instead of drawing it. */
const RUSH_SPEED = 2.4;
/** How long the regeneration sweep takes, top to bottom, in ms. */
const REGEN_MS = 420;
/** Opacity of a block while its rubber band is still being dragged. */
const GHOST = 0.4;

type Kind = "rect" | "frame" | "line" | "text" | "place" | "insert" | "script" | "type" | "array" | "para";
/** Time each command takes at normal speed, in ms. */
const OP: Record<Kind, number> = { rect: 620, frame: 720, line: 540, text: 620, place: 120, insert: 120, script: 0, type: 700, array: 700, para: 800 };
/** The kinds the cursor draws itself. The rest appear on their own. */
const DRAWN: ReadonlySet<Kind> = new Set<Kind>(["rect", "frame", "line", "text", "script", "type", "array", "para"]);
/** Rough time to travel between two elements, used only for the pace estimate. */
const TRAVEL = 480;

/** The regeneration scan line plays once per page load. */
let scanned = false;

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
type Job = { el: HTMLElement; kind: Kind; key: number; deadline?: number; /** which cursor draws it (unset: whichever is free) */ owner?: number };
/** One cursor and what it is doing. */
type Worker = {
  index: number;
  cursor: HTMLElement;
  band: HTMLElement;
  cmdOut: HTMLElement;
  valOut: HTMLElement;
  job: Job | null;
  steps: Step[];
  step: Step | null;
  phase: "travel" | "op";
  t0: number;
  dur: number;
  origin: Pt;
  pos: Pt | null;
  idleAt: number;
  restUntil: number;
  visible: boolean;
  lastCmd: string;
  lastVal: string;
};

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
/** Ortho travel: along x first, then y, like a cursor with ORTHO on. */
const ortho = (a: Pt, b: Pt, t: number): Pt => {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  const d = (dx + dy) * t;
  if (d <= dx) return { x: a.x + Math.sign(b.x - a.x) * d, y: a.y };
  return { x: b.x, y: a.y + Math.sign(b.y - a.y) * (d - dx) };
};
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
    n.style.transformOrigin = "";
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
    n.style.transformOrigin = "";
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
  const marks = document.querySelector<HTMLElement>("[data-dr-marks]");
  const sketch = root?.querySelector<SVGSVGElement>("[data-dr-sketch]");
  const regenLine = root?.querySelector<HTMLElement>("[data-dr-regen]");
  const regenNote = root?.querySelector<HTMLElement>("[data-dr-note]");
  if (!root || !marks || !sketch || !regenLine) return null;

  // One worker per cursor in the markup (two: they share the work).
  const bands = Array.from(root.querySelectorAll<HTMLElement>("[data-dr-band]"));
  const workers: Worker[] = [];
  root.querySelectorAll<HTMLElement>("[data-dr-cursor]").forEach((cursor, index) => {
    const band = bands[index];
    const cmdOut = cursor.querySelector<HTMLElement>("[data-dr-cmd]");
    const valOut = cursor.querySelector<HTMLElement>("[data-dr-val]");
    if (!band || !cmdOut || !valOut) return;
    workers.push({
      index,
      cursor,
      band,
      cmdOut,
      valOut,
      job: null,
      steps: [],
      step: null,
      phase: "travel",
      t0: 0,
      dur: 0,
      origin: { x: 0, y: 0 },
      pos: null,
      idleAt: 0,
      restUntil: 0,
      visible: false,
      lastCmd: "",
      lastVal: "",
    });
  });
  if (!workers.length) return null;
  /** The worker whose turn it is: everything below acts on this one. */
  let W = workers[0];

  const queue: Job[] = [];
  const timers = new Set<number>();
  let speed = 1;
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
  let stopped = false;

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  /* ---------- overlay ---------- */
  const setTag = (cmd: string, val = "") => {
    if (cmd !== W.lastCmd) W.cmdOut.textContent = W.lastCmd = cmd;
    if (val !== W.lastVal) W.valOut.textContent = W.lastVal = val;
  };
  const moveCursor = (p: Pt) => {
    W.cursor.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    const flipX = String(p.x > window.innerWidth - 190);
    const flipY = String(p.y > window.innerHeight - 60);
    if (W.cursor.dataset.flipX !== flipX) W.cursor.dataset.flipX = flipX;
    if (W.cursor.dataset.flipY !== flipY) W.cursor.dataset.flipY = flipY;
  };
  const show = (on: boolean) => {
    if (W.visible === on) return;
    W.visible = on;
    W.cursor.dataset.on = String(on);
  };
  const setBand = (a: Pt | null, b?: Pt) => {
    if (!a || !b) {
      W.band.dataset.on = "false";
      return;
    }
    W.band.style.transform = `translate3d(${Math.min(a.x, b.x).toFixed(1)}px, ${Math.min(a.y, b.y).toFixed(1)}px, 0)`;
    W.band.style.width = `${Math.abs(b.x - a.x).toFixed(1)}px`;
    W.band.style.height = `${Math.abs(b.y - a.y).toFixed(1)}px`;
    W.band.dataset.on = "true";
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

    const modeller = W.index === 1;

    if (modeller && kind === "rect") {
      // The modeller sets a block down from a point: it grows outwards from the click.
      let c = { x: 0, y: 0, r: 0 };
      const centre = (): Pt => {
        const r = box();
        return onScreen({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      };
      return [
        {
          cmd: "INSERT",
          ms: OP.rect,
          begin: () => {
            st.transition = "none";
            st.transform = "none";
            st.opacity = "1";
            st.clipPath = "circle(0px at 50% 50%)";
          },
          from: centre,
          draw: (t, at) => {
            const r = box();
            // measured from where the cursor really is (a tall block is entered where it shows)
            const x = at.x - r.left;
            const y = at.y - r.top;
            c = { x, y, r: Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) };
            st.clipPath = `circle(${(c.r * t).toFixed(1)}px at ${c.x.toFixed(1)}px ${c.y.toFixed(1)}px)`;
            return `SCALE ${t.toFixed(2)}`;
          },
          end: () => {
            commit(el);
            fx(el, box());
          },
        },
      ];
    }

    if (modeller && kind === "text") {
      // The modeller places a heading whole: one pick at its start and the lines rise into place.
      const first = el.querySelector<HTMLElement>(".line > span") ?? el;
      return [
        {
          cmd: "TEXT",
          tool: "text",
          ms: 180,
          begin: () => {
            W.cursor.style.setProperty("--caret", `${Math.round(first.getBoundingClientRect().height * 0.86)}px`);
          },
          from: () => {
            const r = (first.parentElement ?? first).getBoundingClientRect();
            return onScreen({ x: r.left, y: r.top + r.height / 2 });
          },
          end: () => reveal(el, true),
        },
      ];
    }

    if (modeller && kind === "line" && el.dataset.axis !== "y") {
      // The modeller extends a line both ways from its middle.
      const mid = (): Pt => {
        const r = box();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      };
      let a0: Pt | null = null;
      return [
        {
          cmd: "LINE",
          ms: OP.line,
          begin: () => {
            st.transition = "none";
            st.transform = "none";
            const r = box(); // measured at full length
            a0 = { x: r.left, y: r.top + r.height / 2 };
            st.transformOrigin = "center";
            st.transform = "scaleX(0)";
          },
          from: () => onScreen(mid()),
          to: () => {
            const m = mid();
            return onScreen({ x: m.x + el.offsetWidth / 2, y: m.y });
          },
          draw: (t) => {
            st.transform = `scaleX(${t.toFixed(4)})`;
            return `MID  L = ${Math.round(el.offsetWidth * t)}`;
          },
          end: () => {
            if (a0 && el.offsetWidth > 240) mark("ticks", a0.x, a0.y - 7, el.offsetWidth, 7, 1300);
            commit(el);
          },
        },
      ];
    }

    if (modeller && kind === "array") {
      // The modeller lays a row out in one sweep: each item appears as the cursor passes it.
      const kids = (Array.from(el.children) as HTMLElement[]).filter((c) => c.offsetWidth > 0);
      if (!kids.length) return [];
      const shown = new Set<HTMLElement>();
      const show1 = (kid: HTMLElement) => {
        if (shown.has(kid)) return;
        shown.add(kid);
        kid.style.opacity = "";
        kid.animate(
          [
            { opacity: 0, transform: "scale(0.9)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 300, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
        );
      };
      const span = () => {
        const a = kids[0].getBoundingClientRect();
        const b = kids[kids.length - 1].getBoundingClientRect();
        return { left: a.left - 6, right: Math.max(a.right, b.right) + 6, y: a.top + a.height / 2 };
      };
      return [
        {
          cmd: "ARRAY",
          linear: true,
          ms: clamp(kids.length * 260, 520, 1500),
          begin: () => {
            st.transition = "none";
            st.transform = "none";
            st.opacity = "1";
            kids.forEach((k) => (k.style.opacity = "0"));
          },
          from: () => {
            const sp = span();
            return onScreen({ x: sp.left, y: sp.y });
          },
          path: (t) => {
            const sp = span();
            const x = sp.left + (sp.right - sp.left) * t;
            for (const kid of kids) {
              const r = kid.getBoundingClientRect();
              if (x >= r.left + r.width / 2) show1(kid);
            }
            return onScreen({ x, y: sp.y });
          },
          draw: () => `${shown.size} / ${kids.length}`,
          end: () => {
            kids.forEach(show1);
            commit(el);
          },
        },
      ];
    }

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
            W.cursor.style.setProperty("--caret", `${Math.round(span.getBoundingClientRect().height * 0.86)}px`);
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
          ms: clamp(chars * 45, 400, 1100),
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
            W.cursor.style.setProperty("--caret", `${Math.round(textBox().height * 1.1)}px`);
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
          ms: clamp((el.textContent ?? "").length * 16, 600, 1400),
          begin: () => {
            st.transition = "none";
            st.transform = "none";
            st.opacity = "1";
            st.clipPath = "inset(0 100% 100% 0)";
            const l = measure()[0];
            W.cursor.style.setProperty("--caret", `${Math.round((l.bottom - l.top) * 0.9)}px`);
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
          ms: 130,
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
    let count = 0;
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
      // after the first time there is no scan line: each piece is plotted in, drawn
      // across from its left edge like a plotter laying it down, top of the screen first
      if (scanned) {
        count++;
        el.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 -2% 0 0)" }], {
          duration: 340,
          delay: Math.round(top * REGEN_MS),
          easing: "cubic-bezier(0.33, 0.1, 0.25, 1)",
          fill: "backwards",
        });
      }
    }
    if (!any || now - lastRegen < REGEN_MS + 200) return;
    lastRegen = now;
    if (scanned) {
      // the scan line is a one-off: from then on a command-line note says what happened
      if (regenNote) {
        regenNote.textContent = `REGEN  ${count} OBJECT${count === 1 ? "" : "S"}`;
        regenNote.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: 1300 });
      }
      return;
    }
    scanned = true;
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
    for (const w of workers) {
      W = w;
      if (W.job) {
        clearInline(W.job.el);
        els.unshift(W.job.el);
      }
      setBand(null);
      W.job = null;
      W.steps = [];
      W.step = null;
      W.restUntil = 0;
    }
    sketch!.replaceChildren();
    root!.querySelectorAll("[data-ghost]").forEach((g) => g.remove());
    regen(els, now);
  }

  /* ---------- the queue ---------- */
  const drawable = (el: HTMLElement) => {
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return false; // not displayed at this screen size
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  };

  /** Take the next step (or the next element). False when there is nothing left to draw. */
  function next(now: number): boolean {
    while (!W.steps.length) {
      if (W.job?.kind === "script") {
        // a component's script has finished: clear its sketch, make sure the piece shows
        sketch!.replaceChildren();
        sketch!.style.opacity = "";
        if (!W.job.el.classList.contains("is-in")) reveal(W.job.el, true);
      }
      W.job = null;
      // The first waiting piece for this worker: its own side of the hero or anything
      // unassigned; once its side is finished it helps with the other one.
      // (A script that has not arrived yet stays where it is.)
      const mine = W.index;
      const ready = (q: Job) => !(q.kind === "script" && !scripts.has(q.el) && now < (q.deadline ??= now + SCRIPT_WAIT));
      const own = (q: Job) => (q.owner === undefined || q.owner === mine) && ready(q);
      let at = queue.findIndex(own);
      if (at < 0) at = queue.findIndex(ready);
      if (at < 0) return false;
      // Free to choose (an unassigned piece): rather something different from what the
      // other cursor is doing right now, if one of the next few pieces is.
      const busyWith = workers.find((w) => w !== W)?.job?.kind;
      if (busyWith && queue[at].owner === undefined && queue[at].kind === busyWith) {
        let seen = 0;
        for (let i = at + 1; i < queue.length && seen < 3; i++) {
          if (!own(queue[i]) || queue[i].owner !== undefined) continue;
          seen++;
          if (queue[i].kind !== busyWith) {
            at = i;
            break;
          }
        }
      }
      const j = queue.splice(at, 1)[0];
      if (!j.el.isConnected || j.el.classList.contains("is-in")) continue;
      if (!drawable(j.el)) {
        if (j.kind === "script") j.el.dispatchEvent(new CustomEvent("draft:skipped"));
        reveal(j.el, false);
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
      W.job = j;
      W.steps = planned;
    }
    W.step = W.steps.shift()!;
    W.step.begin?.();
    const target = W.step.from();
    // first command after a pause: the cursor comes in from just off the element
    W.origin = W.pos ?? onScreen({ x: target.x - 90, y: target.y - 60 });
    // the drafter goes straight there; the modeller travels along the axes (ortho)
    const dist =
      W.index === 1
        ? Math.abs(target.x - W.origin.x) + Math.abs(target.y - W.origin.y)
        : Math.hypot(target.x - W.origin.x, target.y - W.origin.y);
    // an unhurried glide: short hops stay quick, a move across the screen takes its time
    W.dur = clamp(160 + dist * 0.6, 220, 850) * (W.step.fixed ? 1 : speed);
    W.t0 = now;
    W.phase = "travel";
    const tool = W.step.tool ?? "cross";
    if (W.cursor.dataset.tool !== tool) W.cursor.dataset.tool = tool;
    setTag(W.step.cmd);
    show(true);
    return true;
  }

  /** If a step throws, the element is simply shown: nothing may stay hidden. */
  function bail() {
    setBand(null);
    sketch!.replaceChildren();
    if (W.job) {
      clearInline(W.job.el);
      reveal(W.job.el, false);
    }
    W.job = null;
    W.steps = [];
    W.step = null;
  }

  /** One worker's frame. True while it still has something to do. */
  function tick(now: number): boolean {
    if (!W.step && now < W.restUntil) return true; // a short rest on the piece just finished
    if (!W.step && !next(now)) {
      const waiting = queue.length > 0; // a script that has not arrived yet
      if (!W.visible) return waiting;
      if (!W.idleAt) W.idleAt = now;
      if (now - W.idleAt > LINGER) {
        show(false);
        W.pos = null;
        return waiting;
      }
      return true;
    }
    W.idleAt = 0;
    const s = W.step!;
    try {
      const t = W.dur <= 0 ? 1 : Math.min(1, (now - W.t0) / W.dur);
      if (W.phase === "travel") {
        const target = onScreen(s.from());
        W.pos = W.index === 1 ? ortho(W.origin, target, easeInOut(t)) : lerp(W.origin, target, easeInOut(t));
        moveCursor(W.pos);
        if (t >= 1) {
          W.phase = "op";
          W.t0 = now;
          W.dur = s.ms * (s.fixed ? 1 : speed);
          mark("ping", W.pos.x, W.pos.y);
        }
      } else {
        const a = onScreen(s.from());
        const e = s.linear ? t : easeInOut(t);
        W.pos = s.path ? onScreen(s.path(e)) : s.to ? lerp(a, s.to(), e) : a;
        const val = s.draw?.(e, W.pos, a);
        setTag(s.cmd, val || "");
        moveCursor(W.pos);
        if (t >= 1) {
          if (s.to) mark("ping", W.pos.x, W.pos.y);
          s.end?.();
          W.step = null;
          if (!W.steps.length) W.restUntil = now + (W.index === 1 ? DWELL / 2 : DWELL);
        }
      }
    } catch {
      bail();
    }
    return true;
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
    if (now < rushUntil && (queue.length || workers.some((w) => w.step || w.steps.length))) flush(now);
    let more = false;
    for (const w of workers) {
      W = w;
      if (tick(now)) more = true;
    }
    return more;
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
        // In the hero on a wide screen each cursor has its side: the text column on
        // the left, the viewport on the right. Everywhere else they share the work.
        let owner: number | undefined;
        if (workers.length > 1 && window.innerWidth >= 1100 && el.closest("[data-hero]")) {
          const r = el.getBoundingClientRect();
          // (by its left edge: some left-column pieces are as wide as the page)
          owner = r.left < window.innerWidth * 0.3 ? 0 : 1;
        }
        batch.push({ el, kind, key, owner });
      }
      // by key, then reading order
      batch.sort(
        (a, b) => a.key - b.key || (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1),
      );
      if (performance.now() < rushUntil) {
        regen(batch.map((b) => b.el), performance.now());
        return;
      }
      queue.push(...batch);
      // One pace for everything now waiting: a full screen takes about BUDGET ms
      const cost = (q: Job) => OP[q.kind] * (q.kind === "text" ? 2 : 1) + TRAVEL;
      const waiting = queue.reduce((sum, q) => sum + cost(q), 0) / workers.length;
      speed = clamp(BUDGET / Math.max(1, waiting), MIN_SPEED, 1);
      requestFrame();
    },
    stop() {
      stopped = true;
      stopFrames();
      document.removeEventListener("click", onAnchor, true);
      document.removeEventListener("draft:done", onDone);
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      queue.length = 0;
      for (const w of workers) {
        W = w;
        if (W.job) clearInline(W.job.el); // back to hidden, so a fresh start can draw it again
        W.steps = [];
        W.step = null;
        W.job = null;
        setBand(null);
        show(false);
      }
      marks.replaceChildren();
      sketch.replaceChildren();
      root.querySelectorAll("[data-ghost]").forEach((g) => g.remove());
    },
  };
}
