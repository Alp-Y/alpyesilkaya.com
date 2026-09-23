import { num, quantity } from "@/lib/format";
import type { Section } from "@/lib/excavation/model";
import styles from "./excavation.module.css";

/**
 * A cross-section drawn like a CAD section sheet: existing ground, the
 * excavated surface, the cut hatched between them (inside the boundary),
 * offset and level scales. Levels are true (no exaggeration) × 2 vertically.
 */
export default function SectionView({ section }: { section: Section }) {
  const W = 720;
  const H = 230;
  const pad = { l: 56, r: 16, t: 18, b: 34 };
  const levels = section.samples.flatMap((s) => [s.eg, s.ex]);
  const zMin = Math.floor(Math.min(...levels) - 1);
  const zMax = Math.ceil(Math.max(...levels) + 1);
  const oMin = -36;
  const oMax = 36;
  const X = (o: number) => pad.l + ((o - oMin) / (oMax - oMin)) * (W - pad.l - pad.r);
  const Y = (z: number) => pad.t + ((zMax - z) / (zMax - zMin)) * (H - pad.t - pad.b);
  const line = (key: "eg" | "ex") => section.samples.map((s, i) => `${i ? "L" : "M"}${X(s.o).toFixed(1)} ${Y(s[key]).toFixed(1)}`).join(" ");
  const [i0, i1] = section.inside ?? [0, -1];
  const inside = section.samples.filter((s) => s.o >= i0 && s.o <= i1);
  const cut =
    inside.length > 1
      ? `M${inside.map((s) => `${X(s.o).toFixed(1)} ${Y(s.eg).toFixed(1)}`).join(" L")} L${[...inside]
          .reverse()
          .map((s) => `${X(s.o).toFixed(1)} ${Y(s.ex).toFixed(1)}`)
          .join(" L")} Z`
      : "";
  const zTicks: number[] = [];
  for (let z = Math.ceil(zMin / 2) * 2; z <= zMax; z += 2) zTicks.push(z);

  return (
    <svg className={styles.section} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cross-section at ${section.label}: cut area ${num(section.cutArea)} square metres`}>
      <defs>
        <pattern id="exv-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#e2848c" strokeWidth="0.8" />
        </pattern>
      </defs>
      {/* level grid */}
      {zTicks.map((z) => (
        <g key={z}>
          <line x1={pad.l} x2={W - pad.r} y1={Y(z)} y2={Y(z)} className={styles.sGrid} />
          <text x={pad.l - 8} y={Y(z) + 3} textAnchor="end" className={styles.sText}>
            {z.toFixed(0)}
          </text>
        </g>
      ))}
      {[-30, -20, -10, 0, 10, 20, 30].map((o) => (
        <g key={o}>
          <line x1={X(o)} x2={X(o)} y1={pad.t} y2={H - pad.b} className={o === 0 ? styles.sAxis : styles.sGrid} />
          <text x={X(o)} y={H - pad.b + 14} textAnchor="middle" className={styles.sText}>
            {o === 0 ? "CL" : `${Math.abs(o)}${o < 0 ? " L" : " R"}`}
          </text>
        </g>
      ))}
      {/* boundary limits */}
      {section.inside && (
        <>
          <line x1={X(i0)} x2={X(i0)} y1={pad.t} y2={H - pad.b} className={styles.sLimit} />
          <line x1={X(i1)} x2={X(i1)} y1={pad.t} y2={H - pad.b} className={styles.sLimit} />
        </>
      )}
      {cut && <path d={cut} fill="url(#exv-hatch)" className={styles.sCut} />}
      {/* excavated first, existing ground on top: where they coincide you see the ground */}
      <path d={line("ex")} className={styles.sEx} />
      <path d={line("eg")} className={styles.sEg} />
      <text x={pad.l} y={H - 4} className={styles.sText}>
        {section.label} · OFFSET (m) · LEVEL (m)
      </text>
      <text x={W - pad.r} y={pad.t + 10} textAnchor="end" className={styles.sValue}>
        CUT AREA {quantity(section.cutArea, "m²")}
      </text>
    </svg>
  );
}
