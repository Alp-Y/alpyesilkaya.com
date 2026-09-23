/**
 * PLANE GEOMETRY for the Spatial Quantity Engine demo.
 * ------------------------------------------------------------------
 * Small, dependency-free and exact for simple polygons:
 *
 *   area(polygon)                       shoelace formula
 *   triangulate(polygon)                ear clipping (handles concave shapes)
 *   intersectPolygons(work, boundary)   the boundary is split into triangles
 *                                       (always convex), the work polygon is
 *                                       clipped against each (Sutherland–Hodgman),
 *                                       and the pieces' areas are summed
 *   clipPolyline(line, boundary)        length of a line inside a boundary
 *                                       (Cyrus–Beck against each triangle)
 *
 * Coordinates are metres in a Y-up drawing system.
 */

export type Point = [number, number];
export type Polygon = Point[];

const EPS = 1e-9;

export function area(poly: Polygon): number {
  let s = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % n];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2; // signed: > 0 counter-clockwise
}

export const absArea = (poly: Polygon) => Math.abs(area(poly));

export function length(line: Point[]): number {
  let s = 0;
  for (let i = 1; i < line.length; i++) s += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  return s;
}

/** Area-weighted centroid (falls back to the vertex average for degenerate shapes). */
export function centroid(poly: Polygon): Point {
  const a = area(poly);
  if (Math.abs(a) < EPS) {
    const sx = poly.reduce((s, p) => s + p[0], 0);
    const sy = poly.reduce((s, p) => s + p[1], 0);
    return [sx / poly.length, sy / poly.length];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % n];
    const f = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

export function bounds(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function pointInPolygon([x, y]: Point, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Counter-clockwise copy, without a repeated closing vertex or zero-length edges. */
export function normalize(poly: Polygon): Polygon {
  const out: Polygon = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-7) out.push([p[0], p[1]]);
  }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-7) out.pop();
  return area(out) < 0 ? out.reverse() : out;
}

const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Ear-clipping triangulation of a simple polygon. */
export function triangulate(input: Polygon): Polygon[] {
  const poly = normalize(input);
  const idx = poly.map((_, i) => i);
  const tris: Polygon[] = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const a = poly[idx[(i + idx.length - 1) % idx.length]];
      const b = poly[idx[i]];
      const c = poly[idx[(i + 1) % idx.length]];
      if (cross(a, b, c) <= EPS) continue; // reflex or degenerate
      let contains = false;
      for (let j = 0; j < idx.length; j++) {
        const p = poly[idx[j]];
        if (p === a || p === b || p === c) continue;
        if (cross(a, b, p) >= -EPS && cross(b, c, p) >= -EPS && cross(c, a, p) >= -EPS) {
          contains = true;
          break;
        }
      }
      if (contains) continue;
      tris.push([a, b, c]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break; // not simple — stop gracefully
  }
  if (idx.length === 3) tris.push([poly[idx[0]], poly[idx[1]], poly[idx[2]]]);
  return tris;
}

/** Sutherland–Hodgman: clip any polygon by a CONVEX counter-clockwise polygon. */
function clipByConvex(subject: Polygon, clip: Polygon): Polygon {
  let output = subject;
  for (let i = 0; i < clip.length && output.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const pIn = cross(a, b, p) >= -EPS;
      const qIn = cross(a, b, q) >= -EPS;
      if (pIn) output.push(p);
      if (pIn !== qIn) output.push(intersectLines(p, q, a, b));
    }
  }
  return output;
}

function intersectLines(p: Point, q: Point, a: Point, b: Point): Point {
  const d1x = q[0] - p[0];
  const d1y = q[1] - p[1];
  const d2x = b[0] - a[0];
  const d2y = b[1] - a[1];
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < EPS) return p;
  const t = ((a[0] - p[0]) * d2y - (a[1] - p[1]) * d2x) / den;
  return [p[0] + t * d1x, p[1] + t * d1y];
}

export type PolygonIntersection = { area: number; pieces: Polygon[] };

/** Area of `work ∩ boundary`, exact for simple polygons. `boundaryTris` can be passed in (cached). */
export function intersectPolygons(work: Polygon, boundary: Polygon, boundaryTris = triangulate(boundary)): PolygonIntersection {
  const subject = normalize(work);
  const pieces: Polygon[] = [];
  let total = 0;
  for (const tri of boundaryTris) {
    const piece = clipByConvex(subject, tri);
    if (piece.length >= 3) {
      const a = absArea(piece);
      if (a > 1e-6) {
        pieces.push(piece);
        total += a;
      }
    }
  }
  return { area: total, pieces };
}

/** Parts of a polyline inside a boundary, and their total length. */
export function clipPolyline(line: Point[], boundary: Polygon, boundaryTris = triangulate(boundary)): { length: number; segments: [Point, Point][] } {
  const segments: [Point, Point][] = [];
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const p = line[i - 1];
    const q = line[i];
    for (const tri of boundaryTris) {
      const seg = clipSegmentConvex(p, q, tri);
      if (seg) {
        const l = Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]);
        if (l > 1e-6) {
          segments.push(seg);
          total += l;
        }
      }
    }
  }
  return { length: total, segments };
}

/** Cyrus–Beck clipping of segment pq by a convex CCW polygon. */
function clipSegmentConvex(p: Point, q: Point, poly: Polygon): [Point, Point] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    // Inward normal of edge ab for a CCW polygon
    const nx = -(b[1] - a[1]);
    const ny = b[0] - a[0];
    const num = nx * (p[0] - a[0]) + ny * (p[1] - a[1]);
    const den = nx * dx + ny * dy;
    if (Math.abs(den) < EPS) {
      if (num < -EPS) return null; // parallel and outside
      continue;
    }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [
    [p[0] + dx * t0, p[1] + dy * t0],
    [p[0] + dx * t1, p[1] + dy * t1],
  ];
}
