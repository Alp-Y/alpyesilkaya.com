"use client";

import { useEffect, useMemo, useRef } from "react";
import { useWorkspace } from "@/lib/workspace/store";
import { hoverEntity, selectEntity, setDisplayMode } from "@/lib/workspace/actions";
import { num, quantity } from "@/lib/format";
import { areaLabel, type Analysis } from "@/lib/sqe/engine";
import { highlightFor } from "@/lib/sqe/selection";
import { ids, parseId, type Project } from "@/lib/sqe/types";
import { WORK_TYPES, WORK_TYPE_ORDER, type WorkTypeId } from "@/lib/sqe/workTypes";
import { autoAssignAreas, setAssignMode, setFilter, updateAreaMeta, useSqe } from "@/lib/sqe/store";
import styles from "./sqe.module.css";

/* ================================================================== */
/*  PROJECT TREE                                                       */
/* ================================================================== */

export function ProjectTree({ project, analysis }: { project: Project; analysis: Analysis }) {
  const selection = useWorkspace((s) => s.selection);
  const hl = useMemo(() => highlightFor(selection, analysis), [selection, analysis]);

  // Group areas by section (from metadata); unassigned areas sit together
  const groups = useMemo(() => {
    const map = new Map<string, typeof project.boundaries>();
    for (const b of project.boundaries) {
      const section = b.meta?.section && b.meta.section !== "—" ? b.meta.section : b.meta ? "Areas" : "Unassigned boundaries";
      map.set(section, [...(map.get(section) ?? []), b]);
    }
    return [...map.entries()];
  }, [project]);

  return (
    <nav className={styles.tree} aria-label="Project tree" data-scroll>
      <p className={styles.panelTitle}>Project</p>
      <p className={styles.treeRoot}>{project.name}</p>
      <ul>
        {groups.map(([section, items]) => (
          <li key={section}>
            <span className={styles.treeGroup}>{section}</span>
            <ul>
              {items.map((b) => {
                const id = ids.boundary(b.key);
                return (
                  <li key={b.key}>
                    <TreeItem id={id} active={selection === id} related={hl.boundaries.has(b.key)} assigned={!!b.meta}>
                      {areaLabel(b)}
                    </TreeItem>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
        <li>
          <span className={styles.treeGroup}>Work geometry</span>
          <ul>
            {project.work.map((w) => {
              const id = ids.work(w.code);
              return (
                <li key={w.code}>
                  <TreeItem id={id} active={selection === id} related={hl.work.has(w.code)} swatch={WORK_TYPES[w.type].color}>
                    {w.code}
                    <span className={styles.treeMeta}>{WORK_TYPES[w.type].label}</span>
                  </TreeItem>
                </li>
              );
            })}
          </ul>
        </li>
      </ul>
    </nav>
  );
}

function TreeItem({
  id,
  active,
  related,
  assigned = true,
  swatch,
  children,
}: {
  id: string;
  active: boolean;
  related: boolean;
  assigned?: boolean;
  swatch?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Selected from the drawing or the report → bring it into view inside the tree only
    // (never scroll the page itself)
    const el = ref.current;
    const box = el?.closest<HTMLElement>("[data-scroll]");
    if (!active || !el || !box) return;
    const top = el.offsetTop; // the tree is the offsetParent (position: relative)
    if (top < box.scrollTop) box.scrollTop = top - 8;
    else if (top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + el.offsetHeight - box.clientHeight + 8;
  }, [active]);
  return (
    <button
      ref={ref}
      type="button"
      className={styles.treeItem}
      aria-current={active ? "true" : undefined}
      data-related={related && !active}
      data-assigned={assigned}
      onClick={() => selectEntity(active ? null : id)}
      onPointerEnter={() => hoverEntity(id)}
      onPointerLeave={() => hoverEntity(null)}
      onFocus={() => hoverEntity(id)}
      onBlur={() => hoverEntity(null)}
    >
      <span className={styles.treeMark} style={swatch ? ({ "--c": swatch } as React.CSSProperties) : undefined} aria-hidden="true" />
      {children}
    </button>
  );
}

/* ================================================================== */
/*  PROPERTIES                                                         */
/* ================================================================== */

export function Properties({ project, analysis }: { project: Project; analysis: Analysis }) {
  const selection = useWorkspace((s) => s.selection);
  const assignMode = useSqe((s) => s.assignMode);
  const sel = parseId(selection);
  const unassigned = project.boundaries.filter((b) => !b.meta).length;

  return (
    <aside className={styles.props} aria-label="Properties">
      {/* STEP 02 — ASSIGN AREAS */}
      <div className={styles.assign}>
        <p className={styles.panelTitle}>
          <span className={styles.step}>02</span> Assign areas
        </p>
        <div className={styles.segmented} role="radiogroup" aria-label="Assignment mode">
          {(["auto", "manual"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={assignMode === m} onClick={() => setAssignMode(m)}>
              {m === "auto" ? "Auto" : "Manual"}
            </button>
          ))}
        </div>
        {assignMode === "auto" ? (
          unassigned === 0 ? (
            <p className={styles.hint}>
              <span className="accent">✓</span> All <span className="num">{project.boundaries.length}</span> areas assigned
            </p>
          ) : (
            <button type="button" className={styles.primaryButton} onClick={autoAssignAreas}>
              Auto-assign {unassigned} area{unassigned === 1 ? "" : "s"}
            </button>
          )
        ) : (
          <p className={styles.hint}>Select an area in the drawing or the tree, then edit its metadata below.</p>
        )}
      </div>

      <p className={styles.panelTitle}>Properties</p>
      {!sel && <ProjectSummary project={project} analysis={analysis} />}
      {sel?.kind === "boundary" && <AreaProps project={project} analysis={analysis} boundaryKey={sel.key} editable={assignMode === "manual"} />}
      {sel?.kind === "work" && <WorkProps project={project} analysis={analysis} code={sel.code} />}
      {(sel?.kind === "intersection" || sel?.kind === "row") && <IntersectionProps project={project} analysis={analysis} id={selection!} />}
    </aside>
  );
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className={styles.propRows}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd className="num">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProjectSummary({ project, analysis }: { project: Project; analysis: Analysis }) {
  const assigned = project.boundaries.filter((b) => b.meta).length;
  return (
    <>
      <Rows
        rows={[
          ["Source", project.source === "example" ? "Example project" : "Imported DXF"],
          ["Project areas", `${project.boundaries.length} (${assigned} assigned)`],
          ["Work items", String(project.work.length)],
          ["Intersections", String(analysis.intersections.length)],
        ]}
      />
      <p className={styles.hint}>Select anything in the drawing, the tree or the report — the others follow.</p>
    </>
  );
}

function AreaProps({ project, analysis, boundaryKey, editable }: { project: Project; analysis: Analysis; boundaryKey: string; editable: boolean }) {
  const b = project.boundaries.find((x) => x.key === boundaryKey);
  if (!b) return null;
  const meta = b.meta ?? { areaId: "", name: "", section: "", side: "" };
  const rows = analysis.rows.filter((r) => r.boundaryKey === b.key);
  const fields: [keyof typeof meta, string][] = [
    ["areaId", "Area ID"],
    ["name", "Area name"],
    ["section", "Section"],
    ["side", "Side"],
  ];
  return (
    <>
      {editable ? (
        <div className={styles.form}>
          {fields.map(([key, label]) => (
            <label key={key} className={styles.field}>
              <span>{label}</span>
              <input
                id={`sqe-${b.key}-${key}`}
                value={meta[key]}
                placeholder={b.suggested?.[key] ?? ""}
                onChange={(e) => updateAreaMeta(b.key, { [key]: e.target.value })}
                spellCheck={false}
              />
            </label>
          ))}
        </div>
      ) : (
        <Rows
          rows={[
            ["Area ID", b.meta ? b.meta.areaId : <span className={styles.muted}>Unassigned</span>],
            ["Area name", meta.name || "—"],
            ["Section", meta.section || "—"],
            ["Side", meta.side || "—"],
          ]}
        />
      )}
      <Rows rows={[["Plan area", quantity(analysis.boundaryArea[b.key] ?? 0, "m²")]]} />
      {rows.length > 0 && (
        <>
          <p className={styles.subTitle}>Quantities in this area</p>
          <ul className={styles.linkList}>
            {rows.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => selectEntity(r.id)}>
                  <span>{WORK_TYPES[r.type].label}</span>
                  <span className="num">{quantity(r.quantity, WORK_TYPES[r.type].unit)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function WorkProps({ project, analysis, code }: { project: Project; analysis: Analysis; code: string }) {
  const w = project.work.find((x) => x.code === code);
  if (!w) return null;
  const t = WORK_TYPES[w.type];
  const totals = analysis.totals[w.code];
  const unit = t.measure === "length" ? "lm" : "m²";
  const parts = analysis.intersections.filter((i) => i.workCode === w.code);
  return (
    <>
      <Rows
        rows={[
          ["Work type", t.label],
          ["Code", [w.code, w.spec].filter(Boolean).join(" · ")],
          [t.measure === "length" ? "Total length" : "Total area", quantity(totals?.measure ?? 0, unit)],
          ...(t.depth ? ([["Depth (demo)", quantity(t.depth, "m")]] as [string, string][]) : []),
          ...(totals && totals.outside > 0.01
            ? ([["Outside areas", <span key="o" className={styles.warn}>{quantity(totals.outside, unit)}</span>]] as [string, React.ReactNode][])
            : []),
        ]}
      />
      <p className={styles.subTitle}>Attributed to {parts.length} area{parts.length === 1 ? "" : "s"}</p>
      <ul className={styles.linkList}>
        {parts.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => selectEntity(i.id)}>
              <span>{areaLabel(project.boundaries.find((b) => b.key === i.boundaryKey))}</span>
              <span className="num">{quantity(i.quantity, t.unit)}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function IntersectionProps({ project, analysis, id }: { project: Project; analysis: Analysis; id: string }) {
  const p = parseId(id);
  if (!p || (p.kind !== "intersection" && p.kind !== "row")) return null;
  const list = p.kind === "row" ? (analysis.rows.find((r) => r.id === id)?.intersectionIds ?? []) : [id];
  const parts = analysis.intersections.filter((i) => list.includes(i.id));
  if (!parts.length) return null;
  const t = WORK_TYPES[parts[0].type];
  const measure = parts.reduce((s, i) => s + i.measure, 0);
  const total = parts.reduce((s, i) => s + i.quantity, 0);
  const area = areaLabel(project.boundaries.find((b) => b.key === p.key));
  return (
    <>
      <Rows
        rows={[
          ["Area", area],
          ["Work", `${t.label}${parts.length === 1 ? ` · ${parts[0].workCode}` : ` · ${parts.length} items`}`],
          [t.measure === "length" ? "Length inside" : "Area inside", quantity(measure, t.measure === "length" ? "lm" : "m²")],
        ]}
      />
      {t.measure === "volume" ? (
        <div className={styles.formula}>
          <span className="num">{quantity(measure, "m²")}</span>
          <span>× {quantity(t.depth ?? 0, "m")} depth</span>
          <span className={`num ${styles.result}`}>= {quantity(total, "m³")}</span>
          <p className={styles.hint}>
            Simplified demonstration: area × a representative depth. A real volume would come from design and existing
            surfaces.
          </p>
        </div>
      ) : (
        <Rows rows={[["Quantity", quantity(total, t.unit)]]} />
      )}
    </>
  );
}

/* ================================================================== */
/*  QUANTITY REPORT                                                    */
/* ================================================================== */

export function QuantityReport({ project, analysis }: { project: Project; analysis: Analysis }) {
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
    <section className={styles.report} aria-labelledby="sqe-report-title">
      <div className={styles.reportHead}>
        <p id="sqe-report-title" className={styles.panelTitle}>
          <span className={styles.step}>03</span> Quantity report
        </p>
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
          <button type="button" className={styles.textButton} onClick={() => setDisplayMode("analysis")}>
            Show intersections
          </button>
        </div>
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
              const b = byKey.get(r.boundaryKey);
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
                  <td data-assigned={!!b?.meta}>{areaLabel(b)}</td>
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
      <p className={styles.footnote}>
        Excavation and fill volumes are demonstration values: intersection area × a representative depth (
        {Object.values(WORK_TYPES)
          .filter((t) => t.depth)
          .map((t) => `${t.label.toLowerCase()} ${num(t.depth!)} m`)
          .join(", ")}
        ), not surface-to-surface volumes.
      </p>
    </section>
  );
}
