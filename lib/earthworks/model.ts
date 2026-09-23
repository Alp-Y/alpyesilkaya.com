/**
 * EARTHWORKS MODEL — the maths behind the hero's cut / fill demonstration.
 * ------------------------------------------------------------------
 * A 120 m stretch of new road across rolling ground:
 *   existing ground  a hill (west) and a hollow (east)
 *   design           a 15 m formation on a steady grade, 1:2 side slopes
 *                    that run out until they meet the ground ("daylight")
 *   cut              where the ground is above the design  (material out)
 *   fill             where the ground is below the design  (material in)
 *
 * Volumes use the grid method: each 1 m cell × the mean depth at its
 * corners. The numbers are computed from this model — a demonstration
 * surface, not a real site.
 *
 * Axes: x along the road (east), z across it (+z = south = towards the
 * viewer in the FRONT view), y up. Metres.
 */

export const LENGTH = 120;
export const WIDTH = 64;
export const STEP = 1;
export const NX = LENGTH / STEP + 1;
export const NZ = WIDTH / STEP + 1;
export const HALF_FORMATION = 7.5; // carriageway + shoulders
export const HALF_CARRIAGEWAY = 5.5;
export const SIDE_SLOPE = 0.5; // 1 vertical : 2 horizontal
export const BASE = 20; // datum used for display
/** Vertical exaggeration for display — makes a 6 m cut read as a volume (stated in the legend). */
export const VERTICAL_EXAGGERATION = 2;

export function groundLevel(x: number, z: number): number {
  return (
    BASE +
    5.6 * Math.exp(-(((x + 26) / 19) ** 2)) * (1 + 0.12 * Math.sin(z / 7)) -
    4.6 * Math.exp(-(((x - 30) / 16) ** 2)) +
    0.9 * Math.sin(x / 9 + z / 13) +
    0.55 * Math.cos(z / 8 - x / 23) +
    0.035 * z
  );
}

export function roadLevel(x: number): number {
  return BASE + 0.35 + 0.02 * x;
}

export function designLevel(x: number, z: number, g = groundLevel(x, z)): number {
  const r = roadLevel(x);
  const beyond = Math.max(0, Math.abs(z) - HALF_FORMATION);
  if (g > r) return Math.min(g, r + beyond * SIDE_SLOPE); // cut slope rises to meet the ground
  return Math.max(g, r - beyond * SIDE_SLOPE); // fill slope falls to meet the ground
}

export type EarthworksModel = {
  /** Vertex grids, row-major [iz * NX + ix] */
  x: Float32Array;
  z: Float32Array;
  ground: Float32Array;
  design: Float32Array;
  /** ground − design: + cut, − fill */
  depth: Float32Array;
  cut: number; // m³
  fill: number; // m³
  cutArea: number; // m² footprint
  fillArea: number;
  maxCut: number;
  maxFill: number;
  cutCentre: [number, number, number];
  fillCentre: [number, number, number];
};

export function buildModel(): EarthworksModel {
  const n = NX * NZ;
  const x = new Float32Array(n);
  const z = new Float32Array(n);
  const ground = new Float32Array(n);
  const design = new Float32Array(n);
  const depth = new Float32Array(n);
  let maxCut = 0;
  let maxFill = 0;
  for (let iz = 0; iz < NZ; iz++) {
    for (let ix = 0; ix < NX; ix++) {
      const i = iz * NX + ix;
      const px = -LENGTH / 2 + ix * STEP;
      const pz = -WIDTH / 2 + iz * STEP;
      const g = groundLevel(px, pz);
      const d = designLevel(px, pz, g);
      x[i] = px;
      z[i] = pz;
      ground[i] = g;
      design[i] = d;
      depth[i] = g - d;
      maxCut = Math.max(maxCut, g - d);
      maxFill = Math.max(maxFill, d - g);
    }
  }

  // Grid method: cell volume = cell area × mean corner depth (cut and fill separately)
  let cut = 0;
  let fill = 0;
  let cutArea = 0;
  let fillArea = 0;
  const cc = [0, 0, 0];
  const fc = [0, 0, 0];
  const cellArea = STEP * STEP;
  for (let iz = 0; iz < NZ - 1; iz++) {
    for (let ix = 0; ix < NX - 1; ix++) {
      const a = iz * NX + ix;
      const corners = [a, a + 1, a + NX, a + NX + 1];
      let c = 0;
      let f = 0;
      for (const k of corners) {
        c += Math.max(0, depth[k]) / 4;
        f += Math.max(0, -depth[k]) / 4;
      }
      const mx = x[a] + STEP / 2;
      const mz = z[a] + STEP / 2;
      if (c > 1e-4) {
        cut += c * cellArea;
        cutArea += cellArea;
        cc[0] += mx * c;
        cc[1] += (ground[a] + design[a]) * 0.5 * c;
        cc[2] += mz * c;
      }
      if (f > 1e-4) {
        fill += f * cellArea;
        fillArea += cellArea;
        fc[0] += mx * f;
        fc[1] += (ground[a] + design[a]) * 0.5 * f;
        fc[2] += mz * f;
      }
    }
  }
  const cs = cut / cellArea || 1;
  const fs = fill / cellArea || 1;
  return {
    x,
    z,
    ground,
    design,
    depth,
    cut,
    fill,
    cutArea,
    fillArea,
    maxCut,
    maxFill,
    cutCentre: [cc[0] / cs, cc[1] / cs, cc[2] / cs],
    fillCentre: [fc[0] / fs, fc[1] / fs, fc[2] / fs],
  };
}

/** Bilinear sample of a vertex grid at (x, z). */
export function sample(grid: Float32Array, px: number, pz: number): number {
  const fx = Math.min(NX - 1.001, Math.max(0, (px + LENGTH / 2) / STEP));
  const fz = Math.min(NZ - 1.001, Math.max(0, (pz + WIDTH / 2) / STEP));
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = fx - ix;
  const tz = fz - iz;
  const i = iz * NX + ix;
  return (
    grid[i] * (1 - tx) * (1 - tz) + grid[i + 1] * tx * (1 - tz) + grid[i + NX] * (1 - tx) * tz + grid[i + NX + 1] * tx * tz
  );
}
