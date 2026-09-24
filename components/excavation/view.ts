import type { Comparison } from "@/lib/excavation/volume";

/**
 * Vertical exaggeration for the 3D view: relief should read at a glance
 * without distorting the site. Between ×1 and ×4, in steps of 0.5.
 * (Display only: every quantity is computed at true scale.)
 */
export function verticalExaggeration(c: Comparison) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of c.vertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const relief = Math.max(c.exZMax, c.egZMax) - Math.min(c.exZMin, c.egZMin);
  return Math.max(1, Math.min(4, Math.round(((span * 0.12) / Math.max(0.5, relief)) * 2) / 2));
}
