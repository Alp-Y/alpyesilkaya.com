/**
 * TRACEABILITY — what to highlight for the current selection.
 * One function, used by the viewport, the project tree and the report,
 * so a number can always be traced back to its geometry (and back again).
 */

import type { Analysis } from "./engine";
import { parseId } from "./types";

export type Highlight = {
  boundaries: Set<string>;
  work: Set<string>;
  intersections: Set<string>;
  rows: Set<string>;
};

export function highlightFor(selection: string | null, analysis: Analysis | null): Highlight {
  const h: Highlight = { boundaries: new Set(), work: new Set(), intersections: new Set(), rows: new Set() };
  const sel = parseId(selection);
  if (!sel || !analysis) return h;
  const { intersections, rows } = analysis;

  if (sel.kind === "boundary") {
    h.boundaries.add(sel.key);
    intersections.filter((i) => i.boundaryKey === sel.key).forEach((i) => h.intersections.add(i.id));
    rows.filter((r) => r.boundaryKey === sel.key).forEach((r) => h.rows.add(r.id));
  } else if (sel.kind === "work") {
    h.work.add(sel.code);
    intersections.filter((i) => i.workCode === sel.code).forEach((i) => h.intersections.add(i.id));
  } else if (sel.kind === "intersection") {
    h.intersections.add(selection!);
    h.boundaries.add(sel.key);
    h.work.add(sel.code);
  } else if (sel.kind === "row") {
    h.rows.add(selection!);
    h.boundaries.add(sel.key);
    rows.find((r) => r.id === selection)?.intersectionIds.forEach((id) => h.intersections.add(id));
  }
  // Rows that contain any highlighted intersection
  if (sel.kind !== "row") {
    rows.filter((r) => r.intersectionIds.some((id) => h.intersections.has(id))).forEach((r) => h.rows.add(r.id));
  }
  return h;
}
