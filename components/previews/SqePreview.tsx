"use client";

import { useEffect, useMemo, useRef } from "react";
import SqeViewport, { type SqePreviewState } from "@/components/sqe/SqeViewport";
import { analyse } from "@/lib/sqe/engine";
import { exampleProject } from "@/lib/sqe/example";
import { getSqe, loadExample, useSqe } from "@/lib/sqe/store";
import { usePreviewLoop } from "./usePreviewLoop";
import { useHold } from "./useHold";
import { usePlanOrbit } from "./usePlanOrbit";
import ViewControls from "./ViewControls";
import styles from "./preview.module.css";

/** Satellite image → survey points → CAD areas → quantities → analysis, on repeat. */
const PHASES: (SqePreviewState & { label: string; ms: number })[] = [
  { step: 1, view: "aerial", label: "Satellite", ms: 2600 },
  { step: 2, view: "aerial", label: "Survey", ms: 3400 },
  { step: 3, view: "cad", label: "CAD", ms: 3000 },
  { step: 4, view: "cad", label: "Quantities", ms: 3000 },
  { step: 4, view: "analysis", label: "Analysis", ms: 3800 },
];

/**
 * QUANTITY BY AREA — homepage preview. The real drawing from the tool
 * page, looping through its story on its own. It is something to handle,
 * not a link: drag to spin and tilt the plan, zoom with +/−. Holding it
 * pauses the story. The tool itself opens from the button beside it.
 */
export default function SqePreview({ title }: { title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const plan = useRef<HTMLDivElement>(null);
  const { held, heldRef } = useHold(area);
  const view = usePlanOrbit(area, plan);
  const { phase } = usePreviewLoop(
    ref,
    PHASES.map((p) => p.ms),
    undefined,
    heldRef,
  );
  const storeProject = useSqe((s) => s.project);
  const workType = useSqe((s) => s.workType);

  // the preview always shows the example project (not a DXF imported on the tool page)
  useEffect(() => {
    if (!getSqe().project) loadExample();
  }, []);
  const local = useMemo(() => {
    const project = exampleProject();
    return { project, analysis: analyse(project) };
  }, []);
  const project = storeProject?.source === "example" ? storeProject : local.project;
  const analysis = useSqe((s) => (storeProject?.source === "example" ? s.analysis : null)) ?? local.analysis;
  const current = PHASES[phase];

  return (
    <div ref={ref} className={styles.card} data-held={held}>
      <div ref={area} className={`${styles.stage} ${styles.sqe} ${styles.handle}`} data-ready={!!workType} role="img" aria-label={`${title}: example drawing. Drag to spin, use the buttons to zoom.`}>
        <div ref={plan} className={styles.turn}>
          <SqeViewport project={project} analysis={analysis} preview={{ step: current.step, view: current.view }} />
        </div>
        <ViewControls onIn={view.zoomIn} onOut={view.zoomOut} onReset={view.reset} label={title} />
      </div>
      <PreviewBar labels={PHASES.map((p) => p.label)} durations={PHASES.map((p) => p.ms)} phase={phase} held={held} hint="Drag to spin" />
    </div>
  );
}

/**
 * The preview's story, read left to right, with a thin line filling under
 * the step that is playing (so it reads as progress, not as tabs). The line
 * stops while the preview is held.
 */
export function PreviewBar({ labels, durations, phase, held = false, hint }: { labels: string[]; durations?: number[]; phase: number; held?: boolean; hint?: string }) {
  return (
    <div className={styles.bar} data-held={held}>
      <ol className={styles.phases} aria-hidden="true">
        {labels.map((l, i) => (
          <li key={l} data-on={i === phase} data-done={i < phase} style={durations ? ({ "--dur": `${durations[i]}ms` } as React.CSSProperties) : undefined}>
            <span className="num">{String(i + 1).padStart(2, "0")}</span> {l}
          </li>
        ))}
      </ol>
      {hint && (
        <span className={styles.hint} aria-hidden="true">
          {held ? "Paused" : hint}
        </span>
      )}
    </div>
  );
}
