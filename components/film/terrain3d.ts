/**
 * 2.5D TERRAIN — the basin survey drawn as a shaded, rotatable surface
 * (painter's algorithm on the TIN), used by the film's volume chapter.
 */

import { clamp, lerp, stroke, type Frame } from "./draw";

export type Proj = { cx: number; cy: number; s: number; yaw: number; pitch: number; ez: number; zc: number; tx: number; ty: number };
export function project(p: Proj) {
  const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw), cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
  return (x: number, y: number, z: number): [number, number, number] => {
    const dx = x - p.tx;
    const dy = y - p.ty;
    const xr = dx * cy + dy * sy;
    const yr = -dx * sy + dy * cy;
    const zz = (z - p.zc) * p.ez;
    return [p.cx + xr * p.s, p.cy - (yr * cp + zz * sp) * p.s, -yr * sp + zz * cp];
  };
}

const LIGHT = (() => {
  const v = [-0.45, 0.55, 0.7];
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
})();

export function drawFaces(f: Frame, P: ReturnType<typeof project>, proj: Proj, shade: number, dig: number, cutAway: ((x: number, y: number) => boolean) | null) {
  const { ctx } = f;
  const TR = f.data.terrain;
  const { eg } = TR;
  type Face = { pts: [number, number, number][]; depth: number; col: string; wire: number };
  const faces: Face[] = [];
  const zr = TR.zMax - TR.zMin || 1;
  const faceColor = (a: number[], b: number[], d: number[], cutDepth: number) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = (b[2] - a[2]) * proj.ez;
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = (d[2] - a[2]) * proj.ez;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    if (nz < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const lam = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
    const t = ((a[2] + b[2] + d[2]) / 3 - TR.zMin) / zr;
    let r = 20 + 16 * t + 34 * lam;
    let g = 27 + 20 * t + 38 * lam;
    let bl = 34 + 22 * t + 40 * lam;
    if (cutDepth > 0.03) {
      const k = clamp(cutDepth / 3) * 0.8;
      r = lerp(r, 78 + 56 * lam, k);
      g = lerp(g, 66 + 46 * lam, k);
      bl = lerp(bl, 44 + 26 * lam, k);
    }
    return `rgb(${r | 0}, ${g | 0}, ${bl | 0})`;
  };
  const add = (a: [number, number, number], b: [number, number, number], d: [number, number, number], cutDepth: number) => {
    const cx = (a[0] + b[0] + d[0]) / 3;
    const cy = (a[1] + b[1] + d[1]) / 3;
    if (cutAway?.(cx, cy)) return;
    const pa = P(...a), pb = P(...b), pd = P(...d);
    faces.push({ pts: [pa, pb, pd], depth: (pa[2] + pb[2] + pd[2]) / 3, col: faceColor(a, b, d, cutDepth), wire: cutDepth > 0.03 ? 0.2 : 0.12 });
  };
  if (dig <= 0) {
    const EP = eg.points;
    for (const [i, j, k] of eg.tris) {
      const a = EP[i], b = EP[j], d = EP[k];
      add([a.x, a.y, a.z], [b.x, b.y, b.z], [d.x, d.y, d.z], 0);
    }
  } else {
    // the existing ground sinks to the excavated surface: one mesh, both levels at every vertex
    const M = TR.mesh;
    const z = (v: (typeof M)[number]) => lerp(v.eg, v.ex, dig);
    for (const [i, j, k] of TR.meshTris) {
      const a = M[i], b = M[j], d = M[k];
      const depth = (a.eg - z(a) + b.eg - z(b) + d.eg - z(d)) / 3;
      add([a.x, a.y, z(a)], [b.x, b.y, z(b)], [d.x, d.y, z(d)], depth);
    }
  }
  faces.sort((p, q) => p.depth - q.depth);
  ctx.save();
  ctx.lineJoin = "round";
  for (const fc of faces) {
    ctx.beginPath();
    ctx.moveTo(fc.pts[0][0], fc.pts[0][1]);
    ctx.lineTo(fc.pts[1][0], fc.pts[1][1]);
    ctx.lineTo(fc.pts[2][0], fc.pts[2][1]);
    ctx.closePath();
    ctx.globalAlpha = shade;
    ctx.fillStyle = fc.col;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(170, 190, 210, ${fc.wire * Math.max(shade, 0.4)})`;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  ctx.restore();
}

let waveCache: { edges: [number, number][]; d: number[] } | null = null;
export function drawTinWave(f: Frame, P: ReturnType<typeof project>, k: number, a: number) {
  const { ctx } = f;
  const { eg } = f.data.terrain;
  if (!waveCache || waveCache.edges.length === 0 || (waveCache as unknown as { src: unknown }).src !== eg) {
    const edges = eg.edges();
    const d = edges.map(([i, j]) => Math.hypot((eg.points[i].x + eg.points[j].x) / 2 - 60, (eg.points[i].y + eg.points[j].y) / 2 - 35));
    waveCache = { edges, d };
    (waveCache as unknown as { src: unknown }).src = eg;
  }
  const r = k * 72;
  ctx.save();
  ctx.lineWidth = 0.8;
  // the wavefront is brighter than the settled mesh
  for (const pass of [0, 1]) {
    ctx.beginPath();
    waveCache.edges.forEach(([i, j], n) => {
      const d = waveCache!.d[n];
      if (d > r) return;
      const front = d > r - 8;
      if ((pass === 1) !== front) return;
      const p = eg.points[i];
      const q = eg.points[j];
      const A = P(p.x, p.y, p.z);
      const B = P(q.x, q.y, q.z);
      ctx.moveTo(A[0], A[1]);
      ctx.lineTo(B[0], B[1]);
    });
    stroke(ctx, pass ? `rgba(62, 224, 143, ${0.8 * a})` : `rgba(170, 190, 210, ${0.36 * a})`, pass ? 1 : 0.8);
  }
  ctx.restore();
}

