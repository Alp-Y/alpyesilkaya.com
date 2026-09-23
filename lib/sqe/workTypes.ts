/**
 * WORK TYPES — the single, data-driven list.
 * ------------------------------------------------------------------
 * Every part of the demo (drawing styles, the report, the properties
 * panel, DXF layer matching) reads from here. Add a work type once and
 * it appears everywhere.
 *
 * measure:
 *   "area"   quantity = area inside the project area            (m²)
 *   "volume" quantity = area × representative depth             (m³)
 *            → a simplified DEMONSTRATION calculation, not a surface/TIN volume
 *   "length" quantity = length inside the project area          (lm)
 */

import type { Unit } from "../format";

export type WorkTypeId =
  | "DEMOLITION"
  | "EXCAVATION"
  | "FILL"
  | "SUBBASE"
  | "BASECOURSE"
  | "ASPHALT"
  | "CURB"
  | "STORMWATER";

export type WorkType = {
  id: WorkTypeId;
  label: string;
  /** Short code prefix for work items, e.g. EXC-01 */
  code: string;
  measure: "area" | "volume" | "length";
  unit: Unit;
  /** Representative depth (m) for "volume" work types — demonstration only. */
  depth?: number;
  /** Muted CAD layer colour. */
  color: string;
  /** SVG hatch pattern id (see HATCHES in the viewport) */
  hatch?: "cross" | "diag" | "dots" | "fine" | "sparse";
};

export const WORK_TYPES: Record<WorkTypeId, WorkType> = {
  DEMOLITION: { id: "DEMOLITION", label: "Demolition", code: "DEM", measure: "area", unit: "m²", color: "#c48a93", hatch: "cross" },
  EXCAVATION: { id: "EXCAVATION", label: "Excavation", code: "EXC", measure: "volume", unit: "m³", depth: 1.25, color: "#cfae6a", hatch: "diag" },
  FILL: { id: "FILL", label: "Fill", code: "FIL", measure: "volume", unit: "m³", depth: 1.5, color: "#86abcc", hatch: "dots" },
  SUBBASE: { id: "SUBBASE", label: "Subbase", code: "SUB", measure: "area", unit: "m²", color: "#98a3b0", hatch: "sparse" },
  BASECOURSE: { id: "BASECOURSE", label: "Basecourse", code: "BAS", measure: "area", unit: "m²", color: "#a9b2bc", hatch: "sparse" },
  ASPHALT: { id: "ASPHALT", label: "Asphalt", code: "ASP", measure: "area", unit: "m²", color: "#d3d9e0", hatch: "fine" },
  CURB: { id: "CURB", label: "Curb", code: "CRB", measure: "length", unit: "lm", color: "#d5d79e" },
  STORMWATER: { id: "STORMWATER", label: "Stormwater", code: "STW", measure: "length", unit: "lm", color: "#63b6d6" },
};

export const WORK_TYPE_ORDER: WorkTypeId[] = [
  "DEMOLITION",
  "EXCAVATION",
  "FILL",
  "SUBBASE",
  "BASECOURSE",
  "ASPHALT",
  "CURB",
  "STORMWATER",
];

/** Match a DXF layer name to a work type (e.g. "C-ASPHALT" → ASPHALT). */
export function workTypeForLayer(layer: string): WorkTypeId | null {
  const name = layer.toUpperCase();
  for (const id of WORK_TYPE_ORDER) {
    if (name.includes(id) || name.includes(WORK_TYPES[id].code)) return id;
  }
  if (name.includes("STORM") || name.includes("DRAIN")) return "STORMWATER";
  if (name.includes("KERB")) return "CURB";
  return null;
}
