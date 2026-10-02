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
 * Special pieces
 *   data-draft            a component supplies its own drawing script with
 *                         registerDraft() (the hero model: survey points, the
 *                         ground profile, the design line, then the 3D volumes)
 *   data-draft-fx="dim"   after a block is drawn, dimension lines measure it
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
const DWELL = 180;
/** Opacity of a block while its rubber band is still being dragged. */
const GHOST = 0.4;

type Kind = "rect" | "frame" | "line" | "text" | "place" | "insert" | "script";
/** Time each command takes at normal speed, in ms. */
const OP: Record<Kind, number> = { rect: 540, frame: 620, line: 480, text: 540, place: 120, insert: 120, script: 0 };
/** The kinds the cursor draws itself. The rest appear on their own. */
const DRAWN: ReadonlySet<Kind> = new Set<Kind>(["rect", "line", "text", "script"]);
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
}

/**
 * Hand a drawn element back to the stylesheet: it is already in its final
 * state, so .is-in is added with transitions off (nothing replays).
 */
function commit(el: HTMLElement) {
  const nodes = nodesOf(el);
  nodes.forEach((n) => (n.style.transition = "none"));
  el.style.setProperty("--delay", "0ms");
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
  if (!root || !cursor || !band || !cmdOut || !valOut || !marks || !sketch) return null;

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
  type MarkType = "box" | "grips" | "grip" | "ping" | "dimw" | "dimh" | "hatch" | "ticks";
  const mark = (type: MarkType, x: number, y: number, w = 0, h = 0, life = 900, label = "") => {
    const m = document.createElement("span");
    m.dataset.m = type;
    m.style.left = `${x + window.scrollX}px`;
    m.style.top = `${y + window.scrollY}px`;
    m.style.width = `${w}px`;
    m.style.height = `${h}px`;
    if (type === "box" || type === "grips") for (let i = 0; i < 4; i++) m.appendChild(document.createElement("i"));
    if (label) {
      const b = document.createElement("b");
      b.textContent = label;
      m.appendChild(b);
    }
    marks.appendChild(m);
    later(() => m.remove(), life);
  };
  const markRect = (type: "box" | "grips", r: DOMRect) => mark(type, r.left, r.top, r.width, r.height);

  /** The small extras: [data-draft-fx] on a block picks what happens once it is drawn. */
  const fx = (el: HTMLElement, r: DOMRect) => {
    const kind = el.dataset.draftFx;
    if (kind === "dim") {
      // dimension lines along the top and (where there is room) the left edge
      mark("dimw", r.left, r.top - 14, r.width, 0, 2200, String(Math.round(r.width)));
      if (r.left > 34) mark("dimh", r.left - 14, r.top, 0, r.height, 2200, String(Math.round(r.height)));
    } else if (kind === "hatch") {
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
            markRect("box", box());
            commit(el);
            if (kind === "rect") fx(el, box());
            if (kind === "rect") el.animate([{ opacity: GHOST }, { opacity: 1 }], { duration: 240, easing: "ease-out" });
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
            mark("grip", a.x, a.y);
            mark("grip", b.x, b.y);
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
            markRect("box", box());
            commit(el);
            el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
          },
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
          markRect("grips", box());
          if (kind === "script") sketch!.replaceChildren();
          reveal(el, true);
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
        const e = easeInOut(t);
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
