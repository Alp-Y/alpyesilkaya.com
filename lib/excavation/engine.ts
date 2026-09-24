/**
 * EXCAVATION VOLUME ENGINE — the whole calculation in one call.
 * ------------------------------------------------------------------
 *   INPUT      XYZ survey points (sample or uploaded)
 *   SURFACES   excavated TIN  +  existing ground (TIN or a level)
 *   CALCULATE  composite TIN → cut / fill, areas, depths, breakdowns
 *   INSPECT    sections (see volume.ts → section)
 *   EXPORT     report data (report.ts) → .xlsx (lib/xlsx)
 *
 * Pure functions, no UI: the page, the Excel export and the build-time
 * example report all call `runEngine` and therefore always agree.
 */

import { buildSurface, levelSurface, type P3, type Surface } from "./tin";
import { compare, endAreaCheck, type Comparison, type Ground } from "./volume";
import type { Dataset } from "./samples";
import type { XyzPoint } from "./xyz";

export type GroundInput = { kind: "sample" } | { kind: "level"; z: number } | { kind: "points"; points: XyzPoint[]; name: string };

export type EngineInput = { dataset: Dataset; ground: GroundInput };

export type EngineResult = {
  dataset: Dataset;
  ground: GroundInput;
  /** Real grid coordinates of local (0, 0). */
  origin: [number, number];
  excavated: Surface;
  existing: Surface;
  comparison: Comparison;
  check: ReturnType<typeof endAreaCheck>;
  /** input point counts */
  counts: { excavated: number; ground: number };
  /** Short description of the existing-ground source, for captions and the report. */
  groundLabel: string;
  /** Wall-clock time of the calculation (ms), for the status line. */
  ms: number;
};

export function runEngine({ dataset, ground }: EngineInput): EngineResult {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const groundPoints = ground.kind === "sample" ? dataset.ground ?? [] : ground.kind === "points" ? ground.points : [];
  const all = [...dataset.excavated, ...groundPoints];
  const origin: [number, number] = [Math.floor(Math.min(...all.map((p) => p.x)) / 10) * 10, Math.floor(Math.min(...all.map((p) => p.y)) / 10) * 10];
  const local = (pts: XyzPoint[]): P3[] => pts.map((p) => ({ x: p.x - origin[0], y: p.y - origin[1], z: p.z }));

  const excavated = buildSurface("Excavated surface", local(dataset.excavated));
  let g: Ground;
  let existing: Surface;
  let groundLabel: string;
  if (ground.kind === "level") {
    existing = levelSurface(ground.z, excavated);
    g = { kind: "level", z: ground.z };
    groundLabel = `Constant level ${ground.z.toFixed(2)} m`;
  } else {
    existing = buildSurface("Existing ground", local(groundPoints));
    g = { kind: "tin", surface: existing };
    groundLabel = ground.kind === "sample" ? "Existing ground survey (TIN)" : `${ground.name} (TIN)`;
  }
  const comparison = compare(excavated, g);
  const check = endAreaCheck(comparison);
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    dataset,
    ground,
    origin,
    excavated,
    existing,
    comparison,
    check,
    counts: { excavated: dataset.excavated.length, ground: groundPoints.length },
    groundLabel,
    ms: t1 - t0,
  };
}

/** Existing ground and excavated surface overlap? (false → nothing to compare) */
export function hasOverlap(r: EngineResult) {
  return r.comparison.tris.length > 0;
}
