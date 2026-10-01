"use client";

import { useMemo, useRef, useState } from "react";
import TerminalDrawing, { FULL } from "@/components/terminal/TerminalDrawing";
import { CLASS_IDS, CLASSES, fmtQty, getDrawing, identify, identifyOrder, quantity, type Idents } from "@/lib/terminal/model";
import { PreviewBar } from "./SqePreview";
import { usePreviewLoop } from "./usePreviewLoop";
import { useHold } from "./useHold";
import styles from "./preview.module.css";

/** a plain drawing → its objects identified one by one → every structure counted, on repeat */
const PHASES = [
  { label: "Plain drawing", ms: 1700 },
  { label: "Identify", ms: 5200 },
  { label: "Structures", ms: 4600 },
];
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type Frame = { reveal: number; n: number; res: number; fade: number };
const FINAL: Frame = { reveal: 1, n: 999, res: 1, fade: 1 };

/**
 * CAD TERMINAL — homepage preview, kept simple. A plain drawing plots in
 * (everything grey: just lines, dots and surfaces), then each object is
 * identified and takes its structure's colour, and the count of each type
 * comes up underneath. Point at a structure to see what it is; press and
 * hold to pause.
 */
export default function CtmPreview({ title }: { title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const { held, heldRef } = useHold(area, "press");
  const ents = getDrawing();
  const order = useMemo(() => identifyOrder(), []);
  // the identifications, one state per step, so every frame is a lookup
  const states = useMemo(() => order.reduce<Idents[]>((acc, e) => [...acc, identify(acc[acc.length - 1], e, e.truth)], [{}]), [order]);
  const [f, setF] = useState<Frame>(FINAL);
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);

  const { phase, seek } = usePreviewLoop(
    ref,
    PHASES.map((p) => p.ms),
    (p, t, _dt, wrapped) => {
      if (wrapped) setTip(null);
      if (p === 0) setF({ reveal: ease(t), n: 0, res: 0, fade: Math.min(1, t * 4) });
      else if (p === 1) setF({ reveal: 1, n: Math.floor(Math.min(order.length, t * (order.length + 1))), res: 0, fade: 1 });
      else setF({ reveal: 1, n: order.length, res: Math.min(1, t * 3), fade: t > 0.93 ? 1 - (t - 0.93) / 0.07 : 1 });
    },
    heldRef,
  );

  const ids = states[Math.min(f.n, states.length - 1)];
  const count = Object.keys(ids).length;
  const last = count ? order[count - 1] : null;
  const done = count === order.length;
  const res = held && done ? 1 : f.res;

  const onHover = (id: string | null, ev?: React.PointerEvent) => {
    const box = area.current?.getBoundingClientRect();
    if (!id || !ev || !box) return setTip(null);
    setTip({ id, x: Math.min(ev.clientX - box.left + 12, box.width - 180), y: Math.max(8, ev.clientY - box.top - 72) });
  };
  const tipEnt = tip && ids[tip.id] ? ents.find((e) => e.id === tip.id) : null;
  const tipId = tip ? ids[tip.id] : null;

  return (
    <div ref={ref} className={styles.card} data-held={held}>
      <div ref={area} className={`${styles.stage} ${styles.ctm} ${styles.pointable}`} onPointerLeave={() => setTip(null)}>
        <div className={styles.cmpInner} style={{ opacity: f.fade }}>
          <TerminalDrawing
            ents={ents}
            ids={ids}
            reveal={f.reveal}
            view={FULL}
            selected={null}
            focus={null}
            fresh={last && phase === 1 ? { id: last.id, n: count } : null}
            className={styles.ctmSvg}
            onHover={done ? onHover : undefined}
          />

          <div className={styles.cmpTop} data-show={f.reveal >= 1}>
            <span className={styles.site}>example-road.dwg</span>
            <span>
              <b className={styles.ctmOk}>
                {count} of {ents.length}
              </b>{" "}
              identified
            </span>
          </div>

          {/* how many of each, once everything is identified */}
          <dl className={styles.cmpStrip} style={{ opacity: res, transform: `translate3d(0, ${(1 - res) * 8}px, 0)`, gridTemplateColumns: `repeat(${CLASS_IDS.length}, minmax(0, 1fr))` }}>
            {CLASS_IDS.map((c) => (
              <div key={c}>
                <dt style={{ color: CLASSES[c].color }}>{CLASSES[c].plural}</dt>
                <dd className="num">{Object.values(states[states.length - 1]).filter((v) => v.cls === c).length}</dd>
              </div>
            ))}
          </dl>
        </div>
        {tip && tipEnt && tipId && (
          <div className={styles.cmpTip} style={{ left: tip.x, top: tip.y }} role="status">
            <span style={{ color: CLASSES[tipId.cls].color }}>{CLASSES[tipId.cls].label}</span>
            <b>{tipId.tag}</b>
            <em className="num">{fmtQty(quantity(tipEnt, tipId.cls), CLASSES[tipId.cls].unit)}</em>
          </div>
        )}
      </div>
      <PreviewBar
        labels={PHASES.map((p) => p.label)}
        durations={PHASES.map((p) => p.ms)}
        phase={phase}
        held={held}
        hint={done ? "Point at a structure" : undefined}
        onSeek={(i) => {
          setTip(null);
          seek(i);
        }}
        name={title}
      />
    </div>
  );
}
