"use client";

import { memo, useId } from "react";
import { anchor, CENTRELINE, chainage, CLASSES, EXTENT, type Idents, type Pt, type RawEnt } from "@/lib/terminal/model";
import styles from "./terminal.module.css";

/**
 * THE DRAWING — the example road drawing, in drawing units (metres).
 *
 *   raw           grey linework on layer 0: lines, points, TIN surfaces,
 *                 survey points with their levels as text
 *   identified    the same geometry as a project structure: its colour,
 *                 its own symbol, and a tag (K-01, MH-02…) on a leader
 *
 * No state of its own: the homepage preview and the tool page both drive
 * it through these props.
 *   reveal   0 → 1: the drawing plots in from the left
 *   view     the part of the sheet on screen (a viewBox), for zooming to a structure
 *   focus    ids to keep bright; everything else fades back (browser, SHOW)
 *   fresh    the object that has just been identified: a ring goes out from it
 */

export type ViewBox = { x: number; y: number; w: number; h: number };
export const FULL: ViewBox = { x: -2, y: -8, w: 452, h: EXTENT.y1 - EXTENT.y0 + 16 };
export const sx = (x: number) => x;
export const sy = (y: number) => EXTENT.y1 - y;

type Props = {
  ents: RawEnt[];
  ids: Idents;
  reveal?: number;
  view?: ViewBox;
  selected?: string | null;
  focus?: Set<string> | null;
  fresh?: { id: string; n: number } | null;
  tags?: boolean;
  labels?: boolean;
  onPick?: (id: string | null) => void;
  onHover?: (id: string | null, ev?: React.PointerEvent) => void;
  className?: string;
};

export default function TerminalDrawing({ ents, ids, reveal = 1, view = FULL, selected = null, focus = null, fresh = null, tags = true, labels = true, onPick, onHover, className = "" }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (n: string) => `${n}-${uid}`;
  const order = [...ents].sort((a, b) => LAYER[a.shape] - LAYER[b.shape]);
  const count = Object.keys(ids).length;
  const sel = selected ? ents.find((e) => e.id === selected) : null;
  // text and symbols keep their size on screen when zoomed in
  const k = view.w / FULL.w;

  return (
    <svg
      className={`${styles.drawing} ${className}`}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      role="img"
      aria-label={`Example road drawing: ${ents.length} objects, ${count} identified as project structures`}
      onClick={onPick ? () => onPick(null) : undefined}
      style={{ "--k": k } as React.CSSProperties}
    >
      <defs>
        {Object.entries(CLASSES).map(([c, v]) => (
          <pattern key={c} id={id(`h-${c}`)} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="3" stroke={v.color} strokeWidth="0.5" />
          </pattern>
        ))}
        <clipPath id={id("reveal")}>
          <rect x={FULL.x} y={FULL.y} width={FULL.w * reveal} height={FULL.h} />
        </clipPath>
      </defs>

      <g clipPath={reveal < 1 ? `url(#${id("reveal")})` : undefined}>
        {labels && <Reference />}
        <g onPointerLeave={onHover ? () => onHover(null) : undefined}>
          {order.map((e) => (
            <Ent
              key={e.id}
              e={e}
              ident={ids[e.id]}
              hatch={ids[e.id] ? id(`h-${ids[e.id].cls}`) : ""}
              dim={!!focus && !focus.has(e.id)}
              labels={labels}
              onPick={onPick}
              onHover={onHover}
            />
          ))}
        </g>
        {sel && <Selection e={sel} k={k} />}
        {tags && (
          <g className={styles.tags} aria-hidden="true">
            {order.map((e) => (ids[e.id] ? <Tag key={e.id} e={e} tag={ids[e.id].tag} color={CLASSES[ids[e.id].cls].color} dim={!!focus && !focus.has(e.id)} k={k} /> : null))}
          </g>
        )}
        {fresh && ents.find((e) => e.id === fresh.id) && <Ring key={`${fresh.id}-${fresh.n}`} at={anchor(ents.find((e) => e.id === fresh.id)!)} k={k} />}
      </g>
    </svg>
  );
}

const LAYER: Record<RawEnt["shape"], number> = { tin: 0, points: 1, line: 2, dot: 3 };
const pts = (p: Pt[]) => p.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ");

/* ---------- pieces ---------- */

/** the road's centreline and chainage ticks, always in the drawing */
function Reference() {
  const ticks = [];
  for (let x = 20; x <= 420; x += 40) ticks.push(x);
  return (
    <g className={styles.ref} aria-hidden="true">
      <line x1={sx(20)} x2={sx(420)} y1={sy(CENTRELINE)} y2={sy(CENTRELINE)} />
      {ticks.map((x) => (
        <g key={x}>
          <line x1={x} x2={x} y1={sy(CENTRELINE + 1.6)} y2={sy(CENTRELINE - 1.6)} className={styles.tick} />
          <text x={x} y={sy(CENTRELINE) + 5.2} textAnchor="middle" className={`${styles.t} ${styles.ch}`}>
            {chainage(x)}
          </text>
        </g>
      ))}
      <line x1={sx(220)} x2={sx(220)} y1={sy(EXTENT.y1 - 2)} y2={sy(EXTENT.y0 + 2)} className={styles.zoneLine} />
      <text x={sx(216)} y={sy(EXTENT.y1 - 2) + 3} textAnchor="end" className={`${styles.t} ${styles.zone}`}>
        ZONE A
      </text>
      <text x={sx(224)} y={sy(EXTENT.y1 - 2) + 3} className={`${styles.t} ${styles.zone}`}>
        ZONE B
      </text>
    </g>
  );
}

type EntProps = {
  e: RawEnt;
  ident?: Idents[string];
  hatch: string;
  dim: boolean;
  labels: boolean;
  onPick?: (id: string | null) => void;
  onHover?: (id: string | null, ev?: React.PointerEvent) => void;
};

const Ent = memo(function Ent({ e, ident, hatch, dim, labels, onPick, onHover }: EntProps) {
  const cls = ident?.cls;
  const interactive = !!(onPick || onHover);
  return (
    <g
      className={styles.ent}
      data-cls={cls ?? "raw"}
      data-shape={e.shape}
      data-dim={dim}
      style={cls ? ({ "--c": CLASSES[cls].color } as React.CSSProperties) : undefined}
      onPointerEnter={onHover ? (ev) => onHover(e.id, ev) : undefined}
      onPointerMove={onHover ? (ev) => onHover(e.id, ev) : undefined}
      onClick={
        onPick
          ? (ev) => {
              ev.stopPropagation();
              onPick(e.id);
            }
          : undefined
      }
    >
      {interactive && <Hit e={e} />}
      <Body e={e} cls={cls} hatch={hatch} labels={labels} />
    </g>
  );
});

function Hit({ e }: { e: RawEnt }) {
  if (e.shape === "line") return <polyline points={pts(e.pts)} className={styles.hitLine} />;
  if (e.shape === "dot") return <circle cx={sx(e.pts[0][0])} cy={sy(e.pts[0][1])} r="6" className={styles.hitArea} />;
  const xs = e.pts.map((p) => p[0]);
  const ys = e.pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs) - 4, Math.max(...xs) + 4, Math.min(...ys) - 4, Math.max(...ys) + 4];
  return <rect x={sx(x0)} y={sy(y1)} width={x1 - x0} height={y1 - y0} className={styles.hitArea} />;
}

function Body({ e, cls, hatch, labels }: { e: RawEnt; cls?: string; hatch: string; labels: boolean }) {
  if (e.shape === "line") return <polyline points={pts(e.pts)} className={cls === "pipe" ? styles.pipe : styles.line} />;

  if (e.shape === "dot") {
    const [x, y] = [sx(e.pts[0][0]), sy(e.pts[0][1])];
    if (cls === "manhole")
      return (
        <>
          <circle cx={x} cy={y} r="2.8" className={styles.sym} />
          <path d={`M${x - 1.9} ${y - 1.9}L${x + 1.9} ${y + 1.9}M${x - 1.9} ${y + 1.9}L${x + 1.9} ${y - 1.9}`} className={styles.symLine} />
        </>
      );
    if (cls === "light")
      return (
        <>
          <circle cx={x} cy={y} r="1.7" className={styles.sym} />
          <path d={`M${x} ${y + 1.7}V${y + 4.6}`} className={styles.symLine} />
          <circle cx={x} cy={y + 5.4} r="0.9" className={styles.dot} />
        </>
      );
    return <circle cx={x} cy={y} r="1.1" className={styles.rawDot} />;
  }

  if (e.shape === "tin")
    return (
      <>
        {cls && <polygon points={pts(e.pts)} fill={`url(#${hatch})`} className={styles.fill} />}
        <g className={styles.mesh}>
          {e.tris!.map((t, i) => (
            <polygon key={i} points={pts(t)} />
          ))}
        </g>
        {cls && <polygon points={pts(e.pts)} className={styles.edge} />}
      </>
    );

  // survey points with their levels
  const zs = e.levels!.map((l) => l.z);
  const [zMin, zMax] = [Math.min(...zs), Math.max(...zs)];
  const levelAt = (p: Pt) => e.levels!.find((l) => l.at === p)!.z;
  return (
    <>
      {cls && (
        <g className={styles.surface}>
          {e.tris!.map((t, i) => {
            const z = (levelAt(t[0]) + levelAt(t[1]) + levelAt(t[2])) / 3;
            // deeper reads stronger
            return <polygon key={i} points={pts(t)} style={{ fillOpacity: 0.1 + 0.32 * (1 - (z - zMin) / (zMax - zMin || 1)) }} />;
          })}
        </g>
      )}
      {e.levels!.map((l, i) => {
        const [x, y] = [sx(l.at[0]), sy(l.at[1])];
        return (
          <g key={i} className={styles.survey}>
            <path d={`M${x - 1.3} ${y}H${x + 1.3}M${x} ${y - 1.3}V${y + 1.3}`} />
            {labels && (
              <text x={x + 1.8} y={y - 1.4} className={styles.lvl}>
                {l.z.toFixed(2)}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

/** the tag: a leader from the object to its ID */
function Tag({ e, tag, color, dim, k }: { e: RawEnt; tag: string; color: string; dim: boolean; k: number }) {
  const [ax, ay] = anchor(e);
  const [dx, dy] = e.tag;
  const s = Math.min(1, Math.max(0.45, k));
  const [tx, ty] = [sx(ax + dx * s), sy(ay + dy * s)];
  const w = (tag.length * 2.75 + 3.4) * s;
  const h = 6 * s;
  const right = dx >= 0;
  const bx = right ? tx : tx - w;
  return (
    <g className={styles.tag} data-dim={dim} style={{ "--c": color } as React.CSSProperties}>
      {(dx !== 0 || dy !== 0) && <polyline points={`${sx(ax)},${sy(ay)} ${tx},${ty}`} className={styles.leader} />}
      <circle cx={sx(ax)} cy={sy(ay)} r={0.8 * s} className={styles.leaderDot} />
      <rect x={bx} y={ty - h / 2} width={w} height={h} rx={0.8 * s} className={styles.tagBox} />
      <text x={bx + w / 2} y={ty + 1.55 * s} textAnchor="middle" className={styles.tagText} style={{ fontSize: `${4.2 * s}px` }}>
        {tag}
      </text>
    </g>
  );
}

/** CAD-style selection: the object dashed in the accent, and its grips */
function Selection({ e, k }: { e: RawEnt; k: number }) {
  const g = 2.2 * Math.min(1, Math.max(0.45, k));
  const grip = (p: Pt, i: number) => <rect key={i} x={sx(p[0]) - g / 2} y={sy(p[1]) - g / 2} width={g} height={g} className={styles.grip} />;
  if (e.shape === "line")
    return (
      <g aria-hidden="true">
        <polyline points={pts(e.pts)} className={styles.selLine} />
        {e.pts.map(grip)}
      </g>
    );
  if (e.shape === "dot")
    return (
      <g aria-hidden="true">
        <circle cx={sx(e.pts[0][0])} cy={sy(e.pts[0][1])} r={4.2} className={styles.selLine} />
        {grip(e.pts[0], 0)}
      </g>
    );
  const xs = e.pts.map((p) => p[0]);
  const ys = e.pts.map((p) => p[1]);
  const box: Pt[] = [
    [Math.min(...xs) - 2, Math.min(...ys) - 2],
    [Math.max(...xs) + 2, Math.min(...ys) - 2],
    [Math.max(...xs) + 2, Math.max(...ys) + 2],
    [Math.min(...xs) - 2, Math.max(...ys) + 2],
  ];
  return (
    <g aria-hidden="true">
      <polygon points={pts(box)} className={styles.selLine} />
      {box.map(grip)}
    </g>
  );
}

function Ring({ at, k }: { at: Pt; k: number }) {
  return <circle cx={sx(at[0])} cy={sy(at[1])} r={10 * Math.min(1, Math.max(0.45, k))} className={styles.ring} aria-hidden="true" />;
}
