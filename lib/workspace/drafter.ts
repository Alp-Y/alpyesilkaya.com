/**
 * DRAFTER
 * ------------------------------------------------------------------
 * One quiet CAD cursor and one moment: when the homepage opens it writes the
 * name, then builds the hero model. That is all it draws. Everything else, on
 * every page, fades in by itself with the plain staged reveals (lib/effects.ts
 * still hands every [data-reveal] / [data-observe] element over, and this
 * module adds .is-in for the ones it does not draw).
 *
 *   the name   (hero "lines")   MTEXT   a caret runs along each line, the words follow
 *   the model  ([data-draft])   the component's own script (survey points, then the
 *                               model: components/earthworks/buildScript.ts)
 *   the About photo ([data-draft])  built like a drawing when it scrolls into view
 *                               (components/photoBuild/PhotoBuild.tsx)
 *
 * Scroll away quickly while the hero is being drawn and it stops: what it was
 * working on simply appears. The About photo is different: however fast the
 * visitor gets there, it waits until it is properly in view, then it is drawn.
 *
 * The other gestures (blocks dragged out, rules pulled, rows laid out, a second
 * cursor) are still in this file but switched off: DRAWN lists what the cursor
 * draws, and components/Drafter.tsx decides how many cursors there are.
 *
 * How it works
 *   Everything is driven per frame with inline styles, then handed back to
 *   the normal CSS by adding .is-in (the same end state as before). So the
 *   stylesheet needs no special mode, and without this module (reduced
 *   motion, or a script failure) the usual reveals still work.
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
/** How long the rest of the hero waits for the name to be written, in ms. */
const NAME_LEAD = 700;
/** Opacity of a block while its rubber band is still being dragged. */
const GHOST = 0.4;

type Kind = "rect" | "frame" | "line" | "text" | "place" | "insert" | "script" | "type" | "array" | "para";
/** Time each command takes at normal speed, in ms. */
const OP: Record<Kind, number> = { rect: 620, frame: 720, line: 540, text: 620, place: 120, insert: 120, script: 0, type: 700, array: 700, para: 800 };
/** The kinds the cursor draws itself. The rest appear on their own. */
const DRAWN: ReadonlySet<Kind> = new Set<Kind>(["text", "script"]);
/** Rough time to travel between two elements, used only for the pace estimate. */
const TRAVEL = 480;

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
type Job = {
  el: HTMLElement;
  kind: Kind;
  key: number;
  deadline?: number;
  /** which cursor draws it (unset: whichever is free) */
  owner?: number;
  /**
   * A showpiece outside the hero (the About photo): it is never skipped for
   * fast scrolling. It waits until it is properly in view, then it is drawn.
   */
  sticky?: boolean;
};
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
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const onScreen = (p: Pt): Pt => ({
  x: clamp(p.x, 6, window.innerWidth - 6),
  y: clamp(p.y, 6, window.innerHeight - 6),
});

function kindOf(el: HTMLElement): Kind {
  if (el.hasAttribute("data-draft")) return "script";
  const forced = el.dataset.draftKind;
  if (forced === "array" || forced === "rect" || forced === "para") return forced;
  if (forced === "type") return "para"; // a label is written the same simple way as a paragraph
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
        }, 120 + i * 140);
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

    if (kind === "array") {
      // A row is laid out in one sweep: each item appears as the cursor passes it.
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
  /** Everything given simply appears, top of the screen first. */
  function regen(els: HTMLElement[]) {
    const H = window.innerHeight;
    for (const el of els) {
      if (!el.isConnected || el.classList.contains("is-in")) continue;
      const top = clamp(el.getBoundingClientRect().top / H, 0, 1);
      el.style.setProperty("--delay", `${Math.round(top * REGEN_MS)}ms`);
      el.style.setProperty("--i", "0");
      if (el.hasAttribute("data-draft")) el.dispatchEvent(new CustomEvent("draft:skipped"));
      el.classList.add("is-in");
      releaseChildren(el);
      announce(el);
    }
  }

  /** Drop what is being drawn and what is waiting: all of it is regenerated at once. */
  function flush() {
    // (a sticky piece stays: it is waiting to be looked at, or is being drawn right now)
    const stay = queue.filter((q) => q.sticky);
    const els = queue.filter((q) => !q.sticky).map((q) => q.el);
    queue.length = 0;
    queue.push(...stay);
    for (const w of workers) {
      W = w;
      if (W.job?.sticky) continue;
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
    if (!workers.some((w) => w.job?.sticky)) sketch!.replaceChildren();
    root!.querySelectorAll("[data-ghost]").forEach((g) => g.remove());
    regen(els);
  }

  /** Most of it is on screen (so a sticky piece is only drawn while it can be watched). */
  const inView = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    if (!r.height) return false;
    const shown = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
    return shown >= Math.min(r.height, window.innerHeight) * 0.6;
  };

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
      const ready = (q: Job) =>
        !(q.kind === "script" && !scripts.has(q.el) && now < (q.deadline ??= now + SCRIPT_WAIT)) &&
        // a sticky piece waits until most of it is on screen and the scrolling has calmed down
        (!q.sticky || (inView(q.el) && now >= rushUntil));
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
      // Never two blocks dragged out at the same moment: this one waits its turn
      if (busyWith === "rect" && queue[at].kind === "rect") return false;
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
    const dist = Math.hypot(target.x - W.origin.x, target.y - W.origin.y);
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
        W.pos = lerp(W.origin, onScreen(s.from()), easeInOut(t));
        moveCursor(W.pos);
        if (t >= 1) {
          W.phase = "op";
          W.t0 = now;
          W.dur = s.ms * (s.fixed ? 1 : speed);
        }
      } else {
        const a = onScreen(s.from());
        const e = s.linear ? t : easeInOut(t);
        W.pos = s.path ? onScreen(s.path(e)) : s.to ? lerp(a, s.to(), e) : a;
        s.draw?.(e, W.pos, a);
        setTag(s.cmd); // just the command: no running numbers
        moveCursor(W.pos);
        if (t >= 1) {
          s.end?.();
          W.step = null;
          if (!W.steps.length) W.restUntil = now + DWELL;
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
    if (now < rushUntil && (queue.some((q) => !q.sticky) || workers.some((w) => (w.step || w.steps.length) && !w.job?.sticky))) flush();
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
      // is the hero's name among these (the page has just opened at the top)?
      const leads = els.some((el) => el.dataset.reveal === "lines" && !!el.closest("[data-hero]") && !el.classList.contains("is-in"));
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
        // Only the hero's name and its model are drawn by the cursor. Everything
        // else, on every page, fades in by itself on its usual staged timing.
        const inHero = !!el.closest("[data-hero]");
        // (a component's own script, like the About photo's, is drawn wherever it is)
        if (!DRAWN.has(kind) || (!inHero && kind !== "script")) {
          // In the hero the name leads: the rest of the sheet follows once it is
          // (nearly) written, in its staged order, so there is one clear sequence.
          if (inHero && leads) el.style.setProperty("--delay", `${Math.round(staged + NAME_LEAD)}ms`);
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
        batch.push({ el, kind, key, owner, sticky: kind === "script" && !inHero });
      }
      // by key, then reading order
      batch.sort(
        (a, b) => a.key - b.key || (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1),
      );
      if (performance.now() < rushUntil) {
        regen(batch.filter((b) => !b.sticky).map((b) => b.el));
        queue.push(...batch.filter((b) => b.sticky)); // a showpiece waits instead
        requestFrame();
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
