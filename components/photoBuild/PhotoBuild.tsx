"use client";

import { useEffect, useId, useRef } from "react";
import { registerDraft, type DraftScript, type Pt, type Step } from "@/lib/workspace/drafter";
import { reducedMotion } from "@/lib/workspace/pointer";
import type { PhotoGeometry } from "./geometry";
import styles from "./PhotoBuild.module.css";

/**
 * THE PHOTO, BUILT LIKE A DRAWING
 * ------------------------------------------------------------------
 * Sits on top of a photo in its frame. When the photo scrolls into view the
 * drafter's cursor (lib/workspace/drafter.ts) builds it in five steps:
 *
 *   1. PLINE    traces the outline of the figure
 *   2. HATCH    hatches it top to bottom; the figure comes through the hatch
 *   3. PLINE    traces the skyline
 *   4. CONTOUR  contour lines step down the mountain and the land fills in
 *   5. RENDER   the sky comes in, the linework fades, the photo is complete
 *
 * The outlines are in geometry.ts. With reduced motion, or if the drafter is
 * not running, none of this happens and the photo shows the usual way.
 */
export default function PhotoBuild({ src, geometry, align = "xMidYMax" }: { src: string; geometry: PhotoGeometry; align?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const { width: W, height: H, person, ridge } = geometry;

  useEffect(() => {
    const svg = svgRef.current;
    const fig = svg?.closest<HTMLElement>("figure");
    const frame = svg?.parentElement;
    if (!svg || !fig || !frame) return;
    const q = <T extends SVGElement>(name: string) => svg.querySelector<T>(`[data-b="${name}"]`)!;
    const done = () => {
      frame.dataset.build = "done";
    };
    // nothing to build: reduced motion, no drafter, or the photo is already showing
    if (reducedMotion() || !document.querySelector("[data-drafter]") || fig.classList.contains("is-in")) {
      done();
      return;
    }
    frame.dataset.build = "pending"; // the photo itself waits under the drawing

    const outline = q<SVGPolygonElement>("outline");
    const ridgeLine = q<SVGPolylineElement>("ridge");
    const hatchClip = q<SVGRectElement>("hatch-clip");
    const hatch = q<SVGGElement>("hatch");
    const figure = q<SVGImageElement>("figure");
    const landClip = q<SVGRectElement>("land-clip");
    const contours = Array.from(svg.querySelectorAll<SVGPolylineElement>('[data-b="contour"]'));
    const full = q<SVGImageElement>("full");
    const linework = q<SVGGElement>("linework");

    /** A point in the photo's pixels → where it is on screen right now. */
    const toScreen = (x: number, y: number): Pt => {
      const m = svg.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      const p = new DOMPoint(x, y).matrixTransform(m);
      return { x: p.x, y: p.y };
    };
    /** Draws `el` up to t (0 → 1) and returns where its end is on screen. */
    const trace = (el: SVGGeometryElement, t: number): Pt => {
      const total = el.getTotalLength();
      el.style.strokeDasharray = `${(total * t).toFixed(1)} ${total.toFixed(1)}`;
      const p = el.getPointAtLength(total * t);
      return toScreen(p.x, p.y);
    };
    const box = outline.getBBox();
    const peakY = Math.min(...ridge.split(" ").map((p) => Number(p.split(",")[1])));
    const cx = box.x + box.width / 2;

    const script: DraftScript = ({ reveal }) => {
      const steps: Step[] = [
        {
          cmd: "PLINE",
          ms: 1700,
          fixed: true,
          begin: () => {
            svg.dataset.on = "true";
            reveal(); // the empty frame opens; the drawing happens in it
          },
          from: () => trace(outline, 0),
          path: (t) => trace(outline, t),
        },
        {
          cmd: "HATCH",
          ms: 1200,
          fixed: true,
          from: () => toScreen(cx, box.y),
          path: (t) => {
            const y = box.y + box.height * t;
            hatchClip.setAttribute("height", String(Math.max(0, y - box.y + 8)));
            figure.style.opacity = String(Math.max(0, (t - 0.25) / 0.75)); // the figure comes through the hatch
            return toScreen(cx, y);
          },
          end: () => {
            figure.style.opacity = "1";
            hatch.style.opacity = "0";
          },
        },
        {
          cmd: "PLINE",
          ms: 1200,
          fixed: true,
          from: () => trace(ridgeLine, 0),
          path: (t) => trace(ridgeLine, t),
        },
        {
          cmd: "CONTOUR",
          ms: 1500,
          fixed: true,
          from: () => toScreen(W * 0.5, peakY),
          path: (t) => {
            const y = peakY + (H - peakY) * t;
            landClip.setAttribute("height", String(y)); // the land fills in down to the cursor
            contours.forEach((c, k) => (c.style.opacity = t > (k + 0.5) / (contours.length + 1) ? "1" : "0"));
            return toScreen(W * 0.5, y);
          },
          end: () => landClip.setAttribute("height", String(H)),
        },
        {
          cmd: "RENDER",
          ms: 900,
          fixed: true,
          from: () => toScreen(W * 0.5, peakY * 0.6),
          draw: (t) => {
            full.style.opacity = String(t); // the sky, and with it the whole photo
            linework.style.opacity = String(1 - t);
            outline.style.opacity = String(1 - t);
          },
          end: () => {
            done();
            svg.dataset.on = "false";
          },
        },
      ];
      return steps;
    };

    const unregister = registerDraft(fig, script);
    // the drafter let it pass (scrolled by quickly): show the photo
    fig.addEventListener("draft:skipped", done);
    return () => {
      unregister();
      fig.removeEventListener("draft:skipped", done);
    };
  }, [W, H, ridge]);

  const land = `${ridge} ${W},${H} 0,${H}`;
  // contour lines: the skyline stepped down the slope
  const contourOffsets = [90, 190, 300, 420, 550];
  const shift = (dy: number) =>
    ridge
      .split(" ")
      .map((p) => {
        const [x, y] = p.split(",").map(Number);
        return `${x},${y + dy}`;
      })
      .join(" ");

  return (
    <svg ref={svgRef} className={styles.build} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio={`${align} slice`} data-on="false" aria-hidden="true">
      <defs>
        <clipPath id={`${id}-person`}>
          <polygon points={person} />
        </clipPath>
        <clipPath id={`${id}-land`}>
          <polygon points={land} />
        </clipPath>
        <clipPath id={`${id}-landsweep`}>
          <rect data-b="land-clip" x="0" y="0" width={W} height="0" />
        </clipPath>
        <clipPath id={`${id}-hatchsweep`}>
          <rect data-b="hatch-clip" x="0" y="0" width={W} height="0" transform={`translate(0 ${0})`} />
        </clipPath>
        <pattern id={`${id}-hatch`} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="22" className={styles.hatchLine} />
        </pattern>
      </defs>

      {/* the whole photo (the sky comes with it), last */}
      <image data-b="full" href={src} width={W} height={H} style={{ opacity: 0 }} />
      {/* the land under the skyline, filled in from the top down */}
      <g clipPath={`url(#${id}-landsweep)`}>
        <image href={src} width={W} height={H} clipPath={`url(#${id}-land)`} />
      </g>
      <g data-b="linework">
        <g clipPath={`url(#${id}-land)`}>
          {contourOffsets.map((dy) => (
            <polyline key={dy} data-b="contour" points={shift(dy)} className={styles.contour} style={{ opacity: 0 }} />
          ))}
        </g>
        <polyline data-b="ridge" points={ridge} className={styles.ridge} style={{ strokeDasharray: "0 99999" }} />
      </g>
      {/* the figure, through its hatch */}
      <image data-b="figure" href={src} width={W} height={H} clipPath={`url(#${id}-person)`} style={{ opacity: 0 }} />
      <g data-b="hatch" className={styles.hatch} clipPath={`url(#${id}-person)`}>
        <rect data-b="hatch-clip-fill" x="0" y="0" width={W} height={H} fill={`url(#${id}-hatch)`} clipPath={`url(#${id}-hatchsweep)`} />
      </g>
      <polygon data-b="outline" points={person} className={styles.outline} style={{ strokeDasharray: "0 99999" }} />
    </svg>
  );
}
