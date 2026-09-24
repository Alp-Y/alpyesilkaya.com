"use client";

import { useMemo, useState } from "react";
import type { EngineResult } from "@/lib/excavation/engine";
import { reportModel } from "@/lib/excavation/reportModel";
import { num, quantity } from "@/lib/format";
import styles from "./excavation.module.css";

/**
 * 05 — REPORT. A small preview of the Excel report and the download.
 * The workbook (5 sheets, formulas, charts) is generated in the browser
 * from the same result, so the file always matches what is on screen.
 */
export default function ReportPanel({ result }: { result: EngineResult }) {
  const model = useMemo(() => reportModel(result), [result]);
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
        <div className={styles.sheetHead}>
          <p className={styles.sheetTitle}>
            Excavation report <span>· {model.dataset}</span>
          </p>
          <span className={styles.xlsx} aria-hidden="true">
            XLSX
          </span>
        </div>
        <div className={styles.sheetBody} key={result.dataset.id + result.groundLabel}>
          <dl className={styles.sheetKpis}>
            {model.kpis.slice(0, 4).map((k, i) => (
              <div key={k.label} data-primary={i === 0} style={{ "--i": i } as React.CSSProperties}>
                <dt>{k.label.replace(" (cut)", "")}</dt>
                <dd className="num">{quantity(k.value, k.unit as "m" | "m²" | "m³")}</dd>
              </div>
            ))}
          </dl>
          <figure className={styles.miniChart}>
            <figcaption>Volume by area</figcaption>
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
      </div>

      <button type="button" className={styles.download} onClick={download} disabled={busy}>
        <span>
          <b>{busy ? "Preparing…" : isSample ? "Download example report" : "Export results"}</b>
          <span>Excel · summary, points, volumes, areas, sections</span>
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
    </div>
  );
}
