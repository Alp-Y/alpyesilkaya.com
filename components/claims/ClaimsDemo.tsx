"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DOCS,
  FIELDS,
  FIELD_ORDER,
  ITEMS,
  addDays,
  check,
  claimTotal,
  doc as getDoc,
  docsWith,
  fixIssue,
  initialState,
  money,
  num,
  setField,
  show,
  type Doc,
  type FieldId,
  type Format,
  type Issue,
  type State,
} from "@/lib/claims/model";
import styles from "./claims.module.css";

/**
 * CLAIM MANAGEMENT — interactive demonstration.
 *   01 Claim package    every document, filterable by format; pick one to open it
 *   02 Shared details   values every document shares: edit one, apply it, and it
 *                       updates in every document that carries it
 *   03 Document         the open document, with its shared details marked
 *   04 Check            unit prices, line amounts and totals across documents;
 *                       each finding shows where it is, and can be corrected
 * Everything runs in the browser on a synthetic example package (lib/claims).
 */

const STAGGER = 110;
type Change = { field: FieldId; from: string; to: string; docs: string[] };

export default function ClaimsDemo() {
  const [st, setSt] = useState<State>(() => initialState());
  const [sel, setSel] = useState("CL-10");
  const [fmt, setFmt] = useState<Format | "all">("all");
  const [focus, setFocus] = useState<FieldId | null>("submitted");
  const [drafts, setDrafts] = useState<Record<FieldId, string>>(() => initialState().values);
  const [swept, setSwept] = useState<string[]>([]);
  const [log, setLog] = useState<Change[]>([]);
  const [checked, setChecked] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [fixed, setFixed] = useState<string[]>([]);
  const [hot, setHot] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const viewRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const issues = useMemo(() => check(st), [st]);
  const shown = checked ? issues : [];
  const issuesOf = (id: string) => shown.filter((i) => i.doc === id);
  const list = DOCS.filter((d) => fmt === "all" || d.format === fmt);
  const current = getDoc(sel);

  /* ---------- 02: apply a shared detail everywhere ---------- */
  const apply = (f: FieldId) => {
    const to = drafts[f].trim();
    const from = st.values[f];
    if (!to || to === from) return;
    const docs = docsWith(f).map((d) => d.id);
    setSt((s) => setField(s, f, to));
    setFocus(f);
    setLog((l) => [{ field: f, from, to, docs }, ...l].slice(0, 4));
    // the change runs through the package, one document after another
    setSwept([]);
    if (reduce()) setSwept(docs);
    else docs.forEach((id, i) => later(() => setSwept((s) => [...s, id]), 120 + i * STAGGER));
    later(() => setSwept([]), 120 + docs.length * STAGGER + 2600);
  };
  const nudge = (f: FieldId, days: number) => setDrafts((d) => ({ ...d, [f]: addDays(d[f], days) }));

  /* ---------- 04: the check ---------- */
  const runCheck = () => {
    setFixed([]);
    if (reduce()) {
      setChecked(true);
      return;
    }
    setScanning(true);
    setChecked(false);
    later(() => {
      setScanning(false);
      setChecked(true);
    }, 1300);
  };
  const fix = (is: Issue) => {
    setSt((s) => fixIssue(s, is));
    setFixed((f) => [...f, is.id]);
    setHot(null);
  };
  const reveal = (is: Issue) => {
    setSel(is.doc);
    setHot(is.id);
    if (window.innerWidth < 1000) viewRef.current?.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "start" });
  };
  const reset = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    const s = initialState();
    setSt(s);
    setDrafts(s.values);
    setSwept([]);
    setLog([]);
    setChecked(false);
    setScanning(false);
    setFixed([]);
    setHot(null);
    setFocus("submitted");
  };

  const counts = { DOCX: 0, XLSX: 0, PDF: 0 } as Record<Format, number>;
  DOCS.forEach((d) => counts[d.format]++);
  const total = claimTotal();
  const allClear = checked && issues.length === 0;

  return (
    <div className={styles.app} id="clm-demo">
      <div className={styles.grid}>
        {/* 01 ------------------------------------------------------------ */}
        <section className={styles.cellPackage} aria-labelledby="clm-h-pkg">
          <StepHead n="01" id="clm-h-pkg" title="Claim package" note={`${DOCS.length} documents`} />
          <div className={styles.filters} role="group" aria-label="Show format">
            {(["all", "DOCX", "XLSX", "PDF"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={fmt === k} data-fmt={k === "all" ? undefined : k} onClick={() => setFmt(k)}>
                {k !== "all" && <i aria-hidden="true" />}
                {k === "all" ? "All" : k}
                <b className="num">{k === "all" ? DOCS.length : counts[k]}</b>
              </button>
            ))}
          </div>
          <ul className={styles.docs}>
            {list.map((d) => {
              const n = issuesOf(d.id).length;
              const uses = focus ? d.fields.includes(focus) : false;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    className={styles.doc}
                    data-fmt={d.format}
                    aria-pressed={d.id === sel}
                    data-uses={uses}
                    data-swept={swept.includes(d.id)}
                    data-flag={n > 0}
                    onClick={() => {
                      setSel(d.id);
                      setHot(null);
                    }}
                  >
                    <span className={styles.badge}>{d.format}</span>
                    <span className={styles.docText}>
                      <b>{d.name}</b>
                      <small>
                        {d.id} · {d.file}
                      </small>
                    </span>
                    {n > 0 ? (
                      <span className={styles.count} aria-label={`${n} ${n === 1 ? "issue" : "issues"}`}>
                        {n}
                      </span>
                    ) : uses ? (
                      <span className={styles.uses} aria-label={`carries ${FIELDS[focus!].label}`} />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className={styles.small}>
            Example package: interim payment application {st.values.claimNo} for a simplified road contract. Synthetic data.
          </p>
        </section>

        {/* 02 ------------------------------------------------------------ */}
        <section className={styles.cellFields} aria-labelledby="clm-h-fields">
          <StepHead n="02" id="clm-h-fields" title="Shared details" note="Edit once, update everywhere" />
          <div className={styles.fields}>
            {FIELD_ORDER.map((f) => {
              const meta = FIELDS[f];
              const docs = docsWith(f);
              const dirty = drafts[f] !== st.values[f];
              return (
                <div key={f} className={styles.field} data-focus={focus === f} onPointerEnter={() => setFocus(f)} onFocus={() => setFocus(f)}>
                  <label className={styles.fieldLabel} htmlFor={`clm-${f}`}>
                    {meta.label}
                    <span>in {docs.length} documents</span>
                  </label>
                  <div className={styles.fieldRow}>
                    <input
                      id={`clm-${f}`}
                      className={styles.input}
                      type={meta.type}
                      value={drafts[f]}
                      onChange={(e) => setDrafts((d) => ({ ...d, [f]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && apply(f)}
                    />
                    {meta.type === "date" && (
                      <span className={styles.nudges}>
                        <button type="button" onClick={() => nudge(f, -1)} aria-label={`${meta.label}: one day earlier`}>
                          −1d
                        </button>
                        <button type="button" onClick={() => nudge(f, 1)} aria-label={`${meta.label}: one day later`}>
                          +1d
                        </button>
                        <button type="button" onClick={() => nudge(f, 7)} aria-label={`${meta.label}: one week later`}>
                          +1w
                        </button>
                      </span>
                    )}
                    <button type="button" className={styles.apply} disabled={!dirty || !drafts[f]} onClick={() => apply(f)}>
                      Update {docs.length} <span className="arrow" aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
              );
            })}
            <div className={styles.field} data-calc>
              <span className={styles.fieldLabel}>
                Claim total
                <span>calculated from the BOQ</span>
              </span>
              <span className={`num ${styles.totalValue}`}>{money(total)}</span>
            </div>
          </div>

          <div className={styles.log} aria-live="polite">
            {log.length === 0 ? (
              <p className={styles.small}>
                The consultant’s project manager is out of office and one signature is missing? Move the <b>submission date</b> a week and update the package.
              </p>
            ) : (
              log.map((c, i) => (
                <p key={`${c.field}-${c.to}-${i}`} className={styles.change} data-latest={i === 0}>
                  <span className={styles.tick}>✓</span>
                  <span>
                    <b>{FIELDS[c.field].label}</b> {show(c.field, c.from)} → <em>{show(c.field, c.to)}</em>
                    <small>
                      updated in {c.docs.length} documents: {c.docs.join(", ")}
                    </small>
                  </span>
                </p>
              ))
            )}
          </div>
        </section>

        {/* 03 ------------------------------------------------------------ */}
        <section className={styles.cellView} aria-labelledby="clm-h-view" ref={viewRef}>
          <StepHead n="03" id="clm-h-view" title={current.name} note={current.file} />
          <DocPage d={current} st={st} focus={focus} swept={swept.includes(current.id)} issues={issuesOf(current.id)} hot={hot} fixed={fixed} />
        </section>

        {/* 04 ------------------------------------------------------------ */}
        <section className={styles.cellCheck} aria-labelledby="clm-h-check">
          <StepHead n="04" id="clm-h-check" title="Consistency check" note="Unit prices · amounts · totals" />
          <div className={styles.checkBar}>
            <button type="button" className={styles.primary} onClick={runCheck} disabled={scanning}>
              {scanning ? "Checking…" : checked ? "Check again" : "Check the package"} <span className="arrow" aria-hidden="true">→</span>
            </button>
            <span className={styles.checkStatus} aria-live="polite">
              {scanning ? (
                <span>Comparing {ITEMS.length} rates, {ITEMS.length} line amounts and the totals across {DOCS.length} documents…</span>
              ) : allClear ? (
                <span className={styles.clear}>
                  <span className={styles.tick}>✓</span> All figures agree across {DOCS.length} documents.
                </span>
              ) : checked ? (
                <span>
                  <b className={styles.bad}>{issues.length}</b> {issues.length === 1 ? "inconsistency" : "inconsistencies"} found. Show one to open it in the document.
                </span>
              ) : (
                <span>Unit prices against the bill of quantities, each line’s quantity × rate, and the totals against each other.</span>
              )}
            </span>
            <button type="button" className={styles.replay} onClick={reset}>
              ↻ Reset example
            </button>
          </div>
          {scanning && <div className={styles.progress} aria-hidden="true" />}
          {checked && issues.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Document</th>
                    <th scope="col">Inconsistency</th>
                    <th scope="col">Found</th>
                    <th scope="col">Expected</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((is) => (
                    <tr key={is.id} aria-selected={hot === is.id}>
                      <td>
                        {getDoc(is.doc).name}
                        <small>
                          {is.doc}
                          {is.against ? ` vs ${is.against}` : ""}
                        </small>
                      </td>
                      <td className={styles.what}>{is.title}</td>
                      <td className={styles.bad}>{is.found}</td>
                      <td>{is.expected}</td>
                      <td className={styles.actions}>
                        <button type="button" className={styles.ghost} onClick={() => reveal(is)}>
                          Show
                        </button>
                        <button type="button" className={styles.fix} onClick={() => fix(is)}>
                          {is.fix}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <p className={styles.fine}>
        Shared details are held once and written into every document that uses them. Rates are compared with the bill of quantities, every line amount with its quantity × rate, and
        the invoice with the payment summary. The example package is synthetic; everything runs in your browser.
      </p>
    </div>
  );
}

/* ---------- the open document ---------- */

function DocPage({ d, st, focus, swept, issues, hot, fixed }: { d: Doc; st: State; focus: FieldId | null; swept: boolean; issues: Issue[]; hot: string | null; fixed: string[] }) {
  const v = st.values;
  // a shared detail, as it appears in the text: marked when it is the one in focus, lit when it was just updated
  const tok = (f: FieldId) => (
    <span className={styles.token} data-focus={focus === f} data-swept={swept && focus === f}>
      {show(f, v[f])}
    </span>
  );
  const bad = (id: string) => issues.some((i) => i.id === id);
  const lit = (id: string) => hot === id;
  const ok = (id: string) => fixed.includes(id);
  const total = claimTotal();

  const head = (
    <div className={styles.pageMeta}>
      {d.fields.includes("claimNo") && (
        <span>
          Claim {tok("claimNo")}
        </span>
      )}
      {d.fields.includes("contract") && (
        <span>
          Contract {tok("contract")}
        </span>
      )}
      {d.fields.includes("periodEnd") && (
        <span>
          Period ending {tok("periodEnd")}
        </span>
      )}
      {d.fields.includes("submitted") && (
        <span>
          Date {tok("submitted")}
        </span>
      )}
    </div>
  );
  const bars = (n: number) => (
    <span className={styles.bars} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ width: `${92 - ((i * 17) % 34)}%` }} />
      ))}
    </span>
  );

  let body: React.ReactNode;
  switch (d.kind) {
    case "letter":
      body =
        d.id === "CL-01" ? (
          <>
            <p>Dear Sir,</p>
            <p>
              Please find enclosed Interim Payment Application {tok("claimNo")} under contract {tok("contract")} for work carried out in the period ending {tok("periodEnd")}, in the sum of{" "}
              <span className={`num ${styles.amount}`}>{money(total)}</span>.
            </p>
            {bars(3)}
            <p className={styles.sign}>Submitted on {tok("submitted")}</p>
          </>
        ) : (
          <>
            <p>
              Transmittal of Interim Payment Application {tok("claimNo")}, issued {tok("submitted")}.
            </p>
            <ul className={styles.plain}>
              {DOCS.filter((x) => x.id !== d.id).map((x) => (
                <li key={x.id}>
                  {x.id} {x.name}
                </li>
              ))}
            </ul>
          </>
        );
      break;
    case "summary":
      body = (
        <dl className={styles.sumList}>
          <div>
            <dt>Measured work this period</dt>
            <dd className="num">{money(total)}</dd>
          </div>
          <div>
            <dt>Variations approved</dt>
            <dd className="num">0.00</dd>
          </div>
          <div data-total>
            <dt>Amount due, {v.claimNo}</dt>
            <dd className="num">{money(total)}</dd>
          </div>
        </dl>
      );
      break;
    case "boq":
    case "measure": {
      const m = d.kind === "measure";
      body = (
        <div className={styles.pageTable}>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {ITEMS.map((it, i) => {
                const rate = m ? st.sheetRates[i] : it.rate;
                const amount = m ? st.sheetAmounts[i] : it.qty * it.rate;
                const rateId = `rate-${i}`;
                const amtId = `amount-${i}`;
                return (
                  <tr key={it.code}>
                    <td>{it.code}</td>
                    <td>{it.label}</td>
                    <td className="num">
                      {num(it.qty)} <small>{it.unit}</small>
                    </td>
                    <td className="num" data-bad={m && bad(rateId)} data-hot={m && lit(rateId)} data-ok={m && ok(rateId)}>
                      {money(rate)}
                    </td>
                    <td className="num" data-bad={m && bad(amtId)} data-hot={m && lit(amtId)} data-ok={m && (ok(amtId) || ok(rateId))}>
                      {money(amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total</td>
                <td className="num">{money(m ? st.sheetAmounts.reduce((a, b) => a + b, 0) : total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      );
      break;
    }
    case "invoice":
      body = (
        <dl className={styles.sumList}>
          <div>
            <dt>Invoice no.</dt>
            <dd>
              INV-{tok("claimNo")}
            </dd>
          </div>
          <div>
            <dt>For</dt>
            <dd>Interim payment, contract {tok("contract")}</dd>
          </div>
          <div data-total>
            <dt>Total due</dt>
            <dd className="num" data-bad={bad("total")} data-hot={lit("total")} data-ok={ok("total")}>
              {money(st.invoiceTotal)}
            </dd>
          </div>
        </dl>
      );
      break;
    case "form":
      body = (
        <>
          <p>
            Approval of Interim Payment Application {tok("claimNo")}, contract {tok("contract")}, submitted {tok("submitted")}.
          </p>
          <div className={styles.signs}>
            <span data-done="true">
              Contractor<small>Signed</small>
            </span>
            <span data-done="false">
              Consultant<small>Awaiting signature</small>
            </span>
          </div>
        </>
      );
      break;
    case "register":
      body = (
        <ul className={styles.rows}>
          <li>
            <span>VO-03</span> Additional drainage outlet <em>Approved</em>
          </li>
          <li>
            <span>VO-04</span> Kerb realignment at junction 2 <em>Pending</em>
          </li>
          <li>
            <span>VO-05</span> Temporary traffic diversion <em>Pending</em>
          </li>
        </ul>
      );
      break;
    case "schedule":
      body = (
        <ul className={styles.rows}>
          <li>
            <span>M-01</span> Precast kerbs on site <em>240 m</em>
          </li>
          <li>
            <span>M-02</span> DN600 pipes on site <em>36 m</em>
          </li>
          <li>
            <span>M-03</span> Granular subbase stockpile <em>180 m³</em>
          </li>
        </ul>
      );
      break;
    case "report":
      body = (
        <>
          <p>
            Progress for the period ending {tok("periodEnd")}, submitted with {tok("claimNo")} on {tok("submitted")}.
          </p>
          {bars(5)}
        </>
      );
      break;
    default:
      body = (
        <div className={styles.frames} aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      );
  }

  return (
    <article className={styles.page} data-fmt={d.format} key={d.id}>
      <header className={styles.pageHead}>
        <span className={styles.badge}>{d.format}</span>
        <span className={styles.pageId}>{d.id}</span>
        <span className={styles.pageFile}>{d.file}</span>
      </header>
      <h4 className={styles.pageTitle}>{d.name}</h4>
      {head}
      <div className={styles.pageBody}>{body}</div>
    </article>
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

