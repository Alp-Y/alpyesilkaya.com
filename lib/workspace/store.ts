/**
 * WORKSPACE STATE — the single source of truth
 * ------------------------------------------------------------------
 * The site behaves like one engineering workspace. Everything that more
 * than one part of the UI needs to agree on lives here:
 *
 *   viewport   orientation, display mode, overlays (toolbar, ViewCube,
 *              command line and the Quantity by Area Calculator all read it)
 *   selection  which engineering entity is selected / hovered
 *   activity   what kind of motion should dominate right now
 *
 * It's a tiny external store (no library): components subscribe with the
 * `useWorkspace` hook, plain TypeScript modules with `subscribe`.
 * High-frequency values (pointer position, camera angles during a drag)
 * are NOT pushed through React — only meaningful state changes are.
 *
 * To change state, call the functions in ./actions.ts, never `setState`
 * directly from a component.
 */

import { useSyncExternalStore } from "react";

export type Orientation = "iso" | "top" | "bottom" | "front" | "back" | "left" | "right" | "free";
export type DisplayMode = "wireframe" | "shaded" | "analysis";
/** What kind of motion should dominate (used to quieten ambient motion). */
export type Activity = "idle" | "navigation" | "interaction" | "analysis" | "transition";

export type WorkspaceState = {
  viewport: {
    orientation: Orientation;
    displayMode: DisplayMode;
    overlaysVisible: boolean;
    /** Degrees, only updated when a view settles (not every frame). */
    azimuth: number;
    elevation: number;
    /** Incremented to ask the ViewCube to animate to `orientation`. */
    request: number;
    /** Incremented to ask the ViewCube to reset zoom + view. */
    resetRequest: number;
  };
  /** Stable entity IDs, e.g. "BOUNDARY:A01-N", "WORK:EXC-01", "INTERSECTION:A01-N:EXC-01". */
  selection: string | null;
  hover: string | null;
  activity: Activity;
};

const initial: WorkspaceState = {
  viewport: {
    // The page opens in FRONT view, turning slowly (see InteractiveViewCube autoSpin)
    orientation: "front",
    displayMode: "wireframe",
    overlaysVisible: true,
    azimuth: 0,
    elevation: 0,
    request: 0,
    resetRequest: 0,
  },
  selection: null,
  hover: null,
  activity: "idle",
};

type Listener = () => void;

let state: WorkspaceState = initial;
const listeners = new Set<Listener>();

export function getState(): WorkspaceState {
  return state;
}

export function setState(update: (s: WorkspaceState) => WorkspaceState) {
  const next = update(state);
  if (next === state) return;
  state = next;
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Run `callback` whenever the selected slice changes (compared with ===).
 * Returns an unsubscribe function.
 */
export function watch<T>(selector: (s: WorkspaceState) => T, callback: (value: T, previous: T) => void): () => void {
  let previous = selector(state);
  return subscribe(() => {
    const value = selector(state);
    if (value !== previous) {
      const old = previous;
      previous = value;
      callback(value, old);
    }
  });
}

/** React hook: re-renders only when the selected slice changes. */
export function useWorkspace<T>(selector: (s: WorkspaceState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(initial),
  );
}
