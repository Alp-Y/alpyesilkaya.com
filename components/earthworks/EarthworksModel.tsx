"use client";

import { useEffect, useRef, useState } from "react";
import { getState, watch } from "@/lib/workspace/store";
import { getOrbit } from "@/lib/workspace/actions";
import { getHeroModel, heroModel, type HeroModelId } from "@/lib/heroModels";
import { setHud } from "@/lib/workspace/cadCursor";
import { onFrame, reducedMotion } from "@/lib/workspace/pointer";
import { registerDraft, type DraftScript, type Pt, type Step } from "@/lib/workspace/drafter";
import { LENGTH, roadLevel, sample } from "@/lib/earthworks/model";
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
 * Drag the model itself to turn it (the ViewCube follows). Pointing at it
 * shows where you are on it; the tools section carries the real demos.
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
          // On the model: what you can do, and where you are on it (metres from the model's
          // centre; on the road earthworks also the cut or fill depth there, from the model)
          const rows: [string, string][] = [
            ["X", `${hit.x.toFixed(1)} m`],
            ["Y", `${(-hit.z).toFixed(1)} m`],
          ];
          if (getHeroModel() === "road" && Math.abs(hit.depth) >= 0.05) rows.push([hit.depth > 0 ? "CUT" : "FILL", `${Math.abs(hit.depth).toFixed(2)} m`]);
          setHud("hover", { title: "DRAG TO TURN", rows }, "hero");
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

      // ----- built by the drafter (lib/workspace/drafter.ts): the road, the way it is
      // really worked out. Survey points are picked, the existing ground profile is
      // drawn through them, then the design level; the 3D volumes sweep in between
      // the two lines. The view keeps its slow turn the whole time: every position
      // is projected from the model each frame, so the sketch turns with it and the
      // finished model simply carries on turning.
      let building = false;
      let aborted = false; // the visitor switched model while it was being drawn
      const script: DraftScript = ({ svg, reveal }) => {
        if (getHeroModel() !== "road") return null;
        const NS = "http://www.w3.org/2000/svg";
        const half = LENGTH / 2;
        const ground = (x: number) => sample(s.model.ground, x, 0);
        const at = (x: number, level: number): Pt => {
          const c = canvas.getBoundingClientRect();
          const p = s.project([x, level, 0]);
          return { x: c.left + p.x, y: c.top + p.y };
        };
        const station = (x: number) => `STA 0+${String(Math.round(x + half)).padStart(3, "0")}`;
        // hold the hero's auto-advance to the next model while drawing (the turn carries on)
        const hero = fig.closest<HTMLElement>("[data-hero]");
        const hold = () => {
          hero?.dispatchEvent(new Event("keydown"));
        };

        const points: { x: number; node: SVGGElement }[] = [];
        const eg = document.createElementNS(NS, "path");
        const dg = document.createElementNS(NS, "path");
        eg.dataset.s = "eg";
        dg.dataset.s = "dg";
        let egX: number | null = null;
        let dgX: number | null = null;
        /** Re-place the sketch on the model (it may have scrolled or turned a little). */
        const sync = () => {
          for (const p of points) {
            const a = at(p.x, ground(p.x));
            p.node.setAttribute("transform", `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)})`);
          }
          if (egX !== null) {
            let d = "";
            for (let x = -half; x < egX; x += 2) {
              const a = at(x, ground(x));
              d += `${d ? "L" : "M"}${a.x.toFixed(1)} ${a.y.toFixed(1)}`;
            }
            const a = at(egX, ground(egX));
            eg.setAttribute("d", `${d}${d ? "L" : "M"}${a.x.toFixed(1)} ${a.y.toFixed(1)}`);
          }
          if (dgX !== null) {
            const a = at(-half, roadLevel(-half));
            const b = at(dgX, roadLevel(dgX));
            dg.setAttribute("d", `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
          }
        };

        const steps: Step[] = [];
        // 1. survey: pick the points, each with its level
        [-56, -26, -6, 14, 30, 54].forEach((x, i) => {
          steps.push({
            cmd: "POINT",
            ms: 110,
            fixed: true,
            begin: () => {
              hold();
              if (i > 0) return;
              building = true;
              aborted = false;
              s.setReveal(0);
              svg.style.opacity = "1";
              svg.append(eg, dg);
              reveal();
            },
            from: () => {
              sync();
              return at(x, ground(x));
            },
            draw: () => `Z ${ground(x).toFixed(2)}`,
            end: () => {
              const node = document.createElementNS(NS, "g");
              node.dataset.s = "pt";
              const cross = document.createElementNS(NS, "path");
              cross.setAttribute("d", "M-4 0H4M0 -4V4");
              const label = document.createElementNS(NS, "text");
              label.setAttribute("y", "-9");
              label.textContent = ground(x).toFixed(2);
              node.append(cross, label);
              svg.append(node);
              points.push({ x, node });
              sync();
            },
          });
        });
        // 2. existing ground: a polyline through the survey
        steps.push({
          cmd: "PLINE",
          ms: 900,
          fixed: true,
          begin: hold,
          from: () => {
            sync();
            return at(-half, ground(-half));
          },
          path: (t) => {
            egX = -half + LENGTH * t;
            sync();
            return at(egX, ground(egX));
          },
          draw: () => `EXISTING  ${station(egX ?? -half)}`,
        });
        // 3. design level: the road's steady grade
        steps.push({
          cmd: "LINE",
          ms: 650,
          fixed: true,
          begin: hold,
          from: () => {
            sync();
            return at(-half, roadLevel(-half));
          },
          path: (t) => {
            dgX = -half + LENGTH * t;
            sync();
            return at(dgX, roadLevel(dgX));
          },
          draw: () => "DESIGN  2.0%",
        });
        // 4. the volumes: cut and fill sweep in between the two lines, the sketch gives way
        steps.push({
          cmd: "VOLUME",
          ms: 1500,
          fixed: true,
          begin: hold,
          from: () => {
            sync();
            return at(-half, roadLevel(-half));
          },
          path: (t) => {
            sync();
            const x = -half + LENGTH * t;
            if (!aborted) s.setReveal(t);
            svg.style.opacity = aborted ? "0" : String(Math.max(0, 1 - t * 1.15));
            return at(x, roadLevel(x));
          },
          draw: (t) => `CUT / FILL  ${station(-half + LENGTH * t)}`,
          end: () => {
            building = false;
            if (aborted) return;
            s.setReveal(1);
            setStateFlag("revealed");
            hold(); // the model stays for its full time before the next one
          },
        });
        return steps;
      };

      // ----- switching models: draw the new one in, and show it from its own angle -----
      const onModel = (e: Event) => {
        const id = (e as CustomEvent<{ id: HeroModelId }>).detail?.id;
        if (!id) return;
        if (building) aborted = true;
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
      // With the drafter running, it builds the model when it gets to it. If it
      // has already passed (the scene loaded late) the plain sweep below runs.
      const wrap = fig.closest<HTMLElement>("[data-draft]");
      if (wrap && document.querySelector("[data-drafter]") && !wrap.classList.contains("is-in")) {
        cleanups.push(registerDraft(wrap, script));
        const onSkipped = () => sweep(0, 1500);
        wrap.addEventListener("draft:skipped", onSkipped, { once: true });
        cleanups.push(() => wrap.removeEventListener("draft:skipped", onSkipped));
        return;
      }
      const io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          io.disconnect();
          // first load: start once the viewport frame has drawn itself (~1 s in)
          sweep(Math.max(250, 1000 - performance.now()), 1500);
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
