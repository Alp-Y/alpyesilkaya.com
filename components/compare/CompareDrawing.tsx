"use client";

import { memo, useId } from "react";
import { EXTENT, REFERENCE, type Entity, type Kind, type Update } from "@/lib/compare/model";
import type { Comparison, Diffed, Status } from "@/lib/compare/diff";
import styles from "./compare.module.css";

/**
 * THE DRAWING — two progress drawings, in drawing units (metres).
 *
 *   merge 0   the two sheets one above the other (previous on top)
 *   merge 1   the sheets on top of each other, in the same coordinates
 *   scan      0 → 1: the comparison sweeps across the overlay; behind the
 *             sweep every object is coloured by what happened to it:
 *             green added, red removed, grey unchanged
 *   reveal    [previous, current] 0 → 1: each sheet plots in from the left
 *
 * The drawing has no state of its own: the homepage preview and the tool
 * page both drive it through these numbers.
 */

export const VIEW_W = 460;
const SHEET_W = 440;
const SHEET_H = EXTENT.maxY - EXTENT.minY;
const LEFT = 10;
const GAP = 24;
const TOP_A = 12;
const TOP_B = TOP_A + SHEET_H + GAP;
export const VIEW_H = TOP_B + SHEET_H + 6;
const TOP_M = (VIEW_H - SHEET_H) / 2;
const Y = (y: number) => EXTENT.maxY - y; // drawing y → sheet y (0 at the top)

const HATCH: Record<string, string> = {
  a: "#7aa8e6",
  b: "#d5dce3",
  added: "#3ee08f",
  removed: "#ff5a5f",
  unchanged: "#5b6672",
};

type Props = {
  cmp: Comparison;
  merge: number;
  scan: number;
  reveal?: [number, number];
  focus?: Kind | null;
  hidden?: Partial<Record<Status, boolean>>;
  onHover?: (e: Diffed | null, ev?: React.PointerEvent) => void;
  labels?: boolean;
  className?: string;
};

export default function CompareDrawing({ cmp, merge, scan, reveal = [1, 1], focus = null, hidden = NONE, onHover, labels = true, className = "" }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (n: string) => `${n}-${uid}`;
  const m = ease(merge);
  const topA = TOP_A + (TOP_M - TOP_A) * m;
  const topB = TOP_B + (TOP_M - TOP_B) * m;
  const scanX = LEFT + SHEET_W * scan;
  const scanning = scan > 0 && scan < 1;

  return (
    <svg className={`${styles.drawing} ${className}`} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={`${cmp.a.id} and ${cmp.b.id} progress drawings${scan >= 1 ? `, overlaid: ${cmp.counts.added} objects added, ${cmp.counts.removed} removed` : ""}`}>
      <defs>
        {Object.entries(HATCH).map(([tone, color]) => (
          <pattern key={tone} id={id(`h-${tone}`)} width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="2.6" stroke={color} strokeWidth="0.45" />
          </pattern>
        ))}
        <clipPath id={id("ra")}>
          <rect x="0" y="0" width={VIEW_W * reveal[0]} height={VIEW_H} />
        </clipPath>
        <clipPath id={id("rb")}>
          <rect x="0" y="0" width={VIEW_W * reveal[1]} height={VIEW_H} />
        </clipPath>
        <clipPath id={id("todo")}>
          <rect x={scan > 0 ? scanX : 0} y="0" width={VIEW_W} height={VIEW_H} />
        </clipPath>
        <clipPath id={id("done")}>
          <rect x="0" y="0" width={scanX} height={VIEW_H} />
        </clipPath>
        <linearGradient id={id("band")} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#3ee08f" stopOpacity="0" />
          <stop offset="1" stopColor="#3ee08f" stopOpacity="0.16" />
        </linearGradient>
      </defs>

      {/* the two drawings as they are — hidden behind the sweep once it passes */}
      <g clipPath={`url(#${id("todo")})`}>
        <g clipPath={`url(#${id("ra")})`}>
          <g transform={`translate(${LEFT} ${topA})`} data-tone="a" className={styles.tone}>
            <Header u={cmp.a} role="Previous" opacity={1 - m} labels={labels} />
            <SheetBody u={cmp.a} hatch={id("h-a")} labels={labels} />
          </g>
        </g>
        <g clipPath={`url(#${id("rb")})`}>
          <g transform={`translate(${LEFT} ${topB})`} data-tone="b" className={styles.tone} style={{ opacity: m > 0 ? 0.92 : 1 }}>
            <Header u={cmp.b} role="Current" opacity={1 - m} labels={labels} />
            <SheetBody u={cmp.b} hatch={id("h-b")} labels={labels} />
          </g>
        </g>
      </g>

      {/* behind the sweep: every object coloured by what happened to it */}
      {scan > 0 && (
        <g clipPath={`url(#${id("done")})`}>
          <g transform={`translate(${LEFT} ${TOP_M})`}>
            <Frame />
            {labels && <Reference />}
            <Classified items={cmp.items} uid={uid} focus={focus} hidden={hidden} onHover={onHover} />
          </g>
        </g>
      )}

      {scanning && (
        <g className={styles.scan} aria-hidden="true">
          <rect x={scanX - 28} y={TOP_M - 4} width="28" height={SHEET_H + 8} fill={`url(#${id("band")})`} />
          <line x1={scanX} x2={scanX} y1={TOP_M - 6} y2={TOP_M + SHEET_H + 6} />
        </g>
      )}

      {/* the overlay's own heading */}
      {labels && (
        <g className={styles.merged} style={{ opacity: m }} aria-hidden="true">
          <text x={LEFT} y={TOP_M - 5} className={styles.t}>
            <tspan className={styles.tA}>{cmp.a.id}</tspan>
            <tspan> + </tspan>
            <tspan className={styles.tB}>{cmp.b.id}</tspan>
            <tspan> · overlaid in the same coordinates</tspan>
          </text>
        </g>
      )}
    </svg>
  );
}

const NONE: Partial<Record<Status, boolean>> = {};
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ---------- pieces ---------- */

function Frame() {
  return (
    <g className={styles.frame}>
      <rect x="0" y="0" width={SHEET_W} height={SHEET_H} />
      <path d={`M0 6V0H6M${SHEET_W - 6} 0H${SHEET_W}V6M${SHEET_W} ${SHEET_H - 6}V${SHEET_H}H${SHEET_W - 6}M6 ${SHEET_H}H0V${SHEET_H - 6}`} className={styles.corner} />
    </g>
  );
}

function Header({ u, role, opacity, labels }: { u: Update; role: string; opacity: number; labels: boolean }) {
  if (!labels || opacity <= 0.01) return null;
  return (
    <g style={{ opacity }} aria-hidden="true">
      <text x="0" y="-5" className={styles.t}>
        <tspan className={styles.tHead}>{u.id}</tspan>
        <tspan> · {role} · {u.date}</tspan>
      </text>
      <text x={SHEET_W} y="-5" className={styles.t} textAnchor="end">
        {u.file} · {u.entities.length} objects
      </text>
    </g>
  );
}

function Reference() {
  const [a, b] = REFERENCE.centreline;
  const [c, d] = REFERENCE.sideCentreline;
  return (
    <g className={styles.ref} aria-hidden="true">
      <line x1={a[0]} y1={Y(a[1])} x2={b[0]} y2={Y(b[1])} />
      <line x1={c[0]} y1={Y(c[1])} x2={d[0]} y2={Y(d[1])} />
      {REFERENCE.chainages.map((k) => (
        <g key={k.x}>
          <line x1={k.x} x2={k.x} y1={Y(REFERENCE.chainageY + 1.4)} y2={Y(REFERENCE.chainageY - 1.4)} className={styles.tick} />
          <text x={k.x} y={Y(REFERENCE.labelY)} textAnchor="middle" className={`${styles.t} ${styles.ch}`}>
            {k.label}
          </text>
        </g>
      ))}
    </g>
  );
}

/** one drawing, in its own overlay colour */
const SheetBody = memo(function SheetBody({ u, hatch, labels }: { u: Update; hatch: string; labels: boolean }) {
  return (
    <>
      <Frame />
      {labels && <Reference />}
      {u.entities.map((e) => (
        <Shape key={e.key} e={e} hatch={hatch} />
      ))}
    </>
  );
});

/** the comparison: added, removed, unchanged */
const Classified = memo(function Classified({
  items,
  uid,
  focus,
  hidden,
  onHover,
}: {
  items: Diffed[];
  uid: string;
  focus: Kind | null;
  hidden: Partial<Record<Status, boolean>>;
  onHover?: Props["onHover"];
}) {
  // unchanged underneath, then removed, then added on top
  const order: Status[] = ["unchanged", "removed", "added"];
  return (
    <g onPointerLeave={onHover ? () => onHover(null) : undefined}>
      {order.map((s) =>
        hidden[s] ? null : (
          <g key={s} data-tone={s} className={styles.tone}>
            {items
              .filter((e) => e.status === s)
              .map((e) => (
                <g
                  key={e.key}
                  className={styles.ent}
                  data-dim={focus !== null && e.kind !== focus}
                  onPointerEnter={onHover ? (ev) => onHover(e, ev) : undefined}
                  onPointerMove={onHover ? (ev) => onHover(e, ev) : undefined}
                >
                  <Shape e={e} hatch={`h-${s}-${uid}`} hit={!!onHover} />
                </g>
              ))}
          </g>
        ),
      )}
    </g>
  );
});

function Shape({ e, hatch, hit = false }: { e: Entity; hatch: string; hit?: boolean }) {
  const g = e.geom;
  if (g.t === "poly") {
    const pts = g.pts.map(([x, y]) => `${x},${Y(y)}`).join(" ");
    if (e.kind === "asphalt")
      return (
        <polygon points={pts} fill={`url(#${hatch})`} className={styles.area} />
      );
    return (
      <>
        {hit && <polyline points={pts} className={styles.hit} />}
        <polyline points={pts} className={e.kind === "pipe" ? styles.pipe : styles.kerb} />
      </>
    );
  }
  const [x, y0] = g.at;
  const y = Y(y0);
  if (e.kind === "manhole")
    return (
      <>
        {hit && <circle cx={x} cy={y} r="5" className={styles.hitArea} />}
        <circle cx={x} cy={y} r="2.5" className={styles.sym} />
        <path d={`M${x - 1.7} ${y - 1.7}L${x + 1.7} ${y + 1.7}M${x - 1.7} ${y + 1.7}L${x + 1.7} ${y - 1.7}`} className={styles.symLine} />
      </>
    );
  // street light: column, arm over the carriageway, lantern
  return (
    <>
      {hit && <circle cx={x} cy={y + 2.5} r="5" className={styles.hitArea} />}
      <circle cx={x} cy={y} r="1.5" className={styles.sym} />
      <path d={`M${x} ${y + 1.5}V${y + 3.8}`} className={styles.symLine} />
      <circle cx={x} cy={y + 4.5} r="0.75" className={styles.dot} />
    </>
  );
}
