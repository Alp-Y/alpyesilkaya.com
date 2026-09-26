/**
 * THE BASIN SURVEY — the terrain scene's data, run through the site's real
 * Excavation Volume Engine (lib/excavation): the same Delaunay TIN, the same
 * composite surface comparison, the same section cutter as the tool page.
 * ------------------------------------------------------------------
 *   existing ground   a jittered survey over the basin window (synthetic)
 *   excavated surface an as-dug survey of the basin: flat base, 1:2 batters
 *   → TIN, contours, cut / fill per triangle, cross sections, zones
 *
 * Local metres: x east, y north, from BASIN_ORIGIN (lib/film/project.ts).
 */

import { buildSurface, type P3, type Surface } from "@/lib/excavation/tin";
import { compare, section, type Comparison, type SectionProfile } from "@/lib/excavation/volume";
import { BASIN_ORIGIN, BASIN_SIZE } from "./project";

export type Terrain = {
  eg: Surface;
  /** the survey rows as a TXT file would hold them (grid coordinates) */
  rows: string[];
  c: Comparison;
  /** the hero section (middle of the cut) and the series */
  hero: SectionProfile;
  series: SectionProfile[];
  /** contour segments on the existing ground: [x1,y1,x2,y2,z] */
  contours: number[][];
  /** plan extent of the as-dug survey (composite surface) */
  exMin: [number, number];
  exMax: [number, number];
  zMin: number;
  zMax: number;
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const [W, H] = BASIN_SIZE;
const egZ = (x: number, y: number) => 611.4 + 1.5 * Math.sin(x / 21 + 0.4) + 0.9 * Math.cos(y / 13 + 0.6) - 0.018 * y + 0.006 * x;
/** basin base: x 34…86, y 22…48, level 606.20 falling 0.2 % to the east; batters 1:2 */
const BASE = { x0: 34, x1: 86, y0: 22, y1: 48 };
const designZ = (x: number, y: number) => {
  const dx = Math.max(BASE.x0 - x, 0, x - BASE.x1);
  const dy = Math.max(BASE.y0 - y, 0, y - BASE.y1);
  return 606.2 - 0.002 * (x - BASE.x0) + 0.5 * Math.hypot(dx, dy);
};

function grid(x0: number, x1: number, y0: number, y1: number, step: number, seed: number, jitter: number) {
  const r = rng(seed);
  const pts: [number, number][] = [];
  for (let y = y0; y <= y1 + 1e-6; y += step)
    for (let x = x0; x <= x1 + 1e-6; x += step) {
      const edge = x < x0 + 1e-6 || y < y0 + 1e-6 || x > x1 - 1e-6 || y > y1 - 1e-6;
      pts.push(edge ? [x, y] : [x + (r() - 0.5) * step * jitter, y + (r() - 0.5) * step * jitter]);
    }
  return pts;
}

export function buildTerrain(low = false): Terrain {
  // existing ground survey
  const egPts: P3[] = grid(0, W, 0, H, low ? 10 : 7.5, 7, 0.75).map(([x, y]) => ({ x, y, z: Math.round(egZ(x, y) * 1000) / 1000 }));
  const eg = buildSurface("Existing ground", egPts);

  // as-dug survey: a grid over the basin plus its base corners and toe lines, so the batters read crisply
  const ex0: [number, number] = [18, 8];
  const ex1: [number, number] = [102, 62];
  const exXY = grid(ex0[0], ex1[0], ex0[1], ex1[1], low ? 7 : 5.25, 11, 0.5);
  for (let x = BASE.x0; x <= BASE.x1 + 1e-6; x += 6.5) exXY.push([x, BASE.y0], [x, BASE.y1]);
  for (let y = BASE.y0 + 6.5; y < BASE.y1 - 1e-6; y += 6.5) exXY.push([BASE.x0, y], [BASE.x1, y]);
  const exPts: P3[] = exXY.map(([x, y]) => ({ x, y, z: Math.min(egZ(x, y), designZ(x, y)) }));
  const ex = buildSurface("Excavated surface", exPts);

  const c = compare(ex, { kind: "tin", surface: eg });
  const [s0, s1] = c.axis.cutS;
  const series = Array.from({ length: 6 }, (_, i) => section(c, "cross", s0 + ((s1 - s0) * (i + 0.5)) / 6, 0.75));
  const hero = section(c, "cross", (s0 + s1) / 2, 0.5);

  // contours on the existing ground, every 0.5 m
  const contours: number[][] = [];
  const P = eg.points;
  for (const [a, b, d] of eg.tris) {
    const v = [P[a], P[b], P[d]];
    const lo = Math.min(v[0].z, v[1].z, v[2].z);
    const hi = Math.max(v[0].z, v[1].z, v[2].z);
    for (let z = Math.ceil(lo / 0.5) * 0.5; z < hi; z += 0.5) {
      const hits: number[] = [];
      for (let k = 0; k < 3; k++) {
        const p = v[k];
        const q = v[(k + 1) % 3];
        if ((p.z - z) * (q.z - z) < 0) {
          const t = (z - p.z) / (q.z - p.z);
          hits.push(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);
        }
      }
      if (hits.length === 4) contours.push([...hits, z]);
    }
  }

  const rows = egPts.map((p) => `${(BASIN_ORIGIN[0] + 512_000 + p.x).toFixed(3)},${(BASIN_ORIGIN[1] + 2_761_000 + p.y).toFixed(3)},${p.z.toFixed(3)}`);

  return {
    eg,
    rows,
    c,
    hero,
    series,
    contours,
    exMin: ex0,
    exMax: ex1,
    zMin: Math.min(eg.zMin, c.exZMin),
    zMax: eg.zMax,
  };
}
