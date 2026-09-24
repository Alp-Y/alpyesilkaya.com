/**
 * SURFACE COMPARISON — existing ground vs excavated surface → quantities.
 * ------------------------------------------------------------------
 *   EXISTING GROUND   a TIN from a survey, or a single level
 *   EXCAVATED SURFACE a TIN from the as-dug (or design) survey
 *
 *   composite TIN  = both surveys' points, triangulated together, with
 *                    both levels known at every vertex
 *   depth d(x,y)   = existing − excavated   (linear across each triangle)
 *   cut volume     = ∫ max(0, d) dA         (exact per triangle: each one
 *   fill volume    = ∫ max(0, −d) dA         is clipped at d = 0 first)
 *
 * The same clipping gives the area breakdown (strips along the principal
 * axis of the excavation, chainage A01, A02…) and the depth distribution
 * (bands of depth), so every table in the report adds up to the total.
 *
 * Nothing here knows about the page: it is plain data in, data out, so the
 * calculation can grow into a standalone tool without touching the UI.
 */

import { delaunay, type XY } from "./delaunay";
import { surfaceFrom, triangleLocator, type P3, type Surface, type Tri } from "./tin";

export type Ground = { kind: "level"; z: number } | { kind: "tin"; surface: Surface };

/** A vertex of the composite TIN: plan position + both levels. */
export type CVertex = { x: number; y: number; eg: number; ex: number };

export type Axis = {
  /** Local plan point at chainage 0 (on the axis). */
  origin: XY;
  /** Unit vector along the excavation (chainage direction). */
  dir: XY;
  /** Unit normal (offset direction, + to the right looking along dir). */
  normal: XY;
  /** Chainage and offset range covered by the composite surface. */
  sMin: number;
  sMax: number;
  oMin: number;
  oMax: number;
  /** Chainage range of the cut itself. */
  cutS: [number, number];
};

export type Zone = { id: string; from: number; to: number; cut: number; fill: number; area: number };
export type DepthBand = { from: number; to: number | null; area: number; cut: number };

export type Comparison = {
  vertices: CVertex[];
  tris: Tri[];
  /** plan area where both surfaces exist */
  comparedArea: number;
  cut: number;
  fill: number;
  cutArea: number;
  fillArea: number;
  /** cut / cutArea */
  averageDepth: number;
  maxDepth: number;
  /** excavated surface levels inside the compared area */
  exZMin: number;
  exZMax: number;
  egZMin: number;
  egZMax: number;
  axis: Axis;
  zones: Zone[];
  bands: DepthBand[];
};

type V = { x: number; y: number; d: number };

/** Depth below which two surfaces count as the same ground (1 mm). */
const AREA_EPS = 0.001;

/* ================================================================== */

export function compare(excavated: Surface, ground: Ground): Comparison {
  const { vertices, tris } = composite(excavated, ground);

  // ---- totals ----
  let cut = 0, fill = 0, cutArea = 0, fillArea = 0, comparedArea = 0, maxDepth = 0;
  let exZMin = Infinity, exZMax = -Infinity, egZMin = Infinity, egZMax = -Infinity;
  for (const v of vertices) {
    maxDepth = Math.max(maxDepth, v.eg - v.ex);
    exZMin = Math.min(exZMin, v.ex);
    exZMax = Math.max(exZMax, v.ex);
    egZMin = Math.min(egZMin, v.eg);
    egZMax = Math.max(egZMax, v.eg);
  }
  const polys = tris.map(([a, b, c]) => [a, b, c].map((i) => ({ x: vertices[i].x, y: vertices[i].y, d: vertices[i].eg - vertices[i].ex })) as V[]);
  for (const p of polys) {
    comparedArea += area(p);
    cut += integrate(clip(p, (v) => v.d, 0), 1);
    fill += integrate(clip(p, (v) => -v.d, 0), -1);
    // plan areas count only where the surfaces actually differ (> 1 mm)
    cutArea += area(clip(p, (v) => v.d, AREA_EPS));
    fillArea += area(clip(p, (v) => -v.d, AREA_EPS));
  }

  const axis = principalAxis(vertices);

  // ---- area breakdown: equal chainage strips over the length of the cut ----
  const [c0, c1] = axis.cutS;
  const length = Math.max(1e-6, c1 - c0);
  const n = Math.min(5, Math.max(3, Math.round(length / 35)));
  const zones: Zone[] = [];
  const S = (v: V) => (v.x - axis.origin[0]) * axis.dir[0] + (v.y - axis.origin[1]) * axis.dir[1];
  for (let k = 0; k < n; k++) {
    const from = c0 + (length * k) / n;
    const to = c0 + (length * (k + 1)) / n;
    let zc = 0, zf = 0, za = 0;
    for (const p of polys) {
      let q = clip(p, S, k === 0 ? -Infinity : from);
      q = clip(q, (v) => -S(v), k === n - 1 ? -Infinity : -to);
      if (q.length < 3) continue;
      zc += integrate(clip(q, (v) => v.d, 0), 1);
      zf += integrate(clip(q, (v) => -v.d, 0), -1);
      za += area(clip(q, (v) => v.d, AREA_EPS));
    }
    zones.push({ id: `A${String(k + 1).padStart(2, "0")}`, from, to, cut: zc, fill: zf, area: za });
  }

  // ---- depth distribution ----
  const step = maxDepth <= 2.5 ? 0.5 : maxDepth <= 6 ? 1 : 2;
  const bands: DepthBand[] = [];
  for (let d0 = 0; d0 < maxDepth - 1e-9; d0 += step) {
    const last = d0 + step >= maxDepth - 1e-9;
    let ba = 0, bc = 0;
    for (const p of polys) {
      let q = clip(p, (v) => v.d, d0 === 0 ? AREA_EPS : d0);
      if (!last) q = clip(q, (v) => -v.d, -(d0 + step));
      if (q.length < 3) continue;
      ba += area(q);
      bc += integrate(q, 1);
    }
    bands.push({ from: d0, to: last ? null : d0 + step, area: ba, cut: bc });
  }

  return {
    vertices,
    tris,
    comparedArea,
    cut,
    fill,
    cutArea,
    fillArea,
    averageDepth: cutArea > 0 ? cut / cutArea : 0,
    maxDepth: Math.max(0, maxDepth),
    exZMin,
    exZMax,
    egZMin,
    egZMax,
    axis,
    zones,
    bands,
  };
}

/* ---------- composite TIN ---------- */

function composite(excavated: Surface, ground: Ground): { vertices: CVertex[]; tris: Tri[] } {
  if (ground.kind === "level") {
    // Same triangles as the excavated surface; the ground is flat.
    return { vertices: excavated.points.map((p) => ({ x: p.x, y: p.y, eg: ground.z, ex: p.z })), tris: excavated.tris };
  }
  const g = ground.surface;
  // Both surveys' points, where the other surface exists too
  const vertices: CVertex[] = [];
  const seen = new Set<string>();
  const add = (x: number, y: number) => {
    const k = `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
    if (seen.has(k)) return;
    const ex = excavated.at(x, y);
    const eg = g.at(x, y);
    if (ex === null || eg === null) return;
    seen.add(k);
    vertices.push({ x, y, eg, ex });
  };
  for (const p of excavated.points) add(p.x, p.y);
  for (const p of g.points) add(p.x, p.y);
  let tris = delaunay(vertices.map((v) => [v.x, v.y] as XY));
  // Keep triangles that lie on both surfaces (the hull of the merged points
  // can bridge a concave edge of either survey)
  tris = tris.filter(([a, b, c]) => {
    const x = (vertices[a].x + vertices[b].x + vertices[c].x) / 3;
    const y = (vertices[a].y + vertices[b].y + vertices[c].y) / 3;
    return excavated.at(x, y) !== null && g.at(x, y) !== null;
  });
  return { vertices, tris };
}

/** The composite as two ordinary surfaces (same triangles), for sampling. */
export function compositeSurfaces(c: Comparison) {
  const eg: P3[] = c.vertices.map((v) => ({ x: v.x, y: v.y, z: v.eg }));
  const ex: P3[] = c.vertices.map((v) => ({ x: v.x, y: v.y, z: v.ex }));
  return { existing: surfaceFrom("Existing ground", eg, c.tris), excavated: surfaceFrom("Excavated surface", ex, c.tris) };
}

/* ---------- principal axis (chainage direction) ---------- */

function principalAxis(vertices: CVertex[]): Axis {
  const cutPts = vertices.filter((v) => v.eg - v.ex > 0.05);
  const use = cutPts.length >= 3 ? cutPts : vertices;
  let mx = 0, my = 0;
  for (const v of use) {
    mx += v.x;
    my += v.y;
  }
  mx /= use.length;
  my /= use.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const v of use) {
    sxx += (v.x - mx) ** 2;
    syy += (v.y - my) ** 2;
    sxy += (v.x - mx) * (v.y - my);
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let dir: XY = [Math.cos(theta), Math.sin(theta)];
  // Read west → east (or south → north when the excavation runs north–south)
  if (dir[0] < -1e-9 || (Math.abs(dir[0]) < 1e-9 && dir[1] < 0)) dir = [-dir[0], -dir[1]];
  const normal: XY = [dir[1], -dir[0]]; // right-hand side looking along dir
  const proj = (v: { x: number; y: number }) => (v.x - mx) * dir[0] + (v.y - my) * dir[1];
  const off = (v: { x: number; y: number }) => (v.x - mx) * normal[0] + (v.y - my) * normal[1];
  let sMin = Infinity, sMax = -Infinity, oMin = Infinity, oMax = -Infinity, cMin = Infinity, cMax = -Infinity;
  for (const v of vertices) {
    const s = proj(v), o = off(v);
    sMin = Math.min(sMin, s);
    sMax = Math.max(sMax, s);
    oMin = Math.min(oMin, o);
    oMax = Math.max(oMax, o);
  }
  for (const v of use) {
    const s = proj(v);
    cMin = Math.min(cMin, s);
    cMax = Math.max(cMax, s);
  }
  // Chainage 0 at the start of the surface
  const origin: XY = [mx + dir[0] * sMin, my + dir[1] * sMin];
  return { origin, dir, normal, sMin: 0, sMax: sMax - sMin, oMin, oMax, cutS: [cMin - sMin, cMax - sMin] };
}

/* ---------- polygon helpers (all attributes linear → exact) ---------- */

/** Keep the part of a convex polygon where f(v) ≥ c. */
function clip(poly: V[], f: (v: V) => number, c: number): V[] {
  if (poly.length < 3 || c === -Infinity) return poly;
  const out: V[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const fp = f(p) - c;
    const fq = f(q) - c;
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) {
      const t = fp / (fp - fq);
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, d: p.d + (q.d - p.d) * t });
    }
  }
  return out;
}

function area(poly: V[]) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

/** ∫ sign·d dA over a convex polygon (d linear): fan into triangles, area × mean of corners. */
function integrate(poly: V[], sign: 1 | -1) {
  let v = 0;
  for (let k = 1; k < poly.length - 1; k++) {
    const a = poly[0], b = poly[k], c = poly[k + 1];
    const A = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
    v += (A * sign * (a.d + b.d + c.d)) / 3;
  }
  return v;
}

/* ---------- sections ---------- */

export type SectionKind = "cross" | "long";

export type SectionProfile = {
  kind: SectionKind;
  /** chainage of a cross section, or the offset of the long section */
  at: number;
  label: string;
  /** horizontal distance along the section (m) with both levels */
  samples: { h: number; eg: number; ex: number }[];
  /** plan end points of the section line (local m) */
  line: [XY, XY];
  cutArea: number;
  fillArea: number;
};

/** Cut a section across (at a chainage) or along (at an offset) the excavation. */
export function section(c: Comparison, kind: SectionKind, at: number, step = 0.5): SectionProfile {
  const { axis } = c;
  const locate = sectionLocator(c);
  const samples: SectionProfile["samples"] = [];
  const P = (s: number, o: number): XY => [axis.origin[0] + axis.dir[0] * s + axis.normal[0] * o, axis.origin[1] + axis.dir[1] * s + axis.normal[1] * o];
  const [h0, h1] = kind === "cross" ? [axis.oMin, axis.oMax] : [axis.sMin, axis.sMax];
  const n = Math.max(2, Math.ceil((h1 - h0) / step));
  let cutArea = 0, fillArea = 0;
  let prev: { h: number; d: number } | null = null;
  let first: XY | null = null, last: XY | null = null;
  for (let i = 0; i <= n; i++) {
    const h = h0 + ((h1 - h0) * i) / n;
    const [x, y] = kind === "cross" ? P(at, h) : P(h, at);
    const l = locate(x, y);
    if (!l) {
      prev = null;
      continue;
    }
    first ??= [x, y];
    last = [x, y];
    samples.push({ h, eg: l.eg, ex: l.ex });
    const d = l.eg - l.ex;
    if (prev) {
      const w = h - prev.h;
      cutArea += trapPositive(prev.d, d, w);
      fillArea += trapPositive(-prev.d, -d, w);
    }
    prev = { h, d };
  }
  const label = kind === "cross" ? `CH ${chainage(at)}` : `LONG SECTION · OFFSET ${at >= 0 ? "+" : "−"}${Math.abs(at).toFixed(1)} m`;
  return { kind, at, label, samples, line: [first ?? P(at, h0), last ?? P(at, h1)], cutArea, fillArea };
}

/** ∫ max(0, linear) over one step, exact when the line crosses zero. */
function trapPositive(a: number, b: number, w: number) {
  if (a >= 0 && b >= 0) return ((a + b) / 2) * w;
  if (a <= 0 && b <= 0) return 0;
  const t = a / (a - b); // zero crossing
  return a > 0 ? (a * t * w) / 2 : (b * (1 - t) * w) / 2;
}

const locators = new WeakMap<Comparison, (x: number, y: number) => { eg: number; ex: number } | null>();

/** Existing and excavated level at a plan position (local m), or null outside. */
export function levelsAt(c: Comparison, x: number, y: number) {
  return sectionLocator(c)(x, y);
}

function sectionLocator(c: Comparison) {
  const cached = locators.get(c);
  if (cached) return cached;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of c.vertices) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }
  const pts: P3[] = c.vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));
  const loc = triangleLocator(pts, c.tris, [minX, minY], [maxX, maxY]);
  const fn = (x: number, y: number) => {
    const hit = loc(x, y);
    if (!hit) return null;
    const [a, b, cc] = c.tris[hit.t];
    const A = c.vertices[a], B = c.vertices[b], C = c.vertices[cc];
    return { eg: hit.l1 * A.eg + hit.l2 * B.eg + hit.l3 * C.eg, ex: hit.l1 * A.ex + hit.l2 * B.ex + hit.l3 * C.ex };
  };
  locators.set(c, fn);
  return fn;
}

/** Average-end-area check: cross sections at a regular spacing over the cut. */
export function endAreaCheck(c: Comparison, spacing?: number) {
  const [c0, c1] = c.axis.cutS;
  const L = c1 - c0;
  const step = spacing ?? niceStep(L / 8);
  const stations: { s: number; cutArea: number }[] = [];
  for (let s = Math.ceil(c0 / step) * step; s <= c1 + 1e-6; s += step) stations.push({ s, cutArea: section(c, "cross", s).cutArea });
  let volume = 0;
  for (let i = 1; i < stations.length; i++) volume += ((stations[i - 1].cutArea + stations[i].cutArea) / 2) * (stations[i].s - stations[i - 1].s);
  return { step, stations, volume };
}

export function niceStep(x: number) {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100];
  return steps.find((s) => s >= x) ?? 100;
}

/** 42.5 → "0+042.50" */
export function chainage(s: number) {
  const km = Math.floor(s / 1000);
  const m = s - km * 1000;
  return `${km}+${m.toFixed(2).padStart(6, "0")}`;
}
