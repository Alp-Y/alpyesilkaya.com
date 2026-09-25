"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import CompareDrawing from "@/components/compare/CompareDrawing";
import { fmt, signed } from "@/lib/compare/format";
import { getUpdates, ITEMS } from "@/lib/compare/model";
import { compare, type Diffed } from "@/lib/compare/diff";
import { PreviewBar } from "./SqePreview";
import { usePreviewLoop } from "./usePreviewLoop";
import { useHold } from "./useHold";
import styles from "./preview.module.css";

/** previous drawing → current drawing → overlay → compare → net quantities, on repeat */
const PHASES = [
  { label: "Previous", ms: 1500 },
  { label: "Current", ms: 1500 },
  { label: "Overlay", ms: 1400 },
  { label: "Compare", ms: 2300 },
  { label: "Net quantity", ms: 4600 },
];
/** the richest period first, then the others in order */
const ORDER = [2, 0, 1];

type Frame = { a: number; b: number; merge: number; scan: number; res: number; fade: number };
const FINAL: Frame = { a: 1, b: 1, merge: 1, scan: 1, res: 1, fade: 1 };
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * DRAWING COMPARISON — homepage preview. Two progress drawings plot in,
 * slide onto each other, the comparison sweeps across, and the net
 * quantities come out; each loop moves to another reporting period.
 * The steps underneath are buttons (jump to one and the story carries on
 * from there). Once the comparison has run, point at a coloured object to
 * see what it is and how much it adds or takes away; pointing at the
 * drawing never stops it; pressing and holding on it does. The tool itself opens from the button
 * beside it.
 */
export default function CmpPreview({ title }: { title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const { held, heldRef } = useHold(area, "press");
  const [tip, setTip] = useState<{ e: Diffed; x: number; y: number } | null>(null);
  const onHover = useCallback((e: Diffed | null, ev?: React.PointerEvent) => {
    const box = area.current?.getBoundingClientRect();
    if (!e || !ev || !box) return setTip(null);
    setTip({ e, x: Math.min(ev.clientX - box.left + 12, box.width - 190), y: Math.max(8, ev.clientY - box.top - 70) });
  }, []);
  const pairs = useMemo(() => {
    const u = getUpdates();
    return u.slice(1).map((b, i) => compare(u[i], b));
  }, []);
  const [cycle, setCycle] = useState(0);
  const [f, setF] = useState<Frame>(FINAL);

  const { phase, seek } = usePreviewLoop(
    ref,
    PHASES.map((p) => p.ms),
    (p, t, _dt, wrapped) => {
      if (wrapped) {
        setCycle((c) => c + 1);
        setTip(null);
      }
      if (p === 0) setF({ a: ease(t), b: 0, merge: 0, scan: 0, res: 0, fade: Math.min(1, t * 4) });
      else if (p === 1) setF({ a: 1, b: ease(t), merge: 0, scan: 0, res: 0, fade: 1 });
      else if (p === 2) setF({ a: 1, b: 1, merge: t, scan: 0, res: 0, fade: 1 });
      else if (p === 3) setF({ a: 1, b: 1, merge: 1, scan: t, res: 0, fade: 1 });
      else setF({ a: 1, b: 1, merge: 1, scan: 1, res: Math.min(1, t * 2.5), fade: t > 0.93 ? 1 - (t - 0.93) / 0.07 : 1 });
    },
    heldRef,
  );

  const cmp = pairs[ORDER[cycle % ORDER.length]];
  // while the drawing is held the net quantities show in full, never frozen half-counted
  const res = held && f.scan >= 1 ? 1 : ease(f.res);

  return (
    <div ref={ref} className={styles.card} data-held={held}>
      <div ref={area} className={`${styles.stage} ${styles.cmp} ${styles.pointable}`} onPointerLeave={() => setTip(null)}>
        <div className={styles.cmpInner} style={{ opacity: f.fade }}>
          <CompareDrawing cmp={cmp} merge={f.merge} scan={f.scan} reveal={[f.a, f.b]} className={styles.cmpSvg} onHover={f.scan >= 1 ? onHover : undefined} />

          <div className={styles.cmpTop} data-show={f.merge >= 1}>
            <span className={styles.site}>
              {cmp.a.id} → {cmp.b.id}
            </span>
            <span data-show={f.scan >= 1} className={styles.cmpCounts}>
              <b className={styles.cmpAdd}>{cmp.counts.added} added</b> · <b className={styles.cmpRem}>{cmp.counts.removed} taken out</b>
            </span>
          </div>

          <dl className={styles.cmpStrip} style={{ opacity: res, transform: `translate3d(0, ${(1 - res) * 8}px, 0)` }}>
            {cmp.rows.map((r) => {
              const unit = ITEMS[r.kind].unit;
              return (
                <div key={r.kind}>
                  <dt>{ITEMS[r.kind].short}</dt>
                  <dd className="num" data-sign={r.net > 0 ? "pos" : r.net < 0 ? "neg" : "zero"}>
                    {signed(r.net * res, unit, false)}
                    <em>{unit}</em>
                  </dd>
                  {r.removed > 0 && <dd className={styles.cmpOut}>incl. −{unit === "nr" ? r.removed : r.removed.toFixed(0)} out</dd>}
                </div>
              );
            })}
          </dl>
        </div>
        {tip && f.scan >= 1 && (
          <div className={styles.cmpTip} style={{ left: tip.x, top: tip.y }} role="status">
            <span data-s={tip.e.status}>{tip.e.status === "added" ? `Added in ${cmp.b.id}` : tip.e.status === "removed" ? `Taken out since ${cmp.a.id}` : "Unchanged"}</span>
            <b>{ITEMS[tip.e.kind].label}</b>
            <em className="num">
              {tip.e.status === "added" ? "+" : tip.e.status === "removed" ? "−" : ""}
              {fmt(tip.e.qty, ITEMS[tip.e.kind].unit)}
            </em>
          </div>
        )}
      </div>
      <PreviewBar
        labels={PHASES.map((p) => p.label)}
        durations={PHASES.map((p) => p.ms)}
        phase={phase}
        held={held}
        hint={f.scan >= 1 ? "Point at a change" : undefined}
        onSeek={(i) => {
          setTip(null);
          seek(i);
        }}
        name={title}
      />
    </div>
  );
}
