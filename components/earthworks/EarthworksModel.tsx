"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildModel, LENGTH, VERTICAL_EXAGGERATION } from "@/lib/earthworks/model";
import { getState, watch } from "@/lib/workspace/store";
import { getOrbit, setOrientation } from "@/lib/workspace/actions";
import { setHud } from "@/lib/workspace/cadCursor";
import { onFrame, reducedMotion } from "@/lib/workspace/pointer";
import { num, quantity } from "@/lib/format";
import type { EarthworksScene } from "./scene";
import styles from "./EarthworksModel.module.css";

type OrientationDetail = { quaternion: import("three").Quaternion; zoom: number; interaction?: string };

/**
 * EARTHWORKS — a cut / fill model that turns with the ViewCube.
 *
 *   FRONT  reads as the long section (the page opens here, turning slowly)
 *   TOP    reads as a cut/fill plan
 *   ISO    shows the volumes themselves
 *
 * The model floats free: its canvas is much larger than its layout box, so
 * nothing is cut off while it turns, and the ground fades out at its edges.
 * Drag the model itself to turn it (the ViewCube follows). The volumes are
 * computed from the model (lib/earthworks/model.ts) and labelled as a
 * demonstration.
 */
export default function EarthworksModel({ className = "" }: { className?: string }) {
  const figRef = useRef<HTMLElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cutRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const [state, setStateFlag] = useState<"loading" | "ready" | "revealed" | "static">("loading");
  const totals = useMemo(() => {
    const m = buildModel();
    return { cut: m.cut, fill: m.fill };
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    const fig = figRef.current;
    if (!box || !canvas || !fig) return;
    if (!supportsWebGL()) {
      // no WebGL: show the legend as a static title block
      const id = requestAnimationFrame(() => setStateFlag("static"));
      return () => cancelAnimationFrame(id);
    }
    let cancelled = false;
    let scene: EarthworksScene | null = null;
    const cleanups: (() => void)[] = [];

    const start = async () => {
      const [{ EarthworksScene }, { quaternionFromAngles }] = await Promise.all([import("./scene"), import("../viewcube/orientation")]);
      if (cancelled) return;
      const s = new EarthworksScene(canvas);
      scene = s;
      s.setReveal(reducedMotion() ? 1 : 0);

      // Labels follow their volumes on screen (canvas px → the box they live in)
      const offset = { x: 0, y: 0 };
      s.onRender = () => {
        const place = (el: HTMLElement | null, p: [number, number, number]) => {
          if (!el) return;
          const pr = s.project(p);
          const x = pr.x + offset.x;
          const y = pr.y + offset.y;
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
        };
        place(cutRef.current, s.model.cutCentre);
        place(fillRef.current, s.model.fillCentre);
      };

      // Initial view: the workspace's current angles (the cube may not have started yet)
      const v = getState().viewport;
      s.setView(quaternionFromAngles({ azimuth: (v.azimuth * Math.PI) / 180, elevation: (v.elevation * Math.PI) / 180 }), 1);
      s.setMode(v.displayMode);

      // Size + placement: a big canvas, the model centred on its layout box
      const layout = () => {
        const c = canvas.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        offset.x = c.left - b.left;
        offset.y = c.top - b.top;
        s.resize(c.width, c.height);
        // ~75% of the box: the model sits in space with room around it
        const scale = 0.75 * Math.min(b.width / 132, b.height / 82);
        s.setAnchor(b.left - c.left + b.width / 2, b.top - c.top + b.height / 2, Math.max(1, scale));
      };
      const ro = new ResizeObserver(layout);
      ro.observe(canvas);
      ro.observe(box);
      layout();
      cleanups.push(() => ro.disconnect());

      let orbiting = false;
      let lastY = window.scrollY;
      const onOrientation = (e: Event) => {
        const d = (e as CustomEvent<OrientationDetail>).detail;
        if (d?.quaternion) s.setView(d.quaternion, d.zoom);
        orbiting = d?.interaction === "drag" || d?.interaction === "inertia" || d?.interaction === "transition";
      };
      document.addEventListener("viewcube:orientation", onOrientation);
      cleanups.push(() => document.removeEventListener("viewcube:orientation", onOrientation));
      cleanups.push(watch((st) => st.viewport.displayMode, (m) => s.setMode(m)));

      // ----- drag the model itself to turn it (mouse / pen; touch keeps scrolling) -----
      let dragging = false;
      const onDown = (e: PointerEvent) => {
        if (e.pointerType === "touch" || e.button !== 0) return;
        const r = canvas.getBoundingClientRect();
        const orbit = getOrbit();
        if (!orbit || !s.probe(e.clientX - r.left, e.clientY - r.top)) return;
        dragging = true;
        canvas.dataset.cursor = "grabbing";
        canvas.setPointerCapture(e.pointerId);
        orbit.start(e.clientX, e.clientY, e.timeStamp);
        e.preventDefault();
      };
      const onMove = (e: PointerEvent) => {
        if (dragging) getOrbit()?.move(e.clientX, e.clientY, e.timeStamp);
      };
      const onUp = (e: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        canvas.dataset.cursor = "grab";
        getOrbit()?.end(e.timeStamp);
      };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      cleanups.push(() => {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
      });

      // ----- HUD probe + scroll-back to TOP, through the shared pointer loop -----
      let over = false;
      cleanups.push(
        onFrame((p) => {
          // Scrolling away after playing with it: back to how the page opened — FRONT, turning slowly
          if (p.scrolled) {
            const y = window.scrollY;
            const down = y > lastY;
            lastY = y;
            const hero = fig.closest<HTMLElement>("[data-hero]");
            const past = hero ? y > hero.offsetHeight * 0.18 : false;
            const orbit = getOrbit();
            if (down && past && !orbiting && !dragging && orbit && !orbit.spinning()) {
              setOrientation("front");
              orbit.spin(true);
            }
          }
          const inside = p.inside && p.target === canvas;
          if (!inside) {
            if (over) setHud("hover", null, "hero");
            if (over && !dragging) delete canvas.dataset.cursor;
            over = false;
            return;
          }
          if (!p.moved && !p.scrolled && over) return;
          over = true;
          const r = canvas.getBoundingClientRect();
          const hit = s.probe(p.x - r.left, p.y - r.top);
          if (!dragging) {
            if (hit) canvas.dataset.cursor = "grab";
            else delete canvas.dataset.cursor;
          }
          if (!hit) {
            setHud("hover", null, "hero");
            return;
          }
          const ch = `CH 0+${String(Math.round(hit.x + LENGTH / 2)).padStart(3, "0")}`;
          const off = `${num(Math.abs(hit.z), 1)} m ${hit.z < 0 ? "L" : "R"}`;
          if (hit.depth > 0.05)
            setHud("hover", { title: "CUT · DRAG TO TURN", lines: [`${ch} · ${off}`], rows: [["DEPTH", quantity(hit.depth, "m")], ["GROUND", quantity(hit.ground, "m")], ["DESIGN", quantity(hit.design, "m")]] }, "hero");
          else if (hit.depth < -0.05)
            setHud("hover", { title: "FILL · DRAG TO TURN", lines: [`${ch} · ${off}`], rows: [["HEIGHT", quantity(-hit.depth, "m")], ["GROUND", quantity(hit.ground, "m")], ["DESIGN", quantity(hit.design, "m")]] }, "hero");
          else setHud("hover", { title: "EXISTING GROUND", lines: [`${ch} · ${off}`], rows: [["LEVEL", quantity(hit.ground, "m")]] }, "hero");
        }),
      );
      cleanups.push(() => setHud("hover", null, "hero"));
      setStateFlag("ready");

      // ----- build-in: a sweep across the model, once, when it is in view -----
      if (reducedMotion()) {
        setStateFlag("revealed");
        return;
      }
      const io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          io.disconnect();
          const t0 = performance.now() + 250;
          const D = 1500;
          const tick = (now: number) => {
            if (cancelled) return;
            const t = Math.min(1, Math.max(0, (now - t0) / D));
            s.setReveal(t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
            if (t < 1) requestAnimationFrame(tick);
            else setStateFlag("revealed");
          };
          requestAnimationFrame(tick);
        },
        { threshold: 0.2 },
      );
      io.observe(box);
      cleanups.push(() => io.disconnect());
    };

    // After the page has settled, like the ViewCube
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const t = idle ? idle(() => void start(), { timeout: 1200 }) : window.setTimeout(() => void start(), 300);
    return () => {
      cancelled = true;
      if (!idle) window.clearTimeout(t);
      cleanups.forEach((f) => f());
      scene?.dispose();
    };
  }, []);

  const net = totals.cut - totals.fill;

  return (
    <figure ref={figRef} className={`${styles.model} ${className}`} data-state={state} aria-label="Earthworks demonstration model: cut and fill volumes">
      <figcaption className={styles.legend}>
        <span className={styles.legendTitle}>Earthworks · demonstration model</span>
        <span className={styles.row} data-kind="cut">
          <i aria-hidden="true" />
          Cut <b className="num">{quantity(totals.cut, "m³")}</b>
        </span>
        <span className={styles.row} data-kind="fill">
          <i aria-hidden="true" />
          Fill <b className="num">{quantity(totals.fill, "m³")}</b>
        </span>
        <span className={styles.row}>
          Net <b className="num">{(net >= 0 ? "+" : "−") + quantity(Math.abs(net), "m³")}</b>
        </span>
        <span className={styles.meta}>Drag the model or the ViewCube · V.E. ×{VERTICAL_EXAGGERATION}</span>
      </figcaption>
      <div ref={boxRef} className={styles.box}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <span ref={cutRef} className={styles.tag} data-kind="cut" aria-hidden="true">
          Cut
        </span>
        <span ref={fillRef} className={styles.tag} data-kind="fill" aria-hidden="true">
          Fill
        </span>
      </div>
    </figure>
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
