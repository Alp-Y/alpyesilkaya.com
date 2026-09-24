"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { EngineResult } from "@/lib/excavation/engine";
import { chainage, type SectionKind, type SectionProfile } from "@/lib/excavation/volume";
import { num, quantity } from "@/lib/format";
import styles from "./excavation.module.css";

/**
 * 04 — INSPECT. A cross section (across the excavation, at a chainage) or
 * the long section (along it). Drawn like a section sheet: existing ground,
 * excavated surface, the cut hatched between them.
 */
export default function SectionPanel({
  result,
  profile,
  kind,
  at,
  onChange,
}: {
  result: EngineResult;
  profile: SectionProfile;
  kind: SectionKind;
  at: number;
  onChange: (kind: SectionKind, at: number) => void;
}) {
  const id = useId();
  const { axis } = result.comparison;
  const [min, max] = kind === "cross" ? [Math.ceil(axis.sMin), Math.floor(axis.sMax)] : [Math.ceil(axis.oMin), Math.floor(axis.oMax)];
  const label = kind === "cross" ? `CH ${chainage(at)}` : `Offset ${at >= 0 ? "+" : "−"}${num(Math.abs(at))} m`;

  return (
    <div className={styles.sectionPanel}>
      <div className={styles.sectionBar}>
        <div className={styles.segmented} role="group" aria-label="Section type">
          <button type="button" aria-pressed={kind === "cross"} onClick={() => onChange("cross", clampMid(axis.cutS))}>
            Cross section
          </button>
          <button type="button" aria-pressed={kind === "long"} onClick={() => onChange("long", 0)}>
            Long section
          </button>
        </div>
        <p className={styles.sectionValue}>
          <span>Cut area</span>
          <b className="num">{quantity(profile.cutArea, "m²")}</b>
        </p>
      </div>

      <div className={styles.slider}>
        <label htmlFor={`${id}-at`}>{kind === "cross" ? "Section position (chainage)" : "Long section offset"}</label>
        <input
          id={`${id}-at`}
          type="range"
          min={min}
          max={max}
          step={0.5}
          value={at}
          aria-valuetext={label}
          onChange={(e) => onChange(kind, Number(e.target.value))}
        />
        <output htmlFor={`${id}-at`} className="num">
          {label}
        </output>
      </div>

      <ProfileSvg profile={profile} />
    </div>
  );
}

const clampMid = ([a, b]: [number, number]) => Math.round(((a + b) / 2) * 2) / 2;

function ProfileSvg({ profile }: { profile: SectionProfile }) {
  // the drawing is laid out at its real width, so text stays at its real size
  const box = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = Math.max(280, Math.min(960, width));
  const H = W < 480 ? 210 : 240;
  const pad = { l: 44, r: 10, t: 16, b: 34 };
  const s = profile.samples;
  if (s.length < 2)
    return (
      <p className={styles.empty} role="status">
        No surface at this position: move the section.
      </p>
    );
  const levels = s.flatMap((p) => [p.eg, p.ex]);
  let zMin = Math.floor(Math.min(...levels) - 0.5);
  let zMax = Math.ceil(Math.max(...levels) + 0.5);
  if (zMax - zMin < 4) {
    const m = (zMin + zMax) / 2;
    zMin = Math.floor(m - 2);
    zMax = Math.ceil(m + 2);
  }
  const hMin = s[0].h;
  const hMax = s[s.length - 1].h;
  const X = (h: number) => pad.l + ((h - hMin) / Math.max(1e-6, hMax - hMin)) * (W - pad.l - pad.r);
  const Y = (z: number) => pad.t + ((zMax - z) / (zMax - zMin)) * (H - pad.t - pad.b);
  const path = (key: "eg" | "ex") => s.map((p, i) => `${i ? "L" : "M"}${X(p.h).toFixed(1)} ${Y(p[key]).toFixed(1)}`).join(" ");
  // hatched cut: between the lines wherever ground is above the excavated surface
  const cut = s.map((p, i) => `${i ? "L" : "M"}${X(p.h).toFixed(1)} ${Y(p.eg).toFixed(1)}`).join(" ") + " " + [...s].reverse().map((p) => `L${X(p.h).toFixed(1)} ${Y(Math.min(p.eg, p.ex)).toFixed(1)}`).join(" ") + " Z";
  const zStep = zMax - zMin > 12 ? 2 : 1;
  const zTicks: number[] = [];
  for (let z = Math.ceil(zMin / zStep) * zStep; z <= zMax; z += zStep) zTicks.push(z);
  const hSpan = hMax - hMin;
  // about one label every 46 px
  const hStep = [5, 10, 20, 25, 50, 100].find((st) => (hSpan / st) * 46 <= W - pad.l - pad.r) ?? 100;
  const hTicks: number[] = [];
  for (let h = Math.ceil(hMin / hStep) * hStep; h <= hMax; h += hStep) hTicks.push(h);
  const deepest = s.reduce((b, p) => (p.eg - p.ex > b.eg - b.ex ? p : b), s[0]);
  const hLabel = (h: number) => (profile.kind === "cross" ? (Math.abs(h) < 1e-6 ? "0" : `${h > 0 ? "" : "−"}${Math.abs(h)}`) : chainage(h).replace(/\.00$/, ""));

  return (
    <figure className={styles.profile} ref={box}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${profile.label}: cut area ${num(profile.cutArea)} square metres; deepest cut ${num(Math.max(0, deepest.eg - deepest.ex))} metres, existing ground ${num(deepest.eg)} m, excavated level ${num(deepest.ex)} m.`}
      >
        <defs>
          <pattern id="exv-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#e2848c" strokeWidth="0.8" />
          </pattern>
        </defs>
        {zTicks.map((z) => (
          <g key={z}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(z)} y2={Y(z)} className={styles.sGrid} />
            <text x={pad.l - 8} y={Y(z) + 3} textAnchor="end" className={styles.sText}>
              {z.toFixed(0)}
            </text>
          </g>
        ))}
        {hTicks.map((h) => (
          <g key={h}>
            <line x1={X(h)} x2={X(h)} y1={pad.t} y2={H - pad.b} className={profile.kind === "cross" && h === 0 ? styles.sAxis : styles.sGrid} />
            <text x={X(h)} y={H - pad.b + 14} textAnchor="middle" className={styles.sText}>
              {hLabel(h)}
            </text>
          </g>
        ))}
        <path d={cut} fill="url(#exv-hatch)" className={styles.sCut} />
        <path d={path("ex")} className={styles.sEx} />
        <path d={path("eg")} className={styles.sEg} />
        <text x={pad.l} y={H - 4} className={styles.sText}>
          {profile.kind === "cross" ? "OFFSET FROM AXIS (m)" : "CHAINAGE"} · ELEVATION (m)
        </text>
        <text x={W - pad.r} y={pad.t + 10} textAnchor="end" className={styles.sValue}>
          {profile.label}
        </text>
      </svg>
      <figcaption className={styles.profileKey}>
        <span data-k="eg">Existing ground</span>
        <span data-k="ex">Excavated surface</span>
        <span data-k="cut">Cut</span>
      </figcaption>
    </figure>
  );
}
