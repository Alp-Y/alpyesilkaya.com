/**
 * DELAUNAY TRIANGULATION (Bowyer–Watson) — survey points → TIN.
 * ------------------------------------------------------------------
 * Plain and dependency-free; fine for a few thousand points. Returns
 * triangles as index triples into the input array, counter-clockwise.
 */

export type XY = [number, number];

export function delaunay(points: XY[]): [number, number, number][] {
  const n = points.length;
  if (n < 3) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const d = Math.max(maxX - minX, maxY - minY) * 20;
  const mx = (minX + maxX) / 2;
  const my = (minY + maxY) / 2;
  // super-triangle vertices get indices n, n+1, n+2
  const P: XY[] = [...points, [mx - d, my - d], [mx, my + d], [mx + d, my - d]];

  type Tri = { a: number; b: number; c: number; cx: number; cy: number; r2: number };
  const circum = (a: number, b: number, c: number): Tri => {
    const [ax, ay] = P[a];
    const [bx, by] = P[b];
    const [cx, cy] = P[c];
    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)) || 1e-12;
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;
    return { a, b, c, cx: ux, cy: uy, r2: (ax - ux) ** 2 + (ay - uy) ** 2 };
  };

  let tris: Tri[] = [circum(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const [px, py] = P[i];
    const bad: Tri[] = [];
    const keep: Tri[] = [];
    for (const t of tris) ((px - t.cx) ** 2 + (py - t.cy) ** 2 < t.r2 ? bad : keep).push(t);
    // boundary of the hole: edges that belong to exactly one bad triangle
    const edges = new Map<string, [number, number]>();
    for (const t of bad) {
      for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as [number, number][]) {
        const key = u < v ? `${u},${v}` : `${v},${u}`;
        if (edges.has(key)) edges.delete(key);
        else edges.set(key, [u, v]);
      }
    }
    for (const [u, v] of edges.values()) keep.push(circum(u, v, i));
    tris = keep;
  }

  const out: [number, number, number][] = [];
  for (const t of tris) {
    if (t.a >= n || t.b >= n || t.c >= n) continue;
    const [ax, ay] = P[t.a];
    const [bx, by] = P[t.b];
    const [cx, cy] = P[t.c];
    const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    out.push(cross > 0 ? [t.a, t.b, t.c] : [t.a, t.c, t.b]);
  }
  return out;
}
