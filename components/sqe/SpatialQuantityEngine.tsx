"use client";

import { useEffect, useRef } from "react";
import ViewportToolbar from "../ViewportToolbar";
import SqeViewport from "./SqeViewport";
import { ProjectTree, Properties, QuantityReport } from "./SqePanels";
import { closeProject, importDxf, loadExample, useSqe } from "@/lib/sqe/store";
import { selectEntity } from "@/lib/workspace/actions";
import { useWorkspace } from "@/lib/workspace/store";
import styles from "./sqe.module.css";

/**
 * SPATIAL QUANTITY ENGINE — interactive demonstration.
 *
 *   01 LOAD      example project, or a DXF processed locally in the browser
 *   02 ASSIGN    area metadata (auto or manual)
 *   03 REPORT    quantities per area, traceable back to geometry
 *
 * Selection, hover, display mode and view orientation are shared workspace
 * state, so the drawing, tree, properties, report, HUD, toolbar, ViewCube
 * and command line always agree.
 */
export default function SpatialQuantityEngine() {
  const project = useSqe((s) => s.project);
  const analysis = useSqe((s) => s.analysis);
  const summary = useSqe((s) => s.summary);
  const error = useSqe((s) => s.error);
  const loading = useSqe((s) => s.loading);
  const displayMode = useWorkspace((s) => s.viewport.displayMode);
  const fileRef = useRef<HTMLInputElement>(null);

  const assigned = project ? project.boundaries.every((b) => b.meta) : false;
  const steps = [
    { n: "01", label: "Load drawing", done: !!project },
    { n: "02", label: "Assign areas", done: assigned },
    { n: "03", label: "Quantities", done: assigned && displayMode === "analysis" },
  ];

  // Escape clears the selection while working in the demo
  useEffect(() => {
    if (!project) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement).closest("input, select, [role='menu']")) selectEntity(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project]);

  return (
    <div className={styles.app} id="sqe-demo" data-sqe>
      <header className={styles.appBar}>
        <div className={styles.appTitle}>
          <span className={styles.appName}>Spatial Quantity Engine</span>
          <span className={styles.file}>{project ? `${project.name}${project.source === "dxf" ? ".dxf" : ""}` : "No drawing loaded"}</span>
        </div>
        <ol className={styles.steps} aria-label="Workflow">
          {steps.map((s) => (
            <li key={s.n} data-done={s.done}>
              <span className="num">{s.n}</span> {s.label}
            </li>
          ))}
        </ol>
        <div className={styles.appTools}>
          <ViewportToolbar />
          {project && (
            <button type="button" className={styles.textButton} onClick={closeProject}>
              Close
            </button>
          )}
        </div>
      </header>

      {summary && project && (
        <p className={styles.summary} role="status">
          <span className="num">{summary.regions}</span> closed regions detected
          {summary.work > 0 && (
            <>
              {" "}
              · <span className="num">{summary.work}</span> work items
            </>
          )}
          {summary.ignored > 0 && (
            <>
              {" "}
              · <span className="num">{summary.ignored}</span> unsupported entities ignored
              {summary.ignoredTypes.length > 0 && ` (${summary.ignoredTypes.join(", ")})`}
            </>
          )}
          <span className={styles.local}>Processed locally in your browser</span>
        </p>
      )}

      <div className={styles.body} data-empty={!project}>
        {project && analysis && <ProjectTree project={project} analysis={analysis} />}

        <div className={styles.stage}>
          {project && analysis ? (
            <SqeViewport project={project} analysis={analysis} />
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyKicker}>
                <span className={styles.step}>01</span> Load a drawing
              </p>
              <p className={styles.emptyTitle}>Spatial metadata + automated quantity reporting.</p>
              <p className={styles.emptyCopy}>
                Define project boundaries, assign engineering metadata and automatically organise quantities by project
                area.
              </p>
              <div className={styles.emptyActions}>
                <button type="button" className={styles.primaryButton} onClick={loadExample} disabled={loading}>
                  Load example project
                </button>
                <button type="button" className={styles.secondaryButton} onClick={() => fileRef.current?.click()} disabled={loading}>
                  {loading ? "Reading…" : "Import DXF"}
                </button>
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
              </div>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <p className={styles.fine}>
                DXF only (closed LWPOLYLINE / POLYLINE / LINE loops become areas). Processed locally in your browser —
                nothing is uploaded. <a href="/demo/example-project.dxf" download>Example DXF</a>
              </p>
            </div>
          )}
        </div>

        {project && analysis && <Properties project={project} analysis={analysis} />}
      </div>

      {project && analysis && <QuantityReport project={project} analysis={analysis} />}
    </div>
  );
}
