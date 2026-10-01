"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { DOCS, ITEMS, addDays, check, fmtDate, initialState, type Doc, type Issue } from "@/lib/claims/model";
import { PreviewBar } from "./SqePreview";
import { usePreviewLoop } from "./usePreviewLoop";
import { useHold } from "./useHold";
import styles from "./preview.module.css";
import c from "./clm.module.css";

/** the package → one date edited → every document updated → checked → result, on repeat */
const PHASES = [
  { label: "Claim package", ms: 1500 },
  { label: "Edit once", ms: 1700 },
  { label: "Update all", ms: 2000 },
  { label: "Check", ms: 2000 },
  { label: "Result", ms: 4600 },
];

type Frame = { show: number; edit: number; sweep: number; scan: number; res: number; fade: number };
const FINAL: Frame = { show: 1, edit: 1, sweep: 1, scan: 1, res: 1, fade: 1 };
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * CLAIM MANAGEMENT — homepage preview. The claim package lays out as
 * documents in three formats; the submission date is changed once and the
 * change sweeps through every document that carries it; then the check runs
 * down the package and flags the figures that disagree. Point at a document
 * to see what it carries (and, after the check, what is wrong with it);
 * press and hold to pause.
 */
export default function ClmPreview({ title }: { title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const { held, heldRef } = useHold(area, "press");
  const [f, setF] = useState<Frame>(FINAL);
  const [tip, setTip] = useState<{ d: Doc; x: number; y: number } | null>(null);

  const start = useMemo(() => initialState(), []);
  const issues = useMemo(() => check(start), [start]);
  const before = start.values.submitted;
  const after = addDays(before, 7);
  const withDate = DOCS.filter((d) => d.fields.includes("submitted"));
  const issuesOf = (id: string) => issues.filter((i) => i.doc === id);

  const { phase, seek } = usePreviewLoop(
    ref,
    PHASES.map((p) => p.ms),
    (p, t, _dt, wrapped) => {
      if (wrapped) setTip(null);
      if (p === 0) setF({ show: t, edit: 0, sweep: 0, scan: 0, res: 0, fade: Math.min(1, t * 5) });
      else if (p === 1) setF({ show: 1, edit: t, sweep: 0, scan: 0, res: 0, fade: 1 });
      else if (p === 2) setF({ show: 1, edit: 1, sweep: t, scan: 0, res: 0, fade: 1 });
      else if (p === 3) setF({ show: 1, edit: 1, sweep: 1, scan: t, res: 0, fade: 1 });
      else setF({ show: 1, edit: 1, sweep: 1, scan: 1, res: Math.min(1, t * 2.5), fade: t > 0.93 ? 1 - (t - 0.93) / 0.07 : 1 });
    },
    heldRef,
  );

  const onHover = useCallback((d: Doc | null, ev?: React.PointerEvent) => {
    const box = area.current?.getBoundingClientRect();
    if (!d || !ev || !box) return setTip(null);
    setTip({ d, x: Math.max(8, Math.min(ev.clientX - box.left + 12, box.width - 220)), y: Math.max(8, Math.min(ev.clientY - box.top + 14, box.height - 120)) });
  }, []);

  // where the sweep and the scan have reached, document by document (0 → 1 down the package)
  const at = (i: number) => (i + 0.5) / DOCS.length;
  const typed = Math.round(ease(f.edit) * fmtDate(after).length);
  const updated = withDate.filter((d) => f.sweep >= at(DOCS.indexOf(d))).length;
  const found = issues.filter((is) => f.scan >= at(DOCS.findIndex((d) => d.id === is.doc))).length;
  const res = held && f.scan >= 1 ? 1 : ease(f.res);

  return (
    <div ref={ref} className={styles.card} data-held={held}>
      <div ref={area} className={`${styles.stage} ${c.stage} ${styles.pointable}`} onPointerLeave={() => setTip(null)}>
        <div className={c.inner} style={{ opacity: f.fade }}>
          {/* the one edit */}
          <div className={c.top}>
            <span className={c.field} data-on={f.edit > 0}>
              <span className={c.fieldLabel}>Submission date</span>
              <span className={c.old} data-struck={f.edit > 0.15}>
                {fmtDate(before)}
              </span>
              {f.edit > 0 && (
                <span className={c.new}>
                  {fmtDate(after).slice(0, typed)}
                  {f.edit < 1 && <i className={c.caret} aria-hidden="true" />}
                </span>
              )}
            </span>
            <span className={c.counts}>
              <span data-show={f.sweep > 0}>
                <b className={c.ok}>
                  {updated}/{withDate.length}
                </b>{" "}
                updated
              </span>
              <span data-show={f.scan > 0}>
                <b className={c.bad}>{found}</b> {found === 1 ? "issue" : "issues"}
              </span>
            </span>
          </div>

          {/* the package */}
          <div className={c.docs}>
            {DOCS.map((d, i) => {
              const hasDate = d.fields.includes("submitted");
              const flagged = f.scan >= at(i) && issuesOf(d.id).length > 0;
              const done = hasDate && f.sweep >= at(i);
              return (
                <div
                  key={d.id}
                  className={c.tile}
                  data-fmt={d.format}
                  data-show={f.show >= i / DOCS.length}
                  data-updated={done}
                  data-flag={flagged}
                  data-dim={f.sweep > 0 && f.scan === 0 && !hasDate}
                  onPointerMove={(e) => onHover(d, e)}
                  onPointerLeave={() => onHover(null)}
                >
                  <span className={c.tileHead}>
                    <span className={c.badge}>{d.format}</span>
                    <span className={c.id}>{d.id}</span>
                  </span>
                  <b className={c.name}>{d.name}</b>
                  <span className={c.lines} aria-hidden="true" data-table={d.format === "XLSX"}>
                    <i />
                    <i />
                    <i />
                  </span>
                  {hasDate && <span className={c.date}>{fmtDate(done ? after : before).slice(0, 6)}</span>}
                  {flagged && (
                    <span className={c.flag} aria-label={`${issuesOf(d.id).length} issues`}>
                      !
                    </span>
                  )}
                </div>
              );
            })}
            {/* the check, running down the package */}
            {f.scan > 0 && f.scan < 1 && <span className={c.scan} style={{ "--scan": f.scan } as React.CSSProperties} aria-hidden="true" />}
          </div>

          {/* before the result: what the package is made of */}
          <p className={c.legend} style={{ opacity: 1 - res }} aria-hidden={res > 0.5}>
            <span>{DOCS.length} documents</span>
            {(["DOCX", "XLSX", "PDF"] as const).map((fm) => (
              <span key={fm} data-fmt={fm}>
                <i />
                {fm} <b className="num">{DOCS.filter((d) => d.format === fm).length}</b>
              </span>
            ))}
          </p>

          {/* the result */}
          <dl className={c.result} style={{ opacity: res, transform: `translate3d(0, ${(1 - res) * 8}px, 0)` }}>
            <div>
              <dt>Documents</dt>
              <dd className="num">{DOCS.length}</dd>
            </div>
            <div>
              <dt>Date updated in</dt>
              <dd className="num">
                {withDate.length}
                <em>docs</em>
              </dd>
            </div>
            <div>
              <dt>Inconsistencies</dt>
              <dd className={`num ${c.bad}`}>{issues.length}</dd>
              <dd className={c.sub}>unit price · amount · total</dd>
            </div>
          </dl>
        </div>

        {tip && (
          <div className={c.tip} style={{ left: tip.x, top: tip.y }} role="status">
            <span className={c.tipHead}>
              <span className={c.badge} data-fmt={tip.d.format}>
                {tip.d.format}
              </span>
              {tip.d.file}
            </span>
            <b>{tip.d.name}</b>
            {tip.d.fields.includes("submitted") && (
              <span className={c.tipLine}>
                Submission date <em className={f.sweep >= at(DOCS.indexOf(tip.d)) ? c.ok : undefined}>{fmtDate(f.sweep >= at(DOCS.indexOf(tip.d)) ? after : before)}</em>
              </span>
            )}
            {f.scan >= at(DOCS.indexOf(tip.d)) && issuesOf(tip.d.id).map((is) => <IssueLine key={is.id} is={is} />)}
            {f.scan >= at(DOCS.indexOf(tip.d)) && issuesOf(tip.d.id).length === 0 && f.scan > 0 && <span className={`${c.tipLine} ${c.ok}`}>✓ Figures agree</span>}
          </div>
        )}
      </div>
      <PreviewBar
        labels={PHASES.map((p) => p.label)}
        durations={PHASES.map((p) => p.ms)}
        phase={phase}
        held={held}
        hint={f.show >= 1 ? "Point at a document" : undefined}
        onSeek={(i) => {
          setTip(null);
          seek(i);
        }}
        name={title}
      />
    </div>
  );
}

function IssueLine({ is }: { is: Issue }) {
  const item = is.item !== undefined ? ITEMS[is.item].label : "";
  const what = is.kind === "rate" ? `Unit price differs from the BOQ${item ? `: ${item}` : ""}` : is.kind === "amount" ? `Amount ≠ qty × rate${item ? `: ${item}` : ""}` : "Total differs from the summary";
  return <span className={`${c.tipLine} ${c.bad}`}>! {what}</span>;
}
