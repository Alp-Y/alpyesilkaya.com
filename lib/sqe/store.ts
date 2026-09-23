/**
 * SPATIAL QUANTITY ENGINE — demo state + actions.
 * ------------------------------------------------------------------
 * Engineering data lives here; selection / hover / display mode live in
 * the shared workspace store, so the viewport, project tree, properties,
 * report, HUD, toolbar and command line all stay in step.
 */

import { useSyncExternalStore } from "react";
import { selectEntity, setDisplayMode, setOrientation } from "../workspace/actions";
import { analyse, autoAssign, type Analysis } from "./engine";
import { exampleProject } from "./example";
import { parseDxf, type ImportSummary } from "./dxf";
import type { AreaMeta, Project } from "./types";
import type { WorkTypeId } from "./workTypes";

export type SqeState = {
  project: Project | null;
  analysis: Analysis | null;
  summary: ImportSummary | null;
  error: string | null;
  loading: boolean;
  assignMode: "auto" | "manual";
  filterArea: string; // boundary key or "all"
  filterType: WorkTypeId | "all";
};

const initial: SqeState = {
  project: null,
  analysis: null,
  summary: null,
  error: null,
  loading: false,
  assignMode: "auto",
  filterArea: "all",
  filterType: "all",
};

let state = initial;
const listeners = new Set<() => void>();
const set = (patch: Partial<SqeState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const getSqe = () => state;
export const subscribeSqe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function useSqe<T>(selector: (s: SqeState) => T): T {
  return useSyncExternalStore(
    subscribeSqe,
    () => selector(state),
    () => selector(initial),
  );
}

/* ---------------- actions ---------------- */

function open(project: Project, summary: ImportSummary | null) {
  selectEntity(null);
  set({ project, analysis: analyse(project), summary, error: null, loading: false, filterArea: "all", filterType: "all" });
  // A plan drawing reads best in plan view
  setOrientation("top");
}

export function loadExample() {
  open(exampleProject(), null);
}

export async function importDxf(file: File) {
  if (!/\.dxf$/i.test(file.name)) {
    set({ error: "Please choose a .dxf file. DWG isn't supported — export or save as DXF first." });
    return;
  }
  set({ loading: true, error: null });
  try {
    const text = await file.text();
    const { project, summary, error } = parseDxf(text, file.name);
    if (!project) set({ loading: false, error: error ?? "Nothing usable found in this file.", summary });
    else open(project, summary);
  } catch {
    set({ loading: false, error: "The file couldn't be read. It may be binary or corrupted." });
  }
}

export function closeProject() {
  selectEntity(null);
  set({ ...initial });
}

export function setAssignMode(mode: "auto" | "manual") {
  set({ assignMode: mode });
}

/** STEP 02 — assign area metadata automatically. */
export function autoAssignAreas() {
  if (!state.project) return;
  const project = { ...state.project, boundaries: autoAssign(state.project.boundaries) };
  set({ project, analysis: analyse(project), assignMode: "auto" });
}

/** Manual edit of one area's metadata — labels update immediately. */
export function updateAreaMeta(key: string, patch: Partial<AreaMeta>) {
  if (!state.project) return;
  const boundaries = state.project.boundaries.map((b) => {
    if (b.key !== key) return b;
    const base: AreaMeta = b.meta ?? b.suggested ?? { areaId: b.key, name: "", section: "", side: "" };
    return { ...b, meta: { ...base, ...patch } };
  });
  const project = { ...state.project, boundaries };
  // Geometry didn't change, so the analysis is still valid
  set({ project });
}

export function setFilter(filter: { area?: string; type?: WorkTypeId | "all" }) {
  set({
    filterArea: filter.area ?? state.filterArea,
    filterType: filter.type ?? state.filterType,
  });
}

/** Jump to the analysis view (used by the "Show intersections" shortcut). */
export function showAnalysis() {
  setDisplayMode("analysis");
}
