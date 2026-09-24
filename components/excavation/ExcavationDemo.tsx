"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { section as cutSection, type SectionKind } from "@/lib/excavation/volume";
import { reportModel } from "@/lib/excavation/reportModel";
import InputPanel from "./InputPanel";
import SurfaceViewer from "./SurfaceViewer";
import VolumeResults from "./VolumeResults";
import SectionPanel from "./SectionPanel";
import ReportPanel from "./ReportPanel";
import { useEngine } from "./useEngine";
import styles from "./excavation.module.css";

const STEPS = [
  { n: "01", label: "Input", target: "input" },
  { n: "02", label: "Surface", target: "surface" },
  { n: "03", label: "Calculate", target: "calculate" },
  { n: "04", label: "Inspect", target: "inspect" },
  { n: "05", label: "Export", target: "export" },
] as const;

/**
 * EXCAVATION VOLUME ENGINE — interactive demonstration.
 *   01 Input      sample data (default) or an uploaded XYZ file
 *   02 Surface    TIN surfaces in 3D (existing ground, excavated surface)
 *   03 Calculate  existing − excavated → excavation volume
 *   04 Inspect    cross / long sections, linked to the 3D model
 *   05 Export     report preview + .xlsx download
 * `compact` (homepage) keeps 04–05 folded until asked for.
 * All calculation happens in the browser (lib/excavation).
 */
export default function ExcavationDemo({ compact = false }: { compact?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [open, setOpen] = useState(!compact);
  const engine = useEngine(active);
  const { result, status } = engine;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const anchor = (t: string) => `exv-${uid}-${t}`;

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

  const done = (i: number) => (i === 0 ? true : status === "ready" || (!!result && status !== "error"));

  return (
    <div className={styles.app} ref={rootRef} id="exv-demo" data-compact={compact} data-open={open}>
      <header className={styles.head}>
        <div className={styles.headTitle}>
          <span className="mono">
            <span className="accent">EXV</span> / Interactive demonstration
          </span>
          <p>Excavation Volume Engine</p>
        </div>
        <ol className={styles.rail} aria-label="Workflow">
          {STEPS.map((s, i) => (
            <li key={s.n} data-done={done(i)}>
              <a
                href={`#${anchor(s.target)}`}
                onClick={(e) => {
                  if (i >= 3 && !open) setOpen(true);
                  const el = document.getElementById(anchor(s.target));
                  if (el) {
                    e.preventDefault();
                    window.setTimeout(() => el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }), i >= 3 && !open ? 60 : 0);
                  }
                }}
              >
                <span className="num">{s.n}</span> {s.label}
              </a>
            </li>
          ))}
        </ol>
      </header>

      <div className={styles.grid}>
        <section className={styles.cellInput} id={anchor("input")} aria-labelledby={`${anchor("input")}-h`}>
          <StepHead n="01" id={`${anchor("input")}-h`} title="Input" hint="XYZ survey data" />
          <InputPanel source={engine.source} ground={engine.ground} dataset={engine.dataset} onSource={engine.setSource} onGround={engine.setGround} />
        </section>

        <section className={styles.cellView} id={anchor("surface")} aria-labelledby={`${anchor("surface")}-h`}>
          <StepHead n="02" id={`${anchor("surface")}-h`} title="Surface" hint="TIN · existing ground · excavated surface" />
          <SurfaceViewer result={result} section={open ? profile : null} active={active} calculating={status === "calculating"} />
          {engine.error && (
            <p className={styles.engineError} role="alert">
              {engine.error}
            </p>
          )}
        </section>

        <section className={styles.cellResult} id={anchor("calculate")} aria-labelledby={`${anchor("calculate")}-h`}>
          <StepHead n="03" id={`${anchor("calculate")}-h`} title="Calculate" hint="Existing − excavated" />
          <VolumeResults result={result} calculating={status === "calculating"} />
        </section>

        {compact && (
          <div className={styles.more}>
            <button type="button" aria-expanded={open} aria-controls={anchor("more")} onClick={() => setOpen((v) => !v)}>
              <span>
                <span className="num">04</span> Inspect sections <span aria-hidden="true">·</span> <span className="num">05</span> Export report
              </span>
              <span className={styles.moreArrow} aria-hidden="true">
                ↓
              </span>
            </button>
          </div>
        )}

        <div className={styles.fold} id={anchor("more")} data-open={open} inert={!open}>
          <div className={styles.foldInner}>
            <section className={styles.cellSection} id={anchor("inspect")} aria-labelledby={`${anchor("inspect")}-h`}>
              <StepHead n="04" id={`${anchor("inspect")}-h`} title="Inspect" hint="Section profile, linked to the model" />
              {result && profile ? (
                <SectionPanel result={result} profile={profile} kind={kind} at={at} onChange={(k, a) => setSec({ kind: k, at: a, for: result })} />
              ) : (
                <p className={styles.empty}>Sections appear once the surfaces are built.</p>
              )}
            </section>

            <section className={styles.cellReport} id={anchor("export")} aria-labelledby={`${anchor("export")}-h`}>
              <StepHead n="05" id={`${anchor("export")}-h`} title="Export" hint="Quantity report · Excel" />
              {result ? <ReportPanel result={result} /> : <p className={styles.empty}>The report is generated from the calculation.</p>}
            </section>
          </div>
        </div>
      </div>

      <p className={styles.fine}>
        Sample data is synthetic, generated for this page. Every quantity is calculated in your browser from the triangulated surfaces; uploaded files never leave your device.
      </p>
    </div>
  );
}

function StepHead({ n, id, title, hint }: { n: string; id: string; title: string; hint: string }) {
  return (
    <h3 className={styles.step} id={id}>
      <span className="num accent">{n}</span>
      <span className={styles.stepTitle}>{title}</span>
      <span className={styles.stepHint}>{hint}</span>
    </h3>
  );
}
