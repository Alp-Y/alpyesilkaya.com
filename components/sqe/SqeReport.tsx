"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/lib/workspace/store";
import { hoverEntity, selectEntity } from "@/lib/workspace/actions";
import { num } from "@/lib/format";
import { areaLabel, type Analysis } from "@/lib/sqe/engine";
import { highlightFor } from "@/lib/sqe/selection";
import { setFilter, useSqe } from "@/lib/sqe/store";
import type { Project } from "@/lib/sqe/types";
import { WORK_TYPES, WORK_TYPE_ORDER, type WorkTypeId } from "@/lib/sqe/workTypes";
import styles from "./sqe.module.css";

/** Full quantity report (secondary: opened from "Full quantity report"). */
export default function SqeReport({ project, analysis }: { project: Project; analysis: Analysis }) {
  const selection = useWorkspace((s) => s.selection);
  const hover = useWorkspace((s) => s.hover);
  const filterArea = useSqe((s) => s.filterArea);
  const filterType = useSqe((s) => s.filterType);
  const hl = useMemo(() => highlightFor(selection, analysis), [selection, analysis]);
  const hoverHl = useMemo(() => highlightFor(hover, analysis), [hover, analysis]);
  const byKey = useMemo(() => new Map(project.boundaries.map((b) => [b.key, b])), [project]);

  const rows = analysis.rows.filter(
    (r) => (filterArea === "all" || r.boundaryKey === filterArea) && (filterType === "all" || r.type === filterType),
  );
  const typesInUse = WORK_TYPE_ORDER.filter((t) => analysis.rows.some((r) => r.type === t));
  const total = filterType !== "all" ? rows.reduce((s, r) => s + r.quantity, 0) : null;

  return (
    <div className={styles.report}>
      <div className={styles.filters}>
        <label>
          <span>Area</span>
          <select id="sqe-filter-area" value={filterArea} onChange={(e) => setFilter({ area: e.target.value })}>
            <option value="all">All areas</option>
            {project.boundaries.map((b) => (
              <option key={b.key} value={b.key}>
                {areaLabel(b)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Work type</span>
          <select id="sqe-filter-type" value={filterType} onChange={(e) => setFilter({ type: e.target.value as WorkTypeId | "all" })}>
            <option value="all">All work types</option>
            {typesInUse.map((t) => (
              <option key={t} value={t}>
                {WORK_TYPES[t].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Area</th>
              <th scope="col">Work type</th>
              <th scope="col" className={styles.right}>
                Quantity
              </th>
              <th scope="col">Unit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = WORK_TYPES[r.type];
              const active = selection === r.id;
              return (
                <tr
                  key={r.id}
                  tabIndex={0}
                  aria-current={active ? "true" : undefined}
                  data-related={hl.rows.has(r.id) && !active}
                  data-hover={hoverHl.rows.has(r.id) || hover === r.id}
                  onClick={() => selectEntity(active ? null : r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectEntity(active ? null : r.id);
                    }
                  }}
                  onPointerEnter={() => hoverEntity(r.id)}
                  onPointerLeave={() => hoverEntity(null)}
                >
                  <td>{areaLabel(byKey.get(r.boundaryKey))}</td>
                  <td>
                    <span className={styles.swatch} style={{ "--c": t.color } as React.CSSProperties} aria-hidden="true" />
                    {t.label}
                  </td>
                  <td className={`${styles.right} num`}>{num(r.quantity)}</td>
                  <td>{t.unit}</td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={4} className={styles.muted}>
                  No quantities for this filter.
                </td>
              </tr>
            )}
          </tbody>
          {total !== null && rows.length > 1 && (
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td className={`${styles.right} num`}>{num(total)}</td>
                <td>{WORK_TYPES[filterType as WorkTypeId].unit}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
