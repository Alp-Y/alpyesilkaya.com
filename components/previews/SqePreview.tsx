"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import SqeViewport, { type SqePreviewState } from "@/components/sqe/SqeViewport";
import { analyse } from "@/lib/sqe/engine";
import { exampleProject } from "@/lib/sqe/example";
import { getSqe, loadExample, useSqe } from "@/lib/sqe/store";
import { usePreviewLoop } from "./usePreviewLoop";
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
 * page, looping through its story on its own. The whole card is a link to
 * the interactive tool.
 */
export default function SqePreview({ href, title }: { href: string; title: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const { phase } = usePreviewLoop(
    ref,
    PHASES.map((p) => p.ms),
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
    <Link href={href} ref={ref} className={styles.card} aria-label={`${title}: open the interactive tool`}>
      <div className={`${styles.stage} ${styles.sqe}`} aria-hidden="true" data-ready={!!workType}>
        <SqeViewport project={project} analysis={analysis} preview={{ step: current.step, view: current.view }} />
      </div>
      <PreviewBar labels={PHASES.map((p) => p.label)} phase={phase} />
    </Link>
  );
}

export function PreviewBar({ labels, phase, note }: { labels: string[]; phase: number; note?: string }) {
  return (
    <div className={styles.bar}>
      <ol className={styles.phases} aria-hidden="true">
        {labels.map((l, i) => (
          <li key={l} data-on={i === phase} data-done={i < phase}>
            <span className="num">{String(i + 1).padStart(2, "0")}</span> {l}
          </li>
        ))}
      </ol>
      {note && <span className={styles.note}>{note}</span>}
      <span className={styles.cta}>
        Open the interactive tool <span className="arrow">→</span>
      </span>
    </div>
  );
}
