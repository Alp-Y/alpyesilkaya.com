"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/lib/workspace/store";
import { hoverEntity, selectEntity } from "@/lib/workspace/actions";
import { registerSpace, setHud, type HudContent } from "@/lib/workspace/cadCursor";
import { quantity } from "@/lib/format";
import { bounds, centroid, type Point } from "@/lib/sqe/geometry";
import { areaLabel, type Analysis } from "@/lib/sqe/engine";
import { highlightFor } from "@/lib/sqe/selection";
import { ids, parseId, type Project } from "@/lib/sqe/types";
import { WORK_TYPES } from "@/lib/sqe/workTypes";
import styles from "./sqe.module.css";

const PAD = 18; // metres around the drawing
const MAX_TILT = 60; // degrees — keeps oblique views readable

/**
 * The drawing. SVG in drawing units (metres), Y flipped to screen.
 * - Display mode (shared state) changes how geometry is drawn.
 * - View orientation (shared state + live ViewCube events) tilts / rotates
 *   the sheet: TOP = plan view, ISO = an oblique view of the same plan.
 * - Intersections are drawn as the work geometry clipped by the area
 *   (SVG clip-path) — exactly the region the engine measured.
 */
export default function SqeViewport({ project, analysis }: { project: Project; analysis: Analysis }) {
  const displayMode = useWorkspace((s) => s.viewport.displayMode);
  const overlays = useWorkspace((s) => s.viewport.overlaysVisible);
  const selection = useWorkspace((s) => s.selection);
  const hover = useWorkspace((s) => s.hover);
  const wrapRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const [pxPerUnit, setPxPerUnit] = useState(1.4);

  // ----- drawing extents → SVG space -----
  const box = useMemo(() => {
    const pts: Point[] = [
      ...project.boundaries.flatMap((b) => b.polygon),
      ...project.work.flatMap((w) => w.geometry.points),
      ...project.context.flatMap((c) => c.points),
    ];
    const b = bounds(pts);
    return { ...b, w: b.maxX - b.minX + PAD * 2, h: b.maxY - b.minY + PAD * 2 };
  }, [project]);
  const X = (x: number) => x - box.minX + PAD;
  const Y = (y: number) => box.maxY - y + PAD;
  const pts = (p: Point[]) => p.map(([x, y]) => `${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(" ");
  const fs = (px: number) => px / pxPerUnit; // screen px → drawing units

  const hl = useMemo(() => highlightFor(selection, analysis), [selection, analysis]);
  const hoverHl = useMemo(() => highlightFor(hover, analysis), [hover, analysis]);
  const boundaryByKey = useMemo(() => new Map(project.boundaries.map((b) => [b.key, b])), [project]);

  // ----- measure scale for text sizes -----
  useEffect(() => {
    const el = planeRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPxPerUnit(Math.max(0.2, e.contentRect.width / box.w)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [box.w]);

  // ----- orientation: follow the ViewCube (live) and the shared state (at rest) -----
  const orientation = useWorkspace((s) => s.viewport.orientation);
  const restAz = useWorkspace((s) => s.viewport.azimuth);
  const restEl = useWorkspace((s) => s.viewport.elevation);
  const angles = useRef({ az: 0, el: 90 });
  useEffect(() => {
    const plane = planeRef.current;
    if (!plane) return;
    const apply = (az: number, el: number, live: boolean) => {
      angles.current = { az, el };
      const tilt = Math.min(MAX_TILT, Math.max(0, 90 - Math.abs(el)));
      plane.style.transition = live ? "none" : "";
      plane.style.transform = tilt < 0.01 && Math.abs(az % 360) < 0.01 ? "none" : `rotateX(${tilt.toFixed(2)}deg) rotateZ(${az.toFixed(2)}deg)`;
    };
    const presets: Record<string, [number, number]> = { top: [0, 90], iso: [45, 35.264], front: [0, 0], back: [180, 0], right: [90, 0], left: [270, 0], bottom: [0, -90] };
    const [az0, el0] = orientation === "free" ? [restAz, restEl] : presets[orientation] ?? [0, 90];
    apply(az0, el0, false);
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent<{ azimuth: number; elevation: number; interaction: string }>).detail;
      if (d) apply(d.azimuth, d.elevation, d.interaction === "drag");
    };
    document.addEventListener("viewcube:orientation", onEvent);
    return () => document.removeEventListener("viewcube:orientation", onEvent);
  }, [orientation, restAz, restEl]);

  // ----- drawing coordinates for the HUD / status bar (inverse of the view transform) -----
  useEffect(() => {
    const plane = planeRef.current;
    if (!plane) return;
    return registerSpace("sqe", (cx, cy) => {
      const r = plane.getBoundingClientRect();
      const w = plane.offsetWidth;
      const h = plane.offsetHeight;
      const { az, el } = angles.current;
      const a = (az * Math.PI) / 180;
      const t = (Math.min(MAX_TILT, Math.max(0, 90 - Math.abs(el))) * Math.PI) / 180;
      // screen = [[cos a, −sin a], [cos t·sin a, cos t·cos a]] · local   (about the centre)
      const sx = cx - (r.left + r.width / 2);
      const sy = cy - (r.top + r.height / 2);
      const ct = Math.cos(t) || 1e-6;
      const lx = Math.cos(a) * sx + (Math.sin(a) * sy) / ct;
      const ly = -Math.sin(a) * sx + (Math.cos(a) * sy) / ct;
      const u = (lx + w / 2) * (box.w / w);
      const v = (ly + h / 2) * (box.h / h);
      return { x: u + box.minX - PAD, y: box.maxY + PAD - v };
    });
  }, [box]);

  // ----- HUD: hovered object, or the selection when hovering empty space / itself -----
  useEffect(() => {
    const describe = (id: string | null, selected: boolean): HudContent | null => {
      const p = parseId(id);
      if (!p) return null;
      if (p.kind === "boundary") {
        const b = boundaryByKey.get(p.key);
        if (!b) return null;
        if (selected) return { title: "SELECTED", lines: [areaLabel(b), b.meta ? `${b.meta.section} · ${b.meta.side}`.toUpperCase() : "UNASSIGNED"] };
        return { title: b.meta ? "AREA" : "BOUNDARY", lines: [areaLabel(b), quantity(analysis.boundaryArea[b.key] ?? 0, "m²")] };
      }
      if (p.kind === "work") {
        const w = project.work.find((x) => x.code === p.code);
        if (!w) return null;
        const t = WORK_TYPES[w.type];
        const total = analysis.totals[w.code]?.measure ?? 0;
        const value = t.measure === "length" ? quantity(total, "lm") : quantity(total, "m²");
        return { title: selected ? "SELECTED" : t.label.toUpperCase(), lines: [[w.code, w.spec].filter(Boolean).join(" · "), value] };
      }
      if (p.kind === "intersection" || p.kind === "row") {
        const i = p.kind === "intersection" ? analysis.intersections.find((x) => x.id === id) : null;
        const row = p.kind === "row" ? analysis.rows.find((r) => r.id === id) : null;
        const type = WORK_TYPES[i?.type ?? row!.type];
        const area = areaLabel(boundaryByKey.get(p.key));
        const measure = i ? i.measure : row!.intersectionIds.reduce((s, x) => s + (analysis.intersections.find((y) => y.id === x)?.measure ?? 0), 0);
        const q = i ? i.quantity : row!.quantity;
        const rows: [string, string][] =
          type.measure === "volume"
            ? [["AREA", quantity(measure, "m²")], ["DEPTH", quantity(type.depth ?? 0, "m")], ["VOLUME", quantity(q, "m³")]]
            : [[type.measure === "length" ? "LENGTH" : "AREA", quantity(q, type.unit)]];
        return { title: "INTERSECTION", lines: [`${area} × ${type.label.toUpperCase()}`], rows };
      }
      return null;
    };
    const hovering = hover && hover !== selection;
    setHud("hover", hovering ? describe(hover, false) : null, "sqe");
    setHud("selected", !hovering && selection ? describe(selection, true) : null, "sqe");
  }, [hover, selection, analysis, project, boundaryByKey]);

  useEffect(
    () => () => {
      setHud("hover", null, "sqe");
      setHud("selected", null, "sqe");
      hoverEntity(null);
    },
    [],
  );

  const pick = (id: string) => ({
    "data-cursor": "select",
    "data-entity": id,
    onPointerEnter: () => hoverEntity(id),
    onPointerLeave: () => hoverEntity(null),
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      selectEntity(id);
    },
  });

  const analysisMode = displayMode === "analysis";
  const shaded = displayMode !== "wireframe";

  return (
    <div
      ref={wrapRef}
      className={styles.viewport}
      data-cad-space="sqe"
      data-mode={displayMode}
      onClick={() => selectEntity(null)}
      onPointerLeave={() => hoverEntity(null)}
    >
      <div ref={planeRef} className={styles.plane}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${box.w.toFixed(2)} ${box.h.toFixed(2)}`}
          role="img"
          aria-label={`${project.name}: ${project.boundaries.length} project areas and ${project.work.length} pieces of work geometry`}
        >
          <defs>
            {project.boundaries.map((b) => (
              <clipPath key={b.key} id={`sqe-clip-${b.key}`}>
                <polygon points={pts(b.polygon)} />
              </clipPath>
            ))}
            <Hatches size={fs(7)} />
          </defs>

          {/* Reference drawing */}
          <g className={styles.context}>
            {project.context.map((c, i) => (
              <polyline key={i} points={pts(c.points)} data-style={c.style} />
            ))}
          </g>

          {/* Project areas */}
          <g>
            {project.boundaries.map((b) => {
              const id = ids.boundary(b.key);
              return (
                <polygon
                  key={b.key}
                  points={pts(b.polygon)}
                  className={styles.boundary}
                  data-assigned={!!b.meta}
                  data-selected={hl.boundaries.has(b.key)}
                  data-hover={hover === id}
                  {...pick(id)}
                />
              );
            })}
          </g>

          {/* Work geometry */}
          <g>
            {project.work.map((w) => {
              const t = WORK_TYPES[w.type];
              const id = ids.work(w.code);
              const state = {
                "data-selected": hl.work.has(w.code),
                "data-hover": hover === id,
                "data-dim": analysisMode,
              };
              return w.geometry.kind === "polygon" ? (
                <polygon
                  key={w.code}
                  points={pts(w.geometry.points)}
                  className={styles.work}
                  style={{ "--c": t.color, fill: shaded && t.hatch ? `url(#hatch-${t.id})` : undefined } as React.CSSProperties}
                  {...state}
                  {...(analysisMode ? {} : pick(id))}
                />
              ) : (
                <g key={w.code} style={{ "--c": t.color } as React.CSSProperties}>
                  <polyline points={pts(w.geometry.points)} className={styles.workLine} data-kind={w.type} {...state} />
                  {!analysisMode && <polyline points={pts(w.geometry.points)} className={styles.hitLine} {...pick(id)} />}
                </g>
              );
            })}
          </g>

          {/* Intersections: work geometry clipped by each area — exactly what was measured */}
          {(analysisMode || hl.intersections.size > 0 || hoverHl.intersections.size > 0) && (
            <g>
              {analysis.intersections.map((i) => {
                const w = project.work.find((x) => x.code === i.workCode)!;
                const t = WORK_TYPES[w.type];
                const selected = hl.intersections.has(i.id);
                const hovered = hover === i.id || hoverHl.intersections.has(i.id);
                if (!analysisMode && !selected && !hovered) return null;
                const common = {
                  clipPath: `url(#sqe-clip-${i.boundaryKey})`,
                  "data-selected": selected,
                  "data-hover": hovered,
                  style: { "--c": t.color } as React.CSSProperties,
                  ...(analysisMode ? pick(i.id) : {}),
                };
                return w.geometry.kind === "polygon" ? (
                  <polygon key={i.id} points={pts(w.geometry.points)} className={styles.intersection} {...common} />
                ) : (
                  <polyline key={i.id} points={pts(w.geometry.points)} className={styles.intersectionLine} {...common} />
                );
              })}
            </g>
          )}

          {/* Annotations (hidden by the clean-view control) */}
          <g className={styles.annotations} data-visible={overlays}>
            {project.stations.map((s) => (
              <g key={s.label} transform={`translate(${X(s.at[0]).toFixed(2)} ${Y(s.at[1]).toFixed(2)}) rotate(${((-s.angle * 180) / Math.PI).toFixed(2)})`}>
                <line x1="0" y1={-fs(5)} x2="0" y2={fs(5)} className={styles.tick} />
                <text x={fs(3)} y={-fs(8)} fontSize={fs(9)} className={styles.station}>
                  {s.label}
                </text>
              </g>
            ))}
            {project.source === "example" && <NorthArrow x={X(box.maxX) - fs(10)} y={Y(box.maxY) + fs(26)} s={fs(1)} />}
          </g>

          {/* Area labels: the metadata tag appears once an area is assigned */}
          <g className={styles.labels}>
            {project.boundaries.map((b) => {
              const [cx, cy] = centroid(b.polygon);
              const label = areaLabel(b);
              const w = fs(label.length * 6.6 + 12);
              const h = fs(15);
              return (
                <g
                  key={b.key}
                  transform={`translate(${X(cx).toFixed(2)} ${Y(cy).toFixed(2)})`}
                  className={styles.tag}
                  data-assigned={!!b.meta}
                  data-selected={hl.boundaries.has(b.key)}
                  {...pick(ids.boundary(b.key))}
                >
                  <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={fs(2)} />
                  <text y={fs(3.4)} fontSize={fs(9.5)} textAnchor="middle">
                    {label}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Quantities at each intersection (analysis) */}
          {analysisMode && overlays && (
            <g className={styles.quantities}>
              {analysis.intersections.map((i) => {
                const t = WORK_TYPES[i.type];
                const selected = hl.intersections.has(i.id);
                if (!selected && hl.intersections.size > 0) return null;
                if (!selected && t.measure === "length") return null; // keep the plan readable
                return (
                  <text key={i.id} x={X(i.anchor[0])} y={Y(i.anchor[1])} fontSize={fs(9)} textAnchor="middle" data-selected={selected}>
                    {quantity(i.quantity, t.unit)}
                  </text>
                );
              })}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

/** One hatch pattern per work type, in that type's CAD colour. */
function Hatches({ size }: { size: number }) {
  const s = Math.max(size, 0.5);
  return (
    <>
      {Object.values(WORK_TYPES)
        .filter((t) => t.hatch)
        .map((t) => {
          const line = { stroke: t.color, strokeWidth: 1, vectorEffect: "non-scaling-stroke" as const, opacity: 0.55 };
          const id = `hatch-${t.id}`;
          switch (t.hatch) {
            case "cross":
              return (
                <pattern key={id} id={id} width={s} height={s} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2={s} {...line} />
                  <line x1="0" y1="0" x2={s} y2="0" {...line} />
                </pattern>
              );
            case "dots":
              return (
                <pattern key={id} id={id} width={s} height={s} patternUnits="userSpaceOnUse">
                  <circle cx={s / 2} cy={s / 2} r={s / 9} fill={t.color} opacity={0.6} />
                </pattern>
              );
            case "fine":
              return (
                <pattern key={id} id={id} width={s / 2} height={s / 2} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                  <line x1="0" y1="0" x2="0" y2={s / 2} {...line} opacity={0.4} />
                </pattern>
              );
            case "sparse":
              return (
                <pattern key={id} id={id} width={s * 1.6} height={s * 1.6} patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
                  <line x1="0" y1="0" x2="0" y2={s * 1.6} {...line} opacity={0.4} />
                </pattern>
              );
            default:
              return (
                <pattern key={id} id={id} width={s} height={s} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2={s} {...line} />
                </pattern>
              );
          }
        })}
    </>
  );
}

function NorthArrow({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className={styles.north}>
      <path d={`M0 ${-14 * s} L${5 * s} ${4 * s} L0 ${1 * s} L${-5 * s} ${4 * s} Z`} />
      <text y={-18 * s} fontSize={9 * s} textAnchor="middle">
        N
      </text>
    </g>
  );
}
