"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { registerDraft, type DraftScript, type Pt, type Step } from "@/lib/workspace/drafter";
import { reducedMotion } from "@/lib/workspace/pointer";
import { buildTin, type PhotoGeometry } from "./geometry";
import styles from "./PhotoBuild.module.css";

/**
 * THE PHOTO, BUILT LIKE A DRAWING
 * ------------------------------------------------------------------
 * Sits on top of a photo in its frame. When the photo scrolls into view the
 * drafter's cursor (lib/workspace/drafter.ts) builds it the way a site is
 * built up in Civil 3D, in five steps:
 *
 *   1. LINE     a datum line with a level mark: the ground the figure stands on
 *   2. PLINE    the outline of the figure, starting and ending at the boots on that line
 *   3. HATCH    level lines rise from the datum to the head; the figure comes through
 *   4. SURFACE  the mountain: survey points land, join into a TIN, the triangles
 *               are shaded as a faceted model, and the model turns into the land.
 *               The three stages run down the slope one behind the other, with a
 *               sense of depth: small triangles and a slow pace on the far mountain,
 *               large ones and a fast pace in the near grass (see geometry.ts).
 *   5. RENDER   the sky comes in, the linework fades, the photo is complete
 *
 * The hatch is horizontal and starts from the datum on purpose: level lines end
 * cleanly on any outline, so nothing is cut at an odd angle around the boots.
 * The outlines and the surface are in geometry.ts. With reduced motion, or if
 * the drafter is not running, none of this happens and the photo shows the
 * usual way.
 */

/** How far behind the wireframe the shaded facets follow, and the land behind those (in step time, 0 → 1). */
const FACET_LAG = 0.05;
const LAND_LAG = 0.24;
/** The share of the SURFACE step the wireframe takes to reach the bottom edge. */
const FRONT = 0.72;

export default function PhotoBuild({ src, geometry, align = "xMidYMax" }: { src: string; geometry: PhotoGeometry; align?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const { width: W, height: H, person, ridge } = geometry;
  const tin = useMemo(() => buildTin(geometry), [geometry]);

  // The outline, re-ordered to start at the toe of the front boot: the cursor
  // leaves the datum line, goes round the figure and comes back down to it.
  const { outlinePoints, foot, mid } = useMemo(() => {
    const pts = person.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
    const lowest = Math.max(...pts.map((p) => p[1]));
    const xs = pts.map((p) => p[0]);
    // the toe: the leftmost of the points that sit on the sole
    let start = 0;
    pts.forEach((p, i) => {
      if (p[1] >= lowest - 12 && (pts[start][1] < lowest - 12 || p[0] < pts[start][0])) start = i;
    });
    const ordered = [...pts.slice(start), ...pts.slice(0, start)];
    return {
      outlinePoints: ordered.map((p) => p.join(",")).join(" "),
      foot: lowest,
      mid: Math.round((Math.min(...xs) + Math.max(...xs)) / 2),
    };
  }, [person]);

  // The datum: a level line under the boots, wider than the figure, with a level mark at its right end
  const datum = { x0: mid - 250, x1: mid + 250, y: foot + 3 };
  const mark = `${datum.x1 - 64},${datum.y - 30} ${datum.x1 - 28},${datum.y - 30} ${datum.x1 - 46},${datum.y}`;

  useEffect(() => {
    const svg = svgRef.current;
    const fig = svg?.closest<HTMLElement>("figure");
    const frame = svg?.parentElement;
    if (!svg || !fig || !frame) return;
    const q = <T extends SVGElement>(name: string) => svg.querySelector<T>(`[data-b="${name}"]`)!;
    const all = <T extends SVGElement>(name: string) => Array.from(svg.querySelectorAll<T>(`[data-b="${name}"]`));
    const done = () => {
      frame.dataset.build = "done";
    };
    // nothing to build: reduced motion, no drafter, or the photo is already showing
    if (reducedMotion() || !document.querySelector("[data-drafter]") || fig.classList.contains("is-in")) {
      done();
      return;
    }
    frame.dataset.build = "pending"; // the photo itself waits under the drawing

    const datumLine = q<SVGLineElement>("datum");
    const levelMark = q<SVGPolygonElement>("mark");
    const outline = q<SVGPolygonElement>("outline");
    const hatchClip = q<SVGRectElement>("hatch-clip");
    const hatch = q<SVGGElement>("hatch");
    const figure = q<SVGImageElement>("figure");
    const points = all<SVGCircleElement>("point");
    const wires = all<SVGPolygonElement>("wire");
    const facets = all<SVGPolygonElement>("facet");
    const fills = all<SVGPolygonElement>("fill");
    const full = q<SVGImageElement>("full");
    const linework = q<SVGGElement>("linework");
    const ground = q<SVGGElement>("ground");

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
    const top = outline.getBBox().y;
    const { peak } = tin;

    /**
     * The surface at t. Three stages follow each other down the slope: the
     * survey points and the wireframe, the shaded facets, then the land itself.
     */
    const surface = (t: number) => {
      tin.points.forEach((p, i) => {
        points[i].style.opacity = t >= p.at * FRONT ? "1" : "0";
      });
      tin.triangles.forEach((tri, i) => {
        const at = tri.at * FRONT;
        const land = t >= at + LAND_LAG;
        wires[i].style.opacity = t >= at + 0.02 ? "1" : "0";
        facets[i].style.opacity = t >= at + FACET_LAG && !land ? "1" : "0";
        fills[i].style.display = land ? "" : "none";
      });
    };

    const script: DraftScript = ({ reveal }) => {
      const steps: Step[] = [
        {
          cmd: "LINE",
          ms: 600,
          fixed: true,
          begin: () => {
            svg.dataset.on = "true";
            reveal(); // the empty frame opens; the drawing happens in it
          },
          from: () => trace(datumLine, 0),
          path: (t) => trace(datumLine, t),
          end: () => {
            levelMark.style.opacity = "1";
          },
        },
        {
          cmd: "PLINE",
          ms: 1700,
          fixed: true,
          from: () => trace(outline, 0),
          path: (t) => trace(outline, t),
        },
        {
          cmd: "HATCH",
          ms: 1200,
          fixed: true,
          from: () => toScreen(mid, foot),
          path: (t) => {
            // level lines rise from the datum to the head
            const y = foot - (foot - top) * t;
            hatchClip.setAttribute("y", String(y));
            hatchClip.setAttribute("height", String(foot - y + 8));
            figure.style.opacity = String(Math.max(0, (t - 0.3) / 0.7)); // the figure comes through the hatch
            return toScreen(mid, y);
          },
          end: () => {
            figure.style.opacity = "1";
            hatch.style.opacity = "0";
          },
        },
        {
          cmd: "SURFACE",
          ms: 3400,
          fixed: true,
          linear: true,
          from: () => toScreen(peak.x, peak.y),
          path: (t) => {
            surface(t);
            // the cursor stays with the wireframe: small careful moves on the far mountain,
            // then wider and faster ones as the surface comes towards the viewer
            const f = Math.min(1, t / FRONT);
            const down = tin.frontAt(f);
            return toScreen(peak.x + Math.sin(f * Math.PI * 3.5) * W * (0.06 + 0.3 * down), peak.y + (H - peak.y) * down);
          },
          end: () => surface(2),
        },
        {
          cmd: "RENDER",
          ms: 1000,
          fixed: true,
          from: () => toScreen(peak.x, peak.y * 0.6),
          draw: (t) => {
            full.style.opacity = String(t); // the sky, and with it the whole photo
            linework.style.opacity = String(1 - t);
            outline.style.opacity = String(1 - t);
            ground.style.opacity = String(1 - t);
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
  }, [W, H, ridge, person, tin, foot, mid]);

  const land = `${ridge} ${W},${H} 0,${H}`;
  /** A facet's colour: the frame's dark ground mixed with the accent, by its tone. */
  const shade = (tone: number) => {
    const k = 0.06 + tone * 0.26;
    const mix = (from: number, to: number) => Math.round(from + (to - from) * k);
    return `rgb(${mix(13, 62)},${mix(18, 224)},${mix(22, 143)})`;
  };

  return (
    <svg ref={svgRef} className={styles.build} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio={`${align} slice`} data-on="false" aria-hidden="true">
      <defs>
        <clipPath id={`${id}-person`}>
          <polygon points={person} />
        </clipPath>
        <clipPath id={`${id}-land`}>
          <polygon points={land} />
        </clipPath>
        {/* the triangles of the surface that have turned into land so far */}
        <clipPath id={`${id}-surface`}>
          {tin.triangles.map((t, i) => (
            <polygon key={i} data-b="fill" points={t.fill} style={{ display: "none" }} />
          ))}
        </clipPath>
        <clipPath id={`${id}-hatchsweep`}>
          <rect data-b="hatch-clip" x="0" y={H} width={W} height="0" />
        </clipPath>
        {/* level lines: horizontal, so they meet the outline cleanly everywhere */}
        <pattern id={`${id}-hatch`} width="40" height="15" patternUnits="userSpaceOnUse">
          <line x1="0" y1="7.5" x2="40" y2="7.5" className={styles.hatchLine} />
        </pattern>
      </defs>

      {/* the whole photo (the sky comes with it), last */}
      <image data-b="full" href={src} width={W} height={H} style={{ opacity: 0 }} />
      {/* the land under the skyline, one triangle at a time */}
      <g clipPath={`url(#${id}-land)`}>
        <image href={src} width={W} height={H} clipPath={`url(#${id}-surface)`} />
      </g>
      <g data-b="linework" clipPath={`url(#${id}-land)`}>
        {/* the surface as a shaded model, between the wireframe and the land */}
        {tin.triangles.map((t, i) => (
          <polygon key={i} data-b="facet" points={t.fill} className={styles.facet} style={{ fill: shade(t.tone), opacity: 0 }} />
        ))}
        {tin.triangles.map((t, i) => (
          <polygon key={i} data-b="wire" points={t.wire} className={styles.wire} style={{ opacity: 0 }} />
        ))}
        {tin.points.map((p, i) => (
          <circle key={i} data-b="point" cx={p.x} cy={p.y} r={(3.5 + p.near * 5).toFixed(1)} className={styles.point} style={{ opacity: 0 }} />
        ))}
      </g>
      {/* the datum the figure stands on, and its level mark */}
      <g data-b="ground">
        <line data-b="datum" x1={datum.x0} y1={datum.y} x2={datum.x1} y2={datum.y} className={styles.datum} style={{ strokeDasharray: "0 99999" }} />
        <polygon data-b="mark" points={mark} className={styles.mark} style={{ opacity: 0 }} />
      </g>
      {/* the figure, through its hatch */}
      <image data-b="figure" href={src} width={W} height={H} clipPath={`url(#${id}-person)`} style={{ opacity: 0 }} />
      <g data-b="hatch" className={styles.hatch} clipPath={`url(#${id}-person)`}>
        <rect x="0" y="0" width={W} height={H} fill={`url(#${id}-hatch)`} clipPath={`url(#${id}-hatchsweep)`} />
      </g>
      <polygon data-b="outline" points={outlinePoints} className={styles.outline} style={{ strokeDasharray: "0 99999" }} />
    </svg>
  );
}
