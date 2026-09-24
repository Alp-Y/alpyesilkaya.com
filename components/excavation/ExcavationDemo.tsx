"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { section as cutSection, type SectionKind } from "@/lib/excavation/volume";
import { reportModel } from "@/lib/excavation/reportModel";
import InputPanel from "./InputPanel";
import SurfaceViewer from "./SurfaceViewer";
import VolumeResults from "./VolumeResults";
import SectionPanel from "./SectionPanel";
import ReportPanel from "./ReportPanel";
import { useEngine } from "./useEngine";
import styles from "./excavation.module.css";


/**
 * EXCAVATION VOLUME ENGINE — interactive demonstration.
 *   01 Input      sample data (default) or an uploaded XYZ file
 *   02 Surface    TIN surfaces in 3D (existing ground, excavated surface)
 *   03 Calculate  existing − excavated → excavation volume
 *   04 Inspect    cross / long sections, linked to the 3D model
 *   05 Export     report preview + .xlsx download
 * All calculation happens in the browser (lib/excavation).
 */
export default function ExcavationDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const engine = useEngine(active);
  const { result, status } = engine;

  // start (engine + 3D) only when the demo approaches the viewport
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setActive(true), io.disconnect()), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ---- section: starts at the cross section with the largest cut ----
  const [sec, setSec] = useState<{ kind: SectionKind; at: number; for: unknown } | null>(null);
  const defaultAt = useMemo(() => {
    if (!result) return 0;
    const m = reportModel(result);
    return m.sections.length ? m.critical.at : (result.comparison.axis.cutS[0] + result.comparison.axis.cutS[1]) / 2;
  }, [result]);
  const kind: SectionKind = sec && sec.for === result ? sec.kind : "cross";
  const at = sec && sec.for === result ? sec.at : defaultAt;
  const profile = useMemo(() => (result ? cutSection(result.comparison, kind, at, 0.25) : null), [result, kind, at]);

  return (
    <div className={styles.app} ref={rootRef} id="exv-demo">
      <div className={styles.grid}>
        <section className={styles.cellInput} aria-labelledby="exv-h-input">
          <StepHead n="01" id="exv-h-input" title="Survey data" />
          <InputPanel source={engine.source} ground={engine.ground} dataset={engine.dataset} onSource={engine.setSource} onGround={engine.setGround} />
        </section>

        <section className={styles.cellView} aria-labelledby="exv-h-surface">
          <StepHead n="02" id="exv-h-surface" title="Surfaces" />
          <SurfaceViewer result={result} section={profile} active={active} calculating={status === "calculating"} />
          {engine.error && (
            <p className={styles.engineError} role="alert">
              {engine.error}
            </p>
          )}
        </section>

        <section className={styles.cellResult} aria-labelledby="exv-h-volume">
          <StepHead n="03" id="exv-h-volume" title="Volume" />
          <VolumeResults result={result} calculating={status === "calculating"} />
        </section>

        <div className={styles.lower}>
          <section className={styles.cellSection} aria-labelledby="exv-h-section">
            <StepHead n="04" id="exv-h-section" title="Section" />
            {result && profile ? (
              <SectionPanel result={result} profile={profile} kind={kind} at={at} onChange={(k, a) => setSec({ kind: k, at: a, for: result })} />
            ) : (
              <p className={styles.empty}>Sections appear once the surfaces are built.</p>
            )}
          </section>

          <section className={styles.cellReport} aria-labelledby="exv-h-report">
            <StepHead n="05" id="exv-h-report" title="Report" />
            {result ? <ReportPanel result={result} /> : <p className={styles.empty}>The report is generated from the calculation.</p>}
          </section>
        </div>
      </div>

      <p className={styles.fine}>
        {result
          ? `Composite TIN · ${result.comparison.tris.length.toLocaleString("en-GB")} triangles, each integrated exactly · ${result.groundLabel.toLowerCase()}. `
          : ""}
        Sample data is synthetic. Everything is calculated in your browser; uploaded files never leave your device.
      </p>
    </div>
  );
}

function StepHead({ n, id, title }: { n: string; id: string; title: string }) {
  return (
    <h3 className={styles.step} id={id}>
      <span className="num accent">{n}</span>
      <span className={styles.stepTitle}>{title}</span>
    </h3>
  );
}
