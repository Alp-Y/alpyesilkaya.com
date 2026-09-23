"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/lib/workspace/store";
import { hoverEntity, selectEntity } from "@/lib/workspace/actions";
import { coord, num, quantity } from "@/lib/format";
import { areaLabel, type Analysis } from "@/lib/sqe/engine";
import {
  autoNameAreas,
  backToExample,
  setEditNames,
  setMulti,
  setWorkType,
  updateAreaMeta,
  useSqe,
  workTypesIn,
} from "@/lib/sqe/store";
import { ids, parseId, type Project } from "@/lib/sqe/types";
import { WORK_TYPES } from "@/lib/sqe/workTypes";
import styles from "./sqe.module.css";

const CAPTIONS: Record<number, { title: string; text: string }> = {
  1: { title: "The site", text: "A motorway under construction: the main line, an interchange and a local road diversion." },
  2: { title: "Survey", text: "Area corners are measured on site with GNSS and a total station. Every point gets real coordinates." },
  3: { title: "Project areas", text: "The coordinates become closed CAD polylines carrying area metadata — so CAD software knows each area." },
  4: { title: "Quantities by area", text: "Work geometry × project area = the quantity in each area. Hover or click an area." },
};

/**
 * The side panel — short, one idea at a time (progressive disclosure):
 * the step's caption, then only what that step needs.
 */
export default function SqePanel({ project, analysis }: { project: Project; analysis: Analysis }) {
  const step = useSqe((s) => s.step);
  const workType = useSqe((s) => s.workType);
  const editNames = useSqe((s) => s.editNames);
  const summary = useSqe((s) => s.summary);
  const multi = useSqe((s) => s.multi);
  const selection = useWorkspace((s) => s.selection);
  const hover = useWorkspace((s) => s.hover);
  const types = useMemo(() => workTypesIn(analysis), [analysis]);
  const imported = project.source === "dxf";
  const unnamed = project.boundaries.filter((b) => !b.meta).length;

  const sel = parseId(selection);
  const selKey = sel && sel.kind !== "work" ? sel.key : null;
  const hov = parseId(hover);
  const hoverKey = hov && hov.kind !== "work" ? hov.key : null;
  const hoverWork = hov && hov.kind === "work" ? hov.code : null;
  const selected = selKey ? project.boundaries.find((b) => b.key === selKey) : null;

  const t = workType ? WORK_TYPES[workType] : null;
  const perArea = project.boundaries.map((b) => ({
    b,
    q: analysis.rows.find((r) => r.boundaryKey === b.key && r.type === workType)?.quantity ?? 0,
  }));
  const total = perArea.reduce((s, x) => s + x.q, 0);

  const caption = imported
    ? {
        title: "Your drawing",
        text: `${project.boundaries.length} closed ${project.boundaries.length === 1 ? "area" : "areas"} detected${summary ? ` · ${summary.work} work ${summary.work === 1 ? "item" : "items"}` : ""}. Processed in your browser — nothing was uploaded.`,
      }
    : CAPTIONS[step];

  return (
    <aside className={styles.panel} aria-label="Quantity by Area Calculator" aria-live="polite">
      <div className={styles.caption} key={imported ? "dxf" : step}>
        <p className={styles.captionKicker}>{imported ? "DXF" : `0${step}`}</p>
        <p className={styles.captionTitle}>{caption.title}</p>
        <p className={styles.captionText}>{caption.text}</p>
      </div>

      {/* 02 — a few of the measured points */}
      {!imported && step === 2 && project.site && (
        <dl className={styles.facts}>
          <div>
            <dt>Points surveyed</dt>
            <dd className="num">{project.site.survey.length}</dd>
          </div>
          {project.site.survey.slice(0, 3).map((p) => (
            <div key={p.id}>
              <dt>{p.id}</dt>
              <dd className="num">
                E {coord(p.x + project.site!.origin[0])}
                <br />N {coord(p.y + project.site!.origin[1])}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* Imported drawing: name the areas first */}
      {imported && unnamed > 0 && (
        <button type="button" className={styles.primary} onClick={autoNameAreas}>
          Auto-name {unnamed} {unnamed === 1 ? "area" : "areas"}
        </button>
      )}

      {/* 03 — the areas and their metadata */}
      {(step === 3 || (imported && unnamed === 0 && editNames)) && (
        <ul className={styles.areaList}>
          {project.boundaries.map((b) => (
            <li key={b.key}>
              <button
                type="button"
                className={styles.areaRow}
                data-active={selKey === b.key}
                data-hover={hoverKey === b.key}
                onPointerEnter={() => hoverEntity(ids.boundary(b.key))}
                onPointerLeave={() => hoverEntity(null)}
                onClick={() => selectEntity(selKey === b.key ? null : ids.boundary(b.key))}
              >
                <span className={styles.areaId}>{areaLabel(b)}</span>
                {editNames && b.meta ? (
                  <input
                    className={styles.nameInput}
                    value={b.meta.name}
                    aria-label={`Name of ${areaLabel(b)}`}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateAreaMeta(b.key, { name: e.target.value })}
                  />
                ) : (
                  <span className={styles.areaName}>{b.meta?.name ?? "Unnamed"}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!imported && step === 3 && <p className={styles.note}>Stored as closed polylines with area ID, name and section.</p>}

      {/* 04 — quantities */}
      {step === 4 && t && (imported ? unnamed === 0 : true) && !editNames && (
        <>
          <div className={styles.types} role="radiogroup" aria-label="Work type">
            {types.slice(0, imported ? types.length : 3).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={workType === id}
                onClick={() => setWorkType(id)}
                style={{ "--c": WORK_TYPES[id].color } as React.CSSProperties}
              >
                <span className={styles.swatch} aria-hidden="true" />
                {WORK_TYPES[id].label}
              </button>
            ))}
          </div>

          {multi ? (
            <div className={styles.breakdown}>
              <p className={styles.breakdownHead}>
                <span>
                  {multi.keys.length} {multi.keys.length === 1 ? "area" : "areas"} · {multi.mode}
                </span>
                <button type="button" className={styles.link} onClick={() => setMulti(null)}>
                  Clear
                </button>
              </p>
              <p className={styles.multiIds}>{multi.keys.map((k) => areaLabel(project.boundaries.find((b) => b.key === k))).join(" · ")}</p>
              <dl>
                {types.map((id) => {
                  const q = analysis.rows.filter((r) => r.type === id && multi.keys.includes(r.boundaryKey)).reduce((sum, r) => sum + r.quantity, 0);
                  return (
                    <div key={id} data-current={id === workType}>
                      <dt>{WORK_TYPES[id].label}</dt>
                      <dd className="num">{q ? quantity(q, WORK_TYPES[id].unit) : "—"}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ) : selected ? (
            <div className={styles.breakdown}>
              <p className={styles.breakdownHead}>
                <span>{areaLabel(selected)}</span>
                <button type="button" className={styles.link} onClick={() => selectEntity(null)}>
                  Clear
                </button>
              </p>
              <dl>
                {types.map((id) => {
                  const q = analysis.rows.find((r) => r.boundaryKey === selected.key && r.type === id)?.quantity;
                  return (
                    <div key={id} data-current={id === workType}>
                      <dt>{WORK_TYPES[id].label}</dt>
                      <dd className="num">{q ? quantity(q, WORK_TYPES[id].unit) : "—"}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ) : (
            <>
              <div className={styles.total}>
                <span>Total {t.label.toLowerCase()}</span>
                <strong className="num">
                  {num(total)} <em>{t.unit}</em>
                </strong>
              </div>
              <ul className={styles.qtyList}>
                {perArea.map(({ b, q }) => (
                  <li key={b.key}>
                    <button
                      type="button"
                      className={styles.qtyRow}
                      data-hover={hoverKey === b.key}
                      data-empty={!q}
                      onPointerEnter={() => hoverEntity(ids.boundary(b.key))}
                      onPointerLeave={() => hoverEntity(null)}
                      onClick={() => selectEntity(ids.boundary(b.key))}
                    >
                      <span>{areaLabel(b)}</span>
                      <span className={styles.bar} aria-hidden="true">
                        <i style={{ width: `${total ? (q / total) * 100 : 0}%` }} />
                      </span>
                      <span className="num">{q ? num(q) : "—"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* One piece of work, many areas: how each item is split */}
          <div className={styles.splitList}>
            <p className={styles.splitTitle}>Split by area</p>
            {project.work
              .filter((w) => w.type === workType)
              .map((w) => {
                const parts = analysis.intersections.filter((i) => i.workCode === w.code);
                const sum = parts.reduce((acc, i) => acc + i.quantity, 0);
                return (
                  <button
                    key={w.code}
                    type="button"
                    className={styles.splitRow}
                    data-hover={hoverWork === w.code}
                    onPointerEnter={() => hoverEntity(ids.work(w.code))}
                    onPointerLeave={() => hoverEntity(null)}
                    onFocus={() => hoverEntity(ids.work(w.code))}
                    onBlur={() => hoverEntity(null)}
                  >
                    <span className={styles.splitCode}>
                      {w.code}
                      <em>{parts.length} {parts.length === 1 ? "area" : "areas"}</em>
                    </span>
                    <span className={styles.splitBar} aria-hidden="true">
                      {parts.map((i) => (
                        <i key={i.id} style={{ flexGrow: i.quantity }} title={areaLabel(project.boundaries.find((b) => b.key === i.boundaryKey))}>
                          {areaLabel(project.boundaries.find((b) => b.key === i.boundaryKey))}
                        </i>
                      ))}
                    </span>
                    <span className="num">{num(sum)}</span>
                  </button>
                );
              })}
          </div>
          {t.measure === "volume" && <p className={styles.note}>Volume = area × {num(t.depth ?? 0)} m representative depth (demonstration).</p>}
        </>
      )}

      {imported && (
        <div className={styles.panelActions}>
          {unnamed === 0 && (
            <button type="button" className={styles.link} onClick={() => setEditNames(!editNames)}>
              {editNames ? "Done" : "Edit area names"}
            </button>
          )}
          <button type="button" className={styles.link} onClick={backToExample}>
            ← Back to the example
          </button>
        </div>
      )}
    </aside>
  );
}
