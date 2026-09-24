"use client";

import { useEffect, useRef } from "react";
import SqeViewport from "./SqeViewport";
import SqePanel from "./SqePanel";
import SqeReport from "./SqeReport";
import { advanceStory, getSqe, importDxf, loadExample, setStep, startStory, STEPS, useSqe } from "@/lib/sqe/store";
import { selectEntity, setDisplayMode } from "@/lib/workspace/actions";
import { useWorkspace, type DisplayMode } from "@/lib/workspace/store";
import { reducedMotion } from "@/lib/workspace/pointer";
import styles from "./sqe.module.css";

/** How long each story step stays on screen while it plays (ms). */
const STEP_MS: Record<number, number> = { 1: 1500, 2: 2400, 3: 1800 };

/** The three ways to look at the drawing — they drive the shared display mode. */
const VIEWS: { mode: DisplayMode; label: string }[] = [
  { mode: "shaded", label: "Aerial" },
  { mode: "wireframe", label: "CAD" },
  { mode: "analysis", label: "Analysis" },
];

/**
 * QUANTITY BY AREA CALCULATOR — interactive demonstration.
 *
 * First glance: a motorway project, divided into named areas, with the
 * quantity in each. The 4-step story (site → survey → areas → quantities)
 * plays once when the demo scrolls into view; any interaction ends it.
 * The full report and DXF import are there, but secondary.
 */
export default function SpatialQuantityEngine() {
  const project = useSqe((s) => s.project);
  const analysis = useSqe((s) => s.analysis);
  const step = useSqe((s) => s.step);
  const playing = useSqe((s) => s.playing);
  const error = useSqe((s) => s.error);
  const loading = useSqe((s) => s.loading);
  const displayMode = useWorkspace((s) => s.viewport.displayMode);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const played = useRef(false);
  const example = project?.source === "example";

  // The example is always there — no empty state to get past.
  // (An imported drawing survives re-mounts, e.g. navigating Tools → home.)
  useEffect(() => {
    if (!getSqe().project) loadExample();
  }, []);

  // Play the story once, the first time the demo is properly in view
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !example || played.current || reducedMotion()) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= 0.45 && !played.current) {
          played.current = true;
          startStory();
          io.disconnect();
        }
      },
      { threshold: [0.45] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [example]);

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(advanceStory, STEP_MS[step] ?? 1500);
    return () => window.clearTimeout(t);
  }, [playing, step]);

  // Escape clears the selection while working in the demo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement).closest("input, select, [role='menu']")) selectEntity(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={styles.app} id="sqe-demo" data-sqe ref={rootRef}>
      <div className={styles.appBar}>
        <p className={styles.appTitle}>
          <span className="mono">{project?.source === "dxf" ? "Imported DXF" : "Example project"}</span>
          <span className={styles.appProject}>{project?.name ?? "Loading…"}</span>
        </p>
        <div className={styles.views} role="radiogroup" aria-label="View">
          {VIEWS.filter((v) => project?.site || v.mode !== "shaded").map((v) => (
            <button
              key={v.mode}
              type="button"
              role="radio"
              aria-checked={displayMode === v.mode}
              onClick={() => setDisplayMode(v.mode)}
              data-hud={`VIEW|${v.label.toUpperCase()}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.stage}>
          {example && (
            <ol className={styles.steps} aria-label="How it works">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <button
                    type="button"
                    aria-current={step === s.n ? "step" : undefined}
                    data-done={step > s.n}
                    onClick={() => setStep(s.n)}
                    style={{ "--dur": `${STEP_MS[s.n] ?? 0}ms` } as React.CSSProperties}
                    data-playing={playing && step === s.n}
                  >
                    <span className="num">0{s.n}</span> {s.label}
                  </button>
                </li>
              ))}
              {!playing && step === 4 && (
                <li className={styles.replay}>
                  <button type="button" onClick={startStory} data-hud="REPLAY|HOW IT WORKS">
                    ↻ Replay
                  </button>
                </li>
              )}
            </ol>
          )}
          {project && analysis ? <SqeViewport project={project} analysis={analysis} /> : <div className={styles.placeholder} />}
        </div>

        {project && analysis && <SqePanel project={project} analysis={analysis} />}
      </div>

      <div className={styles.footer}>
        {project && analysis && (
          <details className={styles.details} id="sqe-report">
            <summary>Full quantity report</summary>
            <SqeReport project={project} analysis={analysis} />
          </details>
        )}
        <div className={styles.import}>
          <button type="button" className={styles.link} onClick={() => fileRef.current?.click()} disabled={loading}>
            {loading ? "Reading…" : "Import your own DXF →"}
          </button>
          <a className={styles.fine} href="/demo/example-project.dxf" download>
            Example DXF
          </a>
          <input
            ref={fileRef}
            id="sqe-dxf-input"
            type="file"
            accept=".dxf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importDxf(f);
              e.target.value = "";
            }}
          />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
