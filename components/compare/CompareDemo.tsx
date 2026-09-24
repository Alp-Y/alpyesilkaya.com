"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getUpdates, ITEMS, KINDS, type Kind } from "@/lib/compare/model";
import { fmt, signed } from "@/lib/compare/format";
import { compare, type Diffed, type Status } from "@/lib/compare/diff";
import CompareDrawing from "./CompareDrawing";
import styles from "./compare.module.css";

/**
 * DRAWING COMPARISON — interactive demonstration.
 *   01 Drawings        which two progress updates to compare
 *   02 Overlay         the two sheets, merged on top of each other and swept:
 *                      removed (red), added (green), unchanged (grey)
 *   03 Net quantities  per item: previous, current, added, removed, net
 *   04 Progress ledger every period, net by item, adding up to the total
 * Everything runs in the browser on synthetic example drawings (lib/compare).
 */

const MERGE_MS = 1100;
const SCAN_MS = 1600;

export default function CompareDemo() {
  const updates = getUpdates();
  const pairs = useMemo(() => updates.slice(1).map((b, i) => compare(updates[i], b)), [updates]);
  const [pairIndex, setPairIndex] = useState(pairs.length - 1);
  const cmp = pairs[pairIndex];

  const [merge, setMerge] = useState(0);
  const [scan, setScan] = useState(0);
  const [focus, setFocus] = useState<Kind | null>(null);
  const [hidden, setHidden] = useState<Partial<Record<Status, boolean>>>({});
  const [tip, setTip] = useState<{ e: Diffed; x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const anim = useRef(0);
  const mergeRef = useRef(0);
  const setM = useCallback((v: number) => {
    mergeRef.current = v;
    setMerge(v);
  }, []);

  /* ---------- animation: resolves false when a newer animation took over ---------- */
  const tween = useCallback((ms: number, step: (t: number) => void) => {
    return new Promise<boolean>((resolve) => {
      const token = ++anim.current;
      if (ms <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        step(1);
        resolve(true);
        return;
      }
      const t0 = performance.now();
      const frame = (now: number) => {
        if (token !== anim.current) return resolve(false);
        const t = Math.min(1, (now - t0) / ms);
        step(t);
        if (t < 1) requestAnimationFrame(frame);
        else resolve(true);
      };
      requestAnimationFrame(frame);
    });
  }, []);

  const overlay = useCallback(async () => {
    setScan(0);
    setTip(null);
    const from = mergeRef.current;
    if (from < 1 && !(await tween(MERGE_MS * (1 - from), (t) => setM(from + (1 - from) * t)))) return;
    await tween(SCAN_MS, (t) => setScan(t));
  }, [tween, setM]);

  const separate = useCallback(() => {
    setScan(0);
    setTip(null);
    const from = mergeRef.current;
    void tween(MERGE_MS * 0.8 * from, (t) => setM(from * (1 - t)));
  }, [tween, setM]);

  // play once when the tool first comes into view
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let timer = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          io.disconnect();
          timer = window.setTimeout(() => void overlay(), 900);
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
      anim.current++;
    };
  }, [overlay]);

  const choosePeriod = (i: number) => {
    if (i === pairIndex) return;
    setPairIndex(i);
    setTip(null);
    if (mergeRef.current > 0) {
      setScan(0);
      void tween(SCAN_MS, (t) => setScan(t));
    }
  };

  const onHover = useCallback((e: Diffed | null, ev?: React.PointerEvent) => {
    const stage = stageRef.current;
    if (!e || !ev || !stage) return setTip(null);
    const r = stage.getBoundingClientRect();
    const x = Math.min(ev.clientX - r.left + 14, r.width - 200);
    const y = ev.clientY - r.top + 14;
    setTip({ e, x: Math.max(4, x), y: y > r.height - 90 ? y - 110 : y });
  }, []);

  const done = merge >= 1 && scan >= 1;
  const isOverlay = merge > 0.5;
  const toggle = (s: Status) => setHidden((h) => ({ ...h, [s]: !h[s] }));

  return (
    <div className={styles.app} ref={rootRef} id="cmp-demo">
      <div className={styles.grid}>
        {/* 01 ------------------------------------------------------------ */}
        <section className={styles.cellInput} aria-labelledby="cmp-h-input">
          <StepHead n="01" id="cmp-h-input" title="Progress drawings" />
          <div className={styles.input}>
            <div>
              <p className={styles.mono} style={{ margin: "0 0 4px" }}>
                Reporting period
              </p>
              <div className={styles.periods}>
                {pairs.map((p, i) => (
                  <button key={p.b.id} type="button" className={styles.period} aria-pressed={i === pairIndex} onClick={() => choosePeriod(i)}>
                    <span className={styles.radio} aria-hidden="true" />
                    <span>
                      {p.a.id} → {p.b.id}
                      <small>
                        {p.a.date.slice(0, 6)} → {p.b.date}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.files}>
              <FileCard tone="a" role="Previous update" file={cmp.a.file} meta={`${cmp.a.date} · ${cmp.a.entities.length} objects`} />
              <FileCard tone="b" role="Current update" file={cmp.b.file} meta={`${cmp.b.date} · ${cmp.b.entities.length} objects`} />
            </div>

            <button type="button" className={styles.primary} onClick={() => void overlay()}>
              {done ? "Compare again" : "Overlay and compare"} <span className="arrow" aria-hidden="true">→</span>
            </button>
            <p className={styles.small}>Example drawings of a simplified road scheme, four progress updates two weeks apart. Synthetic data.</p>
          </div>
        </section>

        {/* 02 ------------------------------------------------------------ */}
        <section className={styles.cellView} aria-labelledby="cmp-h-view">
          <StepHead n="02" id="cmp-h-view" title={isOverlay ? "Overlay" : "Two drawings"} />
          <div className={styles.viewBar}>
            <div className={styles.segmented} role="group" aria-label="View">
              <button type="button" aria-pressed={!isOverlay} onClick={separate}>
                Side by side
              </button>
              <button type="button" aria-pressed={isOverlay} onClick={() => void overlay()}>
                Overlay
              </button>
            </div>
            <div className={styles.legend} role="group" aria-label="Show">
              {(["added", "removed", "unchanged"] as Status[]).map((s) => (
                <button key={s} type="button" aria-pressed={!hidden[s]} disabled={!done} onClick={() => toggle(s)}>
                  <span className={styles.key} data-s={s} aria-hidden="true" />
                  {s} <b className="num">{cmp.counts[s]}</b>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.stage} ref={stageRef}>
            <CompareDrawing cmp={cmp} merge={merge} scan={scan} focus={focus} hidden={hidden} onHover={done ? onHover : undefined} />
            {done && (
              <p className={styles.explain} aria-hidden="true">
                <span>
                  <i className={styles.key} data-s="removed" /> Only in {cmp.a.id}: taken out
                </span>
                <span>
                  <i className={styles.key} data-s="added" /> Only in {cmp.b.id}: added
                </span>
                <span>
                  <i className={styles.key} data-s="unchanged" /> In both: unchanged
                </span>
              </p>
            )}
            {tip && (
              <div className={styles.tip} style={{ left: tip.x, top: tip.y }} role="status">
                <span className={styles.tipStatus} data-s={tip.e.status}>
                  {tip.e.status === "added" ? `Added in ${cmp.b.id}` : tip.e.status === "removed" ? `Taken out since ${cmp.a.id}` : "Unchanged"}
                </span>
                <b>{ITEMS[tip.e.kind].label}</b>
                {tip.e.where}
                <div className={styles.tipQty}>
                  {tip.e.status === "removed" ? "−" : tip.e.status === "added" ? "+" : ""}
                  {fmt(tip.e.qty, ITEMS[tip.e.kind].unit)} <span className={styles.mono}>{ITEMS[tip.e.kind].layer}</span>
                </div>
              </div>
            )}
          </div>

          <div className={styles.caption} aria-live="polite">
            {!isOverlay ? (
              <span>
                <b>{cmp.a.entities.length}</b> objects in {cmp.a.id}, <b>{cmp.b.entities.length}</b> in {cmp.b.id}. Which quantities are new, and did anything disappear?
              </span>
            ) : done ? (
              <span>
                <b className={styles.added}>{cmp.counts.added} added</b>, <b className={styles.removed}>{cmp.counts.removed} taken out</b>, {cmp.counts.unchanged} unchanged. Hover an object for its
                quantity.
              </span>
            ) : (
              <span>Comparing every object in both drawings…</span>
            )}
            {done && (
              <button type="button" className={styles.replay} onClick={() => void overlay()}>
                ↻ Replay
              </button>
            )}
          </div>
        </section>

        {/* 03 ------------------------------------------------------------ */}
        <section className={styles.cellResult} aria-labelledby="cmp-h-result">
          <StepHead n="03" id="cmp-h-result" title="Net quantities" note={`${cmp.a.id} → ${cmp.b.id}`} />
          <div className={`${styles.tableWrap} ${done ? styles.ready : styles.pending}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">{cmp.a.id}</th>
                  <th scope="col">{cmp.b.id}</th>
                  <th scope="col">Added</th>
                  <th scope="col">Removed</th>
                  <th scope="col" className={styles.colNet}>
                    Net this period
                  </th>
                </tr>
              </thead>
              <tbody>
                {cmp.rows.map((r) => {
                  const unit = ITEMS[r.kind].unit;
                  return (
                    <tr
                      key={r.kind}
                      tabIndex={0}
                      aria-selected={focus === r.kind}
                      onClick={() => setFocus((f) => (f === r.kind ? null : r.kind))}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setFocus((f) => (f === r.kind ? null : r.kind)))}
                    >
                      <td>
                        {ITEMS[r.kind].label}
                        <small>{ITEMS[r.kind].layer}</small>
                      </td>
                      <td>{fmt(r.prev, unit)}</td>
                      <td>{fmt(r.curr, unit)}</td>
                      <td className={r.added ? styles.pos : styles.zero}>{r.added ? `+${fmt(r.added, unit)}` : "0"}</td>
                      <td className={r.removed ? styles.neg : styles.zero}>{r.removed ? `−${fmt(r.removed, unit)}` : "0"}</td>
                      <td className={`${styles.colNet} ${styles.netCell}`}>{signed(r.net, unit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={styles.check}>
            <span>
              <span className={styles.tick}>✓</span> Every item reconciles: <code>{cmp.a.id} + added − removed = {cmp.b.id}</code>
            </span>
            <span className={styles.small}>{focus ? "Click the row again to show every item." : "Click a row to find that item in the drawing."}</span>
          </p>
        </section>

        {/* 04 ------------------------------------------------------------ */}
        <section className={styles.cellLedger} aria-labelledby="cmp-h-ledger">
          <StepHead n="04" id="cmp-h-ledger" title="Progress ledger" note="Every update, one line" />
          <Ledger pairs={pairs} active={pairIndex} onPick={choosePeriod} />
        </section>
      </div>

      <p className={styles.fine}>
        Objects are matched by layer and geometry: only in the previous drawing means taken out, only in the current drawing means added. Example drawings are synthetic; everything is
        calculated in your browser.
      </p>
    </div>
  );
}

/* ---------- pieces ---------- */

function Ledger({ pairs, active, onPick }: { pairs: ReturnType<typeof compare>[]; active: number; onPick: (i: number) => void }) {
  const base = pairs[0];
  const last = pairs[pairs.length - 1];
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.ledger}`}>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {KINDS.map((k) => (
              <th key={k} scope="col">
                {ITEMS[k].short} ({ITEMS[k].unit})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr data-kind="base">
            <td>{base.a.id} (recorded)</td>
            {base.rows.map((r) => (
              <td key={r.kind}>{fmt(r.prev, ITEMS[r.kind].unit, false)}</td>
            ))}
          </tr>
          {pairs.map((p, i) => (
            <tr
              key={p.b.id}
              tabIndex={0}
              aria-selected={i === active}
              onClick={() => onPick(i)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(i))}
            >
              <td>
                {p.a.id} → {p.b.id}
              </td>
              {p.rows.map((r) => (
                <td key={r.kind} className={r.net > 0 ? styles.pos : r.net < 0 ? styles.neg : styles.zero}>
                  {signed(r.net, ITEMS[r.kind].unit, false)}
                  {r.removed > 0 && <small className={styles.neg} style={{ display: "block", fontSize: 10, opacity: 0.8 }}>incl. −{fmt(r.removed, ITEMS[r.kind].unit, false)} out</small>}
                </td>
              ))}
            </tr>
          ))}
          <tr data-kind="total">
            <td>{last.b.id} (to date)</td>
            {last.rows.map((r) => (
              <td key={r.kind}>{fmt(r.curr, ITEMS[r.kind].unit, false)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function FileCard({ tone, role, file, meta }: { tone: "a" | "b"; role: string; file: string; meta: string }) {
  return (
    <div className={styles.file}>
      <span className={styles.swatch} data-tone={tone} aria-hidden="true" />
      <span className={styles.fileRole}>{role}</span>
      <b>{file}</b>
      <span>{meta}</span>
    </div>
  );
}

function StepHead({ n, id, title, note }: { n: string; id: string; title: string; note?: string }) {
  return (
    <h3 className={styles.step} id={id}>
      <span className="num accent">{n}</span>
      <span className={styles.stepTitle}>{title}</span>
      {note && <span className={styles.stepNote}>{note}</span>}
    </h3>
  );
}
