/**
 * THE ENGINE — spatial intersection → quantities → report.
 * ------------------------------------------------------------------
 *   WORK GEOMETRY ∩ PROJECT AREA = AREA-SPECIFIC QUANTITY
 *
 * Pure functions: give it a project, get intersections and report rows.
 * Nothing here knows about React or the page.
 */

import { absArea, centroid, clipPolyline, intersectPolygons, length, triangulate, type Point, type Polygon } from "./geometry";
import { WORK_TYPES, WORK_TYPE_ORDER, type WorkTypeId } from "./workTypes";
import { ids, type Boundary, type Intersection, type Project, type ReportRow, type WorkItem } from "./types";

export type Analysis = {
  intersections: Intersection[];
  rows: ReportRow[];
  /** Per work item: total measure, attributed measure, remainder outside all project areas. */
  totals: Record<string, { measure: number; attributed: number; outside: number }>;
  boundaryArea: Record<string, number>;
};

export function analyse(project: Project): Analysis {
  const tris = new Map<string, Polygon[]>();
  for (const b of project.boundaries) tris.set(b.key, triangulate(b.polygon));

  const intersections: Intersection[] = [];
  const totals: Analysis["totals"] = {};
  const boundaryArea: Record<string, number> = {};
  for (const b of project.boundaries) boundaryArea[b.key] = absArea(b.polygon);

  for (const w of project.work) {
    const type = WORK_TYPES[w.type];
    const measureTotal = w.geometry.kind === "polygon" ? absArea(w.geometry.points) : length(w.geometry.points);
    let attributed = 0;
    for (const b of project.boundaries) {
      const t = tris.get(b.key)!;
      let measure = 0;
      let anchor: Point = [0, 0];
      if (w.geometry.kind === "polygon") {
        const r = intersectPolygons(w.geometry.points, b.polygon, t);
        measure = r.area;
        const biggest = r.pieces.reduce<{ a: number; p: Polygon | null }>(
          (best, p) => (absArea(p) > best.a ? { a: absArea(p), p } : best),
          { a: 0, p: null },
        );
        if (biggest.p) anchor = centroid(biggest.p);
      } else {
        const r = clipPolyline(w.geometry.points, b.polygon, t);
        measure = r.length;
        const longest = r.segments.reduce<{ l: number; s: [Point, Point] | null }>((best, s) => {
          const l = Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);
          return l > best.l ? { l, s } : best;
        }, { l: 0, s: null });
        if (longest.s) anchor = [(longest.s[0][0] + longest.s[1][0]) / 2, (longest.s[0][1] + longest.s[1][1]) / 2];
      }
      if (measure < 0.005) continue;
      attributed += measure;
      intersections.push({
        id: ids.intersection(b.key, w.code),
        boundaryKey: b.key,
        workCode: w.code,
        type: w.type,
        measure,
        quantity: type.measure === "volume" ? measure * (type.depth ?? 1) : measure,
        anchor,
      });
    }
    totals[w.code] = { measure: measureTotal, attributed, outside: Math.max(0, measureTotal - attributed) };
  }

  // Report rows: one per (area, work type)
  const rowMap = new Map<string, ReportRow>();
  for (const i of intersections) {
    const id = ids.row(i.boundaryKey, i.type);
    const row = rowMap.get(id) ?? { id, boundaryKey: i.boundaryKey, type: i.type, quantity: 0, intersectionIds: [] };
    row.quantity += i.quantity;
    row.intersectionIds.push(i.id);
    rowMap.set(id, row);
  }
  const order = new Map(project.boundaries.map((b, i) => [b.key, i]));
  const rows = [...rowMap.values()].sort(
    (a, b) =>
      (order.get(a.boundaryKey)! - order.get(b.boundaryKey)!) ||
      WORK_TYPE_ORDER.indexOf(a.type) - WORK_TYPE_ORDER.indexOf(b.type),
  );

  return { intersections, rows, totals, boundaryArea };
}

/** Display ID of an area: its assigned metadata ID, or the provisional key. */
export function areaLabel(b: Boundary | undefined): string {
  if (!b) return "·";
  return b.meta?.areaId ?? b.key.replace(/^B/, "B-");
}

/**
 * AUTO ASSIGN
 *  - example project: the scheme's own area IDs (A01-N, A01-S …)
 *  - imported drawings: A01, A02 … ordered west → east, then south → north
 */
export function autoAssign(boundaries: Boundary[]): Boundary[] {
  if (boundaries.every((b) => b.suggested)) return boundaries.map((b) => ({ ...b, meta: { ...b.suggested! } }));
  const sorted = [...boundaries].sort((a, b) => {
    const ca = firstCorner(a.polygon);
    const cb = firstCorner(b.polygon);
    return ca[0] - cb[0] || ca[1] - cb[1];
  });
  const idFor = new Map(sorted.map((b, i) => [b.key, `A${String(i + 1).padStart(2, "0")}`]));
  return boundaries.map((b) => ({
    ...b,
    meta: b.meta ?? { areaId: idFor.get(b.key)!, name: `Area ${idFor.get(b.key)}`, section: "·", side: "·" },
  }));
}

function firstCorner(p: Polygon) {
  let minX = Infinity;
  let minY = Infinity;
  for (const [x, y] of p) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
  }
  return [minX, minY];
}

export function workLabel(w: WorkItem) {
  return `${WORK_TYPES[w.type].label} ${w.code}`;
}

export function typeOf(id: WorkTypeId) {
  return WORK_TYPES[id];
}
