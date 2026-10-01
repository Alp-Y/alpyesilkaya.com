"use client";

import { useEffect, useRef, useState } from "react";
import InputPanel from "./InputPanel";
import SurfaceViewer from "./SurfaceViewer";
import VolumeResults from "./VolumeResults";
import ReportPanel from "./ReportPanel";
import { useEngine } from "./useEngine";
import styles from "./excavation.module.css";


/**
 * EXCAVATION VOLUME ENGINE — interactive demonstration.
 *   01 Input      sample data (default) or an uploaded XYZ file
 *   02 Surface    TIN surfaces in 3D (existing ground, excavated surface)
 *   03 Volume     existing − excavated → excavation volume, and the Excel report
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

  return (
    <div className={styles.app} ref={rootRef} id="exv-demo">
      <div className={styles.grid}>
        <section className={styles.cellInput} aria-labelledby="exv-h-input">
          <StepHead n="01" id="exv-h-input" title="Survey data" />
          <InputPanel source={engine.source} ground={engine.ground} dataset={engine.dataset} onSource={engine.setSource} onGround={engine.setGround} />
        </section>

        <section className={styles.cellView} aria-labelledby="exv-h-surface">
          <StepHead n="02" id="exv-h-surface" title="Surfaces" />
          <SurfaceViewer result={result} section={null} active={active} calculating={status === "calculating"} />
          {engine.error && (
            <p className={styles.engineError} role="alert">
              {engine.error}
            </p>
          )}
        </section>

        <section className={styles.cellResult} aria-labelledby="exv-h-volume">
          <StepHead n="03" id="exv-h-volume" title="Volume" />
          <VolumeResults result={result} calculating={status === "calculating"} />
          {result && <ReportPanel result={result} compact />}
        </section>
      </div>

      <p className={styles.fine}>Sample data is synthetic. Everything runs in your browser.</p>
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
