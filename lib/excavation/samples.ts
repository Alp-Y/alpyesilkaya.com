/**
 * SAMPLE DATASETS — three generated excavations, each as two surveys:
 *   ground      the existing ground survey (before)
 *   excavated   the survey of the excavated surface (after)
 *
 * Like real as-dug surveys, the "after" survey re-uses the original ground
 * shots outside the works and adds new shots inside them (toe, slopes,
 * formation). Everything is synthetic: generated here from simple design
 * rules, with real-looking grid coordinates. It is NOT project data.
 */

import type { XyzPoint } from "./xyz";

export type SampleId = "simple" | "road" | "irregular";

export type Dataset = {
  id: SampleId | "upload";
  name: string;
  /** one line for the input panel */
  description: string;
  excavated: XyzPoint[];
  /** the sample's own existing-ground survey (not available for uploads) */
  ground: XyzPoint[] | null;
  /** a sensible constant existing-ground level for this dataset */
  groundLevel: number;
};

/** Grid origin added to the local coordinates (easting, northing). */
const E0 = 512_400;
const N0 = 2_761_800;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Local = { x: number; y: number; z: number };

/** Jittered survey grid over [0,w]×[0,h]; edges kept straight. */
function surveyGrid(w: number, h: number, step: number, seed: number, jitter = 0.7) {
  const r = rng(seed);
  const pts: { x: number; y: number }[] = [];
  for (let y = 0; y <= h + 1e-6; y += step)
    for (let x = 0; x <= w + 1e-6; x += step) {
      const edge = x < 1e-6 || y < 1e-6 || x > w - 1e-6 || y > h - 1e-6;
      pts.push({
        x: edge ? x : Math.min(w, Math.max(0, x + (r() - 0.5) * step * jitter)),
        y: edge ? y : Math.min(h, Math.max(0, y + (r() - 0.5) * step * jitter)),
      });
    }
  return pts;
}

function toXyz(prefix: string, pts: Local[]): XyzPoint[] {
  return pts.map((p, i) => ({
    id: `${prefix}${String(i + 1).padStart(3, "0")}`,
    x: Math.round((E0 + p.x) * 1000) / 1000,
    y: Math.round((N0 + p.y) * 1000) / 1000,
    z: Math.round(p.z * 1000) / 1000,
  }));
}

/**
 * Build the two surveys from a ground function and an excavation design:
 * excavated level = min(ground, design). Shots where nothing was dug are
 * shared by both surveys; `extra` adds the as-dug shots inside the works.
 */
function surveys(ground: (x: number, y: number) => number, design: (x: number, y: number) => number, base: { x: number; y: number }[], extra: { x: number; y: number }[]) {
  const g: Local[] = base.map((p) => ({ ...p, z: ground(p.x, p.y) }));
  const ex: Local[] = [];
  for (const p of g) if (design(p.x, p.y) >= p.z) ex.push(p); // untouched: same shot
  for (const p of extra) {
    const z = ground(p.x, p.y);
    const d = design(p.x, p.y);
    if (d < z + 0.02) ex.push({ x: p.x, y: p.y, z: Math.min(z, d) });
  }
  return { ground: g, excavated: ex };
}

/* ---------- 1. Simple excavation: a basement pit ---------- */

function simple(): Dataset {
  const W = 70, H = 50;
  const ground = (x: number, y: number) => 650.1 - 0.012 * x + 0.009 * y + 0.12 * Math.sin(x / 9) * Math.cos(y / 11);
  // Pit: 34 × 22 m base at 646.40, batters 1V : 1H
  const bx0 = 18, bx1 = 52, by0 = 14, by1 = 36, formation = 646.4, batter = 1;
  const outside = (x: number, y: number) => Math.hypot(Math.max(bx0 - x, 0, x - bx1), Math.max(by0 - y, 0, y - by1));
  const design = (x: number, y: number) => formation + outside(x, y) * batter;
  const extra: { x: number; y: number }[] = [];
  // formation grid
  for (let y = by0; y <= by1 + 1e-6; y += 2.75) for (let x = bx0; x <= bx1 + 1e-6; x += 2.83) extra.push({ x, y });
  // toe and slope strings every ~2.5 m
  for (const off of [0, 1.2, 2.4, 3.6]) {
    const x0 = bx0 - off, x1 = bx1 + off, y0 = by0 - off, y1 = by1 + off;
    for (let x = x0; x <= x1 + 1e-6; x += 2.5) extra.push({ x, y: y0 }, { x, y: y1 });
    for (let y = y0 + 2.5; y < y1 - 1e-6; y += 2.5) extra.push({ x: x0, y }, { x: x1, y });
  }
  const s = surveys(ground, design, surveyGrid(W, H, 3.5, 7), extra);
  return {
    id: "simple",
    name: "Simple Excavation",
    description: "Basement pit · 34 × 22 m formation · 1:1 batters",
    ground: toXyz("EG", s.ground),
    excavated: toXyz("EX", s.excavated),
    groundLevel: 650.0,
  };
}

/* ---------- 2. Road excavation: a cutting along an alignment ---------- */

function road(): Dataset {
  const W = 160, H = 110, HALF = 7, SLOPE = 1.5;
  const ground = (x: number, y: number) =>
    648 + 0.045 * y + 4.4 * Math.exp(-(((x - 80) ** 2) / 1100 + ((y - 57) ** 2) / 800)) + 1.1 * Math.sin(x / 17) + 0.8 * Math.cos(y / 13) + 0.45 * Math.sin((x + y) / 9);
  const centre = (x: number) => 55 + 6 * Math.sin(x / 60);
  const formation = (x: number) => 649.1 + 0.0075 * x;
  const design = (x: number, y: number) => {
    const d = Math.abs(y - centre(x));
    return formation(x) - 0.025 * Math.min(d, HALF) + Math.max(0, d - HALF) / SLOPE;
  };
  const extra: { x: number; y: number }[] = [];
  for (let x = 1.5; x < W; x += 3.1)
    for (const off of [-HALF, -HALF / 2, 0, HALF / 2, HALF, -HALF - 3, HALF + 3, -HALF - 6, HALF + 6, -HALF - 9, HALF + 9]) extra.push({ x, y: centre(x) + off });
  const s = surveys(ground, design, surveyGrid(W, H, 5, 11), extra);
  return {
    id: "road",
    name: "Road Excavation",
    description: "Cutting along a 160 m alignment · 14 m formation · 1:1.5 side slopes",
    ground: toXyz("EG", s.ground),
    excavated: toXyz("EX", s.excavated),
    groundLevel: 654.0,
  };
}

/* ---------- 3. Irregular excavation: a detention basin ---------- */

function irregular(): Dataset {
  const W = 90, H = 70, cx = 45, cy = 35;
  const ground = (x: number, y: number) => 650.6 + 0.018 * x - 0.014 * y + 0.55 * Math.sin(x / 14) + 0.4 * Math.cos(y / 10) + 0.2 * Math.sin((x - y) / 7);
  // Irregular outline: radius varies with direction; floor falls to a sump
  const rFloor = (t: number) => 14 + 4 * Math.sin(2 * t + 0.5) + 2.4 * Math.cos(3 * t) + 1.2 * Math.sin(5 * t + 1);
  const floor = (x: number, y: number) => 647.3 - 0.012 * (x - cx) - 1.1 * Math.exp(-(((x - 36) ** 2) + ((y - 30) ** 2)) / 38);
  const design = (x: number, y: number) => {
    const t = Math.atan2(y - cy, x - cx);
    const out = Math.max(0, Math.hypot(x - cx, y - cy) - rFloor(t));
    return floor(x, y) + out / 2; // side slopes 1V : 2H
  };
  const extra: { x: number; y: number }[] = [];
  // radial as-dug shots: floor rings + slope rings
  for (let k = 0; k < 64; k++) {
    const t = (k / 64) * Math.PI * 2;
    const rf = rFloor(t);
    for (const f of [0.25, 0.5, 0.75, 1]) extra.push({ x: cx + Math.cos(t) * rf * f, y: cy + Math.sin(t) * rf * f });
    for (const o of [1.5, 3, 4.5, 6, 7.5]) extra.push({ x: cx + Math.cos(t) * (rf + o), y: cy + Math.sin(t) * (rf + o) });
  }
  extra.push({ x: cx, y: cy }, { x: 36, y: 30 });
  const s = surveys(ground, design, surveyGrid(W, H, 3.6, 23), extra);
  return {
    id: "irregular",
    name: "Irregular Excavation",
    description: "Detention basin · irregular outline · sump · 1:2 side slopes",
    ground: toXyz("EG", s.ground),
    excavated: toXyz("EX", s.excavated),
    groundLevel: 651.5,
  };
}

const builders: Record<SampleId, () => Dataset> = { simple, road, irregular };
const cache = new Map<SampleId, Dataset>();

export const SAMPLE_IDS: SampleId[] = ["road", "simple", "irregular"];
export const SAMPLE_NAMES: Record<SampleId, string> = { simple: "Simple Excavation", road: "Road Excavation", irregular: "Irregular Excavation" };
export const DEFAULT_SAMPLE: SampleId = "road";

export function getSample(id: SampleId): Dataset {
  let d = cache.get(id);
  if (!d) {
    d = builders[id]();
    cache.set(id, d);
  }
  return d;
}

/** A dataset as X,Y,Z text, as a surveyor would send it. */
export function toCsv(points: XyzPoint[], withId = true) {
  const head = withId ? "POINT_ID,X,Y,Z" : "X,Y,Z";
  return [head, ...points.map((p) => (withId ? `${p.id},${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}` : `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`))].join("\n") + "\n";
}
