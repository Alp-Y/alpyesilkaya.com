/**
 * EXCAVATION REPORT MODEL — the numbers the report shows, from one result.
 * Used by the on-page preview (light) and by the workbook writer
 * (report.ts, loaded only when a visitor downloads).
 */

import type { EngineResult } from "./engine";
import { chainage, section, type SectionProfile } from "./volume";

export const REPORT_SHEETS = ["Summary", "Input Points", "Volume Results", "Area Breakdown", "Sections"] as const;

export type ReportModel = {
  title: string;
  dataset: string;
  date: string;
  groundSource: string;
  points: number;
  kpis: { label: string; value: number; unit: string; decimals: 0 | 2 }[];
  zones: { id: string; range: string; area: number; cut: number; share: number }[];
  bands: { label: string; area: number; cut: number; share: number }[];
  /** the cross section with the largest cut area */
  critical: SectionProfile;
  sections: { label: string; s: number; cutArea: number; fillArea: number }[];
  endAreaVolume: number;
  synthetic: boolean;
};

export function reportModel(r: EngineResult, date = new Date()): ReportModel {
  const c = r.comparison;
  const total = c.cut || 1;
  const stations = r.check.stations.map((st) => {
    const p = section(c, "cross", st.s);
    return { label: `CH ${chainage(st.s)}`, s: st.s, cutArea: p.cutArea, fillArea: p.fillArea };
  });
  const maxSt = stations.reduce((best, s) => (s.cutArea > best.cutArea ? s : best), stations[0] ?? { s: (c.axis.cutS[0] + c.axis.cutS[1]) / 2, cutArea: 0 });
  const critical = section(c, "cross", maxSt.s, 0.5);
  return {
    title: "Excavation Report",
    dataset: r.dataset.name,
    date: formatDate(date),
    groundSource: r.ground.kind === "level" ? `Constant level ${r.ground.z.toFixed(2)} m` : `TIN · ${r.counts.ground.toLocaleString("en-GB")} points${r.ground.kind === "points" ? ` (${r.ground.name})` : ""}`,
    points: r.counts.excavated + r.counts.ground,
    kpis: [
      { label: "Excavation volume (cut)", value: c.cut, unit: "m³", decimals: 2 },
      { label: "Excavated plan area", value: c.cutArea, unit: "m²", decimals: 2 },
      { label: "Average excavation depth", value: c.averageDepth, unit: "m", decimals: 2 },
      { label: "Maximum excavation depth", value: c.maxDepth, unit: "m", decimals: 2 },
      { label: "Fill volume (surface above ground)", value: c.fill, unit: "m³", decimals: 2 },
      { label: "Minimum excavated elevation", value: c.exZMin, unit: "m", decimals: 2 },
      { label: "Maximum excavated elevation", value: c.exZMax, unit: "m", decimals: 2 },
      { label: "Survey points", value: r.counts.excavated + r.counts.ground, unit: "pts", decimals: 0 },
    ],
    zones: c.zones.map((z) => ({ id: z.id, range: `CH ${chainage(z.from)} to ${chainage(z.to)}`, area: z.area, cut: z.cut, share: z.cut / total })),
    bands: c.bands.map((b) => ({ label: b.to === null ? `> ${b.from.toFixed(1)} m` : `${b.from.toFixed(1)} to ${b.to.toFixed(1)} m`, area: b.area, cut: b.cut, share: b.cut / total })),
    critical,
    sections: stations,
    endAreaVolume: r.check.volume,
    synthetic: r.dataset.id !== "upload",
  };
}

export function formatDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
