/**
 * THE FILM'S RUNNING ORDER — one entry per scene. Each scene draws itself
 * from its own clock (seconds into the scene), so any chapter can play on
 * its own, loop, or be scrubbed to.
 */

import type { Frame } from "./draw";
import { areasScene, openScene } from "./scenesPlan";
import { surfaceScene } from "./scenesSurface";
import { drainageScene, finaleScene, progressScene, reportScene, traceScene } from "./scenesWork";
import { CHAPTERS, type ChapterId } from "./chapters";

const DRAW: Record<ChapterId, (f: Frame) => void> = {
  overview: openScene,
  quantities: areasScene,
  surfaces: surfaceScene,
  drainage: drainageScene,
  progress: progressScene,
  traceability: traceScene,
  report: reportScene,
  summary: finaleScene,
};

export type Scene = { id: ChapterId; dur: number; start: number; draw: (f: Frame) => void };

export function buildTimeline(ids?: readonly ChapterId[]): { scenes: Scene[]; duration: number } {
  let start = 0;
  const scenes = CHAPTERS.filter((c) => !ids || ids.includes(c.id)).map((c) => {
    const s = { id: c.id, dur: c.dur, start, draw: DRAW[c.id] };
    start += c.dur;
    return s;
  });
  return { scenes, duration: start };
}
