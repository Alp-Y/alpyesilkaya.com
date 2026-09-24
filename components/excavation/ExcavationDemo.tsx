"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildExcavation, ORIGIN, type ExcavationModel } from "@/lib/excavation/model";
import { registerSpace, setHud } from "@/lib/workspace/cadCursor";
import { onFrame, reducedMotion } from "@/lib/workspace/pointer";
import { coord, num, quantity } from "@/lib/format";
import type { ExcavationScene, Stage } from "./scene";
import SectionView from "./SectionView";
import styles from "./excavation.module.css";

const STAGES: { n: Stage; label: string }[] = [
  { n: 1, label: "Survey" },
  { n: 2, label: "Surfaces" },
  { n: 3, label: "Boundary" },
  { n: 4, label: "Volume" },
  { n: 5, label: "Sections" },
];
/** How long each stage plays in the automatic run (ms). */
const PLAY_MS: Record<number, number> = { 1: 2200, 2: 2800, 3: 2000, 4: 3200 };

/**
 * AUTOMATIZE EXCAVATION CALCULATIONS — interactive demonstration.
 *   survey XYZ → TIN surfaces → boundary → volume (+ section views)
 * Plays once when it scrolls into view, then you explore: drag to orbit,
 * right-drag / shift-drag to pan, scroll to zoom (after clicking the
 * viewport), double-click to reset. Hover a point or the surface to inspect.
 */
export default function ExcavationDemo() {
  const model = useMemo<ExcavationModel>(() => buildExcavation(), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ExcavationScene | null>(null);
  const labelsRef = useRef<Record<string, HTMLElement | null>>({});
  const [ready, setReady] = useState(false);
  const [stage, setStageState] = useState<Stage>(1);
  const [progress, setProgress] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [station, setStation] = useState(80);
  const readoutRef = useRef<HTMLParagraphElement>(null);

  const played = useRef(false);

  const section = model.sections.find((s) => s.station === station) ?? model.sections[0];
  const callouts = useMemo(() => {
    // three survey shots to label in stage 1: spread across the site
    const pick = (tx: number, ty: number) => model.points.reduce((best, p) => (Math.hypot(p.x - tx, p.y - ty) < Math.hypot(best.x - tx, best.y - ty) ? p : best));
    return [pick(40, 80), pick(92, 60), pick(128, 36)];
  }, [model]);
  const labelAnchor = useMemo(() => {
    // deepest point: where the two surfaces are furthest apart
    return model.points.reduce((best, p) => (p.z - p.zx > best.z - best.zx ? p : best));
  }, [model]);

  // ---------- start the 3D scene when the demo comes near the viewport ----------
  useEffect(() => {
    const root = rootRef.current;
    const view = viewRef.current;
    const canvas = canvasRef.current;
    if (!root || !view || !canvas || !supportsWebGL()) return;
    let cancelled = false;
    let scene: ExcavationScene | null = null;
    const cleanups: (() => void)[] = [];

    const start = async () => {
      const { ExcavationScene } = await import("./scene");
      if (cancelled) return;
      const s = new ExcavationScene(canvas, model);
      scene = s;
      sceneRef.current = s;
      const ro = new ResizeObserver(([e]) => s.resize(e.contentRect.width, e.contentRect.height));
      ro.observe(view);
      cleanups.push(() => ro.disconnect());

      // HTML labels follow the 3D model
      s.onRender = () => {
        const place = (key: string, x: number, y: number, z: number) => {
          const el = labelsRef.current[key];
          if (!el) return;
          const p = s.project(x, y, z);
          if (!p) return void (el.style.opacity = "0");
          el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
          el.style.opacity = "";
        };
        callouts.forEach((p, i) => place(`pt${i}`, p.x, p.y, p.z));
        place("eg", labelAnchor.x - 14, labelAnchor.y + 12, labelAnchor.z + 1.2);
        place("ex", labelAnchor.x + 10, labelAnchor.y - 4, labelAnchor.zx);
        const b = model.boundary[3];
        place("boundary", b[0], b[1], 620);
      };

      // Coordinates for the site HUD + the readout
      cleanups.push(
        registerSpace("exv", (cx, cy) => {
          const r = canvas.getBoundingClientRect();
          const p = s.planAt(cx - r.left, cy - r.top);
          return p ? { x: p.x + ORIGIN[0], y: p.y + ORIGIN[1] } : { x: ORIGIN[0], y: ORIGIN[1] };
        }),
      );

      // ---- orbit / pan / zoom ----
      let drag: { x: number; y: number; pan: boolean } | null = null;
      let engaged = false;
      const onDown = (e: PointerEvent) => {
        engaged = true;
        drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey };
        canvas.setPointerCapture(e.pointerId);
        canvas.dataset.cursor = "grabbing";
      };
      const onMove = (e: PointerEvent) => {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        drag.x = e.clientX;
        drag.y = e.clientY;
        if (drag.pan) s.pan(dx, dy);
        else s.orbit(dx, dy);
      };
      const onUp = () => {
        drag = null;
        canvas.dataset.cursor = "grab";
      };
      const onWheel = (e: WheelEvent) => {
        if (!engaged) return; // never hijack page scrolling before the visitor has clicked in
        e.preventDefault();
        s.zoom(Math.exp(e.deltaY * 0.0012));
      };
      const onLeave = () => (engaged = false);
      const onDbl = () => s.resetView();
      const noMenu = (e: Event) => e.preventDefault();
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("pointerleave", onLeave);
      canvas.addEventListener("dblclick", onDbl);
      canvas.addEventListener("contextmenu", noMenu);
      cleanups.push(() => {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("pointerleave", onLeave);
        canvas.removeEventListener("dblclick", onDbl);
        canvas.removeEventListener("contextmenu", noMenu);
      });

      // ---- hover inspection, through the shared pointer loop ----
      let over = false;
      cleanups.push(
        onFrame((p) => {
          const inside = p.inside && p.target === canvas;
          if (!inside) {
            if (over) {
              setHud("hover", null, "exv");
              writeReadout(readoutRef.current, null);
            }
            over = false;
            return;
          }
          if (!p.moved && over) return;
          over = true;
          const r = canvas.getBoundingClientRect();
          const hit = s.pick(p.x - r.left, p.y - r.top);
          if (hit?.kind === "point") {
            const pt = s.model.points[hit.index];
            setHud("hover", { title: "SURVEY POINT", lines: [pt.id], rows: [["EASTING", coord(pt.x + ORIGIN[0])], ["NORTHING", coord(pt.y + ORIGIN[1])], ["ELEVATION", quantity(pt.z, "m")]] }, "exv");
            writeReadout(readoutRef.current, { e: pt.x + ORIGIN[0], n: pt.y + ORIGIN[1], z: pt.z });
          } else if (hit?.kind === "surface") {
            const depth = Math.max(0, hit.eg - hit.ex);
            const inB = s.isInside(hit.x, hit.y);
            setHud(
              "hover",
              {
                title: depth > 0.01 ? (inB ? "EXCAVATION" : "EXCAVATION · OUTSIDE BOUNDARY") : "EXISTING GROUND",
                rows: [["EXISTING GROUND", quantity(hit.eg, "m")], ["EXCAVATED LEVEL", quantity(hit.ex, "m")], ["DEPTH", quantity(depth, "m")]],
              },
              "exv",
            );
            writeReadout(readoutRef.current, { e: hit.x + ORIGIN[0], n: hit.y + ORIGIN[1], z: hit.eg });
          } else {
            setHud("hover", null, "exv");
            const q = s.planAt(p.x - r.left, p.y - r.top);
            writeReadout(readoutRef.current, q ? { e: q.x + ORIGIN[0], n: q.y + ORIGIN[1] } : null);
          }
        }),
      );
      cleanups.push(() => setHud("hover", null, "exv"));
      setReady(true);
    };

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          io.disconnect();
          void start();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(root);
    return () => {
      cancelled = true;
      io.disconnect();
      cleanups.forEach((f) => f());
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [model, callouts, labelAnchor]);

  // ---------- play the story once, when the viewport is properly in view ----------
  useEffect(() => {
    const root = viewRef.current;
    if (!root || !ready || played.current) return;
    if (reducedMotion()) {
      // no autoplay: go straight to the result
      played.current = true;
      const id = requestAnimationFrame(() => setStageState(4));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= 0.5 && !played.current) {
          played.current = true;
          io.disconnect();
          setStageState(1);
          setPlaying(true);
        }
      },
      { threshold: [0.5] },
    );
    io.observe(root);
    return () => io.disconnect();
  }, [ready]);

  // ---------- animate the current stage's build-in; advance while playing ----------
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const dur = reducedMotion() ? 0 : playing ? (PLAY_MS[stage] ?? 1500) * 0.8 : 900;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = dur ? Math.min(1, (now - t0) / dur) : 1;
      s.setStage(stage, t, station);
      setProgress(t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    let next = 0;
    if (playing) next = window.setTimeout(() => (stage >= 4 ? setPlaying(false) : setStageState((stage + 1) as Stage)), PLAY_MS[stage] ?? 1500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(next);
    };
  }, [stage, playing, station, ready]);

  const go = (n: Stage) => {
    setPlaying(false);
    setStageState(n);
  };

  const show = (n: Stage) => stage === n;

  return (
    <div className={styles.app} ref={rootRef} id="exv-demo">
      <div ref={viewRef} className={styles.view} data-cad-space="exv" data-ready={ready} data-stage={stage}>
        <canvas ref={canvasRef} className={styles.canvas} data-cursor="grab" aria-label="3D excavation model, drag to orbit" />

        {/* Stage caption (top-left) */}
        <div className={styles.caption} key={stage}>
          {stage === 1 && (
            <>
              <span>Survey data</span>
              <b className="num">{model.points.length.toLocaleString("en-GB")} XYZ points</b>
            </>
          )}
          {stage === 2 && (
            <>
              <span>TIN surfaces</span>
              <b className="num">{model.tris.length.toLocaleString("en-GB")} triangles</b>
            </>
          )}
          {stage === 3 && (
            <>
              <span>Calculation boundary</span>
              <b className="num">Area {quantity(model.boundaryArea, "m²")}</b>
            </>
          )}
          {stage === 4 && (
            <>
              <span>Excavation volume</span>
              <b>Existing ground − excavated surface</b>
            </>
          )}
          {stage === 5 && (
            <>
              <span>Section views</span>
              <b className="num">Every 20 m · {model.sections.length} sections</b>
            </>
          )}
        </div>

        {/* 3D-anchored labels */}
        <div className={styles.labels} aria-hidden="true">
          {callouts.map((p, i) => (
            <span
              key={p.id}
              ref={(el) => {
                labelsRef.current[`pt${i}`] = el;
              }}
              className={styles.callout}
              data-show={show(1) && progress > 0.35 + i * 0.15}
            >
              <b>{p.id}</b>
              <span className="num">E {coord(p.x + ORIGIN[0])}</span>
              <span className="num">N {coord(p.y + ORIGIN[1])}</span>
              <span className="num">Z {coord(p.z)}</span>
            </span>
          ))}
          <span
            ref={(el) => {
              labelsRef.current.eg = el;
            }}
            className={styles.tag}
            data-show={stage === 2 && progress > 0.55}
          >
            Existing ground
          </span>
          <span
            ref={(el) => {
              labelsRef.current.ex = el;
            }}
            className={styles.tag}
            data-kind="ex"
            data-show={stage === 2 && progress > 0.8}
          >
            Excavated surface
          </span>
          <span
            ref={(el) => {
              labelsRef.current.boundary = el;
            }}
            className={styles.tag}
            data-kind="boundary"
            data-show={stage === 3 && progress > 0.6}
          >
            Calculation boundary · {quantity(model.boundaryArea, "m²")}
          </span>
        </div>

        {/* 04 — the result, inside the viewport */}
        <div className={styles.result} data-show={show(4) && progress > 0.55} aria-live="polite">
          <p className={styles.expression}>Existing ground − Excavated surface</p>
          <p className={styles.volume}>
            <span className="num">{num(model.volume)}</span> <em>m³</em>
          </p>
          <p className={styles.volumeLabel}>Excavation volume</p>
          <dl className={styles.stats}>
            <div>
              <dt>Area</dt>
              <dd className="num">{quantity(model.boundaryArea, "m²")}</dd>
            </div>
            <div>
              <dt>Average depth</dt>
              <dd className="num">{quantity(model.averageDepth, "m")}</dd>
            </div>
            <div>
              <dt>Maximum depth</dt>
              <dd className="num">{quantity(model.maxDepth, "m")}</dd>
            </div>
            <div>
              <dt>Survey points</dt>
              <dd className="num">{model.points.length.toLocaleString("en-GB")}</dd>
            </div>
          </dl>
        </div>

        {/* viewport furniture */}
        <svg className={styles.axes} viewBox="0 0 44 44" aria-hidden="true">
          <path d="M10 34 L32 34" stroke="#e2848c" />
          <path d="M10 34 L10 12" stroke="#7fd3ae" />
          <path d="M10 34 L22 24" stroke="#6ea0ff" />
          <text x="35" y="37">X</text>
          <text x="7" y="9">Z</text>
          <text x="24" y="22">Y</text>
        </svg>
        <p ref={readoutRef} className={`${styles.readout} num`} aria-hidden="true">
          Drag to orbit · right-drag to pan · click, then scroll to zoom
        </p>
        <p className={styles.mode} aria-hidden="true">
          TIN SURFACE | 3D VIEW · V.E. ×2
        </p>

        {!ready && <p className={styles.loading}>Loading 3D model…</p>}

        {/* stage navigation */}
        <ol className={styles.nav} aria-label="Calculation steps">
          {STAGES.map((st, i) => (
            <li key={st.n}>
              {i > 0 && <span className={styles.arrow} aria-hidden="true">→</span>}
              <button type="button" aria-current={stage === st.n ? "step" : undefined} data-done={stage > st.n} onClick={() => go(st.n)}>
                {st.label}
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* 05 — section views */}
      {stage === 5 && (
        <div className={styles.sections}>
          <div className={styles.stations} role="tablist" aria-label="Section stations">
            {model.sections.map((s) => (
              <button key={s.station} type="button" role="tab" aria-selected={s.station === station} onClick={() => setStation(s.station)}>
                <span>{s.label}</span>
                <b className="num">{num(s.cutArea)} m²</b>
              </button>
            ))}
          </div>
          <SectionView section={section} />
          <p className={styles.check}>
            Average end area across these sections: <b className="num">{quantity(model.endAreaVolume, "m³")}</b>: a quick check on the TIN
            volume (<b className="num">{quantity(model.volume, "m³")}</b>), which integrates every triangle instead of 20 m slices.
          </p>
        </div>
      )}

      <div className={styles.footer}>
        <p className={styles.fine}>Demonstration site, generated for this page; the volume is computed from its TIN in your browser.</p>
      </div>
    </div>
  );
}

/** Coordinate readout: written straight to the DOM (no React render per mouse move). */
function writeReadout(el: HTMLElement | null, r: { e: number; n: number; z?: number } | null) {
  if (!el) return;
  el.dataset.live = String(!!r);
  el.textContent = r ? `E: ${coord(r.e)}   N: ${coord(r.n)}${r.z !== undefined ? `   Z: ${coord(r.z)}` : ""}` : "Drag to orbit · right-drag to pan · click, then scroll to zoom";
}

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
