"use client";

import { useEffect, useRef, useState } from "react";
import { runEngine, type EngineResult } from "@/lib/excavation/engine";
import { getSample, type SampleId } from "@/lib/excavation/samples";
import { num } from "@/lib/format";
import type { SurfaceScene } from "@/components/excavation/surfaceScene";
import { PreviewBar } from "./SqePreview";
import { usePreviewLoop } from "./usePreviewLoop";
import { useHold } from "./useHold";
import ViewControls from "./ViewControls";
import { bindControls } from "@/components/excavation/orbitControls";
import styles from "./preview.module.css";

/** Survey points → TIN → surfaces → cut volume, then a slow turn, on repeat. */
const PHASES = [
  { label: "Survey points", ms: 1500 },
  { label: "TIN", ms: 1300 },
  { label: "Surfaces", ms: 1100 },
  { label: "Cut volume", ms: 5600 },
];
/** build-in progress (SurfaceScene.setBuild) at the end of each phase */
const BUILD_AT = [0.3, 0.5, 0.7, 1];
const ORDER: SampleId[] = ["road", "irregular", "simple"];
const SPIN = 0.00006; // rad / ms

/**
 * EXCAVATION VOLUME ENGINE — homepage preview. The same live 3D scene and
 * engine as the tool page (so it stays sharp at any size), cycling through
 * the three sample sites. Drag to spin it, zoom with +/− (or the wheel once
 * you have pressed on it); holding it pauses the story. The tool itself
 * opens from the button beside it.
 */
export default function ExvPreview({ title }: { title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { held, heldRef } = useHold(stageRef);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SurfaceScene | null>(null);
  const results = useRef<EngineResult[]>([]);
  const cycle = useRef(0);
  const dotsOn = useRef(true);
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState<EngineResult | null>(null);

  const { phase, seek } = usePreviewLoop(
    ref,
    PHASES.map((p) => p.ms),
    (p, t, dt, wrapped) => {
      const s = sceneRef.current;
      if (!s || !results.current.length) return;
      // a new loop: next sample site
      if (wrapped) {
        cycle.current = (cycle.current + 1) % results.current.length;
        const r = results.current[cycle.current];
        s.setData(r);
        setShown(r);
      }
      // once the surfaces are built, the survey dots step back so the cut reads clearly
      const dots = !(p === PHASES.length - 1 && t > 0.25);
      if (dots !== dotsOn.current) {
        dotsOn.current = dots;
        s.setLayers({ points: dots, tin: true, existing: true, excavated: true, cut: true });
      }
      const from = p === 0 ? 0 : BUILD_AT[p - 1];
      s.setBuild(from + (BUILD_AT[p] - from) * t);
      s.orbit(-(SPIN * dt) / 0.006, 0);
      // fade between sites
      const end = p === PHASES.length - 1 ? 1 - Math.max(0, (t - 0.9) / 0.1) : 1;
      const start = p === 0 ? Math.min(1, t * 4) : 1;
      if (canvasRef.current) canvasRef.current.style.opacity = String(Math.min(start, end));
    },
    heldRef,
  );

  // start the engine + 3D scene when the preview comes near the viewport
  useEffect(() => {
    const el = ref.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    let cancelled = false;
    let scene: SurfaceScene | null = null;
    let ro: ResizeObserver | null = null;
    let unbind: (() => void) | null = null;
    const start = async () => {
      if (!supportsWebGL()) return;
      const { SurfaceScene } = await import("@/components/excavation/surfaceScene");
      if (cancelled) return;
      const first = runEngine({ dataset: getSample(ORDER[0]), ground: { kind: "sample" } });
      results.current = [first];
      scene = new SurfaceScene(canvas);
      sceneRef.current = scene;
      ro = new ResizeObserver(([e]) => scene!.resize(e.contentRect.width, e.contentRect.height));
      ro.observe(canvas.parentElement!);
      scene.setData(first);
      scene.setBuild(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 0);
      unbind = bindControls(canvas, scene, () => {});
      setShown(first);
      setReady(true);
      // the other two sites, when the browser is idle
      const later = () => {
        if (cancelled) return;
        for (const id of ORDER.slice(1)) results.current.push(runEngine({ dataset: getSample(id), ground: { kind: "sample" } }));
      };
      if ("requestIdleCallback" in window) window.requestIdleCallback(later, { timeout: 4000 });
      else setTimeout(later, 1500);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          io.disconnect();
          void start();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      ro?.disconnect();
      unbind?.();
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const c = shown?.comparison;
  return (
    <div ref={ref} className={styles.card} data-held={held}>
      <div ref={stageRef} className={`${styles.stage} ${styles.exv} ${styles.handle}`} data-ready={ready}>
        <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={`${title}: 3D model of an example site. Drag to spin, use the buttons to zoom.`} />
        {shown && c && (
          <div className={styles.overlay} key={shown.dataset.id}>
            <span className={styles.site}>{shown.dataset.name}</span>
            <span className={styles.value} data-show={phase === PHASES.length - 1}>
              <b className="num">{num(c.cut)}</b> m³
            </span>
          </div>
        )}
        {ready && <ViewControls onIn={() => sceneRef.current?.zoom(0.8)} onOut={() => sceneRef.current?.zoom(1.25)} onReset={() => sceneRef.current?.resetView()} label={title} />}
      </div>
      <PreviewBar labels={PHASES.map((p) => p.label)} durations={PHASES.map((p) => p.ms)} phase={phase} held={held} hint="Drag to spin" onSeek={seek} name={title} />
    </div>
  );
}

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
