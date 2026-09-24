/**
 * QUANTITY BY AREA CALCULATOR — demo state + actions.
 * ------------------------------------------------------------------
 * Engineering data lives here; selection / hover / display mode live in
 * the shared workspace store, so the drawing, the side panel, the report,
 * the HUD, the toolbar and the command line all stay in step.
 *
 * The example project tells its story in four steps:
 *   1 SITE        the aerial view of the works
 *   2 SURVEY      area corners measured on site → coordinates
 *   3 AREAS       coordinates → CAD polylines carrying area metadata
 *   4 QUANTITIES  work geometry × project area = quantity per area
 */

import { useSyncExternalStore } from "react";
import { selectEntity } from "../workspace/actions";
import { analyse, autoAssign, type Analysis } from "./engine";
import { exampleProject } from "./example";
import { parseDxf, type ImportSummary } from "./dxf";
import type { AreaMeta, Project } from "./types";
import { WORK_TYPE_ORDER, type WorkTypeId } from "./workTypes";

export type Step = 1 | 2 | 3 | 4;
export const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Site" },
  { n: 2, label: "Survey" },
  { n: 3, label: "Areas" },
  { n: 4, label: "Quantities" },
];

export type SqeState = {
  project: Project | null;
  analysis: Analysis | null;
  summary: ImportSummary | null;
  error: string | null;
  loading: boolean;
  step: Step;
  /** true while the 4-step story plays by itself */
  playing: boolean;
  workType: WorkTypeId | null;
  editNames: boolean;
  /** Window / crossing selection of several areas (boundary keys). */
  multi: { keys: string[]; mode: "window" | "crossing" } | null;
  filterArea: string; // report filters (details view)
  filterType: WorkTypeId | "all";
};

const initial: SqeState = {
  project: null,
  analysis: null,
  summary: null,
  error: null,
  loading: false,
  step: 4,
  playing: false,
  workType: null,
  editNames: false,
  multi: null,
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

/** The work types a project contains, most telling first. */
export function workTypesIn(analysis: Analysis | null): WorkTypeId[] {
  if (!analysis) return [];
  const first: WorkTypeId[] = ["EXCAVATION", "DEMOLITION", "ASPHALT"];
  const order = [...first, ...WORK_TYPE_ORDER.filter((t) => !first.includes(t))];
  return order.filter((t) => analysis.rows.some((r) => r.type === t));
}

/* ---------------- actions ---------------- */

function open(project: Project, summary: ImportSummary | null, step: Step) {
  selectEntity(null);
  const analysis = analyse(project);
  set({
    project,
    analysis,
    summary,
    error: null,
    loading: false,
    step,
    playing: false,
    workType: workTypesIn(analysis)[0] ?? null,
    editNames: false,
    multi: null,
    filterArea: "all",
    filterType: "all",
  });
}

export function loadExample() {
  open(exampleProject(), null, 4);
}

export async function importDxf(file: File) {
  if (!/\.dxf$/i.test(file.name)) {
    set({ error: "Please choose a .dxf file. DWG isn't supported. Export or save as DXF first." });
    return;
  }
  set({ loading: true, error: null });
  try {
    const text = await file.text();
    const { project, summary, error } = parseDxf(text, file.name);
    if (!project) set({ loading: false, error: error ?? "Nothing usable found in this file.", summary });
    else open(project, summary, 4);
  } catch {
    set({ loading: false, error: "The file couldn't be read. It may be binary or corrupted." });
  }
}

/** Leave an imported drawing and return to the example project. */
export function backToExample() {
  loadExample();
}

export function setStep(step: Step) {
  set({ step, playing: false });
}

/** Play the story 1 → 4. The caller drives the timing (see SpatialQuantityEngine). */
export function startStory() {
  selectEntity(null);
  set({ step: 1, playing: true });
}
export function advanceStory() {
  if (!state.playing) return;
  if (state.step >= 4) set({ playing: false });
  else set({ step: (state.step + 1) as Step, playing: state.step + 1 < 4 });
}
export function stopStory() {
  if (state.playing) set({ playing: false, step: 4 });
}

export function setWorkType(workType: WorkTypeId) {
  set({ workType, step: 4, playing: false });
}

/** Imported drawings: name every unnamed closed region A01, A02 … */
export function autoNameAreas() {
  if (!state.project) return;
  const project = { ...state.project, boundaries: autoAssign(state.project.boundaries) };
  set({ project, analysis: analyse(project) });
}

/** Several areas picked with a selection window; null clears it. */
export function setMulti(multi: SqeState["multi"]) {
  if (multi && multi.keys.length) selectEntity(null);
  set({ multi: multi && multi.keys.length ? multi : null, ...(multi && multi.keys.length ? { step: 4 as Step, playing: false } : {}) });
}

export function setEditNames(editNames: boolean) {
  set({ editNames });
}

/** Rename one area — labels, panel, report and HUD update immediately. */
export function updateAreaMeta(key: string, patch: Partial<AreaMeta>) {
  if (!state.project) return;
  const boundaries = state.project.boundaries.map((b) => {
    if (b.key !== key) return b;
    const base: AreaMeta = b.meta ?? b.suggested ?? { areaId: b.key, name: "", section: "·", side: "·" };
    return { ...b, meta: { ...base, ...patch } };
  });
  // Geometry didn't change, so the analysis is still valid
  set({ project: { ...state.project, boundaries } });
}

export function setFilter(filter: { area?: string; type?: WorkTypeId | "all" }) {
  set({
    filterArea: filter.area ?? state.filterArea,
    filterType: filter.type ?? state.filterType,
  });
}
