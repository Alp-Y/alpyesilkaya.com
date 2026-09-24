"use client";

import { useMemo, useState } from "react";
import type { EngineResult } from "@/lib/excavation/engine";
import { reportModel, REPORT_SHEETS } from "@/lib/excavation/reportModel";
import { num, quantity } from "@/lib/format";
import styles from "./excavation.module.css";

type Tab = "Summary" | "Area Breakdown" | "Sections";
const TABS: Tab[] = ["Summary", "Area Breakdown", "Sections"];

/**
 * 05 — EXPORT. A preview of the Excel report (not the whole workbook),
 * and the download. The workbook is generated in the browser from the
 * same result, so the file always matches what is on screen.
 */
export default function ReportPanel({ result }: { result: EngineResult }) {
  const model = useMemo(() => reportModel(result), [result]);
  const [tab, setTab] = useState<Tab>("Summary");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSample = result.dataset.id !== "upload";

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const { buildWorkbook, reportFileName } = await import("@/lib/excavation/report");
      const bytes = await buildWorkbook(result);
      const blob = new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = reportFileName(result);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setError("The report couldn’t be generated in this browser.");
    } finally {
      setBusy(false);
    }
  };

  const maxZone = Math.max(...model.zones.map((z) => z.cut), 1);

  return (
    <div className={styles.report}>
      <div className={styles.sheet}>
        {/* title block */}
        <div className={styles.sheetHead}>
          <div>
            <p className={styles.sheetTitle}>Excavation Report</p>
            <dl className={styles.sheetMeta}>
              <div>
                <dt>Project / dataset</dt>
                <dd>{model.dataset}</dd>
              </div>
              <div>
                <dt>Calculation date</dt>
                <dd className="num">{model.date}</dd>
              </div>
              <div>
                <dt>Number of points</dt>
                <dd className="num">{model.points.toLocaleString("en-GB")}</dd>
              </div>
            </dl>
          </div>
          <span className={styles.xlsx} aria-hidden="true">
            XLSX
          </span>
        </div>

        {/* the preview body, per sheet */}
        <div className={styles.sheetBody} role="tabpanel" id="exv-report-panel" aria-label={`${tab} sheet preview`} key={tab}>
          {tab === "Summary" && (
            <div className={styles.sheetSummary}>
              <dl className={styles.sheetKpis}>
                {model.kpis.slice(0, 4).map((k, i) => (
                  <div key={k.label} data-primary={i === 0} style={{ "--i": i } as React.CSSProperties}>
                    <dt>{k.label.replace(" (cut)", "")}</dt>
                    <dd className="num">{quantity(k.value, k.unit as "m" | "m²" | "m³")}</dd>
                  </div>
                ))}
              </dl>
              <figure className={styles.miniChart}>
                <figcaption>Excavation volume by area</figcaption>
                <div className={styles.bars} role="img" aria-label={model.zones.map((z) => `${z.id} ${num(z.cut)} cubic metres`).join(", ")}>
                  {model.zones.map((z, i) => (
                    <div key={z.id} className={styles.bar} style={{ "--h": z.cut / maxZone, "--i": i } as React.CSSProperties}>
                      <span className="num">{Math.round(z.cut).toLocaleString("en-GB")}</span>
                      <i />
                      <b>{z.id}</b>
                    </div>
                  ))}
                </div>
              </figure>
            </div>
          )}
          {tab === "Area Breakdown" && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Area</th>
                    <th scope="col" className={styles.hideSm}>
                      Chainage
                    </th>
                    <th scope="col" className={styles.right}>
                      Volume
                    </th>
                    <th scope="col" className={styles.right}>
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {model.zones.map((z) => (
                    <tr key={z.id}>
                      <td>{z.id}</td>
                      <td className={`${styles.hideSm} num`}>{z.range.replace("CH ", "")}</td>
                      <td className={`${styles.right} num`}>{num(z.cut)} m³</td>
                      <td className={`${styles.right} num`}>{(z.share * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className={styles.hideSm} />
                    <td className={`${styles.right} num`}>{num(result.comparison.cut)} m³</td>
                    <td className={`${styles.right} num`}>100.0%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {tab === "Sections" && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Station</th>
                    <th scope="col" className={styles.right}>
                      Cut area
                    </th>
                    <th scope="col" className={`${styles.right} ${styles.hideSm}`}>
                      Fill area
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {model.sections.map((st) => (
                    <tr key={st.s} data-critical={st.label === model.critical.label}>
                      <td className="num">{st.label}</td>
                      <td className={`${styles.right} num`}>{num(st.cutArea)} m²</td>
                      <td className={`${styles.right} ${styles.hideSm} num`}>{num(st.fillArea)} m²</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Average end area</td>
                    <td className={`${styles.right} num`}>{num(model.endAreaVolume)} m³</td>
                    <td className={styles.hideSm} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* sheet tabs, like the workbook */}
        <div className={styles.sheetTabs} role="tablist" aria-label="Report sheets">
          {REPORT_SHEETS.map((name) => {
            const previewable = (TABS as string[]).includes(name);
            return previewable ? (
              <button key={name} type="button" role="tab" aria-selected={tab === name} aria-controls="exv-report-panel" onClick={() => setTab(name as Tab)}>
                {name}
              </button>
            ) : (
              <span key={name} className={styles.sheetTabStatic}>
                {name}
              </span>
            );
          })}
        </div>
      </div>

      <div className={styles.export}>
        <button type="button" className={styles.download} onClick={download} disabled={busy}>
          <span className={styles.xlsxIcon} aria-hidden="true">
            X
          </span>
          <span>
            <b>{isSample ? "Download Example Report" : "Export Results"}</b>
            <span>
              .xlsx · 5 sheets · {isSample ? "synthetic sample data" : "from your data, made in your browser"}
            </span>
          </span>
          <span className="arrow" aria-hidden="true">
            ↓
          </span>
        </button>
        {error && (
          <p className={styles.exportError} role="alert">
            {error}
          </p>
        )}
        <p className={styles.sheetsList}>{REPORT_SHEETS.join(" · ")}</p>
      </div>
    </div>
  );
}
