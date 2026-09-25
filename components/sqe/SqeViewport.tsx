"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/lib/workspace/store";
import { hoverEntity, selectEntity } from "@/lib/workspace/actions";
import { registerSpace, setHud, type HudContent, type SelectionDetail } from "@/lib/workspace/cadCursor";
import { coord, num, quantity } from "@/lib/format";
import { bounds, centroid, intersectPolygons, pointInPolygon, triangulate, type Point, type Polygon } from "@/lib/sqe/geometry";
import type { Analysis } from "@/lib/sqe/engine";
import { getSqe, setMulti, stopStory, useSqe, workTypesIn, type Step } from "@/lib/sqe/store";
import { ids, parseId, type Boundary, type Project, type SurveyPoint } from "@/lib/sqe/types";
import { WORK_TYPES } from "@/lib/sqe/workTypes";
import styles from "./sqe.module.css";

const PAD = 24; // metres around an imported drawing

/** CAD layer colours for the reference linework (CAD view). */
const LAYERS: Record<string, { color: string; dash?: string; label: string }> = {
  "C-ROAD-EDGE": { color: "#c9d1da", label: "Road edges" },
  "C-EXIST-ROAD": { color: "#7f8a96", dash: "6 4", label: "Existing roads" },
  "C-RAMP": { color: "#c9d1da", label: "Ramps" },
  "C-DRAIN": { color: "#5fb7d9", dash: "10 3 2 3", label: "Watercourse" },
};

/**
 * THE DRAWING — aerial image + CAD overlay, in drawing units (metres).
 *
 * Story steps: 1 SITE · 2 SURVEY · 3 AREAS · 4 QUANTITIES
 *
 * Views (the shared display mode) show different information, not just
 * different brightness:
 *   AERIAL    the site as it is: the photo, the area zones, the chosen work
 *   CAD       the drawing: linework by layer, every work type hatched,
 *             area polylines with vertex grips, chainage — no photo
 *   ANALYSIS  the result: each area shaded by its quantity (legend), the
 *             measured pieces solid, the numbers large
 *
 * Drag a window (→) or crossing (←) to select several areas at once.
 *
 * `preview` (homepage): the step and view are given, not read from the
 * shared stores, and the drawing takes no input (no HUD, no selection),
 * so a looping preview never changes the rest of the site.
 */
export type SqePreviewState = { step: Step; view: "aerial" | "cad" | "analysis" };

export default function SqeViewport({ project, analysis, preview }: { project: Project; analysis: Analysis; preview?: SqePreviewState }) {
  const storeStep = useSqe((s) => s.step);
  const step = preview?.step ?? storeStep;
  const workType = useSqe((s) => s.workType);
  const multi = useSqe((s) => s.multi);
  const sharedMode = useWorkspace((s) => s.viewport.displayMode);
  const displayMode = preview ? (preview.view === "aerial" ? "shaded" : preview.view === "analysis" ? "analysis" : "wireframe") : sharedMode;
  const selection = useWorkspace((s) => s.selection);
  const hover = useWorkspace((s) => s.hover);
  const svgRef = useRef<SVGSVGElement>(null);
  const [pxPerUnit, setPxPerUnit] = useState(0.75);
  const [hoverPoint, setHoverPoint] = useState<SurveyPoint | null>(null);

  const site = project.site;
  const origin = useMemo<[number, number]>(() => site?.origin ?? [0, 0], [site]);
  const view = displayMode === "shaded" ? "aerial" : displayMode === "analysis" ? "analysis" : "cad";

  // ----- extents: the aerial's frame, or the drawing's bounds -----
  const box = useMemo(() => {
    if (site) return { minX: 0, minY: 0, maxX: site.extent[0], maxY: site.extent[1] };
    const b = bounds([...project.boundaries.flatMap((x) => x.polygon), ...project.work.flatMap((w) => w.geometry.points)]);
    return { minX: b.minX - PAD, minY: b.minY - PAD, maxX: b.maxX + PAD, maxY: b.maxY + PAD };
  }, [project, site]);
  const W = box.maxX - box.minX;
  const H = box.maxY - box.minY;
  const X = (x: number) => x - box.minX;
  const Y = (y: number) => box.maxY - y;
  const pts = (p: Point[]) => p.map(([x, y]) => `${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(" ");
  const u = (px: number) => px / pxPerUnit; // screen px → drawing units

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPxPerUnit(Math.max(0.05, e.contentRect.width / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);

  // ----- drawing coordinates for the HUD + status bar -----
  useEffect(() => {
    const el = svgRef.current;
    if (!el || preview) return;
    return registerSpace("sqe", (cx, cy) => {
      const r = el.getBoundingClientRect();
      const x = box.minX + ((cx - r.left) / r.width) * W;
      const y = box.maxY - ((cy - r.top) / r.height) * H;
      return { x: x + origin[0], y: y + origin[1] };
    });
  }, [box, W, H, origin, preview]);

  // ----- window / crossing selection → several areas -----
  useEffect(() => {
    const onSelect = (e: Event) => {
      const d = (e as CustomEvent<SelectionDetail>).detail;
      const el = svgRef.current;
      if (d.space !== "sqe" || !el || preview) return;
      stopStory();
      const r = el.getBoundingClientRect();
      const toX = (cx: number) => box.minX + ((cx - r.left) / r.width) * W;
      const toY = (cy: number) => box.maxY - ((cy - r.top) / r.height) * H;
      const x0 = toX(d.rect.left);
      const x1 = toX(d.rect.right);
      const y0 = toY(d.rect.bottom);
      const y1 = toY(d.rect.top);
      const rect: Polygon = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      const inside = (p: Point) => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
      const keys = project.boundaries
        .filter((b) =>
          d.mode === "window"
            ? b.polygon.every(inside)
            : b.polygon.some(inside) || intersectPolygons(rect, b.polygon, triangulate(b.polygon)).area > 0.01,
        )
        .map((b) => b.key);
      setMulti({ keys, mode: d.mode });
    };
    document.addEventListener("cad:selection", onSelect);
    return () => document.removeEventListener("cad:selection", onSelect);
  }, [project, box, W, H, preview]);

  // A single pick replaces a multi-selection
  useEffect(() => {
    if (selection && getSqe().multi) setMulti(null);
  }, [selection]);

  const typeInfo = workType ? WORK_TYPES[workType] : null;
  const qtyIn = useMemo(() => {
    const m = new Map<string, number>();
    if (!workType) return m;
    for (const r of analysis.rows) if (r.type === workType) m.set(r.boundaryKey, r.quantity);
    return m;
  }, [analysis, workType]);
  const maxQty = Math.max(0, ...qtyIn.values());
  const byKey = useMemo(() => new Map(project.boundaries.map((b) => [b.key, b])), [project]);
  const multiSet = useMemo(() => new Set(multi?.keys ?? []), [multi]);

  const sel = parseId(selection);
  const selKey = sel && sel.kind !== "work" ? sel.key : null;
  const hov = parseId(hover);
  const hoverKey = hov && hov.kind !== "work" ? hov.key : null;
  const hoverWork = hov && hov.kind === "work" ? hov.code : null;

  const areaState = (key: string) =>
    hoverKey === key ? "hover" : selKey === key || multiSet.has(key) ? "selected" : selKey || multiSet.size ? "dim" : "idle";

  // ----- HUD: hovered area (or survey point), else the selection -----
  useEffect(() => {
    if (preview) return;
    const describe = (key: string | null, selected: boolean): HudContent | null => {
      const b = key ? byKey.get(key) : null;
      if (!b) return null;
      const id = b.meta?.areaId ?? key!;
      if (step < 4 || !typeInfo) {
        return { title: selected ? "SELECTED" : "AREA", lines: [id, (b.meta?.name ?? "Unnamed").toUpperCase()], rows: [["AREA", quantity(analysis.boundaryArea[b.key] ?? 0, "m²")]] };
      }
      const q = qtyIn.get(b.key) ?? 0;
      if (displayMode === "analysis") {
        return { title: selected ? "SELECTED" : "INTERSECTION", lines: [`${id} × ${typeInfo.label.toUpperCase()}`], rows: [["QUANTITY", quantity(q, typeInfo.unit)]] };
      }
      return { title: selected ? "SELECTED" : "AREA", lines: [id], rows: [[typeInfo.label.toUpperCase(), q ? quantity(q, typeInfo.unit) : "·"]] };
    };
    const hoveringOther = hoverKey && hoverKey !== selKey;
    if (hoverPoint) {
      setHud("hover", { title: "SURVEY POINT", lines: [hoverPoint.id], rows: [["E", coord(hoverPoint.x + origin[0])], ["N", coord(hoverPoint.y + origin[1])], ["Z", coord(hoverPoint.z)]] }, "sqe");
    } else setHud("hover", hoveringOther ? describe(hoverKey, false) : null, "sqe");
    let selected: HudContent | null = null;
    if (!hoveringOther && !hoverPoint) {
      if (selKey) selected = describe(selKey, true);
      else if (multi && typeInfo) {
        const total = multi.keys.reduce((s, k) => s + (qtyIn.get(k) ?? 0), 0);
        selected = { title: multi.mode === "window" ? "WINDOW SELECTION" : "CROSSING SELECTION", lines: [`${multi.keys.length} AREAS`], rows: [[typeInfo.label.toUpperCase(), quantity(total, typeInfo.unit)]] };
      }
    }
    setHud("selected", selected, "sqe");
  }, [hoverKey, selKey, hoverPoint, step, typeInfo, qtyIn, displayMode, analysis, byKey, origin, multi, preview]);

  useEffect(
    () => () => {
      setHud("hover", null, "sqe");
      setHud("selected", null, "sqe");
      hoverEntity(null);
    },
    [],
  );

  const areaProps = (b: Boundary) => ({
    "data-cursor": "select",
    "data-entity": ids.boundary(b.key),
    onPointerEnter: () => hoverEntity(ids.boundary(b.key)),
    onPointerLeave: () => hoverEntity(null),
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      setMulti(null);
      selectEntity(selKey === b.key ? null : ids.boundary(b.key));
    },
  });

  const labelAt = (b: Boundary): Point => {
    const c = centroid(b.polygon);
    if (pointInPolygon(c, b.polygon)) return c;
    const n = b.polygon.length;
    const a = b.polygon[Math.floor(n / 4)];
    const z = b.polygon[Math.floor((3 * n) / 4)];
    return [(a[0] + z[0]) / 2, (a[1] + z[1]) / 2];
  };

  const showAreas = step >= 3;
  const showWork = step >= 4 && !!workType;
  const types = workTypesIn(analysis);
  // CAD shows every work type (the drawing); the other views show the chosen one
  const workTypesShown = view === "cad" ? types : workType ? [workType] : [];
  const fontPx = 11;

  // vertex grips (CAD view): polygon corners, thinned so curved edges don't turn into a dotted line
  const grips = (poly: Point[]) => poly.filter((_, i) => i % Math.max(1, Math.round(poly.length / 12)) === 0);

  return (
    <div className={styles.drawing} data-step={step} data-mode={displayMode} data-view={view} data-has-image={!!site}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        style={{ aspectRatio: `${W} / ${H}` }}
        role="img"
        aria-label={`${project.name}: ${project.boundaries.length} project areas`}
        data-cad-space={preview ? undefined : "sqe"}
        data-coord-area={preview ? undefined : ""}
        onPointerDown={preview ? undefined : () => stopStory()}
        onClick={
          preview
            ? undefined
            : () => {
                selectEntity(null);
                setMulti(null);
              }
        }
      >
        <defs>
          {project.boundaries.map((b) => (
            <clipPath key={b.key} id={`sqe-clip-${b.key}`}>
              <polygon points={pts(b.polygon)} />
            </clipPath>
          ))}
          {types.map((t, i) => (
            <pattern key={t} id={`sqe-hatch-${t}`} width={u(7)} height={u(7)} patternUnits="userSpaceOnUse" patternTransform={`rotate(${[45, -45, 0, 90][i % 4]})`}>
              <line x1="0" y1="0" x2="0" y2={u(7)} stroke={WORK_TYPES[t].color} strokeWidth={u(1)} />
            </pattern>
          ))}
        </defs>

        {site && <image className={styles.aerial} href={site.image} x={0} y={0} width={W} height={H} preserveAspectRatio="none" />}

        {/* Local grid, 50 m */}
        <g className={styles.grid} aria-hidden="true">
          {Array.from({ length: Math.floor(W / 50) + 1 }, (_, i) => (
            <line key={`gx${i}`} x1={i * 50} y1={0} x2={i * 50} y2={H} strokeWidth={u(i % 4 ? 0.5 : 1)} />
          ))}
          {Array.from({ length: Math.floor(H / 50) + 1 }, (_, i) => (
            <line key={`gy${i}`} x1={0} y1={H - i * 50} x2={W} y2={H - i * 50} strokeWidth={u(i % 4 ? 0.5 : 1)} />
          ))}
        </g>

        {/* CAD: reference linework by layer + chainage */}
        {site && view === "cad" && step >= 3 && (
          <g className={styles.linework} aria-hidden="true">
            {site.linework.map((l, i) => {
              const layer = LAYERS[l.layer];
              return (
                <polyline
                  key={i}
                  points={pts(l.points)}
                  stroke={layer?.color ?? "#8d99a6"}
                  strokeDasharray={layer?.dash ? layer.dash.split(" ").map((d) => u(Number(d))).join(" ") : undefined}
                  strokeWidth={u(0.9)}
                />
              );
            })}
            {project.context.map((c, i) => (
              <polyline key={`c${i}`} points={pts(c.points)} className={styles.centreline} strokeWidth={u(0.8)} strokeDasharray={`${u(14)} ${u(3)} ${u(3)} ${u(3)}`} />
            ))}
            {project.stations.map((s) => (
              <g key={s.label} transform={`translate(${X(s.at[0])} ${Y(s.at[1])}) rotate(${(-s.angle * 180) / Math.PI})`}>
                <line x1={0} y1={-u(6)} x2={0} y2={u(6)} className={styles.tick} strokeWidth={u(1)} />
                <text y={-u(9)} fontSize={u(9)} textAnchor="middle" className={styles.chainage}>
                  {s.label}
                </text>
              </g>
            ))}
          </g>
        )}

        {/* 02 SURVEY — control point, sight lines, measured points */}
        {site && (step === 2 || step === 3) && (
          <g className={styles.survey} data-live={step === 2}>
            {step === 2 &&
              site.survey.map((p, i) => (
                <line key={`s${p.id}`} className={styles.sight} x1={X(site.control.x)} y1={Y(site.control.y)} x2={X(p.x)} y2={Y(p.y)} pathLength={1} strokeWidth={u(0.75)} style={{ animationDelay: `${i * 55}ms` }} />
              ))}
            <g className={styles.station} transform={`translate(${X(site.control.x)} ${Y(site.control.y)})`}>
              <path d={`M0 ${-u(8)} L${u(7)} ${u(5)} L${-u(7)} ${u(5)} Z`} strokeWidth={u(1.2)} />
              <circle r={u(1.6)} />
              <text y={u(19)} fontSize={u(10)} textAnchor="middle">
                {site.control.id}
              </text>
            </g>
            {site.survey.map((p, i) => (
              <g
                key={p.id}
                className={styles.point}
                transform={`translate(${X(p.x)} ${Y(p.y)})`}
                style={{ animationDelay: `${step === 2 ? i * 55 + 180 : 0}ms` }}
                onPointerEnter={() => setHoverPoint(p)}
                onPointerLeave={() => setHoverPoint(null)}
                data-cursor="select"
              >
                <circle r={u(9)} className={styles.pointHit} />
                <path d={`M${-u(4)} 0 H${u(4)} M0 ${-u(4)} V${u(4)}`} strokeWidth={u(1.2)} />
                <circle r={u(2.2)} strokeWidth={u(1)} />
              </g>
            ))}
          </g>
        )}

        {/* ANALYSIS: each area shaded by its quantity of the chosen type */}
        {showWork && view === "analysis" && typeInfo && (
          <g className={styles.choropleth} aria-hidden="true">
            {project.boundaries.map((b) => {
              const q = qtyIn.get(b.key) ?? 0;
              return (
                <polygon
                  key={b.key}
                  points={pts(b.polygon)}
                  fill={typeInfo.color}
                  fillOpacity={q && maxQty ? 0.1 + 0.45 * (q / maxQty) : 0.02}
                  data-state={areaState(b.key)}
                />
              );
            })}
          </g>
        )}

        {/* 04 — work geometry: full extent (faint), then the part inside each area */}
        {showWork &&
          workTypesShown.map((t) => {
            const active = t === workType;
            const items = project.work.filter((w) => w.type === t);
            return (
              <g key={t} className={styles.work} data-active={active} style={{ color: WORK_TYPES[t].color } as React.CSSProperties}>
                {items.map((w) => (
                  <polygon
                    key={w.code}
                    points={pts(w.geometry.points)}
                    className={styles.workShape}
                    fill={view === "cad" ? `url(#sqe-hatch-${t})` : "none"}
                    strokeWidth={u(1)}
                    data-hover={hoverWork === w.code}
                  />
                ))}
                {active &&
                  project.boundaries.map((b) => (
                    <g key={b.key} clipPath={`url(#sqe-clip-${b.key})`} className={styles.cut} data-state={areaState(b.key)}>
                      {items.map((w) => (
                        <polygon key={w.code} points={pts(w.geometry.points)} strokeWidth={u(1.4)} data-hover={hoverWork === w.code} data-dim={!!hoverWork && hoverWork !== w.code} />
                      ))}
                    </g>
                  ))}
              </g>
            );
          })}

        {/* 03 — project areas (the hit targets from step 3 on) */}
        {showAreas && (
          <g className={styles.areas}>
            {project.boundaries.map((b) => {
              const state = areaState(b.key);
              return (
                <polygon
                  key={b.key}
                  className={styles.area}
                  data-state={state}
                  data-assigned={!!b.meta}
                  points={pts(b.polygon)}
                  pathLength={1}
                  strokeWidth={u(state === "hover" || state === "selected" ? 1.8 : 1.1)}
                  {...areaProps(b)}
                />
              );
            })}
          </g>
        )}

        {/* CAD: vertex grips on the area polylines */}
        {showAreas && view === "cad" && (
          <g className={styles.grips} aria-hidden="true">
            {project.boundaries.flatMap((b) =>
              grips(b.polygon).map(([x, y], i) => <rect key={`${b.key}-${i}`} x={X(x) - u(2.5)} y={Y(y) - u(2.5)} width={u(5)} height={u(5)} strokeWidth={u(1)} />),
            )}
          </g>
        )}

        {/* A hovered work item: what each area gets from it */}
        {showWork && hoverWork && (
          <g className={styles.splits} aria-hidden="true">
            {analysis.intersections
              .filter((i) => i.workCode === hoverWork)
              .map((i) => {
                const t = WORK_TYPES[i.type];
                const text = `${byKey.get(i.boundaryKey)?.meta?.areaId ?? i.boundaryKey} · ${num(i.quantity)} ${t.unit}`;
                const w = text.length * (fontPx - 1) * 0.6 + 12;
                return (
                  <g key={i.id} transform={`translate(${X(i.anchor[0])} ${Y(i.anchor[1])})`}>
                    <rect x={-u(w / 2)} y={-u(10)} width={u(w)} height={u(20)} rx={u(2)} strokeWidth={u(1)} style={{ stroke: t.color }} />
                    <text y={u(4)} fontSize={u(fontPx - 1)} textAnchor="middle" className="num">
                      {text}
                    </text>
                  </g>
                );
              })}
          </g>
        )}

        {/* Labels: ID (+ name in step 3, + quantity in step 4) */}
        {showAreas && !hoverWork && (
          <g className={styles.labels} aria-hidden="true">
            {project.boundaries.map((b) => {
              const [lx, ly] = labelAt(b);
              const id = b.meta?.areaId ?? b.key.replace(/^B/, "B-");
              const q = qtyIn.get(b.key);
              const second = step === 3 ? b.meta?.name ?? "" : q && typeInfo ? quantity(q, typeInfo.unit) : "";
              const big = view === "analysis" && step === 4 && !!q;
              const f1 = big ? fontPx + 1 : fontPx;
              const f2 = big ? fontPx + 3 : fontPx - 1;
              const w = Math.max(id.length * f1 * 0.64 + 12, second ? second.length * f2 * 0.6 + 12 : 0);
              const h = second ? (big ? 42 : 34) : 20;
              return (
                <g key={b.key} className={styles.label} data-state={areaState(b.key)} data-empty={step === 4 && !q} data-big={big} transform={`translate(${X(lx)} ${Y(ly)})`}>
                  <rect x={-u(w / 2)} y={-u(h / 2)} width={u(w)} height={u(h)} rx={u(2)} strokeWidth={u(1)} />
                  <text y={second ? -u(big ? 5 : 3) : u(4)} fontSize={u(f1)} textAnchor="middle" className={styles.labelId}>
                    {id}
                  </text>
                  {second && (
                    <text y={u(big ? 14 : 11)} fontSize={u(f2)} textAnchor="middle" className={`${styles.labelSub} num`}>
                      {second}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {/* Sheet furniture: legend (per view) + scale bar + north arrow */}
      <div className={styles.furniture} aria-hidden="true">
        <div className={styles.furnitureLeft}>
          {step >= 4 && view === "cad" && (
            <ul className={styles.legend}>
              <li>
                <i style={{ borderColor: "rgba(233,237,241,0.8)" }} />
                SQE-AREA
              </li>
              {types.map((t) => (
                <li key={t} data-active={t === workType}>
                  <i style={{ borderColor: WORK_TYPES[t].color }} />C-{t}
                </li>
              ))}
              {site && (
                <li>
                  <i style={{ borderColor: "#c9d1da" }} />C-ROAD
                </li>
              )}
            </ul>
          )}
          {step >= 4 && view === "analysis" && typeInfo && (
            <div className={styles.ramp}>
              <span>{typeInfo.label} per area</span>
              <i style={{ background: `linear-gradient(90deg, transparent, ${typeInfo.color})` }} />
              <em className="num">
                0 <b>{quantity(maxQty, typeInfo.unit)}</b>
              </em>
            </div>
          )}
          <div className={styles.scale}>
            <span style={{ width: `${100 * pxPerUnit}px` }} />
            <em>100 m</em>
          </div>
        </div>
        <svg className={styles.north} viewBox="-10 -14 20 28">
          <path d="M0 -12 L6 6 L0 2 L-6 6 Z" />
          <text y="13" textAnchor="middle">
            N
          </text>
        </svg>
      </div>
      {site && view === "aerial" && <p className={styles.credit}>Rendered example site, not a real location</p>}
      {step === 4 && !preview && (
        <p className={styles.dragHint} aria-hidden="true">
          Drag → window · ← crossing
        </p>
      )}
    </div>
  );
}
