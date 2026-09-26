/**
 * FILM DRAWING KIT — the canvas primitives every scene is made of:
 * timing curves, the plan camera, CAD linework, hatches, labels, the
 * command line, captions and report tables. Colours are the site's tokens
 * (app/globals.css), so the film sits inside the page, not on top of it.
 */

import type { XY } from "@/lib/film/project";
import type { FilmData } from "./data";

/* ---------- timing ---------- */

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** progress 0 → 1 of t through [a, b] */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeIn = (t: number) => t * t * t;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** fade in over [a, b], out over [c, d] */
export const env = (t: number, a: number, b: number, c = Infinity, d = Infinity) => Math.min(easeOut(seg(t, a, b)), 1 - easeInOut(seg(t, c, d)));

/* ---------- palette (site tokens) ---------- */

export const C = {
  bg: "#07090b",
  panel: "rgba(11, 14, 18, 0.92)",
  panelSolid: "#0b0e12",
  line: "rgba(160, 185, 215, 0.12)",
  lineStrong: "rgba(160, 185, 215, 0.24)",
  gridMinor: "rgba(160, 185, 215, 0.04)",
  gridMajor: "rgba(160, 185, 215, 0.085)",
  text1: "#e8ecf0",
  text2: "#97a1ad",
  text3: "#747f8b",
  accent: "#3ee08f",
  accentSoft: "rgba(62, 224, 143, 0.14)",
  red: "#e5484d",
  grip: "#4d8dff",
  cut: "#cfae6a",
  cad: "#aab4c0",
};

/* ---------- frame ---------- */

export type Frame = {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  /** portrait composition (phones) */
  tall: boolean;
  /** size unit: type and strokes scale with it */
  u: number;
  /** absolute film seconds, and seconds into the current scene */
  t: number;
  lt: number;
  data: FilmData;
  low: boolean;
  sans: string;
  mono: string;
  dpr: number;
};

/* ---------- plan camera ---------- */

export type Cam = { x: number; y: number; span: number; r?: number };
export type View = { P: (p: XY) => XY; s: number; cam: Cam };

export function view(f: Frame, cam: Cam): View {
  const s = f.W / cam.span;
  const r = cam.r ?? 0;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const cx = f.W / 2;
  const cy = f.H / 2;
  return {
    s,
    cam,
    P: ([x, y]) => {
      const dx = x - cam.x;
      const dy = y - cam.y;
      return [cx + (dx * cos - dy * sin) * s, cy - (dx * sin + dy * cos) * s];
    },
  };
}

type Key = { at: number; cam: Cam };
/** Camera from keyframes (eased between each pair). */
export function track(keys: Key[], t: number): Cam {
  if (t <= keys[0].at) return keys[0].cam;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (t <= b.at) {
      const k = easeInOut(seg(t, a.at, b.at));
      // zoom is interpolated in log space so it feels constant-speed
      return {
        x: lerp(a.cam.x, b.cam.x, k),
        y: lerp(a.cam.y, b.cam.y, k),
        span: Math.exp(lerp(Math.log(a.cam.span), Math.log(b.cam.span), k)),
        r: lerp(a.cam.r ?? 0, b.cam.r ?? 0, k),
      };
    }
  }
  return keys[keys.length - 1].cam;
}

/* ---------- background ---------- */

export function clear(f: Frame) {
  const { ctx, W, H } = f;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.7);
  g.addColorStop(0, "rgba(150, 175, 205, 0.045)");
  g.addColorStop(1, "rgba(150, 175, 205, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** A CAD grid in world units under the camera: the step follows the zoom. */
export function grid(f: Frame, V: View, alpha = 1) {
  if (alpha <= 0) return;
  const { ctx, W, H } = f;
  const target = 34 / V.s; // ~34 px between minor lines
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500];
  const minor = steps.find((s) => s >= target) ?? 500;
  const major = minor * 5;
  const r = V.cam.r ?? 0;
  const half = (Math.hypot(W, H) / V.s) * 0.6;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1;
  for (const [step, color] of [
    [minor, C.gridMinor],
    [major, C.gridMajor],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    const x0 = Math.floor((V.cam.x - half) / step) * step;
    const y0 = Math.floor((V.cam.y - half) / step) * step;
    for (let x = x0; x <= V.cam.x + half; x += step) {
      if (step === minor && Math.abs(x / major - Math.round(x / major)) < 1e-6) continue;
      const a = V.P([x, V.cam.y - half]);
      const b = V.P([x, V.cam.y + half]);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    for (let y = y0; y <= V.cam.y + half; y += step) {
      if (step === minor && Math.abs(y / major - Math.round(y / major)) < 1e-6) continue;
      const a = V.P([V.cam.x - half, y]);
      const b = V.P([V.cam.x + half, y]);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
  }
  ctx.restore();
  void r;
}

/** Screen-space grid (report sheets, the terrain scene's backdrop). */
export function screenGrid(f: Frame, step: number, alpha = 1, ox = 0, oy = 0) {
  const { ctx, W, H } = f;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1;
  ctx.strokeStyle = C.gridMinor;
  ctx.beginPath();
  for (let x = ((ox % step) + step) % step; x < W; x += step) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, H);
  }
  for (let y = ((oy % step) + step) % step; y < H; y += step) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(W, Math.round(y) + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

/* ---------- linework ---------- */

export function pathPoly(ctx: CanvasRenderingContext2D, pts: XY[], P: (p: XY) => XY, close = true) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const [x, y] = P(p);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  if (close) ctx.closePath();
}

/** A polyline drawn up to `k` (0 → 1) of its length. Returns the head point. */
export function partialLine(ctx: CanvasRenderingContext2D, pts: XY[], P: (p: XY) => XY, k: number): XY | null {
  if (k <= 0 || pts.length < 2) return null;
  const sp = pts.map(P);
  let total = 0;
  for (let i = 1; i < sp.length; i++) total += Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]);
  let left = total * clamp(k);
  ctx.beginPath();
  ctx.moveTo(sp[0][0], sp[0][1]);
  let head: XY = sp[0];
  for (let i = 1; i < sp.length; i++) {
    const d = Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]);
    if (d >= left) {
      const t = d ? left / d : 0;
      head = [sp[i - 1][0] + (sp[i][0] - sp[i - 1][0]) * t, sp[i - 1][1] + (sp[i][1] - sp[i - 1][1]) * t];
      ctx.lineTo(head[0], head[1]);
      ctx.stroke();
      return head;
    }
    left -= d;
    ctx.lineTo(sp[i][0], sp[i][1]);
    head = sp[i];
  }
  ctx.stroke();
  return head;
}

export function stroke(ctx: CanvasRenderingContext2D, color: string, width = 1, dash: number[] = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Diagonal CAD hatch inside the current path (screen space). */
export function hatch(f: Frame, color: string, alpha = 1, spacing = 7, angle = Math.PI / 4, fillAlpha = 0.08) {
  const { ctx, W, H } = f;
  ctx.save();
  ctx.clip();
  ctx.globalAlpha *= alpha;
  if (fillAlpha > 0) {
    ctx.fillStyle = color;
    ctx.globalAlpha *= fillAlpha;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha /= fillAlpha;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha *= 0.55;
  ctx.beginPath();
  const d = Math.hypot(W, H);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let o = -d; o < d; o += spacing) {
    ctx.moveTo(W / 2 + cos * o - sin * d, H / 2 + sin * o + cos * d);
    ctx.lineTo(W / 2 + cos * o + sin * d, H / 2 + sin * o - cos * d);
  }
  ctx.stroke();
  ctx.restore();
}

/** Small CAD symbols. */
export function manhole(ctx: CanvasRenderingContext2D, [x, y]: XY, r: number, color: string, fill = C.bg) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.6, y - r * 0.6);
  ctx.lineTo(x + r * 0.6, y + r * 0.6);
  ctx.stroke();
}
export function cross(ctx: CanvasRenderingContext2D, [x, y]: XY, r: number, color: string, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  stroke(ctx, color, width);
}
export function grip(ctx: CanvasRenderingContext2D, [x, y]: XY, r = 3.5) {
  ctx.fillStyle = C.grip;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - r + 0.5, y - r + 0.5, r * 2 - 1, r * 2 - 1);
}

/* ---------- type ---------- */

type TextOpts = { size?: number; color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline; alpha?: number; weight?: number; spacing?: number };

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

/** The site's mono annotation voice: small, uppercase, tracked. */
export function mono(f: Frame, text: string, x: number, y: number, o: TextOpts = {}) {
  const { ctx } = f;
  const size = o.size ?? monoSize(f);
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.font = `${o.weight ?? 450} ${size}px ${f.mono}`;
  setSpacing(ctx, o.spacing ?? size * 0.08);
  ctx.fillStyle = o.color ?? C.text3;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = o.base ?? "alphabetic";
  ctx.fillText(text, x, y);
  ctx.restore();
}
/** Numbers and data values: mono, not uppercase-tracked, tabular. */
export function num(f: Frame, text: string, x: number, y: number, o: TextOpts = {}) {
  mono(f, text, x, y, { spacing: 0, color: C.text1, ...o });
}
export function sans(f: Frame, text: string, x: number, y: number, o: TextOpts = {}) {
  const { ctx } = f;
  const size = o.size ?? 16;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.font = `${o.weight ?? 560} ${size}px ${f.sans}`;
  setSpacing(ctx, o.spacing ?? -size * 0.035);
  ctx.fillStyle = o.color ?? C.text1;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = o.base ?? "alphabetic";
  ctx.fillText(text, x, y);
  ctx.restore();
}
export function textWidth(f: Frame, text: string, size: number, font: "mono" | "sans" = "mono", weight = 450) {
  const { ctx } = f;
  ctx.save();
  ctx.font = `${weight} ${size}px ${font === "mono" ? f.mono : f.sans}`;
  setSpacing(ctx, font === "mono" ? size * 0.08 : -size * 0.035);
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}
export const monoSize = (f: Frame) => Math.max(10, 10.5 * f.u);

/** A boxed label, like an area tag on a drawing. Anchored at its left-middle. */
export function tag(
  f: Frame,
  text: string,
  x: number,
  y: number,
  o: { color?: string; border?: string; bg?: string; alpha?: number; size?: number; align?: "left" | "center" | "right" } = {},
) {
  const { ctx } = f;
  const size = o.size ?? monoSize(f);
  const pad = size * 0.55;
  const w = textWidth(f, text, size) + pad * 2;
  const h = size * 1.9;
  const x0 = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.fillStyle = o.bg ?? "rgba(7, 9, 11, 0.88)";
  ctx.fillRect(x0, y - h / 2, w, h);
  ctx.strokeStyle = o.border ?? C.lineStrong;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x0) + 0.5, Math.round(y - h / 2) + 0.5, Math.round(w) - 1, Math.round(h) - 1);
  ctx.restore();
  mono(f, text, x0 + pad, y + size * 0.36, { size, color: o.color ?? C.text2, alpha: o.alpha });
  return w;
}

/** Two-line section caption, e.g. FROM COORDINATES / TO SURFACES. */
export function caption(f: Frame, lines: [string, string], a: number, where: "tl" | "bl" | "center" = "tl") {
  if (a <= 0) return;
  const size = f.tall ? Math.min(26, f.W * 0.066) : clamp(f.W * 0.028, 20, 36);
  const pad = f.tall ? 18 : Math.max(24, f.W * 0.028);
  const lh = size * 1.02;
  const rise = (1 - easeOut(a)) * 10;
  let x = pad;
  let y = pad + size + (f.tall ? 6 : 8);
  let align: CanvasTextAlign = "left";
  if (where === "bl") y = f.H - pad - lh - 4;
  if (where === "center") {
    x = f.W / 2;
    y = f.H / 2 - lh / 2 + size * 0.35;
    align = "center";
  }
  sans(f, lines[0], x, y + rise, { size, color: C.text2, alpha: a, align, weight: 520 });
  sans(f, lines[1], x, y + lh + rise, { size, color: C.text1, alpha: a, align });
}

/** Small mono chapter marker in the top-right corner: "02 · QUANTITY BY AREA" */
export function marker(f: Frame, text: string, a: number) {
  if (a <= 0) return;
  const pad = f.tall ? 18 : Math.max(24, f.W * 0.028);
  mono(f, text, f.W - pad, pad + 10, { align: "right", alpha: a, color: C.text3 });
}

/* ---------- command line ---------- */

/**
 * The AutoCAD command line: `Command: YTQTY` typed in, Enter, a one-line
 * response. `typeAt` is when typing starts (scene seconds).
 */
export function commandLine(f: Frame, cmd: string, typeAt: number, reply: string | null, a = 1) {
  const lt = f.lt;
  if (a <= 0 || lt < typeAt - 0.4) return;
  const { ctx } = f;
  const size = Math.max(11, 12 * f.u);
  const typeDur = cmd.length * 0.065;
  const enterAt = typeAt + typeDur + 0.35;
  const shown = cmd.slice(0, Math.floor(clamp((lt - typeAt) / typeDur) * cmd.length));
  const pad = f.tall ? 14 : Math.max(20, f.W * 0.022);
  const h = size * 2.3;
  const w = f.tall ? f.W - pad * 2 : Math.min(460 * f.u, f.W * 0.44);
  const x = pad;
  const y = f.H - pad - h;
  const fade = env(lt, typeAt - 0.4, typeAt - 0.1, enterAt + 1.6, enterAt + 2.2) * a;
  if (fade <= 0) return;
  ctx.save();
  ctx.globalAlpha = fade;
  // the reply above the prompt, as the command history
  if (reply && lt > enterAt) {
    const ra = seg(lt, enterAt, enterAt + 0.2);
    mono(f, reply, x + size * 0.8, y - size * 0.7, { size: size * 0.9, color: C.text3, alpha: ra, spacing: 0.4 });
  }
  ctx.fillStyle = "rgba(9, 12, 15, 0.9)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = lt > enterAt && lt < enterAt + 0.25 ? "rgba(62, 224, 143, 0.6)" : C.lineStrong;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  const by = y + h / 2 + size * 0.36;
  mono(f, "Command:", x + size * 0.8, by, { size, color: C.text3, spacing: 0.3 });
  const px = x + size * 0.8 + textWidth(f, "Command: ", size) - size * 0.3;
  mono(f, lt > enterAt ? "" : shown, px, by, { size, color: C.text1, spacing: 0.6, weight: 500 });
  // caret: blinks while waiting, sits after the text while typing
  const caretX = px + (lt > enterAt ? 0 : textWidth(f, shown, size) - size * 0.1 + 2);
  const blink = lt < typeAt || (lt > typeAt + typeDur && lt <= enterAt) || lt > enterAt ? Math.floor(lt * 2.4) % 2 === 0 : true;
  if (blink) {
    ctx.fillStyle = C.accent;
    ctx.fillRect(caretX, y + h / 2 - size * 0.45, size * 0.5, size * 0.9);
  }
  // the executed command, echoed faintly right of the prompt
  if (lt > enterAt) mono(f, cmd, x + w - size * 0.8, by, { size: size * 0.9, color: C.accent, align: "right", alpha: 0.8, spacing: 0.6 });
  ctx.restore();
}

/* ---------- tables ---------- */

export type Col = { label: string; w: number; align?: "left" | "right" };
export type TableOpts = {
  x: number;
  y: number;
  w: number;
  rowH: number;
  /** 0 → 1 per row: how far each row has arrived */
  rowIn: (i: number) => number;
  headIn: number;
  highlight?: (i: number) => number;
  size?: number;
  colors?: (i: number, c: number) => string | undefined;
};
/** A clean report table: header rule, rows fading/sliding in, tabular numbers. */
export function table(f: Frame, cols: Col[], rows: string[][], o: TableOpts) {
  const { ctx } = f;
  const size = o.size ?? monoSize(f);
  const total = cols.reduce((a, c) => a + c.w, 0);
  const xs: number[] = [];
  let acc = o.x;
  for (const c of cols) {
    xs.push(acc);
    acc += (c.w / total) * o.w;
  }
  const cell = (i: number) => (cols[i].w / total) * o.w;
  const padX = size * 0.7;
  // header
  if (o.headIn > 0) {
    ctx.save();
    ctx.globalAlpha *= o.headIn;
    cols.forEach((c, i) =>
      mono(f, c.label, c.align === "right" ? xs[i] + cell(i) - padX : xs[i] + padX, o.y + o.rowH * 0.62, { size: size * 0.92, color: C.text3, align: c.align ?? "left" }),
    );
    ctx.fillStyle = C.lineStrong;
    ctx.fillRect(o.x, o.y + o.rowH - 1, o.w * easeOut(o.headIn), 1);
    ctx.restore();
  }
  rows.forEach((r, ri) => {
    const k = o.rowIn(ri);
    if (k <= 0) return;
    const y = o.y + o.rowH * (ri + 1);
    ctx.save();
    ctx.globalAlpha *= easeOut(k);
    const hl = o.highlight?.(ri) ?? 0;
    if (hl > 0) {
      ctx.fillStyle = `rgba(62, 224, 143, ${0.1 * hl})`;
      ctx.fillRect(o.x, y, o.w, o.rowH);
      ctx.fillStyle = `rgba(62, 224, 143, ${0.7 * hl})`;
      ctx.fillRect(o.x, y, 2, o.rowH);
    }
    const dx = (1 - easeOut(k)) * 14;
    r.forEach((v, ci) => {
      const c = cols[ci];
      const isNum = c.align === "right";
      const color = o.colors?.(ri, ci) ?? (isNum ? C.text1 : ci === 0 ? C.text3 : C.text2);
      const tx = isNum ? xs[ci] + cell(ci) - padX : xs[ci] + padX;
      (isNum ? num : mono)(f, v, tx + dx, y + o.rowH * 0.64, { size, color, align: isNum ? "right" : "left", spacing: isNum ? 0 : size * 0.05 });
    });
    ctx.fillStyle = C.line;
    ctx.fillRect(o.x, y + o.rowH - 1, o.w, 1);
    ctx.restore();
  });
  return { xs, cell, bottom: o.y + o.rowH * (rows.length + 1) };
}

/** A panel: the report / window frame the tables sit in. */
export function panel(f: Frame, x: number, y: number, w: number, h: number, a: number, title?: string, meta?: string) {
  if (a <= 0) return;
  const { ctx } = f;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = C.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = C.lineStrong;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w) - 1, Math.round(h) - 1);
  if (title) {
    const size = monoSize(f);
    const bar = size * 2.6;
    ctx.fillStyle = "rgba(150, 175, 205, 0.04)";
    ctx.fillRect(x + 1, y + 1, w - 2, bar);
    ctx.fillStyle = C.line;
    ctx.fillRect(x, y + bar, w, 1);
    ctx.fillStyle = C.accent;
    ctx.fillRect(x + size, y + bar / 2 - 3, 6, 6);
    mono(f, title, x + size + 14, y + bar / 2 + size * 0.36, { color: C.text2 });
    if (meta) mono(f, meta, x + w - size, y + bar / 2 + size * 0.36, { align: "right" });
  }
  ctx.restore();
}

/** A number that counts up to its value as `k` goes 0 → 1. */
export const countTo = (v: number, k: number) => v * easeOut(clamp(k));
const fmt2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const n2 = (v: number) => fmt2.format(Math.abs(v) < 0.005 ? 0 : v);
export const signed = (v: number, d = 2) => (v > 0 ? "+" : v < 0 ? "−" : "") + (d ? n2(Math.abs(v)) : String(Math.round(Math.abs(v))));
export const nq = (v: number, unit: string) => (unit === "nr" ? String(Math.round(v)) : n2(v));

/** A value chip flying from one screen point to another (the "number moves into the report" beat). */
export function flyer(f: Frame, text: string, from: XY, to: XY, k: number, color = C.accent) {
  if (k <= 0 || k >= 1) return;
  const e = easeInOut(k);
  const x = lerp(from[0], to[0], e);
  const y = lerp(from[1], to[1], e) - Math.sin(e * Math.PI) * 18;
  const { ctx } = f;
  ctx.save();
  ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9 + 0.1;
  ctx.strokeStyle = color;
  ctx.globalAlpha *= 0.35;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  tag(f, text, x, y, { color, border: color, align: "center", alpha: Math.min(1, Math.sin(k * Math.PI) * 1.6) });
}
