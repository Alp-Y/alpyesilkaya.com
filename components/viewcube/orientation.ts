/**
 * ORIENTATION MATHS
 * ------------------------------------------------------------------
 * The view is described like a CAD "turntable" camera:
 *
 *   azimuth   — rotation around the world up-axis (+Y), in radians.
 *               0 = looking from FRONT (+Z), +π/2 = from RIGHT (+X).
 *   elevation — angle above the ground plane, −π/2 … +π/2.
 *               +π/2 = looking straight down (TOP view).
 *
 * World axes (Three.js convention, Y up):
 *   +X = RIGHT / East     +Y = TOP / up     +Z = FRONT / South
 *   North therefore points to −Z, which is "up the screen" in the TOP
 *   view — the same as plan view in AutoCAD / Civil 3D.
 *
 * The camera orientation is the quaternion  q = Ry(azimuth) · Rx(−elevation).
 * Building it this way is well defined everywhere, including straight
 * up/down (no lookAt() singularity) and never introduces camera roll,
 * so the view can't flip.
 */

import { Quaternion, Vector3 } from "three";

export type PresetName =
  | "home"
  | "top"
  | "bottom"
  | "front"
  | "back"
  | "left"
  | "right";

/** A face / edge / corner of the cube, as a direction with components in {−1, 0, 1}. */
export type Region = { x: -1 | 0 | 1; y: -1 | 0 | 1; z: -1 | 0 | 1 };

export type ViewAngles = { azimuth: number; elevation: number };

export type OrientationChange = {
  /** Camera orientation in world space (a copy — safe to keep). */
  quaternion: Quaternion;
  /** Degrees, 0–360. 0 = looking from the FRONT (south), 90 = from the RIGHT (east). */
  azimuth: number;
  /** Degrees, −90 (from below) to +90 (straight down, plan view). */
  elevation: number;
  zoom: number;
  /** Named view when the camera rests exactly on one, otherwise null. */
  preset: PresetName | null;
  mode: "free" | "preset";
  /** What is moving the view right now. */
  interaction: "drag" | "transition" | "inertia" | "rest";
};

const DEG = Math.PI / 180;

/** True isometric elevation: the angle of the (1,1,1) diagonal above the ground ≈ 35.264°. */
export const ISO_ELEVATION = Math.atan(1 / Math.SQRT2);

export const HOME: ViewAngles = { azimuth: 45 * DEG, elevation: ISO_ELEVATION };

export const PRESETS: Record<PresetName, ViewAngles> = {
  home: HOME,
  top: { azimuth: 0, elevation: Math.PI / 2 },
  bottom: { azimuth: 0, elevation: -Math.PI / 2 },
  front: { azimuth: 0, elevation: 0 },
  back: { azimuth: Math.PI, elevation: 0 },
  right: { azimuth: Math.PI / 2, elevation: 0 },
  left: { azimuth: -Math.PI / 2, elevation: 0 },
};

/** Elevation limits for free orbiting — exactly ±90° is allowed (plan views). */
export const MAX_ELEVATION = Math.PI / 2;

const _yAxis = new Vector3(0, 1, 0);
const _xAxis = new Vector3(1, 0, 0);
const _qa = new Quaternion();
const _qb = new Quaternion();

/** Camera orientation for a turntable view. Writes into `target`. */
export function quaternionFromAngles({ azimuth, elevation }: ViewAngles, target = new Quaternion()): Quaternion {
  _qa.setFromAxisAngle(_yAxis, azimuth);
  _qb.setFromAxisAngle(_xAxis, -elevation);
  return target.copy(_qa).multiply(_qb);
}

/** Direction from the target to the camera (unit vector). */
export function directionFromAngles({ azimuth, elevation }: ViewAngles, target = new Vector3()): Vector3 {
  const c = Math.cos(elevation);
  return target.set(Math.sin(azimuth) * c, Math.sin(elevation), Math.cos(azimuth) * c);
}

/**
 * Viewing angles that look at a face, edge or corner from outside.
 * Faces: 90° views. Edges: 45° views. Corners: true isometric views.
 * TOP and BOTTOM keep FRONT at the bottom of the screen (azimuth 0).
 */
export function anglesForRegion(r: Region): ViewAngles {
  const v = new Vector3(r.x, r.y, r.z).normalize();
  const elevation = Math.asin(clamp(v.y, -1, 1));
  const horizontal = Math.hypot(v.x, v.z);
  const azimuth = horizontal < 1e-6 ? 0 : Math.atan2(v.x, v.z);
  return { azimuth, elevation };
}

/** Human-readable name for a region, e.g. "TOP", "TOP · FRONT", "TOP · FRONT · RIGHT". */
export function regionName(r: Region): string {
  const parts: string[] = [];
  if (r.y === 1) parts.push("TOP");
  if (r.y === -1) parts.push("BOTTOM");
  if (r.z === 1) parts.push("FRONT");
  if (r.z === -1) parts.push("BACK");
  if (r.x === 1) parts.push("RIGHT");
  if (r.x === -1) parts.push("LEFT");
  return parts.join(" · ");
}

export function regionKey(r: Region): string {
  return `${r.x},${r.y},${r.z}`;
}

/** The named preset a set of angles matches exactly (within a small tolerance), if any. */
export function presetForAngles(a: ViewAngles): PresetName | null {
  for (const [name, p] of Object.entries(PRESETS) as [PresetName, ViewAngles][]) {
    const sameEl = Math.abs(a.elevation - p.elevation) < 0.5 * DEG;
    const poles = Math.abs(Math.abs(p.elevation) - Math.PI / 2) < 1e-6;
    const sameAz = poles || Math.abs(wrapAngle(a.azimuth - p.azimuth)) < 0.5 * DEG;
    if (sameEl && sameAz) return name;
  }
  return null;
}

/** Wrap an angle to (−π, π]. */
export function wrapAngle(a: number): number {
  let x = (a + Math.PI) % (2 * Math.PI);
  if (x < 0) x += 2 * Math.PI;
  return x - Math.PI;
}

/** `to` rewritten so that the path from `from` takes the short way round. */
export function nearestAngle(from: number, to: number): number {
  return from + wrapAngle(to - from);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export const toDegrees = (rad: number) => rad / DEG;
export const toRadians = (deg: number) => deg * DEG;
