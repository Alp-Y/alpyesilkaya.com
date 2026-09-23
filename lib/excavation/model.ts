/**
 * AUTOMATIZE EXCAVATION CALCULATIONS — the calculation, independent of any UI.
 * ------------------------------------------------------------------
 *   survey XYZ points  →  TIN (Delaunay)  →  two surfaces on that TIN:
 *     EXISTING GROUND    the surveyed levels
 *     EXCAVATED SURFACE  the levels after excavation (here: a road cutting)
 *   →  calculation boundary (closed polyline)
 *   →  volume = ∫ (existing − excavated) dA over the TIN, inside the boundary
 *
 * The integral is exact for a TIN: each triangle is clipped to the boundary
 * and the depth, linear across the triangle, is integrated over the clipped
 * part. It is NOT area × average depth.
 *
 * Sections: the same TIN is cut along stations of the road alignment;
 * the cut area of each section also gives an average-end-area check.
 *
 * All of it is demonstration data (a generated site), computed for real.
 * Coordinates: local metres (x east, y north); display adds the grid origin.
 */

import { delaunay, type XY } from "./delaunay";

export const ORIGIN: [number, number] = [512_300, 2_743_760]; // E, N added for display
export const EXTENT: [number, number] = [160, 110];
export const HALF_FORMATION = 7;
export const SIDE_SLOPE = 1.5; // 1 vertical : 1.5 horizontal
export const VE = 2; // vertical exaggeration for display only

/* ---------- the site ---------- */

export function groundLevel(x: number, y: number): number {
  return (
    614 +
    0.045 * y +
    4.4 * Math.exp(-(((x - 80) ** 2) / 1100 + ((y - 57) ** 2) / 800)) +
    1.1 * Math.sin(x / 17) +
    0.8 * Math.cos(y / 13) +
    0.45 * Math.sin((x + y) / 9)
  );
}

/** Road centreline (y as a function of x) and its formation level. */
export const centreline = (x: number) => 55 + 6 * Math.sin(x / 60);
export const formationLevel = (x: number) => 615.1 + 0.0075 * x;

export function excavatedLevel(x: number, y: number, g = groundLevel(x, y)): number {
  const d = Math.abs(y - centreline(x));
  const design = formationLevel(x) - 0.025 * Math.min(d, HALF_FORMATION) + Math.max(0, d - HALF_FORMATION) / SIDE_SLOPE;
  return Math.min(g, design); // only where the ground is above the design is anything dug out
}

/** Calculation boundary: a closed polyline around the cutting (local metres). */
export const BOUNDARY: XY[] = [
  [24, 34], [52, 27], [96, 26], [133, 33], [146, 52], [138, 76], [100, 86], [58, 85], [28, 76], [17, 56],
];

/* ---------- survey → TIN ---------- */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export type SurveyPoint = { id: string; x: number; y: number; z: number; zx: number };

export type ExcavationModel = {
  points: SurveyPoint[];
  tris: [number, number, number][];
  boundary: XY[];
  boundaryArea: number;
  volume: number;
  averageDepth: number;
  maxDepth: number;
  sections: Section[];
  endAreaVolume: number;
  /** triangle index → inside/partly inside the boundary */
  triInside: boolean[];
};

export type Section = {
  station: number; // chainage along x (m)
  label: string; // CH 0+040
  /** offsets (m, − left / + right looking east) with existing and excavated levels */
  samples: { o: number; eg: number; ex: number }[];
  cutArea: number; // m², inside the boundary
  /** plan position of the section line ends (local m) */
  line: [XY, XY];
  /** the part of the section inside the boundary (offset range) */
  inside: [number, number] | null;
};

export function buildExcavation(): ExcavationModel {
  const r = rng(11);
  const pts: SurveyPoint[] = [];
  // Jittered grid (a typical topographic survey) + denser shots along the road line
  const step = 4.6;
  for (let y = 0; y <= EXTENT[1] + 0.01; y += step)
    for (let x = 0; x <= EXTENT[0] + 0.01; x += step) {
      const edge = x < 0.01 || y < 0.01 || x > EXTENT[0] - 0.01 || y > EXTENT[1] - 0.01;
      const px = edge ? x : x + (r() - 0.5) * step * 0.7;
      const py = edge ? y : y + (r() - 0.5) * step * 0.7;
      pts.push({ id: "", x: Math.min(EXTENT[0], Math.max(0, px)), y: Math.min(EXTENT[1], Math.max(0, py)), z: 0, zx: 0 });
    }
  for (let x = 2; x < EXTENT[0]; x += 3.1)
    for (const off of [-HALF_FORMATION, 0, HALF_FORMATION]) pts.push({ id: "", x: x + (r() - 0.5), y: centreline(x) + off + (r() - 0.5) * 0.6, z: 0, zx: 0 });
  pts.forEach((p, i) => {
    p.id = `P${101 + i}`;
    p.z = groundLevel(p.x, p.y);
    p.zx = excavatedLevel(p.x, p.y, p.z);
  });

  const tris = delaunay(pts.map((p) => [p.x, p.y] as XY));
  const depth = pts.map((p) => Math.max(0, p.z - p.zx));

  // ---- volume: each triangle clipped to the boundary, depth integrated exactly (linear) ----
  let volume = 0;
  const triInside: boolean[] = [];
  for (const [a, b, c] of tris) {
    const A = pts[a], B = pts[b], C = pts[c];
    const poly = clipConvex([[A.x, A.y], [B.x, B.y], [C.x, C.y]], BOUNDARY);
    triInside.push(poly.length >= 3);
    if (poly.length < 3) continue;
    const det = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
    const dAt = ([x, y]: XY) => {
      const l1 = ((B.y - C.y) * (x - C.x) + (C.x - B.x) * (y - C.y)) / det;
      const l2 = ((C.y - A.y) * (x - C.x) + (A.x - C.x) * (y - C.y)) / det;
      return l1 * depth[a] + l2 * depth[b] + (1 - l1 - l2) * depth[c];
    };
    for (let k = 1; k < poly.length - 1; k++) {
      const p0 = poly[0], p1 = poly[k], p2 = poly[k + 1];
      const area = Math.abs((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])) / 2;
      volume += (area * (dAt(p0) + dAt(p1) + dAt(p2))) / 3;
    }
  }
  const boundaryArea = Math.abs(shoelace(BOUNDARY));
  let maxDepth = 0;
  pts.forEach((p, i) => {
    if (inPolygon([p.x, p.y], BOUNDARY)) maxDepth = Math.max(maxDepth, depth[i]);
  });

  // ---- sections every 20 m, sampled from the TIN ----
  const lookup = triangleLookup(pts, tris);
  const sections: Section[] = [];
  for (let st = 20; st <= 140; st += 20) {
    const cy = centreline(st);
    const slope = (centreline(st + 0.5) - centreline(st - 0.5)) / 1;
    const len = Math.hypot(1, slope);
    const nx = slope / len; // normal to the alignment (pointing right = south)
    const ny = -1 / len;
    const samples: Section["samples"] = [];
    let inside: [number, number] | null = null;
    let cutArea = 0;
    let prev: { o: number; d: number; in: boolean } | null = null;
    for (let o = -36; o <= 36.001; o += 0.5) {
      const x = st + nx * o;
      const y = cy + ny * o;
      const s = lookup(x, y);
      if (!s) continue;
      samples.push({ o, eg: s.eg, ex: s.ex });
      const isIn = inPolygon([x, y], BOUNDARY);
      if (isIn) inside = inside ? [inside[0], o] : [o, o];
      const d = Math.max(0, s.eg - s.ex);
      if (prev && prev.in && isIn) cutArea += ((prev.d + d) / 2) * (o - prev.o);
      prev = { o, d, in: isIn };
    }
    sections.push({ station: st, label: `CH 0+${String(st).padStart(3, "0")}`, samples, cutArea, line: [[st + nx * -36, cy + ny * -36], [st + nx * 36, cy + ny * 36]], inside });
  }
  // average end area between consecutive sections (a check, not the result)
  let endAreaVolume = 0;
  for (let i = 1; i < sections.length; i++) endAreaVolume += ((sections[i - 1].cutArea + sections[i].cutArea) / 2) * (sections[i].station - sections[i - 1].station);

  return { points: pts, tris, boundary: BOUNDARY, boundaryArea, volume, averageDepth: volume / boundaryArea, maxDepth, sections, endAreaVolume, triInside };
}

/* ---------- geometry helpers ---------- */

export function shoelace(p: XY[]) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

export function inPolygon([x, y]: XY, poly: XY[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Sutherland–Hodgman: clip a polygon by a CONVEX clip polygon (any winding). */
function clipConvex(subject: XY[], clip: XY[]): XY[] {
  const ccw = shoelace(clip) > 0;
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const side = (p: XY) => ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * (ccw ? 1 : -1);
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const p = input[k];
      const q = input[(k + 1) % input.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) out.push(p);
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

/** Point → (existing, excavated) levels by barycentric interpolation on the TIN. */
function triangleLookup(pts: SurveyPoint[], tris: [number, number, number][]) {
  const cell = 8;
  const cols = Math.ceil(EXTENT[0] / cell) + 1;
  const buckets = new Map<number, number[]>();
  tris.forEach(([a, b, c], t) => {
    const xs = [pts[a].x, pts[b].x, pts[c].x];
    const ys = [pts[a].y, pts[b].y, pts[c].y];
    for (let gx = Math.floor(Math.min(...xs) / cell); gx <= Math.floor(Math.max(...xs) / cell); gx++)
      for (let gy = Math.floor(Math.min(...ys) / cell); gy <= Math.floor(Math.max(...ys) / cell); gy++) {
        const k = gy * cols + gx;
        const list = buckets.get(k) ?? [];
        list.push(t);
        buckets.set(k, list);
      }
  });
  return (x: number, y: number) => {
    const list = buckets.get(Math.floor(y / cell) * cols + Math.floor(x / cell)) ?? [];
    for (const t of list) {
      const [a, b, c] = tris[t];
      const A = pts[a], B = pts[b], C = pts[c];
      const det = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
      const l1 = ((B.y - C.y) * (x - C.x) + (C.x - B.x) * (y - C.y)) / det;
      const l2 = ((C.y - A.y) * (x - C.x) + (A.x - C.x) * (y - C.y)) / det;
      const l3 = 1 - l1 - l2;
      if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) {
        return { eg: l1 * A.z + l2 * B.z + l3 * C.z, ex: l1 * A.zx + l2 * B.zx + l3 * C.zx };
      }
    }
    return null;
  };
}
