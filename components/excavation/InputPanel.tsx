"use client";

import { useId, useRef, useState } from "react";
import { SAMPLE_IDS, SAMPLE_NAMES, getSample } from "@/lib/excavation/samples";
import { MAX_POINTS, describeIssues, ISSUE_LABEL, parseXyz, type XyzResult } from "@/lib/excavation/xyz";
import type { Dataset } from "@/lib/excavation/samples";
import type { GroundChoice, Source } from "./useEngine";
import styles from "./excavation.module.css";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * 01 — INPUT. Sample data (default) or an uploaded XYZ file, plus the
 * existing ground. Files are read and checked in the browser; nothing is
 * uploaded anywhere.
 */
export default function InputPanel({
  source,
  ground,
  dataset,
  onSource,
  onGround,
}: {
  source: Source;
  ground: GroundChoice;
  dataset: Dataset;
  onSource: (s: Source) => void;
  onGround: (g: GroundChoice) => void;
}) {
  const [tab, setTab] = useState<"sample" | "upload">(source.kind);
  const [upload, setUpload] = useState<{ name: string; parsed: XyzResult } | null>(source.kind === "upload" ? { name: source.name, parsed: source.parsed } : null);
  const [groundUpload, setGroundUpload] = useState<{ name: string; parsed: XyzResult } | null>(ground.kind === "points" ? { name: ground.name, parsed: ground.parsed } : null);
  const [levelText, setLevelText] = useState("");
  const [editing, setEditing] = useState(false);
  const [advanced, setAdvanced] = useState(ground.kind === "points");
  const id = useId();

  // while typing, show the text; otherwise the level in use (or the dataset's suggestion)
  const shownLevel = editing ? levelText : (ground.kind === "level" ? ground.z : dataset.groundLevel).toFixed(2);

  const commitLevel = (text: string) => {
    const z = Number(text.replace(",", "."));
    if (Number.isFinite(z) && z > -500 && z < 9000) onGround({ kind: "level", z });
  };

  const readFile = async (file: File): Promise<{ name: string; parsed: XyzResult }> => {
    if (file.size > MAX_BYTES) return { name: file.name, parsed: { ...parseXyz(""), error: "This file is larger than 8 MB. The demo reads up to " + MAX_POINTS.toLocaleString("en-GB") + " points." } };
    const text = await file.text();
    return { name: file.name, parsed: parseXyz(text) };
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const u = await readFile(file);
    setUpload(u);
    if (!u.parsed.error) onSource({ kind: "upload", name: u.name, parsed: u.parsed });
  };
  const onGroundFile = async (file: File | undefined) => {
    if (!file) return;
    const u = await readFile(file);
    setGroundUpload(u);
    if (!u.parsed.error) onGround({ kind: "points", name: u.name, parsed: u.parsed });
  };

  const preview = dataset.excavated.slice(0, 3);
  const more = dataset.excavated.length - preview.length;

  return (
    <div className={styles.input}>
      <div className={styles.tabs} role="tablist" aria-label="Input data">
        <button type="button" role="tab" aria-selected={tab === "sample"} id={`${id}-t1`} aria-controls={`${id}-p1`} onClick={() => setTab("sample")}>
          Sample data
        </button>
        <button type="button" role="tab" aria-selected={tab === "upload"} id={`${id}-t2`} aria-controls={`${id}-p2`} onClick={() => setTab("upload")}>
          Upload XYZ
        </button>
      </div>

      {tab === "sample" ? (
        <div role="tabpanel" id={`${id}-p1`} aria-labelledby={`${id}-t1`} className={styles.samples}>
          {SAMPLE_IDS.map((sid) => {
            const on = source.kind === "sample" && source.id === sid;
            return (
              <button key={sid} type="button" className={styles.sample} aria-pressed={on} onClick={() => onSource({ kind: "sample", id: sid })}>
                <span className={styles.radio} aria-hidden="true" />
                {SAMPLE_NAMES[sid]}
              </button>
            );
          })}
          {source.kind === "sample" && <p className={styles.sampleNote}>{getSample(source.id).description}</p>}
        </div>
      ) : (
        <div role="tabpanel" id={`${id}-p2`} aria-labelledby={`${id}-t2`} className={styles.uploadPanel}>
          <FileDrop id={`${id}-file`} label="Excavated surface points" onFile={onFile} />
          <p className={styles.format}>
            One point per line: <code>X,Y,Z</code>
            <span>X = Easting · Y = Northing · Z = Elevation (m)</span>
          </p>
          <p className={styles.format}>
            Header rows, spaces, tabs and <code>POINT_ID,X,Y,Z</code> are fine.{" "}
            <a className="link-line" href="/downloads/xyz-template.csv" download>
              Template
            </a>{" "}
            ·{" "}
            <a className="link-line" href="/downloads/sample-xyz-points.csv" download>
              Sample file
            </a>
          </p>
          {upload && <Validation name={upload.name} parsed={upload.parsed} />}
          <p className={styles.privacy}>Read in your browser. Nothing is uploaded.</p>
        </div>
      )}

      {/* raw data, as received */}
      <figure className={styles.raw} aria-label="First rows of the input data">
        <figcaption>
          <span>Raw XYZ</span>
          <span className="num">{dataset.excavated.length.toLocaleString("en-GB")} pts</span>
        </figcaption>
        <pre className="num">
          {`POINT_ID,X,Y,Z\n${preview.map((p) => `${p.id},${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`).join("\n")}${more > 0 ? `\n… ${more.toLocaleString("en-GB")} more` : ""}`}
        </pre>
      </figure>

      {/* existing ground */}
      <fieldset className={styles.ground}>
        <legend>Existing ground</legend>
        {dataset.ground && (
          <label className={styles.choice}>
            <input type="radio" name={`${id}-ground`} checked={ground.kind === "sample"} onChange={() => onGround({ kind: "sample" })} />
            <span>
              Use sample ground surface <em className="num">{dataset.ground.length.toLocaleString("en-GB")} pts</em>
            </span>
          </label>
        )}
        <label className={styles.choice}>
          <input type="radio" name={`${id}-ground`} checked={ground.kind === "level"} onChange={() => commitLevel(shownLevel)} />
          <span>Enter ground elevation</span>
        </label>
        {ground.kind === "level" && (
          <div className={styles.level}>
            <label htmlFor={`${id}-level`}>Existing ground elevation</label>
            <span className={styles.levelBox}>
              <input
                id={`${id}-level`}
                type="number"
                inputMode="decimal"
                step="0.01"
                value={shownLevel}
                onFocus={() => {
                  setLevelText(shownLevel);
                  setEditing(true);
                }}
                onChange={(e) => setLevelText(e.target.value)}
                onBlur={(e) => {
                  setEditing(false);
                  commitLevel(e.target.value);
                }}
                onKeyDown={(e) => e.key === "Enter" && commitLevel((e.target as HTMLInputElement).value)}
              />
              <span aria-hidden="true">m</span>
            </span>
          </div>
        )}
        <details className={styles.advanced} open={advanced} onToggle={(e) => setAdvanced((e.target as HTMLDetailsElement).open)}>
          <summary>Advanced: existing ground from an XYZ file</summary>
          <label className={styles.choice}>
            <input type="radio" name={`${id}-ground`} checked={ground.kind === "points"} disabled={!groundUpload || !!groundUpload.parsed.error} onChange={() => groundUpload && onGround({ kind: "points", name: groundUpload.name, parsed: groundUpload.parsed })} />
            <span>Compare two surveys (TIN to TIN)</span>
          </label>
          <FileDrop id={`${id}-gfile`} label="Existing ground points" onFile={onGroundFile} small />
          {groundUpload && <Validation name={groundUpload.name} parsed={groundUpload.parsed} />}
        </details>
      </fieldset>
    </div>
  );
}

function FileDrop({ id, label, onFile, small = false }: { id: string; label: string; onFile: (f: File | undefined) => void; small?: boolean }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className={styles.drop}
      data-over={over}
      data-small={small}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files[0]);
      }}
    >
      <label htmlFor={id}>
        <span className={styles.dropIcon} aria-hidden="true">
          ↑
        </span>
        <span>
          <b>{label}</b>
          <span>Choose a .csv or .txt file, or drop it here</span>
        </span>
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        accept=".csv,.txt,.xyz,.pts,text/csv,text/plain"
        className={styles.fileInput}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          if (input.current) input.current.value = "";
        }}
      />
    </div>
  );
}

function Validation({ name, parsed }: { name: string; parsed: XyzResult }) {
  if (parsed.error)
    return (
      <div className={styles.validation} data-state="error" role="alert">
        <b>{name}</b>
        <p>{parsed.error}</p>
      </div>
    );
  const issues = describeIssues(parsed);
  return (
    <div className={styles.validation} data-state={issues ? "warn" : "ok"} role="status">
      <b>
        {name} · <span className="num">{parsed.points.length.toLocaleString("en-GB")}</span> points read
      </b>
      {issues && (
        <details>
          <summary>{issues}</summary>
          <ul>
            {parsed.examples.map((e) => (
              <li key={`${e.line}-${e.kind}`}>
                <span className="num">Line {e.line}</span> {ISSUE_LABEL[e.kind]}: <code>{e.text.slice(0, 48)}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
