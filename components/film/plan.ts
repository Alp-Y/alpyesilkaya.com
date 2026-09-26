/**
 * THE PROJECT PLAN — the one drawing most scenes look at. Every layer has a
 * 0 → 1 level so a scene can build it, dim it or colour it by work type.
 */

import {
  AREAS,
  AREA_HALF,
  ASPHALT_SO,
  BASIN_ORIGIN,
  DEMOLITION_SO,
  INLETS,
  KERB_SO,
  LIGHTS_SO,
  PIPES,
  PROGRESS,
  STRUCTURES,
  WORK,
  alignAt,
  chainage,
  so,
  soLine,
  soPoly,
  type XY,
} from "@/lib/film/project";
import { C, clamp, easeOut, grid, hatch, manhole, mono, partialLine, pathPoly, seg, stroke, tag, type Cam, type Frame, type View } from "./draw";

/* ---------- camera shots (world metres) ---------- */

type Shot = { wide: Cam; tall: Cam };
export const SHOTS = {
  full: { wide: { x: 445, y: -6, span: 1000 }, tall: { x: 360, y: -24, span: 560 } },
  areas: { wide: { x: 300, y: 0, span: 440 }, tall: { x: 300, y: 0, span: 190 } },
  basin: { wide: { x: 480, y: -91, span: 200 }, tall: { x: 480, y: -91, span: 150 } },
  drain: { wide: { x: 330, y: -22, span: 380 }, tall: { x: 250, y: -20, span: 150 } },
  progress: { wide: { x: 0, y: 0, span: 120 }, tall: { x: 0, y: 0, span: 80 } },
  trace: { wide: { x: 290, y: 4, span: 300 }, tall: { x: 225, y: 4, span: 125 } },
} satisfies Record<string, Shot>;
export const shot = (f: Frame, s: Shot) => (f.tall ? s.tall : s.wide);

/* ---------- static geometry ---------- */

const CL = soLine(
  [
    [0, 0],
    [900, 0],
  ],
  6,
);
const EDGE_O = [11.5, 1.5, -1.5, -11.5];
const ASPHALT = ASPHALT_SO.map((p) => soPoly(p, 6));
const KERBS = KERB_SO.map((l) => soLine(l, 6));
const DEMOLITION = soPoly(DEMOLITION_SO, 4);
const LIGHTS = LIGHTS_SO.map(([s, o]) => so(s, o));
/** basin base corners (local metres), as in lib/film/terrain.ts */
const BASIN_BASE: XY[] = [
  [34, 22],
  [86, 48],
];

export type Layers = {
  grid?: number;
  /** centreline draw-on (0 → 1 of its length) */
  align?: number;
  /** the bright head while the line is drawn */
  head?: number;
  stations?: number;
  /** carriageway edges: offset out from the centreline */
  edges?: number;
  areas?: number;
  areaLabels?: number;
  /** highlight one area's boundary */
  focusArea?: string | null;
  focus?: number;
  asphalt?: number;
  kerbs?: number;
  demolition?: number;
  lights?: number;
  drainage?: number;
  drainLabels?: number;
  basin?: number;
  basinPoints?: number;
  basinTin?: number;
  /** 0 = neutral CAD grey, 1 = work-type colours with hatches */
  typed?: number;
  /** the lay-by as it stands in the current progress drawing, its new part in green */
  progress?: number;
  /** the basin's excavated outline, tinted as cut */
  basinCut?: number;
  dim?: number;
};

const mix = (a: string, b: string, k: number) => (k > 0.5 ? b : a);

/** Stagger: item i of n reaches 1 in its own window within 0…1 of k. */
export const stag = (k: number, i: number, n: number, spread = 0.6) => clamp((k - (i / Math.max(1, n - 1)) * spread) / (1 - spread));

export function drawProject(f: Frame, V: View, L: Layers) {
  const { ctx } = f;
  const { P } = V;
  const dim = L.dim ?? 1;
  const typed = L.typed ?? 0;
  ctx.save();
  ctx.globalAlpha = dim;
  grid(f, V, L.grid ?? 1);

  // project areas: dashed boundaries, built one after another
  const ak = L.areas ?? 0;
  if (ak > 0) {
    AREAS.forEach((a, i) => {
      const k = stag(ak, i, AREAS.length, 0.7);
      if (k <= 0) return;
      const focus = L.focusArea === a.id ? (L.focus ?? 0) : 0;
      ctx.save();
      if (focus > 0) {
        pathPoly(ctx, a.poly, P);
        ctx.fillStyle = `rgba(62, 224, 143, ${0.06 * focus})`;
        ctx.fill();
      }
      ctx.globalAlpha *= 0.4 + 0.6 * k;
      const ring = [...a.poly, a.poly[0]];
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = focus > 0 ? `rgba(62, 224, 143, ${0.35 + 0.55 * focus})` : "rgba(160, 185, 215, 0.34)";
      ctx.lineWidth = 1;
      partialLine(ctx, ring, P, easeOut(k));
      ctx.setLineDash([]);
      ctx.restore();
    });
  }

  // work geometry
  const aa = L.asphalt ?? 0;
  if (aa > 0) {
    for (const p of ASPHALT) {
      ctx.save();
      ctx.globalAlpha *= aa;
      pathPoly(ctx, p, P);
      if (typed > 0) hatch(f, WORK.asphalt.color, typed * 0.6, 6, Math.PI / 4, 0.07);
      else {
        ctx.fillStyle = "rgba(170, 185, 200, 0.05)";
        ctx.fill();
      }
      ctx.restore();
    }
  }
  const da = L.demolition ?? 0;
  if (da > 0) {
    ctx.save();
    ctx.globalAlpha *= da;
    pathPoly(ctx, DEMOLITION, P);
    if (typed > 0) hatch(f, WORK.demolition.color, typed * 0.7, 5, -Math.PI / 4, 0.08);
    pathPoly(ctx, DEMOLITION, P);
    stroke(ctx, mix("rgba(196, 138, 147, 0.55)", WORK.demolition.color, typed), 1, [4, 3]);
    ctx.restore();
  }

  // carriageway edges grow out of the centreline
  const ek = L.edges ?? 0;
  if (ek > 0) {
    const k = easeOut(ek);
    for (const o of EDGE_O) {
      const line = soLine(
        [
          [0, o * k],
          [900, o * k],
        ],
        8,
      );
      pathPoly(ctx, line, P, false);
      stroke(ctx, `rgba(170, 182, 196, ${0.2 + 0.35 * k})`, 1);
    }
    // back of verge and the construction boundary
    for (const o of [16, -16]) {
      pathPoly(ctx, soLine([[0, o * k], [900, o * k]], 10), P, false);
      stroke(ctx, `rgba(160, 185, 215, ${0.14 * k})`, 1, [2, 4]);
    }
  }
  const ka = L.kerbs ?? 0;
  if (ka > 0) {
    ctx.save();
    ctx.globalAlpha *= ka;
    for (const l of KERBS) {
      pathPoly(ctx, l, P, false);
      stroke(ctx, typed > 0 ? WORK.kerb.color : "rgba(213, 215, 158, 0.55)", 1.6);
    }
    ctx.restore();
  }

  // centreline: a bright line first, then a dash-dot alignment with chainage
  const al = L.align ?? 0;
  if (al > 0) {
    ctx.save();
    const settled = 1 - (L.head ?? 0);
    ctx.strokeStyle = settled > 0.5 ? "rgba(229, 72, 77, 0.75)" : C.accent;
    ctx.lineWidth = settled > 0.5 ? 1.1 : 1.6;
    if (settled > 0.5) ctx.setLineDash([18, 4, 3, 4]);
    const head = partialLine(ctx, CL, P, al);
    ctx.setLineDash([]);
    if (head && (L.head ?? 0) > 0) {
      const g = ctx.createRadialGradient(head[0], head[1], 0, head[0], head[1], 26);
      g.addColorStop(0, `rgba(62, 224, 143, ${0.55 * (L.head ?? 0)})`);
      g.addColorStop(1, "rgba(62, 224, 143, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(head[0] - 26, head[1] - 26, 52, 52);
      ctx.fillStyle = C.text1;
      ctx.fillRect(head[0] - 1.5, head[1] - 1.5, 3, 3);
    }
    ctx.restore();
  }
  const st = L.stations ?? 0;
  if (st > 0) {
    ctx.save();
    ctx.globalAlpha *= st;
    ctx.beginPath();
    for (let s = 0; s <= 900; s += 20) {
      const big = s % 100 === 0;
      const a = P(so(s, big ? 4 : 2));
      const b = P(so(s, big ? -4 : -2));
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    stroke(ctx, "rgba(229, 72, 77, 0.6)", 1);
    const every = V.s * 100 < 70 ? 300 : V.s * 100 < 150 ? 200 : 100;
    for (let s = 0; s <= 900; s += every) {
      const p = P(so(s, -AREA_HALF - 6));
      mono(f, chainage(s), p[0], p[1] + 4, { align: "center", color: C.text3, size: Math.max(9.5, 9.5 * f.u) });
    }
    ctx.restore();
  }

  // storm drainage
  const dr = L.drainage ?? 0;
  if (dr > 0) drawDrainage(f, V, dr, L.drainLabels ?? 0);

  const la = L.lights ?? 0;
  if (la > 0) {
    ctx.save();
    ctx.globalAlpha *= la;
    const r = clamp(V.s * 1.2, 2, 4);
    for (const l of LIGHTS) {
      const [x, y] = P(l);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      stroke(ctx, typed > 0 ? WORK.light.color : "rgba(185, 163, 224, 0.6)", 1);
    }
    ctx.restore();
  }

  const pr = L.progress ?? 0;
  if (pr > 0) {
    ctx.save();
    ctx.globalAlpha *= pr;
    pathPoly(ctx, PROGRESS.prevBay, P);
    hatch(f, WORK.asphalt.color, 0.5, 5, Math.PI / 4, 0.06);
    pathPoly(ctx, PROGRESS.addedBay, P);
    hatch(f, C.accent, 1, 4, Math.PI / 4, 0.18);
    pathPoly(ctx, PROGRESS.currBay, P);
    stroke(ctx, C.accent, 1);
    ctx.restore();
  }
  const bc = L.basinCut ?? 0;
  if (bc > 0) {
    ctx.save();
    ctx.globalAlpha *= bc;
    const toe = [BASIN_BASE[0], [BASIN_BASE[1][0], BASIN_BASE[0][1]], BASIN_BASE[1], [BASIN_BASE[0][0], BASIN_BASE[1][1]]] as XY[];
    const top = toe.map(([x, y]) => [x + (x < 60 ? -6 : 6), y + (y < 35 ? -6 : 6)] as XY);
    const w = (p: XY) => P([BASIN_ORIGIN[0] + p[0], BASIN_ORIGIN[1] + p[1]]);
    pathPoly(ctx, top, w);
    hatch(f, C.cut, 0.8, 5, -Math.PI / 4, 0.12);
    pathPoly(ctx, top, w);
    stroke(ctx, C.cut, 1);
    pathPoly(ctx, toe, w);
    stroke(ctx, "rgba(207, 174, 106, 0.6)", 1, [3, 3]);
    ctx.restore();
  }

  // the basin survey window
  const ba = L.basin ?? 0;
  if (ba > 0) drawBasin(f, V, ba, L.basinPoints ?? 0, L.basinTin ?? 0);

  // area labels
  const lab = L.areaLabels ?? 0;
  if (lab > 0 && V.s * 150 > 110) {
    AREAS.forEach((a, i) => {
      const k = stag(lab, i, AREAS.length, 0.5);
      if (k <= 0) return;
      const p = P(a.label);
      const focus = L.focusArea === a.id ? (L.focus ?? 0) : 0;
      if (p[0] < -60 || p[0] > f.W + 20) return;
      tag(f, a.id, p[0], p[1], { alpha: easeOut(k), color: focus > 0.5 ? C.accent : C.text2, border: focus > 0.5 ? "rgba(62,224,143,0.6)" : C.lineStrong });
    });
  }
  ctx.restore();
}

/** Pipes, manholes, inlets; `k` grows the network from upstream to the outfall. */
export function drawDrainage(f: Frame, V: View, k: number, labels = 0, emphasis?: (i: number) => number) {
  const { ctx } = f;
  const { P } = V;
  const n = PIPES.length;
  const r = clamp(V.s * 1.6, 3, 7);
  PIPES.forEach((p, i) => {
    const ki = stag(k, i, n, 0.8);
    if (ki <= 0) return;
    const pk = seg(ki, 0.3, 1);
    const em = emphasis?.(i) ?? 0;
    const w = clamp(V.s * (p.dia / 1000) * 1.2, 1.2, 3.2) + em;
    ctx.strokeStyle = em > 0 ? C.text1 : WORK.pipe.color;
    ctx.lineWidth = w;
    partialLine(ctx, [p.a, p.b], P, easeOut(pk));
    if (pk > 0.6) {
      // flow arrow at mid-pipe
      const a = P(p.a);
      const b = P(p.b);
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const s = clamp(V.s * 1.4, 3, 5);
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s, -s * 0.7);
      ctx.lineTo(-s, s * 0.7);
      ctx.closePath();
      ctx.fillStyle = WORK.pipe.color;
      ctx.globalAlpha *= seg(pk, 0.6, 1);
      ctx.fill();
      ctx.restore();
      if (labels > 0 && V.s > 1.1) {
        const off = 13 + r;
        const nx = -Math.sin(ang);
        const ny = Math.cos(ang);
        mono(f, `Ø${p.dia} ${p.mat}`, mx + nx * off, my + ny * off + 3, { align: "center", color: C.text2, alpha: labels * seg(pk, 0.7, 1), size: Math.max(9.5, 9.5 * f.u), spacing: 0.4 });
      }
    }
    const s0 = STRUCTURES[i];
    if (ki > 0) {
      const mk = seg(ki, 0, 0.3);
      manhole(ctx, P(s0.p), r * easeOut(mk), em > 0 ? C.text1 : WORK.manhole.color);
    }
  });
  // outfall headwall
  if (k > 0.97) {
    const [x, y] = P(PIPES[n - 1].b);
    ctx.fillStyle = WORK.pipe.color;
    ctx.fillRect(x - r, y - 1.5, r * 2, 3);
  }
  // gully inlets and their laterals
  INLETS.forEach((g, i) => {
    const ki = seg(k, 0.2 + i * 0.2, 0.45 + i * 0.2);
    if (ki <= 0) return;
    ctx.save();
    ctx.globalAlpha *= ki;
    ctx.strokeStyle = "rgba(99, 182, 214, 0.6)";
    ctx.lineWidth = 1;
    partialLine(ctx, [g.p, g.to], P, ki);
    const [x, y] = P(g.p);
    const s = clamp(V.s * 1.1, 2.5, 5);
    ctx.strokeStyle = WORK.pipe.color;
    ctx.strokeRect(x - s, y - s * 0.7, s * 2, s * 1.4);
    ctx.restore();
  });
}

/** The basin: survey window, points and TIN in plan (world coordinates). */
export function drawBasin(f: Frame, V: View, a: number, points: number, tin: number) {
  const { ctx } = f;
  const { eg, c } = f.data.terrain;
  const w2 = (x: number, y: number): XY => V.P([BASIN_ORIGIN[0] + x, BASIN_ORIGIN[1] + y]);
  ctx.save();
  ctx.globalAlpha *= a;
  // outline of the excavation (top of batter): the composite vertices where cut starts
  pathPoly(ctx, [[0, 0], [120, 0], [120, 70], [0, 70]], ([x, y]) => w2(x, y));
  stroke(ctx, "rgba(160, 185, 215, 0.3)", 1, [3, 3]);
  if (tin > 0) {
    ctx.beginPath();
    for (const [i, j] of eg.edges()) {
      const p = w2(eg.points[i].x, eg.points[i].y);
      const q = w2(eg.points[j].x, eg.points[j].y);
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
    }
    stroke(ctx, `rgba(160, 185, 215, ${0.28 * tin})`, 0.8);
  }
  if (points > 0) {
    ctx.fillStyle = C.text1;
    const r = clamp(V.s * 0.35, 1, 2);
    eg.points.forEach((p, i) => {
      const k = stag(points, i, eg.points.length, 0.8);
      if (k <= 0) return;
      const [x, y] = w2(p.x, p.y);
      ctx.globalAlpha = a * k;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
  }
  ctx.restore();
  void c;
}

/** Where a basin-local point sits on screen under a plan view. */
export const basinToWorld = (x: number, y: number): XY => [BASIN_ORIGIN[0] + x, BASIN_ORIGIN[1] + y];

export { alignAt };
