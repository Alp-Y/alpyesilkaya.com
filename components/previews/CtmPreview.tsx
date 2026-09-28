"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import TerminalDrawing, { FULL, sx, sy, type ViewBox } from "@/components/terminal/TerminalDrawing";
import { bbox, chainageRange, CLASS_IDS, CLASSES, fmtQty, getDrawing, identify, identifyOrder, quantity, rows as exportRows, type Idents } from "@/lib/terminal/model";
import { PreviewBar } from "./SqePreview";
import { usePreviewLoop } from "./usePreviewLoop";
import { useHold } from "./useHold";
import styles from "./preview.module.css";

/** raw drawing → lines and dots become structures → surfaces → browse → export, on repeat */
const PHASES = [
  { label: "Drawing", ms: 1700 },
  { label: "Identify", ms: 4200 },
  { label: "Surfaces", ms: 2600 },
  { label: "Browse", ms: 3800 },
  { label: "Export", ms: 4400 },
];
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: ViewBox, b: ViewBox, t: number): ViewBox => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });

type Frame = { reveal: number; n: number; picking: number; browse: number; zoom: number; card: number; exp: number; fade: number };
const FINAL: Frame = { reveal: 1, n: 99, picking: -1, browse: 0, zoom: 0, card: 0, exp: 1, fade: 1 };

/**
 * CAD TERMINAL — homepage preview. A plain drawing plots in; its lines and
 * dots are identified one by one as kerbs, pipes, manholes and lights, the
 * TIN surfaces and survey points as asphalt, demolition and excavation
 * surfaces; the browser finds a manhole; the export lists only the storm
 * drainage. Once identified, point at a structure to see what it is.
 * Pointing never stops it; pressing and holding on it does.
 */
export default function CtmPreview({ title }: { title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const { held, heldRef } = useHold(area, "press");
  const ents = getDrawing();
  const order = useMemo(() => identifyOrder(), []);
  const lineworkCount = order.filter((e) => e.shape === "line" || e.shape === "dot").length;
  // the identifications, one state per step, so every frame is a lookup
  const states = useMemo(() => order.reduce<Idents[]>((acc, e) => [...acc, identify(acc[acc.length - 1], e, e.truth)], [{}]), [order]);
  const all = states[states.length - 1];
  const target = useMemo(() => {
    const id = Object.entries(all).find(([, v]) => v.tag === "MH-02")![0];
    const e = ents.find((x) => x.id === id)!;
    const b = bbox(e);
    // framed right of centre, clear of the browser panel on the left
    const w = 230;
    const h = w / (FULL.w / FULL.h);
    return { id, e, view: { x: sx(b.x0) - w * 0.6, y: Math.min(FULL.y + FULL.h - h, Math.max(FULL.y, sy(b.y0) - h * 0.5)), w, h } as ViewBox };
  }, [all, ents]);
  const drainage = useMemo(() => exportRows(all).filter((r) => r.pkg === "Storm drainage"), [all]);
  const [f, setF] = useState<Frame>(FINAL);
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);

  const { phase, seek } = usePreviewLoop(
    ref,
    PHASES.map((p) => p.ms),
    (p, t, _dt, wrapped) => {
      if (wrapped) setTip(null);
      const surf = order.length - lineworkCount;
      if (p === 0) setF({ reveal: ease(t), n: 0, picking: -1, browse: 0, zoom: 0, card: 0, exp: 0, fade: Math.min(1, t * 4) });
      else if (p === 1) {
        const k = Math.min(lineworkCount, t * (lineworkCount + 1.2));
        setF({ reveal: 1, n: Math.floor(k), picking: k < lineworkCount ? Math.floor(k) : -1, browse: 0, zoom: 0, card: 0, exp: 0, fade: 1 });
      } else if (p === 2) {
        const k = Math.min(surf, t * (surf + 0.8));
        setF({ reveal: 1, n: lineworkCount + Math.floor(k), picking: k < surf ? lineworkCount + Math.floor(k) : -1, browse: 0, zoom: 0, card: 0, exp: 0, fade: 1 });
      } else if (p === 3)
        setF({
          reveal: 1,
          n: order.length,
          picking: -1,
          browse: Math.min(1, t * 5),
          zoom: ease(Math.min(1, Math.max(0, (t - 0.38) / 0.3))),
          card: Math.min(1, Math.max(0, (t - 0.62) * 5)),
          exp: 0,
          fade: 1,
        });
      else
        setF({
          reveal: 1,
          n: order.length,
          picking: -1,
          browse: Math.max(0, 1 - t * 6),
          zoom: 1 - ease(Math.min(1, t * 3.2)),
          card: Math.max(0, 1 - t * 6),
          exp: Math.min(1, Math.max(0, (t - 0.18) * 3)),
          fade: t > 0.94 ? 1 - (t - 0.94) / 0.06 : 1,
        });
    },
    heldRef,
  );

  const ids = states[Math.min(f.n, states.length - 1)];
  const count = Object.keys(ids).length;
  const picking = f.picking >= 0 ? order[f.picking] : null;
  const last = count ? order[count - 1] : null;
  const lastId = last ? ids[last.id] : null;
  const view = f.zoom > 0 ? lerp(FULL, target.view, f.zoom) : FULL;
  const focus = f.browse > 0.5 && phase === 3 ? new Set(Object.entries(ids).filter(([, v]) => v.cls === "manhole").map(([k]) => k)) : null;
  const done = count === order.length;
  const selected = picking?.id ?? (f.card > 0 ? target.id : null);

  const onHover = useCallback((id: string | null, ev?: React.PointerEvent) => {
    const box = area.current?.getBoundingClientRect();
    if (!id || !ev || !box) return setTip(null);
    setTip({ id, x: Math.min(ev.clientX - box.left + 12, box.width - 180), y: Math.max(8, ev.clientY - box.top - 72) });
  }, []);
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
            view={view}
            selected={selected}
            focus={focus}
            fresh={lastId && last && phase > 0 && phase < 3 ? { id: last.id, n: count } : null}
            className={styles.ctmSvg}
            onHover={done && phase >= 3 ? onHover : undefined}
          />

          <div className={styles.cmpTop} data-show={f.reveal >= 1}>
            <span className={styles.site}>example-road.dwg</span>
            <span>
              <b className={styles.ctmOk}>{count} {count === 1 ? "structure" : "structures"}</b> · {ents.length - count} to identify
            </span>
          </div>

          {/* the command line, while things are being identified */}
          <p className={styles.ctmCmd} data-show={phase > 0 && phase < 3}>
            <span className={styles.ctmPrompt}>Command:</span>{" "}
            {picking ? (
              <>
                IDENTIFY <span style={{ color: CLASSES[picking.truth].color }}>{CLASSES[picking.truth].label.toUpperCase()}</span>
                <i className={styles.ctmCaret} aria-hidden="true" />
              </>
            ) : lastId && last ? (
              <>
                <span style={{ color: CLASSES[lastId.cls].color }}>{lastId.tag}</span> {CLASSES[lastId.cls].label} · {lastId.zone} · {chainageRange(last)}
              </>
            ) : (
              <>
                OPEN example-road.dwg <i className={styles.ctmCaret} aria-hidden="true" />
              </>
            )}
          </p>

          {/* the browser: every structure by type */}
          <div className={styles.ctmBrowser} style={{ opacity: f.browse, transform: `translate3d(${(1 - f.browse) * -10}px, 0, 0)` }} aria-hidden={f.browse < 0.5}>
            <span className={styles.ctmHead}>Project browser</span>
            {CLASS_IDS.map((c) => {
              const n = Object.values(ids).filter((v) => v.cls === c).length;
              const on = c === "manhole" && f.zoom > 0.05;
              return (
                <div key={c} className={styles.ctmRow} data-on={on} style={{ "--c": CLASSES[c].color } as React.CSSProperties}>
                  <i />
                  {CLASSES[c].plural}
                  <b className="num">{n}</b>
                  {on && (
                    <span className={styles.ctmSub}>
                      {["MH-01", "MH-02", "MH-03"].map((t) => (
                        <em key={t} data-on={t === "MH-02"}>
                          {t}
                        </em>
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* what the tool knows about the structure it found */}
          <dl className={styles.ctmCard} style={{ opacity: f.card, transform: `translate3d(0, ${(1 - f.card) * 6}px, 0)`, "--c": CLASSES.manhole.color } as React.CSSProperties} aria-hidden={f.card < 0.5}>
            <dt>ID</dt>
            <dd>
              <b>MH-02</b>
            </dd>
            <dt>Structure</dt>
            <dd>Manhole</dd>
            <dt>Zone</dt>
            <dd>{all[target.id].zone}</dd>
            <dt>Chainage</dt>
            <dd className="num">{chainageRange(target.e)}</dd>
            <dt>Status</dt>
            <dd>{all[target.id].status}</dd>
          </dl>

          {/* the export: only what you asked for, with its project information */}
          <div className={styles.ctmExport} style={{ opacity: f.exp, transform: `translate3d(0, ${(1 - f.exp) * 8}px, 0)` }} aria-hidden={f.exp < 0.5}>
            <p>
              <span className={styles.site}>Export</span> <em>Package: Storm drainage</em> <em>All zones</em>
              <span className={styles.ctmCount}>{drainage.length} rows</span>
            </p>
            <table>
              <tbody>
                {drainage.slice(0, 4).map((r, i) => (
                  <tr key={r.id} style={{ opacity: Math.min(1, Math.max(0, f.exp * 5 - i * 0.8)), "--c": CLASSES[r.cls].color } as React.CSSProperties}>
                    <td>
                      <b>{r.tag}</b>
                    </td>
                    <td>{CLASSES[r.cls].label}</td>
                    <td>{r.zone}</td>
                    <td>{r.chainage}</td>
                    <td data-s={r.status}>{r.status}</td>
                    <td className="num">{fmtQty(r.qty, r.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {tip && tipEnt && tipId && (
          <div className={styles.cmpTip} style={{ left: tip.x, top: tip.y }} role="status">
            <span style={{ color: CLASSES[tipId.cls].color }}>{CLASSES[tipId.cls].label}</span>
            <b>
              {tipId.tag} · {tipId.zone}
            </b>
            <em className="num">{fmtQty(quantity(tipEnt, tipId.cls), CLASSES[tipId.cls].unit)}</em>
          </div>
        )}
      </div>
      <PreviewBar
        labels={PHASES.map((p) => p.label)}
        durations={PHASES.map((p) => p.ms)}
        phase={phase}
        held={held}
        hint={done && phase >= 3 ? "Point at a structure" : undefined}
        onSeek={(i) => {
          setTip(null);
          seek(i);
        }}
        name={title}
      />
    </div>
  );
}
