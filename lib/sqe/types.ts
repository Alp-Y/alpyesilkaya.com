import type { Point, Polygon } from "./geometry";
import type { WorkTypeId } from "./workTypes";

/**
 * SHARED ENGINEERING ENTITY MODEL
 * ------------------------------------------------------------------
 * One representation, used by the viewport, the project tree, the
 * properties panel, the report and the HUD. Everything is referenced by
 * stable IDs:
 *
 *   BOUNDARY:B03              a project area (its display ID, e.g. A01-N, is metadata)
 *   WORK:EXC-01               a piece of work geometry
 *   INTERSECTION:B03:EXC-01   work geometry ∩ project area
 *   ROW:B03:EXCAVATION        a report row (all intersections of one type in one area)
 */

export type AreaMeta = {
  areaId: string; // e.g. A01-N
  name: string; // e.g. Main Road North
  section: string; // e.g. Main Road
  side: string; // e.g. North
};

export type Boundary = {
  key: string; // stable, e.g. B03
  polygon: Polygon;
  meta: AreaMeta | null; // null until assigned
  /** Metadata the example project suggests (used by AUTO ASSIGN). */
  suggested?: AreaMeta;
};

export type WorkItem = {
  code: string; // stable, e.g. EXC-01
  type: WorkTypeId;
  geometry: { kind: "polygon"; points: Polygon } | { kind: "polyline"; points: Point[] };
  /** Extra descriptor shown in the HUD, e.g. "Ø600". */
  spec?: string;
};

/** Reference drawing (roads, centreline, stations) — not part of any calculation. */
export type ContextLine = { points: Point[]; style: "edge" | "centre" | "context" };
export type Station = { at: Point; label: string; angle: number };

export type Project = {
  name: string;
  source: "example" | "dxf";
  boundaries: Boundary[];
  work: WorkItem[];
  context: ContextLine[];
  stations: Station[];
};

export type Intersection = {
  id: string; // INTERSECTION:B03:EXC-01
  boundaryKey: string;
  workCode: string;
  type: WorkTypeId;
  /** m² for polygons, m for polylines */
  measure: number;
  /** Reported quantity in the work type's unit (area, area × depth, or length). */
  quantity: number;
  /** Where to place its annotation (inside the intersection). */
  anchor: Point;
};

export type ReportRow = {
  id: string; // ROW:B03:EXCAVATION
  boundaryKey: string;
  type: WorkTypeId;
  quantity: number;
  intersectionIds: string[];
};

export const ids = {
  boundary: (key: string) => `BOUNDARY:${key}`,
  work: (code: string) => `WORK:${code}`,
  intersection: (key: string, code: string) => `INTERSECTION:${key}:${code}`,
  row: (key: string, type: string) => `ROW:${key}:${type}`,
};

export function parseId(id: string | null):
  | { kind: "boundary"; key: string }
  | { kind: "work"; code: string }
  | { kind: "intersection"; key: string; code: string }
  | { kind: "row"; key: string; type: WorkTypeId }
  | null {
  if (!id) return null;
  const [kind, a, b] = id.split(":");
  if (kind === "BOUNDARY" && a) return { kind: "boundary", key: a };
  if (kind === "WORK" && a) return { kind: "work", code: a };
  if (kind === "INTERSECTION" && a && b) return { kind: "intersection", key: a, code: b };
  if (kind === "ROW" && a && b) return { kind: "row", key: a, type: b as WorkTypeId };
  return null;
}
