"use client";

import { useEffect, useMemo, useRef } from "react";
import SqeViewport, { type SqePreviewState } from "@/components/sqe/SqeViewport";
import { analyse } from "@/lib/sqe/engine";
import { exampleProject } from "@/lib/sqe/example";
import { getSqe, loadExample, useSqe } from "@/lib/sqe/store";
import { hoverEntity, selectEntity } from "@/lib/workspace/actions";
import { usePreviewLoop } from "./usePreviewLoop";
import { useHold } from "./useHold";
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
 * page, looping through its story on its own. The steps underneath are
 * buttons (jump to one and the story carries on from there), and once the
 * areas are drawn you can point at them and click them. Pointing at the
 * drawing holds the story still. The tool itself opens from the button
 * beside it.
 */
export default function SqePreview({ title }: { title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const { held, heldRef } = useHold(area);
  const { phase, seek } = usePreviewLoop(
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
  // a selection made here stays here
  useEffect(
    () => () => {
      selectEntity(null);
      hoverEntity(null);
    },
    [],
  );
  const local = useMemo(() => {
    const project = exampleProject();
    return { project, analysis: analyse(project) };
  }, []);
  const project = storeProject?.source === "example" ? storeProject : local.project;
  const analysis = useSqe((s) => (storeProject?.source === "example" ? s.analysis : null)) ?? local.analysis;
  const current = PHASES[phase];

  return (
    <div ref={ref} className={styles.card} data-held={held}>
      <div
        ref={area}
        className={`${styles.stage} ${styles.sqe} ${styles.pointable}`}
        data-ready={!!workType}
        onClick={() => selectEntity(null)}
      >
        <SqeViewport project={project} analysis={analysis} preview={{ step: current.step, view: current.view }} />
      </div>
      <PreviewBar labels={PHASES.map((p) => p.label)} durations={PHASES.map((p) => p.ms)} phase={phase} held={held} hint={current.step >= 3 ? "Point at an area" : undefined} onSeek={seek} name={title} />
    </div>
  );
}

/**
 * The preview's story, read left to right. Each step is a button: jump to
 * it and the story carries on from there. A thin line fills under the step
 * that is playing, and stops while the preview is held.
 */
export function PreviewBar({
  labels,
  durations,
  phase,
  held = false,
  hint,
  onSeek,
  name,
}: {
  labels: string[];
  durations?: number[];
  phase: number;
  held?: boolean;
  hint?: string;
  onSeek?: (i: number) => void;
  name?: string;
}) {
  return (
    <div className={styles.bar} data-held={held}>
      <ol className={styles.phases} aria-label={name ? `${name}: steps` : "Steps"}>
        {labels.map((l, i) => (
          <li key={l} data-on={i === phase} data-done={i < phase} style={durations ? ({ "--dur": `${durations[i]}ms` } as React.CSSProperties) : undefined}>
            <button type="button" onClick={() => onSeek?.(i)} aria-current={i === phase ? "step" : undefined}>
              <span className="num">{String(i + 1).padStart(2, "0")}</span> <span className={styles.stepLabel}>{l}</span>
            </button>
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
