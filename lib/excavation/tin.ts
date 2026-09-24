/**
 * TIN SURFACE — survey points → triangulated irregular network.
 * ------------------------------------------------------------------
 *   XYZ points  →  Delaunay triangulation in plan (X,Y)
 *               →  Z applied at every vertex
 *               →  a continuous surface, linear across each triangle
 *
 * Like a Civil 3D surface, very long triangles along a concave edge of the
 * survey are removed (maximum triangle edge length), so the surface does
 * not bridge areas that were never surveyed.
 *
 * Coordinates here are LOCAL metres (x east, y north) relative to a
 * dataset origin; see `Dataset.origin` for the real grid coordinates.
 */

import { delaunay, type XY } from "./delaunay";

export type P3 = { x: number; y: number; z: number };
export type Tri = [number, number, number];

export type Surface = {
  name: string;
  points: P3[];
  tris: Tri[];
  /** Plan extent of the surface. */
  min: XY;
  max: XY;
  /** Elevation range. */
  zMin: number;
  zMax: number;
  /** Elevation at a plan position, or null outside the surface. */
  at: (x: number, y: number) => number | null;
  /** Unique triangle edges (vertex index pairs), for drawing the TIN. */
  edges: () => [number, number][];
};

/** Triangles with an edge longer than this multiple of the median edge are dropped. */
const MAX_EDGE_FACTOR = 5;

export function buildSurface(name: string, points: P3[]): Surface {
  let tris = delaunay(points.map((p) => [p.x, p.y] as XY));
  tris = dropLongTriangles(points, tris);
  return surfaceFrom(name, points, tris);
}

export function surfaceFrom(name: string, points: P3[], tris: Tri[]): Surface {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, zMin = Infinity, zMax = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    zMin = Math.min(zMin, p.z);
    zMax = Math.max(zMax, p.z);
  }
  const locate = triangleLocator(points, tris, [minX, minY], [maxX, maxY]);
  let edgeCache: [number, number][] | null = null;
  return {
    name,
    points,
    tris,
    min: [minX, minY],
    max: [maxX, maxY],
    zMin,
    zMax,
    at: (x, y) => {
      const hit = locate(x, y);
      if (!hit) return null;
      const [a, b, c] = tris[hit.t];
      return hit.l1 * points[a].z + hit.l2 * points[b].z + hit.l3 * points[c].z;
    },
    edges: () => {
      if (edgeCache) return edgeCache;
      const m = new Map<string, [number, number]>();
      for (const [a, b, c] of tris)
        for (const [u, v] of [[a, b], [b, c], [c, a]] as [number, number][]) m.set(u < v ? `${u},${v}` : `${v},${u}`, u < v ? [u, v] : [v, u]);
      edgeCache = [...m.values()];
      return edgeCache;
    },
  };
}

/** Remove triangles bridging unsurveyed ground (edge > factor × median edge). */
function dropLongTriangles(points: P3[], tris: Tri[]): Tri[] {
  if (tris.length < 8) return tris;
  const lengths: number[] = [];
  const len = (u: number, v: number) => Math.hypot(points[u].x - points[v].x, points[u].y - points[v].y);
  for (const [a, b, c] of tris) lengths.push(len(a, b), len(b, c), len(c, a));
  lengths.sort((p, q) => p - q);
  const limit = lengths[Math.floor(lengths.length / 2)] * MAX_EDGE_FACTOR;
  // Peel only from the outside: a long triangle is removed if it touches the
  // current hull. Repeat until stable, so interior triangles are never lost.
  let current = tris;
  for (let pass = 0; pass < 50; pass++) {
    const edgeCount = new Map<string, number>();
    const k = (u: number, v: number) => (u < v ? `${u},${v}` : `${v},${u}`);
    for (const [a, b, c] of current) for (const [u, v] of [[a, b], [b, c], [c, a]]) edgeCount.set(k(u, v), (edgeCount.get(k(u, v)) ?? 0) + 1);
    const next = current.filter(([a, b, c]) => {
      const outer = [[a, b], [b, c], [c, a]].some(([u, v]) => edgeCount.get(k(u, v)) === 1 && len(u, v) > limit);
      return !outer;
    });
    if (next.length === current.length) break;
    current = next;
  }
  return current;
}

/** Barycentric point location with a uniform grid of buckets. */
export function triangleLocator(points: P3[], tris: Tri[], min: XY, max: XY) {
  const span = Math.max(max[0] - min[0], max[1] - min[1], 1e-6);
  const cells = Math.max(4, Math.min(160, Math.round(Math.sqrt(tris.length) * 1.2)));
  const size = span / cells;
  const cols = Math.ceil((max[0] - min[0]) / size) + 1;
  const buckets = new Map<number, number[]>();
  tris.forEach(([a, b, c], t) => {
    const x0 = Math.min(points[a].x, points[b].x, points[c].x), x1 = Math.max(points[a].x, points[b].x, points[c].x);
    const y0 = Math.min(points[a].y, points[b].y, points[c].y), y1 = Math.max(points[a].y, points[b].y, points[c].y);
    for (let gx = Math.floor((x0 - min[0]) / size); gx <= Math.floor((x1 - min[0]) / size); gx++)
      for (let gy = Math.floor((y0 - min[1]) / size); gy <= Math.floor((y1 - min[1]) / size); gy++) {
        const key = gy * cols + gx;
        const list = buckets.get(key);
        if (list) list.push(t);
        else buckets.set(key, [t]);
      }
  });
  return (x: number, y: number): { t: number; l1: number; l2: number; l3: number } | null => {
    const gx = Math.floor((x - min[0]) / size);
    const gy = Math.floor((y - min[1]) / size);
    if (gx < 0 || gy < 0 || gx >= cols) return null;
    const list = buckets.get(gy * cols + gx);
    if (!list) return null;
    for (const t of list) {
      const [a, b, c] = tris[t];
      const A = points[a], B = points[b], C = points[c];
      const det = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
      if (det === 0) continue;
      const l1 = ((B.y - C.y) * (x - C.x) + (C.x - B.x) * (y - C.y)) / det;
      const l2 = ((C.y - A.y) * (x - C.x) + (A.x - C.x) * (y - C.y)) / det;
      const l3 = 1 - l1 - l2;
      if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) return { t, l1, l2, l3 };
    }
    return null;
  };
}

/** A level plane, used when the existing ground is a single elevation. */
export function levelSurface(z: number, over: Surface): Surface {
  const s: Surface = {
    name: `Level ${z.toFixed(2)}`,
    points: [],
    tris: [],
    min: over.min,
    max: over.max,
    zMin: z,
    zMax: z,
    at: () => z,
    edges: () => [],
  };
  return s;
}
