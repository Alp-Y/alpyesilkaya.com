"use client";

import { useEffect, useRef, useState } from "react";
import type { EngineResult } from "@/lib/excavation/engine";
import type { SectionProfile } from "@/lib/excavation/volume";
import { registerSpace, setHud } from "@/lib/workspace/cadCursor";
import { onFrame, reducedMotion } from "@/lib/workspace/pointer";
import { coord, quantity } from "@/lib/format";
import type { Layers, SurfaceScene } from "./surfaceScene";
import { verticalExaggeration } from "./view";
import styles from "./excavation.module.css";

/** The excavated surface is always shown; these can be switched. */
const LAYERS: { key: keyof Layers; label: string; swatch: string }[] = [
  { key: "points", label: "Points", swatch: "points" },
  { key: "tin", label: "TIN", swatch: "tin" },
  { key: "existing", label: "Existing ground", swatch: "existing" },
  { key: "cut", label: "Cut", swatch: "cut" },
];

const BUILD_MS = 2600;
const REBUILD_MS = 1300;

/**
 * 02 — SURFACE. The 3D viewport: survey points → TIN → surfaces → cut.
 * Three.js is loaded only when the demo approaches the viewport.
 * Mouse: drag to orbit, right-drag / shift-drag to pan, click then scroll
 * to zoom. Touch: drag sideways to orbit, two fingers to zoom and pan.
 * Hover (or tap) the model to read coordinates, levels and depth.
 */
export default function SurfaceViewer({
  result,
  section,
  active,
  calculating,
}: {
  result: EngineResult | null;
  section: SectionProfile | null;
  active: boolean;
  calculating: boolean;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SurfaceScene | null>(null);
  const readoutRef = useRef<HTMLParagraphElement>(null);
  const tagRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [ready, setReady] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [layers, setLayers] = useState<Layers>({ points: true, tin: true, existing: true, excavated: true, cut: true });
  const [build, setBuild] = useState(0);
  const shown = useRef<EngineResult | null>(null);

  // ---- create the scene (lazy) ----
  useEffect(() => {
    const view = viewRef.current;
    const canvas = canvasRef.current;
    if (!active || !view || !canvas) return;
    let cancelled = false;
    let scene: SurfaceScene | null = null;
    const cleanups: (() => void)[] = [];

    (async () => {
      if (!supportsWebGL()) return setUnsupported(true);
      const { SurfaceScene } = await import("./surfaceScene");
      if (cancelled) return;
      const s = new SurfaceScene(canvas);
      scene = s;
      sceneRef.current = s;
      const ro = new ResizeObserver(([e]) => s.resize(e.contentRect.width, e.contentRect.height));
      ro.observe(view);
      cleanups.push(() => ro.disconnect());

      // labels pinned to the model: at the deepest point
      s.onRender = () => {
        const r = s.result;
        if (!r) return;
        const c = r.comparison;
        let deepest = c.vertices[0];
        for (const v of c.vertices) if (v.eg - v.ex > deepest.eg - deepest.ex) deepest = v;
        const place = (key: string, z: number) => {
          const el = tagRefs.current[key];
          if (!el) return;
          const p = s.project(deepest.x, deepest.y, z);
          if (!p) return void (el.style.visibility = "hidden");
          el.style.visibility = "";
          el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
        };
        place("eg", deepest.eg);
        place("ex", deepest.ex);
      };

      // site HUD: drawing coordinates in this space
      cleanups.push(
        registerSpace("exv", (cx, cy) => {
          const r = canvas.getBoundingClientRect();
          const hit = s.pick(cx - r.left, cy - r.top);
          const o = s.result?.origin ?? [0, 0];
          return hit?.kind === "surface" ? { x: hit.x + o[0], y: hit.y + o[1] } : { x: o[0], y: o[1] };
        }),
      );

      cleanups.push(bindControls(canvas, s, (hit) => describeHit(s, hit, readoutRef.current)));

      // hover inspection through the site's shared pointer loop (mouse / pen)
      let over = false;
      cleanups.push(
        onFrame((p) => {
          const inside = p.inside && p.target === canvas;
          if (!inside) {
            if (over) {
              setHud("hover", null, "exv");
              describeHit(s, null, readoutRef.current);
            }
            over = false;
            return;
          }
          if (!p.moved && over) return;
          over = true;
          const r = canvas.getBoundingClientRect();
          describeHit(s, s.pick(p.x - r.left, p.y - r.top), readoutRef.current, true);
        }),
      );
      cleanups.push(() => setHud("hover", null, "exv"));
      setReady(true);
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((f) => f());
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [active]);

  // ---- new result → rebuild geometry and replay the build-in ----
  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !ready || !result || shown.current === result) return;
    const first = shown.current === null;
    shown.current = result;
    s.setData(result);
    s.setLayers(layers);
    const dur = reducedMotion() ? 0 : first ? BUILD_MS : REBUILD_MS;
    let raf = 0;
    let t0 = 0;
    const start = () => {
      t0 = performance.now();
      const tick = (now: number) => {
        const t = dur ? Math.min(1, (now - t0) / dur) : 1;
        s.setBuild(t);
        setBuild(t);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    // the first build waits until the viewport is properly in view
    let io: IntersectionObserver | null = null;
    if (first && dur && viewRef.current) {
      s.setBuild(0);
      io = new IntersectionObserver(
        ([e]) => {
          if (e.intersectionRatio >= 0.35) {
            io?.disconnect();
            start();
          }
        },
        { threshold: [0.35] },
      );
      io.observe(viewRef.current);
    } else start();
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      // if interrupted, show the finished state
      s.setBuild(1);
    };
    // layers are applied separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, ready]);

  useEffect(() => sceneRef.current?.setLayers(layers), [layers, ready]);
  useEffect(() => sceneRef.current?.setSection(section), [section, ready, result]);

  const c = result?.comparison;
  const stage = build < 0.3 ? 1 : build < 0.5 ? 2 : build < 0.7 ? 3 : 4;
  const caption = !c
    ? null
    : stage === 1
      ? ["XYZ survey points", `${(result.counts.excavated + result.counts.ground).toLocaleString("en-GB")} points`]
      : stage === 2
        ? ["Delaunay triangulation", `${(result.excavated.tris.length + result.existing.tris.length).toLocaleString("en-GB")} triangles`]
        : stage === 3
          ? ["TIN surfaces", "Existing ground · excavated surface"]
          : ["Surface comparison", `Existing − excavated · V.E. ×${verticalExaggeration(c)}`];

  return (
    <div className={styles.viewer}>
      <div ref={viewRef} className={styles.view} data-cad-space="exv" data-ready={ready && !!result}>
        <canvas ref={canvasRef} className={styles.canvas} data-cursor="grab" aria-label="3D model of the existing ground and the excavated surface. Drag to orbit." role="img" />

        {caption && (
          <div className={styles.caption} key={caption[0]} aria-hidden="true">
            <span>{caption[0]}</span>
            <b className="num">{caption[1]}</b>
          </div>
        )}

        <div className={styles.labels} aria-hidden="true">
          <span ref={(el) => void (tagRefs.current.eg = el)} className={styles.tag} data-show={build >= 1 && layers.existing}>
            Existing ground
          </span>
          <span ref={(el) => void (tagRefs.current.ex = el)} className={styles.tag} data-kind="ex" data-show={build >= 1 && layers.excavated}>
            Excavated surface
          </span>
        </div>

        {(!ready || !result) && !unsupported && <p className={styles.loading}>{calculating ? "Building surfaces…" : "Loading 3D model…"}</p>}
        {unsupported && <p className={styles.loading}>3D view needs WebGL. The quantities below are still calculated.</p>}
        {calculating && ready && result && <p className={styles.busy}>Calculating…</p>}

        <div className={styles.viewTools}>
          <button type="button" onClick={() => sceneRef.current?.resetView()} aria-label="Reset the 3D view">
            3D
          </button>
          <button type="button" onClick={() => sceneRef.current?.topView()} aria-label="Plan view from the top">
            Top
          </button>
        </div>

        <p ref={readoutRef} className={`${styles.readout} num`} aria-live="off">
          Drag to orbit · tap or hover to inspect
        </p>
      </div>

      {/* layer toggles double as the legend */}
      <div className={styles.layers} role="group" aria-label="Layers">
        {LAYERS.map((l) => (
          <button key={l.key} type="button" aria-pressed={layers[l.key]} onClick={() => setLayers((v) => ({ ...v, [l.key]: !v[l.key] }))}>
            <span className={styles.swatch} data-swatch={l.swatch} aria-hidden="true" />
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Write the inspection readout (and the site HUD for mouse hover). */
function describeHit(s: SurfaceScene, hit: ReturnType<SurfaceScene["pick"]>, el: HTMLElement | null, hud = false) {
  const r = s.result;
  if (!el || !r) return;
  const [E, N] = r.origin;
  if (!hit) {
    if (hud) setHud("hover", null, "exv");
    el.dataset.live = "false";
    el.textContent = "Drag to orbit · tap or hover to inspect";
    return;
  }
  el.dataset.live = "true";
  if (hit.kind === "point") {
    const p = hit.survey === "excavated" ? r.dataset.excavated[hit.index] : (r.ground.kind === "sample" ? r.dataset.ground ?? [] : r.ground.kind === "points" ? r.ground.points : [])[hit.index];
    if (!p) return;
    el.textContent = `${p.id}  E ${coord(p.x)}  N ${coord(p.y)}  Z ${coord(p.z)}`;
    if (hud)
      setHud("hover", { title: hit.survey === "excavated" ? "SURVEY POINT · EXCAVATED" : "SURVEY POINT · EXISTING", lines: [p.id], rows: [["EASTING", coord(p.x)], ["NORTHING", coord(p.y)], ["ELEVATION", quantity(p.z, "m")]] }, "exv");
    return;
  }
  const depth = hit.eg - hit.ex;
  el.textContent = `E ${coord(hit.x + E)}  N ${coord(hit.y + N)}  EG ${coord(hit.eg)}  EX ${coord(hit.ex)}  ${depth >= 0 ? "CUT" : "FILL"} ${coord(Math.abs(depth))} m`;
  if (hud)
    setHud(
      "hover",
      {
        title: depth > 0.005 ? "EXCAVATION" : depth < -0.005 ? "FILL" : "EXISTING GROUND",
        rows: [
          ["EXISTING GROUND", quantity(hit.eg, "m")],
          ["EXCAVATED LEVEL", quantity(hit.ex, "m")],
          ["DEPTH", quantity(Math.max(0, depth), "m")],
        ],
      },
      "exv",
    );
}

/** Orbit / pan / zoom for mouse and touch (with pinch), tap to inspect. */
function bindControls(canvas: HTMLCanvasElement, s: SurfaceScene, onTap: (hit: ReturnType<SurfaceScene["pick"]>) => void) {
  const pointers = new Map<number, { x: number; y: number; type: string }>();
  let mode: "orbit" | "pan" | null = null;
  let engaged = false;
  let pinch: { d: number; mx: number; my: number } | null = null;
  let down: { x: number; y: number; t: number } | null = null;

  const onDown = (e: PointerEvent) => {
    engaged = true;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      mode = e.button === 2 || e.shiftKey ? "pan" : "orbit";
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      mode = null;
    }
    canvas.dataset.cursor = "grabbing";
  };
  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { ...prev, x: e.clientX, y: e.clientY });
    if (pointers.size >= 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (d > 0 && pinch.d > 0) s.zoom(pinch.d / d);
      s.pan(mx - pinch.mx, my - pinch.my);
      pinch = { d, mx, my };
      return;
    }
    if (!mode) return;
    // touch: vertical drags belong to the page (touch-action: pan-y), sideways ones orbit
    if (mode === "pan") s.pan(dx, dy);
    else s.orbit(dx, prev.type === "touch" ? 0 : dy);
  };
  const onUp = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      // a short, still press is a tap: inspect what is under it
      if (down && p && Math.hypot(p.x - down.x, p.y - down.y) < 6 && performance.now() - down.t < 350) {
        const r = canvas.getBoundingClientRect();
        onTap(s.pick(p.x - r.left, p.y - r.top));
      }
      mode = null;
      down = null;
      canvas.dataset.cursor = "grab";
    }
  };
  const onWheel = (e: WheelEvent) => {
    if (!engaged) return; // never take over page scrolling before the visitor has clicked in
    e.preventDefault();
    s.zoom(Math.exp(e.deltaY * 0.0012));
  };
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse") engaged = false;
  };
  const onDbl = () => s.resetView();
  const noMenu = (e: Event) => e.preventDefault();
  const onKey = (e: KeyboardEvent) => {
    const k: Record<string, () => void> = {
      ArrowLeft: () => s.orbit(-20, 0),
      ArrowRight: () => s.orbit(20, 0),
      ArrowUp: () => s.orbit(0, -20),
      ArrowDown: () => s.orbit(0, 20),
      "+": () => s.zoom(0.85),
      "=": () => s.zoom(0.85),
      "-": () => s.zoom(1.18),
      "0": () => s.resetView(),
    };
    const f = k[e.key];
    if (f) {
      e.preventDefault();
      f();
    }
  };
  canvas.tabIndex = 0;
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("dblclick", onDbl);
  canvas.addEventListener("contextmenu", noMenu);
  canvas.addEventListener("keydown", onKey);
  return () => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("dblclick", onDbl);
    canvas.removeEventListener("contextmenu", noMenu);
    canvas.removeEventListener("keydown", onKey);
  };
}

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
