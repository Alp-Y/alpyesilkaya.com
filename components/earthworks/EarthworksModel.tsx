"use client";

import { useEffect, useRef, useState } from "react";
import { getState, watch } from "@/lib/workspace/store";
import { getOrbit } from "@/lib/workspace/actions";
import { getHeroModel, heroModel, type HeroModelId } from "@/lib/heroModels";
import { setHud } from "@/lib/workspace/cadCursor";
import { onFrame, reducedMotion } from "@/lib/workspace/pointer";
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
 * Drag the model itself to turn it (the ViewCube follows). In the hero it
 * is a visual only — no figures; the tools section carries the real demos.
 * The hero's model tabs switch it to the other showcase scenes (showcase.ts).
 */
export default function EarthworksModel({ className = "" }: { className?: string }) {
  const figRef = useRef<HTMLElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setStateFlag] = useState<"loading" | "ready" | "revealed" | "static">("loading");

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
      const [{ EarthworksScene }, { quaternionFromAngles }, { SHOWCASE }] = await Promise.all([
        import("./scene"),
        import("../viewcube/orientation"),
        import("./showcase"),
      ]);
      if (cancelled) return;
      const s = new EarthworksScene(canvas);
      scene = s;
      const build = (id: Exclude<HeroModelId, "road">) => SHOWCASE[id]();
      s.setModel(getHeroModel(), build);
      s.setReveal(reducedMotion() ? 1 : 0);

      // Initial view: the workspace's current angles (the cube may not have started yet)
      const v = getState().viewport;
      s.setView(quaternionFromAngles({ azimuth: (v.azimuth * Math.PI) / 180, elevation: (v.elevation * Math.PI) / 180 }), 1);
      s.setMode(v.displayMode);

      // Scale bar on the sheet (in the hero): a real length at the model's current scale
      let pxPerM = 1;
      let zoom = 1;
      const bar = fig.closest<HTMLElement>("[data-hero]")?.querySelector<HTMLElement>("[data-scale-bar]") ?? null;
      const updateScaleBar = () => {
        if (!bar) return;
        const px = pxPerM * zoom;
        // the round length that draws closest to ~160 px
        const L = [5, 10, 20, 25, 50, 100, 200].reduce((best, l) => (Math.abs(l * px - 160) < Math.abs(best * px - 160) ? l : best));
        bar.style.setProperty("--bar", `${(L * px).toFixed(1)}px`);
        const mid = bar.querySelector("[data-sb-mid]");
        const end = bar.querySelector("[data-sb-end]");
        if (mid) mid.textContent = String(L / 2);
        if (end) end.textContent = `${L} m`;
      };

      // Size + placement: a big canvas, the model centred on its layout box
      const layout = () => {
        const c = canvas.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        s.resize(c.width, c.height);
        // ~90% of the box: the model fills its half of the sheet, with a little air around it
        const scale = 0.9 * Math.min(b.width / 132, b.height / 82);
        pxPerM = Math.max(1, scale);
        s.setAnchor(b.left - c.left + b.width / 2, b.top - c.top + b.height / 2, pxPerM);
        updateScaleBar();
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
        if (d?.zoom && d.zoom !== zoom) {
          zoom = d.zoom;
          updateScaleBar();
        }
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
            if (down && past && !orbiting && !dragging && orbit && !orbit.spinning()) orbit.showcase(heroModel(getHeroModel()).view);
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
          // A visual, not a readout: the pointer only says what you can do
          setHud("hover", { title: "DRAG TO TURN", lines: [] }, "hero");
        }),
      );
      cleanups.push(() => setHud("hover", null, "hero"));
      setStateFlag("ready");

      // ----- build-in: a sweep across the model -----
      let sweepId = 0;
      const sweep = (delay: number, D: number) => {
        const id = ++sweepId;
        const t0 = performance.now() + delay;
        const tick = (now: number) => {
          if (cancelled || id !== sweepId) return;
          const t = Math.min(1, Math.max(0, (now - t0) / D));
          s.setReveal(t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
          if (t < 1) requestAnimationFrame(tick);
          else setStateFlag("revealed");
        };
        requestAnimationFrame(tick);
      };

      // ----- switching models: draw the new one in, and show it from its own angle -----
      const onModel = (e: Event) => {
        const id = (e as CustomEvent<{ id: HeroModelId }>).detail?.id;
        if (!id) return;
        s.setModel(id, build);
        if (reducedMotion()) s.setReveal(1);
        else {
          s.setReveal(0);
          sweep(0, 1100);
        }
        getOrbit()?.showcase(heroModel(id).view);
      };
      document.addEventListener("hero:model", onModel);
      cleanups.push(() => document.removeEventListener("hero:model", onModel));

      // once, when it first comes into view
      if (reducedMotion()) {
        setStateFlag("revealed");
        return;
      }
      const io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          io.disconnect();
          sweep(250, 1500);
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

  return (
    <figure ref={figRef} className={`${styles.model} ${className}`} data-state={state} aria-label="3D model of the selected engineering scene, drag to turn it">
      <div ref={boxRef} className={styles.box}>
        <canvas ref={canvasRef} className={styles.canvas} />
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
