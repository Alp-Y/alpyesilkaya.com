/**
 * THE FILM'S SCENES — one idea per chapter, said in one plain sentence,
 * shown with one clear transformation:
 *
 *   intro     a line becomes a road                "Every drawing holds the answers."
 *   zones     work is sorted into project zones    "Measure by zone."
 *   volume    survey points → surface → volume     "From survey points to volume."
 *   drainage  the network is read from the drawing "Read the drainage network."
 *   progress  last week vs this week               "See what changed this week."
 *   report    it all lands in one report           "Everything, in one report."
 *   end       the title and the way to the tools
 *
 * Motion is slow and eased; scenes fade through the background between
 * chapters (player.ts). Geometry and the one volume figure are computed from
 * the example project (lib/film), nothing is typed in.
 */

import { PIPES, PROGRESS, WORK, pf, so, soLine, soPoly, type XY } from "@/lib/film/project";
import {
  C,
  clamp,
  clear,
  easeInOut,
  easeOut,
  env,
  hatch,
  lerp,
  manhole,
  mono,
  partialLine,
  pathPoly,
  sans,
  seg,
  stroke,
  textWidth,
  view,
  type Cam,
  type Frame,
  type View,
} from "./draw";
import { drawDrainage, drawProject } from "./plan";
import { drawFaces, drawTinWave, project, type Proj } from "./terrain3d";

/* ================================================================== */
/* shared: the headline, the stage below it                            */
/* ================================================================== */

const pad = (f: Frame) => (f.tall ? 18 : Math.max(28, f.W * 0.04));

/** The area under the headline where each chapter shows its idea. */
function region(f: Frame) {
  const top = f.tall ? f.H * 0.27 : f.H * 0.27;
  const bottom = f.H - (f.tall ? 16 : f.H * 0.06);
  return { x: pad(f), y: top, w: f.W - pad(f) * 2, h: bottom - top, cx: f.W / 2, cy: (top + bottom) / 2 };
}

/** Break a sentence into lines that fit `max` px. */
function wrap(f: Frame, text: string, size: number, max: number, weight: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (line && textWidth(f, test, size, "sans", weight) > max) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The chapter's sentence, centred at the top: a title and one quieter line.
 * `a` / `b` are how far each has faded in (0 → 1).
 */
function headline(f: Frame, title: string, sub: string, a: number, b: number, y0?: number) {
  const size = f.tall ? Math.min(25, f.W * 0.066) : clamp(f.W * 0.03, 24, 40);
  const subSize = f.tall ? Math.min(14.5, f.W * 0.038) : clamp(f.W * 0.0125, 14, 18);
  const max = f.W - pad(f) * 2;
  const top = y0 ?? (f.tall ? f.H * 0.075 : f.H * 0.1);
  const tLines = wrap(f, title, size, max, 600);
  if (a > 0)
    tLines.forEach((l, i) =>
      sans(f, l, f.W / 2, top + size + i * size * 1.1 + (1 - easeOut(a)) * 8, { size, weight: 600, align: "center", alpha: easeOut(a), spacing: -size * 0.025 }),
    );
  if (b > 0) {
    const sy = top + size + (tLines.length - 1) * size * 1.1 + subSize * 1.9;
    wrap(f, sub, subSize, Math.min(max, 620), 400).forEach((l, i) =>
      sans(f, l, f.W / 2, sy + i * subSize * 1.45 + (1 - easeOut(b)) * 6, { size: subSize, weight: 400, color: C.text2, align: "center", alpha: easeOut(b), spacing: 0 }),
    );
  }
}
/** Standard headline timing: title at 0.5 s, its line at 1.1 s. */
const said = (f: Frame, title: string, sub: string) => headline(f, title, sub, seg(f.lt, 0.5, 1.3), seg(f.lt, 1.1, 1.9));

/** A plan view centred in a given screen point. */
const planView = (f: Frame, cam: Cam, cx: number, cy: number) => view(f, cam, cx - f.W / 2, cy - f.H / 2);

/** A soft fade of the drawing where a list is about to sit (wide: the right side; tall: below). */
function veil(f: Frame, a: number, at: number) {
  if (a <= 0) return;
  const { ctx } = f;
  const g = f.tall ? ctx.createLinearGradient(0, at - 40, 0, at + 30) : ctx.createLinearGradient(at - 60, 0, at + 50, 0);
  g.addColorStop(0, "rgba(7, 9, 11, 0)");
  g.addColorStop(1, "rgba(7, 9, 11, 0.94)");
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  if (f.tall) ctx.fillRect(0, at - 40, f.W, f.H - at + 40);
  else ctx.fillRect(at - 60, 0, f.W - at + 60, f.H);
  ctx.restore();
}

/** Soft chip: coloured dot + words. */
function chip(f: Frame, color: string, text: string, x: number, y: number, a: number, align: "left" | "center" = "left") {
  if (a <= 0) return;
  const size = f.tall ? 12.5 : clamp(f.W * 0.0105, 12.5, 15);
  const w = textWidth(f, text, size, "sans", 450) + size * 1.4;
  const x0 = align === "center" ? x - w / 2 : x;
  f.ctx.save();
  f.ctx.globalAlpha = a;
  f.ctx.fillStyle = color;
  f.ctx.beginPath();
  f.ctx.arc(x0 + size * 0.35, y - size * 0.32, size * 0.3, 0, Math.PI * 2);
  f.ctx.fill();
  f.ctx.restore();
  sans(f, text, x0 + size * 1.1, y, { size, weight: 450, color: C.text1, alpha: a, spacing: 0 });
  return w;
}

/* ================================================================== */
/* 1 · INTRO — a line becomes a road                                    */
/* ================================================================== */

export function introScene(f: Frame) {
  const lt = f.lt;
  clear(f);
  const R = region(f);
  const cam: Cam = f.tall ? { x: 300 + lt * 3, y: 4, span: 300 } : { x: 330 + lt * 4, y: 12, span: 700 - lt * 8 };
  const V = planView(f, cam, R.cx, R.cy + (f.tall ? 0 : 10));
  const line = easeInOut(seg(lt, 0.8, 3.6));
  drawProject(f, V, {
    grid: 0.7 * seg(lt, 0, 1.2),
    align: line,
    head: 1 - seg(lt, 3.6, 4.2),
    edges: easeInOut(seg(lt, 3.2, 5.0)),
    kerbs: seg(lt, 4.4, 5.6),
    lights: seg(lt, 4.8, 6.0) * 0.8,
  });
  headline(f, "Every drawing holds the answers.", "These tools find them, measure them and put them in a report. Automatically.", seg(lt, 2.2, 3.2), seg(lt, 3.0, 4.0));
}

/* ================================================================== */
/* 2 · ZONES — the work is sorted into project zones                    */
/* ================================================================== */

const ZONES = [
  { name: "Zone A", s0: 100, s1: 250, color: "#3ee08f" },
  { name: "Zone B", s0: 250, s1: 400, color: "#4d8dff" },
  { name: "Zone C", s0: 400, s1: 550, color: "#d9b56f" },
];
const PAVE: [number, number] = [70, 480]; // paved so far, by chainage
const Z_HALF = 26;
const zonePoly = (z: (typeof ZONES)[number]) =>
  soPoly([
    [z.s0, -Z_HALF],
    [z.s1, -Z_HALF],
    [z.s1, Z_HALF],
    [z.s0, Z_HALF],
  ]);
/** the paving inside one zone: both carriageways, clipped to the zone by chainage */
const pavedIn = (z: (typeof ZONES)[number]) => {
  const a = Math.max(z.s0, PAVE[0]);
  const b = Math.min(z.s1, PAVE[1]);
  if (b <= a) return [] as XY[][];
  return [
    soPoly([
      [a, 1.5],
      [b, 1.5],
      [b, 11.5],
      [a, 11.5],
    ]),
    soPoly([
      [a, -11.5],
      [b, -11.5],
      [b, -1.5],
      [a, -1.5],
    ]),
  ];
};
const PAVED_ALL: XY[][] = [
  soPoly([
    [PAVE[0], 1.5],
    [PAVE[1], 1.5],
    [PAVE[1], 11.5],
    [PAVE[0], 11.5],
  ]),
  soPoly([
    [PAVE[0], -11.5],
    [PAVE[1], -11.5],
    [PAVE[1], -1.5],
    [PAVE[0], -1.5],
  ]),
];

export function zonesScene(f: Frame) {
  const lt = f.lt;
  const { ctx } = f;
  clear(f);
  const R = region(f);
  // wide: the drawing moves left for the list; tall: it moves up
  const make = easeInOut(seg(lt, 7.4, 8.6));
  const cam: Cam = f.tall ? { x: 325, y: 1, span: 500 } : { x: 325, y: 2, span: lerp(620, 560, make) };
  const cx = f.tall ? R.cx : lerp(R.cx, f.W * 0.34, make);
  const cy = f.tall ? lerp(R.cy, R.y + R.h * 0.24, make) : R.cy;
  const V = planView(f, cam, cx, cy);
  drawProject(f, V, { grid: 0.7, align: 1, edges: 1, kerbs: 0.5, lights: 0.5 });

  // the zones, drawn once
  ZONES.forEach((z, i) => {
    const k = easeOut(seg(lt, 1.8 + i * 0.45, 2.8 + i * 0.45));
    if (k <= 0) return;
    const poly = zonePoly(z);
    ctx.save();
    ctx.globalAlpha = k;
    pathPoly(ctx, poly, V.P);
    ctx.fillStyle = z.color;
    ctx.globalAlpha = k * 0.06;
    ctx.fill();
    ctx.globalAlpha = k * 0.7;
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = z.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    const p = V.P(so((z.s0 + z.s1) / 2, Z_HALF + 9));
    sans(f, z.name, p[0], p[1], { size: f.tall ? 12.5 : clamp(f.W * 0.011, 12.5, 15), weight: 500, color: z.color, align: "center", alpha: k, spacing: 0 });
  });

  // the work, still unsorted
  const wk = easeOut(seg(lt, 3.6, 4.6));
  if (wk > 0) {
    ctx.save();
    ctx.globalAlpha = wk * (1 - 0.6 * seg(lt, 5.2, 6.8));
    for (const p of PAVED_ALL) {
      pathPoly(ctx, p, V.P);
      hatch(f, "#c9d1da", 0.7, 5, Math.PI / 4, 0.08);
    }
    ctx.restore();
  }

  veil(f, make, f.tall ? R.y + R.h * 0.5 : f.W * 0.62);

  // sorted: each zone's share takes its colour, one after another
  const bars: { x: number; y: number; w: number; h: number }[] = [];
  const listA = seg(lt, 8.0, 8.8);
  const L = f.tall
    ? { x: R.x + 8, y: R.y + R.h * 0.56, w: R.w - 16 }
    : { x: f.W * 0.66, y: R.cy - 70, w: Math.min(f.W * 0.28, 360) };
  const rowH = f.tall ? 44 : 50;
  const maxLen = Math.max(...ZONES.map((z) => Math.max(0, Math.min(z.s1, PAVE[1]) - Math.max(z.s0, PAVE[0]))));
  ZONES.forEach((z, i) => {
    const y = L.y + i * rowH;
    const len = Math.max(0, Math.min(z.s1, PAVE[1]) - Math.max(z.s0, PAVE[0]));
    bars.push({ x: L.x, y: y + 14, w: (L.w * 0.72 * len) / maxLen, h: 6 });
  });
  ZONES.forEach((z, i) => {
    const k = easeInOut(seg(lt, 5.2 + i * 0.5, 6.4 + i * 0.5));
    if (k <= 0) return;
    const fly = easeInOut(seg(lt, 8.6 + i * 0.35, 9.8 + i * 0.35));
    for (const poly of pavedIn(z)) {
      const pts = poly.map(V.P);
      let mx = 0, my = 0;
      for (const [x, y] of pts) {
        mx += x;
        my += y;
      }
      mx /= pts.length;
      my /= pts.length;
      // once sorted, the share lifts off the drawing into its row
      const b = bars[i];
      const tx = b.x + b.w / 2;
      const ty = b.y + b.h / 2;
      ctx.save();
      ctx.globalAlpha = k * (1 - fly * 0.85);
      ctx.beginPath();
      pts.forEach(([x, y], j) => {
        const px = lerp(x, tx + (x - mx) * 0.15, fly);
        const py = lerp(y, ty + (y - my) * 0.15, fly);
        if (j) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = z.color;
      ctx.globalAlpha *= 0.55;
      ctx.fill();
      ctx.restore();
    }
    // the cut at the zone boundary: the work is split exactly there
    const cutK = env(lt, 5.2 + i * 0.5, 5.6 + i * 0.5, 7.2, 7.8);
    if (cutK > 0 && z.s0 > PAVE[0] && z.s0 < PAVE[1]) {
      const a = V.P(so(z.s0, 14));
      const b = V.P(so(z.s0, -14));
      ctx.save();
      ctx.globalAlpha = cutK;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      stroke(ctx, C.text1, 1.5);
      ctx.restore();
    }
  });

  // the list: one row per zone, the bar is how much work is in it
  if (listA > 0) {
    const size = f.tall ? 13 : clamp(f.W * 0.011, 13, 15);
    ZONES.forEach((z, i) => {
      const k = seg(lt, 8.2 + i * 0.35, 8.9 + i * 0.35);
      const b = bars[i];
      sans(f, z.name, L.x, b.y - 8, { size, weight: 500, alpha: easeOut(k), spacing: 0 });
      sans(f, "Paving", L.x + textWidth(f, z.name, size, "sans", 500) + 10, b.y - 8, { size, weight: 400, color: C.text3, alpha: easeOut(k), spacing: 0 });
      ctx.save();
      ctx.globalAlpha = easeOut(k) * 0.9;
      ctx.fillStyle = "rgba(160, 185, 215, 0.08)";
      ctx.fillRect(b.x, b.y, L.w * 0.72, b.h);
      ctx.fillStyle = z.color;
      const g = easeOut(seg(lt, 9.2 + i * 0.35, 10.2 + i * 0.35));
      ctx.fillRect(b.x, b.y, b.w * g, b.h);
      ctx.restore();
    });
  }
  said(f, "Measure by zone.", "Draw the project zones once. Every quantity lands in the right one.");
}

/* ================================================================== */
/* 3 · VOLUME — survey points become a surface and a volume             */
/* ================================================================== */

export function volumeScene(f: Frame) {
  const lt = f.lt;
  const { ctx } = f;
  clear(f);
  const R = region(f);
  const TR = f.data.terrain;
  const { eg, c } = TR;

  const tilt = easeInOut(seg(lt, 5.6, 8.0));
  const dig = easeInOut(seg(lt, 8.4, 10.8));
  const aside = easeInOut(seg(lt, 10.6, 11.8));
  const base = Math.min(R.w / 150, R.h / 88);
  const proj: Proj = {
    cx: f.tall ? R.cx : R.cx - f.W * 0.18 * aside,
    cy: f.tall ? lerp(R.cy, R.y + R.h * 0.38, aside) + tilt * 10 : R.cy + tilt * R.h * 0.06,
    s: base * (1 + (f.tall ? 0.05 : 0.18) * tilt) * (1 - (f.tall ? 0.12 : 0.08) * aside),
    yaw: -0.42 * tilt - (lt > 5.6 ? 0.035 * (lt - 5.6) : 0),
    pitch: 1.0 * tilt,
    ez: 2.4,
    zc: (TR.zMin + TR.zMax) / 2,
    tx: 60,
    ty: 35,
  };
  const P = project(proj);

  // points appear, sweeping east
  const pk = seg(lt, 1.8, 4.0);
  const tinK = seg(lt, 3.8, 6.0);
  const shade = seg(lt, 6.0, 8.0);
  if (shade > 0 || dig > 0) drawFaces(f, P, proj, shade, dig, null);
  if (tinK > 0 && shade < 1) drawTinWave(f, P, tinK, (1 - shade) * 0.8);
  const ck = seg(lt, 6.8, 8.2) * (1 - dig);
  if (ck > 0) {
    ctx.beginPath();
    for (const [x1, y1, x2, y2, z] of TR.contours) {
      const a = P(x1, y1, z);
      const b = P(x2, y2, z);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    stroke(ctx, `rgba(62, 224, 143, ${0.3 * ck})`, 0.8);
  }
  if (pk > 0 && shade < 1) {
    const r = f.tall ? 1.5 : 1.9;
    ctx.fillStyle = C.text1;
    for (const p of eg.points) {
      const k = clamp((pk - (p.x / 120) * 0.7) / 0.3);
      if (k <= 0) continue;
      const [x, y] = P(p.x, p.y, p.z);
      ctx.globalAlpha = k * (1 - shade);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  // the answer: one number
  const na = seg(lt, 11.2, 12.2);
  if (na > 0) {
    const big = f.tall ? Math.min(34, f.W * 0.09) : clamp(f.W * 0.04, 30, 54);
    const label = f.tall ? 13 : clamp(f.W * 0.011, 13, 15);
    const x = f.tall ? R.cx : f.W * 0.75;
    const y = f.tall ? R.y + R.h * 0.86 : R.cy;
    const align = "center";
    sans(f, "Excavation volume", x, y - big * 0.95, { size: label, weight: 450, color: C.text2, align, alpha: easeOut(na), spacing: 0 });
    const v = c.cut * easeOut(seg(lt, 11.4, 13.2));
    sans(f, `${Math.round(v).toLocaleString("en-US")} m³`, x, y + big * 0.25, { size: big, weight: 600, align, alpha: easeOut(na), color: "#e3c68b" });
    sans(f, "from the survey, surface to surface", x, y + big * 0.25 + label * 2.1, { size: label, weight: 400, color: C.text3, align, alpha: easeOut(seg(lt, 12.4, 13.2)), spacing: 0 });
  }
  said(f, "From survey points to volume.", "Points become a 3D surface, and the excavation volume is worked out for you.");
}

/* ================================================================== */
/* 4 · DRAINAGE — the network is read straight from the drawing         */
/* ================================================================== */

const LIST_PIPES = 4;

export function drainageScene(f: Frame) {
  const lt = f.lt;
  const { ctx } = f;
  clear(f);
  const R = region(f);
  const make = easeInOut(seg(lt, 6.4, 7.6));
  const cam: Cam = f.tall ? { x: 335, y: -24, span: 340 } : { x: 330, y: -24, span: lerp(360, 480, make) };
  const cx = f.tall ? R.cx : lerp(R.cx, f.W * 0.33, make);
  const cy = f.tall ? lerp(R.cy, R.y + R.h * 0.2, make) : R.cy;
  const V = planView(f, cam, cx, cy);
  drawProject(f, V, { grid: 0.7, align: 1, edges: 1, kerbs: 0.4, dim: 0.75 });

  const grow = easeInOut(seg(lt, 1.8, 5.6));
  // which pipe the list is talking about lights up on the drawing
  const rowAt = (i: number) => 7.8 + i * 0.55;
  drawDrainage(f, V, grow, 0, (i) => (i < LIST_PIPES ? env(lt, rowAt(i), rowAt(i) + 0.3, rowAt(i) + 0.9, rowAt(i) + 1.3) * 1.2 : 0));

  veil(f, make, f.tall ? R.y + R.h * 0.44 : f.W * 0.56);

  // water moving through the network, once it is complete
  const flowA = seg(lt, 5.4, 6.2);
  if (flowA > 0) {
    ctx.save();
    ctx.fillStyle = "#bfe9f7";
    PIPES.forEach((p, i) => {
      const a = V.P(p.a);
      const b = V.P(p.b);
      for (let j = 0; j < 2; j++) {
        const t = (lt * 0.45 + j * 0.5 + i * 0.13) % 1;
        ctx.globalAlpha = flowA * Math.sin(t * Math.PI) * 0.9;
        ctx.beginPath();
        ctx.arc(lerp(a[0], b[0], t), lerp(a[1], b[1], t), 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  }

  // the list
  const la = seg(lt, 7.2, 8.0);
  if (la > 0) {
    const size = f.tall ? 13 : clamp(f.W * 0.0112, 13, 15);
    const L = f.tall ? { x: R.x + 6, y: R.y + R.h * 0.5, w: R.w - 12 } : { x: f.W * 0.62, y: R.cy - 86, w: Math.min(f.W * 0.32, 400) };
    const cols = f.tall ? [0, 0.34, 0.66, 1] : [0, 0.34, 0.66, 1];
    const heads = ["From", "To", "Pipe", "Length"];
    heads.forEach((h, j) =>
      sans(f, h, L.x + L.w * cols[j], L.y, { size: size * 0.9, weight: 450, color: C.text3, align: j === 3 ? "right" : "left", alpha: easeOut(la), spacing: 0 }),
    );
    ctx.save();
    ctx.globalAlpha = easeOut(la);
    ctx.fillStyle = C.lineStrong;
    ctx.fillRect(L.x, L.y + size * 0.8, L.w, 1);
    ctx.restore();
    const lh = size * 2.3;
    for (let i = 0; i < LIST_PIPES; i++) {
      const p = PIPES[i];
      const k = easeOut(seg(lt, rowAt(i), rowAt(i) + 0.5));
      if (k <= 0) continue;
      const y = L.y + size * 0.8 + lh * (i + 0.72);
      const hl = env(lt, rowAt(i), rowAt(i) + 0.3, rowAt(i) + 0.9, rowAt(i) + 1.3);
      if (hl > 0) {
        ctx.save();
        ctx.globalAlpha = hl * 0.12;
        ctx.fillStyle = WORK.pipe.color;
        ctx.fillRect(L.x - 8, y - size * 1.25, L.w + 16, lh);
        ctx.restore();
      }
      const mh = (id: string) => (id.startsWith("MHL1-") ? `Manhole ${Number(id.slice(5)) - 11}` : "Outfall");
      const cells = [mh(p.from), mh(p.to), `Ø ${p.dia} mm`, `${Math.round(p.length)} m`];
      cells.forEach((t, j) =>
        sans(f, t, L.x + L.w * cols[j] + (1 - k) * 10, y, { size, weight: j < 2 ? 450 : 400, color: j < 2 ? C.text1 : C.text2, align: j === 3 ? "right" : "left", alpha: k, spacing: 0 }),
      );
    }
    const more = seg(lt, rowAt(LIST_PIPES) - 0.2, rowAt(LIST_PIPES) + 0.4);
    if (more > 0) sans(f, `and ${PIPES.length - LIST_PIPES} more, with depths and levels`, L.x, L.y + size * 0.8 + lh * (LIST_PIPES + 0.72), { size: size * 0.92, weight: 400, color: C.text3, alpha: easeOut(more), spacing: 0 });
  }
  said(f, "Read the drainage network.", "Pipes and manholes are picked up straight from the drawing. No retyping.");
}

/* ================================================================== */
/* 5 · PROGRESS — last week vs this week                                */
/* ================================================================== */

const ROAD_LEVEL = -Math.atan2(PROGRESS.frame.h[1], PROGRESS.frame.h[0]);

function progressDrawing(f: Frame, V: View, which: "prev" | "curr", tone: string, a: number) {
  const { ctx } = f;
  const { P } = V;
  ctx.save();
  ctx.globalAlpha *= a;
  for (const l of PROGRESS.context) {
    pathPoly(ctx, l, P, false);
    stroke(ctx, "rgba(160, 185, 215, 0.22)", 1);
  }
  const bay = which === "prev" ? PROGRESS.prevBay : PROGRESS.currBay;
  pathPoly(ctx, bay, P);
  ctx.fillStyle = "rgba(232, 236, 240, 0.06)";
  ctx.fill();
  pathPoly(ctx, bay, P);
  stroke(ctx, tone, 1.3);
  for (const k of which === "prev" ? [PROGRESS.kerbKept, PROGRESS.kerbRemoved] : [PROGRESS.kerbKept, PROGRESS.kerbAdded]) {
    pathPoly(ctx, k, P, false);
    stroke(ctx, tone, 2);
  }
  const r = clamp(V.s * 0.8, 4, 8);
  manhole(ctx, P(PROGRESS.mhKept), r, tone);
  if (which === "curr") manhole(ctx, P(PROGRESS.mhAdded), r, tone);
  ctx.restore();
}

export function progressScene(f: Frame) {
  const lt = f.lt;
  const { ctx } = f;
  clear(f);
  const R = region(f);
  const center = pf(2, 8);
  const merge = easeInOut(seg(lt, 4.4, 5.8));
  const open = easeOut(seg(lt, 1.6, 2.6));
  const gap = 14;
  const halves = [0, 1].map((i) =>
    f.tall ? { x: R.x, y: R.y + i * ((R.h - gap) / 2 + gap), w: R.w, h: (R.h - gap) / 2 } : { x: R.x + i * ((R.w - gap) / 2 + gap), y: R.y, w: (R.w - gap) / 2, h: R.h },
  );
  const full = { x: R.x, y: R.y, w: R.w, h: R.h };
  const rects = halves.map((h) => ({ x: lerp(h.x, full.x, merge), y: lerp(h.y, full.y, merge), w: lerp(h.w, full.w, merge), h: lerp(h.h, full.h, merge) }));
  const span = f.tall ? 66 : 96;
  const viewFor = (r: { x: number; y: number; w: number; h: number }) => {
    const s = Math.min(r.w, f.tall ? r.w : r.w * 1.6) / span;
    return planView(f, { x: center[0], y: center[1], span: f.W / s, r: ROAD_LEVEL }, r.x + r.w / 2, r.y + r.h / 2);
  };
  const cls = seg(lt, 6.0, 7.6);
  ["prev", "curr"].forEach((which, i) => {
    const r = rects[i];
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.globalAlpha = open;
    ctx.fillStyle = "rgba(12, 15, 19, 0.9)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const V = viewFor(r);
    // overlaid, last week sits underneath in a cool tone, then steps back
    const tone = which === "prev" ? (merge > 0.5 ? "rgba(120, 150, 185, 0.9)" : "rgba(232, 236, 240, 0.85)") : "rgba(232, 236, 240, 0.9)";
    const a = which === "prev" ? 1 - cls * (merge > 0.5 ? 1 : 0) : 1 - cls * 0.5;
    progressDrawing(f, V, which as "prev" | "curr", tone, a);
    ctx.restore();
    const la = open * (1 - merge);
    if (la > 0) {
      ctx.save();
      ctx.globalAlpha = la;
      ctx.strokeStyle = C.line;
      ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w) - 1, Math.round(r.h) - 1);
      ctx.restore();
      sans(f, i === 0 ? "Last week" : "This week", r.x + 16, r.y + 28, { size: f.tall ? 13 : 15, weight: 500, color: i === 0 ? C.text2 : C.text1, alpha: la, spacing: 0 });
    }
  });

  // what changed: the new part of the lay-by, the kerb that went, the new manhole
  const V = viewFor(rects[1]);
  if (cls > 0) {
    const wipe = easeInOut(seg(lt, 6.0, 7.2));
    const w = [pf(0, 12), pf(5 * wipe, 12), pf(5 * wipe, 22), pf(0, 22)];
    ctx.save();
    pathPoly(ctx, w, V.P);
    hatch(f, C.accent, 1, 4, Math.PI / 4, 0.25);
    pathPoly(ctx, w, V.P);
    stroke(ctx, C.accent, 1.4);
    const rk = seg(lt, 6.8, 7.6);
    ctx.globalAlpha = rk;
    pathPoly(ctx, PROGRESS.kerbRemoved, V.P, false);
    stroke(ctx, C.red, 2.2, [6, 5]);
    const ak = seg(lt, 7.2, 8.0);
    ctx.globalAlpha = ak;
    pathPoly(ctx, PROGRESS.kerbAdded, V.P, false);
    stroke(ctx, C.accent, 2.4);
    manhole(ctx, V.P(PROGRESS.mhAdded), clamp(V.s * 0.8, 4, 8), C.accent);
    ctx.restore();
    const label = (text: string, p: XY, col: string, a: number) => {
      const [x, y] = V.P(p);
      sans(f, text, x, y, { size: f.tall ? 12.5 : 14, weight: 500, color: col, align: "center", alpha: a, spacing: 0 });
    };
    label("New work", pf(2.5, 8.5), C.accent, seg(lt, 7.0, 7.8));
    label("Removed", pf(15, 15.5), "#f07f82", seg(lt, 7.4, 8.2));
  }
  const lg = seg(lt, 8.4, 9.2);
  if (lg > 0) {
    const y = R.y + R.h - (f.tall ? 10 : 18);
    const t1 = "Counted as progress";
    const t2 = "Taken off";
    const size = f.tall ? 12.5 : clamp(f.W * 0.0105, 12.5, 15);
    const w1 = textWidth(f, t1, size, "sans", 450) + size * 1.4;
    const w2 = textWidth(f, t2, size, "sans", 450) + size * 1.4;
    const x0 = R.cx - (w1 + w2 + 28) / 2;
    chip(f, C.accent, t1, x0, y, easeOut(lg));
    chip(f, C.red, t2, x0 + w1 + 28, y, easeOut(lg));
  }
  said(f, "See what changed this week.", "Two drawings are compared, and only the new work is counted.");
}

/* ================================================================== */
/* 6 · REPORT — everything lands in one report                          */
/* ================================================================== */

export function reportScene(f: Frame) {
  const lt = f.lt;
  const { ctx } = f;
  clear(f);
  const R = region(f);
  const w = f.tall ? R.w : Math.min(R.w * 0.62, 640);
  const rows = 4;
  const size = f.tall ? 13 : clamp(f.W * 0.0115, 13, 15.5);
  const lh = f.tall ? 56 : 64;
  const h = size * 5 + lh * rows + size * 1.5;
  const x = R.cx - w / 2;
  const y = R.cy - h / 2 + (1 - easeOut(seg(lt, 1.4, 2.4))) * 16;
  const a = easeOut(seg(lt, 1.4, 2.4));
  if (a > 0) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "#0e1217";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = C.lineStrong;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    sans(f, "Weekly report", x + size * 1.6, y + size * 2.6, { size: size * 1.2, weight: 600, alpha: a, spacing: 0 });
    mono(f, "EXCEL", x + w - size * 1.6, y + size * 2.5, { align: "right", alpha: a, color: C.text3 });
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = C.line;
    ctx.fillRect(x + size * 1.6, y + size * 3.9, w - size * 3.2, 1);
    ctx.restore();

    const items: { color: string; name: string; note: string; draw: (bx: number, by: number, bw: number, k: number) => void }[] = [
      {
        color: "#3ee08f",
        name: "Paving by zone",
        note: "A · B · C",
        draw: (bx, by, bw, k) =>
          ZONES.forEach((z, i) => {
            const len = Math.max(0, Math.min(z.s1, PAVE[1]) - Math.max(z.s0, PAVE[0]));
            ctx.fillStyle = z.color;
            const seg3 = (bw - 8) / 3;
            ctx.fillRect(bx + i * (seg3 + 4), by, seg3 * (len / 150) * k, 5);
          }),
      },
      {
        color: "#d9b56f",
        name: "Excavation volume",
        note: "Basin",
        draw: (bx, by, bw, k) => {
          ctx.fillStyle = "#d9b56f";
          ctx.fillRect(bx, by, bw * 0.78 * k, 5);
        },
      },
      {
        color: WORK.pipe.color,
        name: "Drainage network",
        note: `${PIPES.length} pipes`,
        draw: (bx, by, bw, k) => {
          ctx.strokeStyle = WORK.pipe.color;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          const n = PIPES.length;
          for (let i = 0; i <= n; i++) {
            const px = bx + (bw * 0.9 * i) / n;
            if (i / n > k) break;
            if (i) ctx.lineTo(px, by + 2.5);
            else ctx.moveTo(px, by + 2.5);
          }
          ctx.stroke();
          for (let i = 0; i <= n; i++) {
            if (i / n > k) break;
            ctx.beginPath();
            ctx.arc(bx + (bw * 0.9 * i) / n, by + 2.5, 3, 0, Math.PI * 2);
            ctx.fillStyle = "#0e1217";
            ctx.fill();
            ctx.stroke();
          }
        },
      },
      {
        color: C.accent,
        name: "New work this week",
        note: "Lay-by",
        draw: (bx, by, bw, k) => {
          ctx.fillStyle = "rgba(160, 185, 215, 0.25)";
          ctx.fillRect(bx, by, bw * 0.5 * Math.min(1, k * 1.5), 5);
          ctx.fillStyle = C.accent;
          ctx.fillRect(bx + bw * 0.5, by, bw * 0.25 * clamp(k * 1.5 - 0.5), 5);
        },
      },
    ];
    items.forEach((it, i) => {
      const k = easeOut(seg(lt, 2.6 + i * 0.7, 3.4 + i * 0.7));
      if (k <= 0) return;
      const ry = y + size * 5.2 + i * lh;
      chip(f, it.color, it.name, x + size * 1.6 + (1 - k) * 10, ry + size * 0.4, k);
      sans(f, it.note, x + w - size * 1.6, ry + size * 0.4, { size: size * 0.92, weight: 400, color: C.text3, align: "right", alpha: k, spacing: 0 });
      ctx.save();
      ctx.globalAlpha = k;
      it.draw(x + size * 2.7, ry + size * 1.5, w - size * 4.3, easeOut(seg(lt, 3.0 + i * 0.7, 4.4 + i * 0.7)));
      ctx.restore();
    });
  }
  said(f, "Everything, in one report.", "Organised the same way every week, and ready to share.");
}

/* ================================================================== */
/* 7 · END                                                              */
/* ================================================================== */

export function endScene(f: Frame) {
  const lt = f.lt;
  const { ctx } = f;
  clear(f);
  const cam: Cam = f.tall ? { x: 330, y: -10, span: 520 } : { x: 420, y: -10, span: 1000 + lt * 10 };
  const V = view(f, cam, 0, f.tall ? f.H * 0.34 : f.H * 0.36);
  // the road draws itself one last time, faintly, under everything
  ctx.save();
  ctx.globalAlpha = 0.35;
  drawProject(f, V, { grid: 0.5, align: 1, edges: 1, kerbs: 0.6, drainage: 1, dim: 0.5 });
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 1 - seg(lt, 2.4, 3.2);
  partialLine(
    ctx,
    soLine(
      [
        [0, 0],
        [900, 0],
      ],
      8,
    ),
    V.P,
    easeInOut(seg(lt, 0.4, 2.6)),
  );
  ctx.restore();
  const size = f.tall ? Math.min(27, f.W * 0.072) : clamp(f.W * 0.038, 28, 50);
  const cy = f.H * (f.tall ? 0.34 : 0.36);
  const a = seg(lt, 1.0, 2.0);
  const lines = f.tall ? ["Civil engineering", "workflows, automated."] : ["Civil engineering workflows, automated."];
  lines.forEach((l, i) => sans(f, l, f.W / 2, cy + i * size * 1.1 + (1 - easeOut(a)) * 10, { size, weight: 600, align: "center", alpha: easeOut(a), spacing: -size * 0.03 }));
  const b = seg(lt, 2.0, 3.0);
  const sub = f.tall ? 13.5 : clamp(f.W * 0.0125, 14, 17);
  sans(f, "Alp Yesilkaya  ·  Civil Engineer  ·  Engineering tools + AI", f.W / 2, cy + (lines.length - 1) * size * 1.1 + size * 1.25, {
    size: f.tall ? 12 : sub,
    weight: 400,
    color: C.text2,
    align: "center",
    alpha: easeOut(b),
    spacing: 0,
  });
}
