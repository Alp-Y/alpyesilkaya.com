/**
 * EXCAVATION REPORT — engine result → report model → .xlsx workbook.
 * ------------------------------------------------------------------
 *   Summary          key quantities, sources, method, charts
 *   Input Points     both surveys, as received (E, N, Z)
 *   Volume Results   cut / fill, depth distribution, method check
 *   Area Breakdown   chainage strips A01…, with totals (formulas)
 *   Sections         cross sections + the profile of the largest one
 *
 * `reportModel` is what the on-page preview shows; `buildWorkbook` writes
 * the same numbers to Excel. Both come from one EngineResult.
 */

import { writeWorkbook, ref, type Cell, type Sheet } from "@/lib/xlsx/workbook";
import type { EngineResult } from "./engine";
import { formatDate, reportModel, round } from "./reportModel";

export { REPORT_SHEETS, reportModel, type ReportModel } from "./reportModel";

/* ================================================================== */

export function buildWorkbook(r: EngineResult, date = new Date()): Promise<Uint8Array> {
  const m = reportModel(r, date);
  const c = r.comparison;
  const sheets: Sheet[] = [];
  const blank: Cell[] = [];

  /* ---------- Area Breakdown (built first: Summary charts refer to it) ---------- */
  const abHead = 5;
  const abRows: Cell[][] = [
    [{ v: "Area Breakdown", s: "title" }, { v: "", s: "title" }, { v: "", s: "title" }, { v: "", s: "title" }, { v: "", s: "title" }],
    [{ v: `${m.dataset} · cut volume per area`, s: "subtitle" }],
    [{ v: `Areas are equal chainage strips along the principal axis of the excavation (${c.zones.length} strips).`, s: "note" }],
    blank,
    blank,
    [{ v: "Area", s: "header" }, { v: "Chainage", s: "header" }, { v: "Plan area (m²)", s: "headerRight" }, { v: "Cut volume (m³)", s: "headerRight" }, { v: "Share", s: "headerRight" }],
  ];
  const z0 = abHead + 1;
  m.zones.forEach((z, i) => {
    const row = z0 + i + 1;
    abRows.push([{ v: z.id, s: "text" }, { v: z.range, s: "text" }, { v: round(z.area), s: "num2" }, { v: round(z.cut), s: "num2" }, { v: z.share, s: "pct", f: `D${row}/D$${z0 + m.zones.length + 1}` }]);
  });
  const zTotal = z0 + m.zones.length + 1;
  abRows.push([
    { v: "Total", s: "totalLabel" },
    { v: "", s: "totalLabel" },
    { v: round(c.cutArea), s: "total2", f: `SUM(C${z0 + 1}:C${zTotal - 1})` },
    { v: round(c.cut), s: "total2", f: `SUM(D${z0 + 1}:D${zTotal - 1})` },
    { v: 1, s: "totalPct", f: `SUM(E${z0 + 1}:E${zTotal - 1})` },
  ]);
  const zoneCats = ref("Area Breakdown", 0, z0, 0, z0 + m.zones.length - 1);
  const zoneVals = ref("Area Breakdown", 3, z0, 3, z0 + m.zones.length - 1);
  const zoneChart = {
    type: "column" as const,
    title: "Excavation volume by area",
    yTitle: "Cut volume (m³)",
    series: [{ name: "Cut volume (m³)", color: "1E7A4E", cat: zoneCats, val: zoneVals, catCache: m.zones.map((z) => z.id), valCache: m.zones.map((z) => round(z.cut, 1)) }],
  };
  const abSheet: Sheet = {
    name: "Area Breakdown",
    cols: [10, 30, 16, 16, 10],
    rows: abRows,
    merges: ["A1:E1", "A3:E3"],
    charts: [{ ...zoneChart, from: [0, zTotal + 2], to: [5, zTotal + 20] }],
    tab: "1E7A4E",
  };

  /* ---------- Volume Results ---------- */
  const vr: Cell[][] = [
    [{ v: "Volume Results", s: "title" }, { v: "", s: "title" }, { v: "", s: "title" }, { v: "", s: "title" }, { v: "", s: "title" }],
    [{ v: `${m.dataset} · existing ground − excavated surface`, s: "subtitle" }],
    blank,
    [{ v: "SURFACE COMPARISON", s: "section" }],
    [{ v: "Quantity", s: "header" }, { v: "", s: "header" }, { v: "Value", s: "headerRight" }, { v: "Unit", s: "header" }],
    [{ v: "Cut volume", s: "text" }, { v: "", s: "text" }, { v: round(c.cut), s: "num2" }, { v: "m³", s: "text" }],
    [{ v: "Fill volume", s: "text" }, { v: "", s: "text" }, { v: round(c.fill), s: "num2" }, { v: "m³", s: "text" }],
    [{ v: "Net volume (cut − fill)", s: "text" }, { v: "", s: "text" }, { v: round(c.cut - c.fill), s: "num2", f: "C6-C7" }, { v: "m³", s: "text" }],
    [{ v: "Plan area compared", s: "text" }, { v: "", s: "text" }, { v: round(c.comparedArea), s: "num2" }, { v: "m²", s: "text" }],
    [{ v: "Plan area in cut", s: "text" }, { v: "", s: "text" }, { v: round(c.cutArea), s: "num2" }, { v: "m²", s: "text" }],
    [{ v: "Average depth in cut", s: "text" }, { v: "", s: "text" }, { v: round(c.averageDepth), s: "num2", f: "IF(C10>0,C6/C10,0)" }, { v: "m", s: "text" }],
    [{ v: "Maximum depth", s: "text" }, { v: "", s: "text" }, { v: round(c.maxDepth), s: "num2" }, { v: "m", s: "text" }],
    [{ v: "Composite TIN triangles", s: "text" }, { v: "", s: "text" }, { v: c.tris.length, s: "int" }, { v: "", s: "text" }],
    blank,
    [{ v: "DEPTH DISTRIBUTION", s: "section" }],
    [{ v: "Depth band", s: "header" }, { v: "", s: "header" }, { v: "Plan area (m²)", s: "headerRight" }, { v: "Cut volume (m³)", s: "headerRight" }, { v: "Share", s: "headerRight" }],
  ];
  const b0 = vr.length;
  m.bands.forEach((b, i) => {
    const row = b0 + i + 1;
    vr.push([{ v: b.label, s: "text" }, { v: "", s: "text" }, { v: round(b.area), s: "num2" }, { v: round(b.cut), s: "num2" }, { v: b.share, s: "pct", f: `D${row}/$C$6` }]);
  });
  const bTotal = vr.length + 1;
  vr.push([
    { v: "Total", s: "totalLabel" },
    { v: "", s: "totalLabel" },
    { v: round(m.bands.reduce((s, b) => s + b.area, 0)), s: "total2", f: `SUM(C${b0 + 1}:C${bTotal - 1})` },
    { v: round(c.cut), s: "total2", f: `SUM(D${b0 + 1}:D${bTotal - 1})` },
    { v: 1, s: "totalPct", f: `SUM(E${b0 + 1}:E${bTotal - 1})` },
  ]);
  vr.push(blank, [{ v: "METHOD CHECK", s: "section" }]);
  vr.push([{ v: "Check", s: "header" }, { v: "", s: "header" }, { v: "Volume (m³)", s: "headerRight" }, { v: "Difference", s: "headerRight" }]);
  const chkRow = vr.length + 1;
  vr.push([{ v: "TIN volume (integrated per triangle)", s: "text" }, { v: "", s: "text" }, { v: round(c.cut), s: "num2", f: "C6" }, { v: "", s: "text" }]);
  vr.push([
    { v: `Average end area (sections every ${r.check.step} m)`, s: "text" },
    { v: "", s: "text" },
    { v: round(r.check.volume), s: "num2" },
    { v: c.cut ? r.check.volume / c.cut - 1 : 0, s: "pct", f: `IF(C${chkRow}>0,C${chkRow + 1}/C${chkRow}-1,0)` },
  ]);
  vr.push(blank, [
    {
      v: "The TIN volume is exact for the two triangulated surfaces: every triangle of the composite TIN is clipped where the surfaces cross and its depth is integrated. The average-end-area figure is an independent check from sections and is expected to differ by a few percent.",
      s: "note",
    },
  ]);
  const noteRow = vr.length;
  const bandChart = {
    type: "column" as const,
    title: "Excavation depth distribution",
    xTitle: "Depth band",
    yTitle: "Cut volume (m³)",
    series: [
      {
        name: "Cut volume (m³)",
        color: "5B6F86",
        cat: ref("Volume Results", 0, b0, 0, b0 + m.bands.length - 1),
        val: ref("Volume Results", 3, b0, 3, b0 + m.bands.length - 1),
        catCache: m.bands.map((b) => b.label),
        valCache: m.bands.map((b) => round(b.cut, 1)),
      },
    ],
  };
  sheets.push({
    name: "Volume Results",
    cols: [30, 4, 16, 16, 12],
    rows: vr,
    merges: ["A1:E1", `A${noteRow}:E${noteRow}`],
    charts: [{ ...bandChart, from: [6, 3], to: [14, 21] }],
    tab: "5B6F86",
  });

  /* ---------- Summary ---------- */
  const s: Cell[][] = [
    [{ v: "EXCAVATION REPORT", s: "title" }, { v: "", s: "title" }, { v: "", s: "title" }, { v: "", s: "title" }],
    [{ v: "Existing ground − excavated surface · TIN surface comparison", s: "subtitle" }],
    blank,
    [{ v: "Project / dataset", s: "label" }, { v: m.dataset, s: "value" }, { v: "", s: "value" }],
    [{ v: "Calculation date", s: "label" }, { v: m.date, s: "value" }, { v: "", s: "value" }],
    [{ v: "Existing ground", s: "label" }, { v: m.groundSource, s: "value" }, { v: "", s: "value" }],
    [{ v: "Excavated surface", s: "label" }, { v: `TIN · ${r.counts.excavated.toLocaleString("en-GB")} points`, s: "value" }, { v: "", s: "value" }],
    [{ v: "Number of points", s: "label" }, { v: m.points.toLocaleString("en-GB"), s: "value" }, { v: "", s: "value" }],
    [{ v: "Method", s: "label" }, { v: "Composite TIN, exact per triangle", s: "value" }, { v: "", s: "value" }],
    blank,
    [{ v: "EXCAVATION VOLUME", s: "kpiLabel" }],
    [{ v: round(c.cut), s: "kpi" }],
    blank,
    [{ v: "Metric", s: "header" }, { v: "Result", s: "headerRight" }, { v: "Unit", s: "header" }],
  ];
  m.kpis.forEach((k) => s.push([{ v: k.label, s: "text" }, { v: k.decimals ? round(k.value) : k.value, s: k.decimals ? "num2" : "int" }, { v: k.unit, s: "text" }]));
  s.push(blank, [{ v: "AREA BREAKDOWN", s: "section" }], [{ v: "Area", s: "header" }, { v: "Cut volume (m³)", s: "headerRight" }, { v: "Share", s: "headerRight" }]);
  m.zones.forEach((z, i) =>
    s.push([
      { v: `${z.id}`, s: "text" },
      { v: round(z.cut), s: "num2", f: `'Area Breakdown'!D${z0 + i + 1}` },
      { v: z.share, s: "pct", f: `'Area Breakdown'!E${z0 + i + 1}` },
    ]),
  );
  s.push(blank, [
    {
      v: m.synthetic
        ? "Example report generated from synthetic demonstration data on alpyesilkaya.com. Not project data. Coordinates: X = Easting, Y = Northing, Z = Elevation (m)."
        : "Generated in the browser on alpyesilkaya.com from the uploaded survey data. Check the input before using the quantities. Coordinates: X = Easting, Y = Northing, Z = Elevation (m).",
      s: "note",
    },
  ]);
  const summaryNote = s.length;
  sheets.unshift({
    name: "Summary",
    cols: [32, 20, 10, 3],
    rows: s,
    merges: ["A1:C1", "B4:C4", "B5:C5", "B6:C6", "B7:C7", "B8:C8", "B9:C9", `A${summaryNote}:C${summaryNote}`],
    charts: [
      { ...zoneChart, from: [4, 3], to: [12, 19] },
      { ...bandChart, from: [4, 20], to: [12, 36] },
    ],
    tab: "1F2A33",
  });

  /* ---------- Input Points ---------- */
  const ip: Cell[][] = [
    [{ v: "Input Points", s: "title" }, { v: "", s: "title" }, { v: "", s: "title" }, { v: "", s: "title" }, { v: "", s: "title" }],
    [{ v: "Survey points as received · X = Easting, Y = Northing, Z = Elevation (m)", s: "subtitle" }],
    blank,
    [{ v: "Survey", s: "header" }, { v: "Point ID", s: "header" }, { v: "X (Easting)", s: "headerRight" }, { v: "Y (Northing)", s: "headerRight" }, { v: "Z (Elevation)", s: "headerRight" }],
  ];
  for (const p of r.dataset.excavated) ip.push([{ v: "Excavated surface", s: "text" }, { v: p.id, s: "text" }, { v: p.x, s: "coord" }, { v: p.y, s: "coord" }, { v: p.z, s: "coord" }]);
  const groundPts = r.ground.kind === "sample" ? r.dataset.ground ?? [] : r.ground.kind === "points" ? r.ground.points : [];
  for (const p of groundPts) ip.push([{ v: "Existing ground", s: "text" }, { v: p.id, s: "text" }, { v: p.x, s: "coord" }, { v: p.y, s: "coord" }, { v: p.z, s: "coord" }]);
  sheets.splice(1, 0, {
    name: "Input Points",
    cols: [20, 12, 16, 16, 14],
    rows: ip,
    merges: ["A1:E1"],
    freeze: { row: 4 },
    autoFilter: `A4:E${ip.length}`,
    tab: "8D99A6",
  });

  sheets.push(abSheet);

  /* ---------- Sections ---------- */
  const se: Cell[][] = [
    [{ v: "Sections", s: "title" }, { v: "", s: "title" }, { v: "", s: "title" }, { v: "", s: "title" }, { v: "", s: "title" }],
    [{ v: `Cross sections every ${r.check.step} m along the excavation · average end area check`, s: "subtitle" }],
    blank,
    [{ v: "Station", s: "header" }, { v: "Chainage (m)", s: "headerRight" }, { v: "Cut area (m²)", s: "headerRight" }, { v: "Fill area (m²)", s: "headerRight" }, { v: "Volume to next (m³)", s: "headerRight" }],
  ];
  const s0 = se.length;
  m.sections.forEach((st, i) => {
    const row = s0 + i + 1;
    const last = i === m.sections.length - 1;
    const next = m.sections[i + 1];
    se.push([
      { v: st.label, s: "text" },
      { v: round(st.s, 2), s: "num2" },
      { v: round(st.cutArea), s: "num2" },
      { v: round(st.fillArea), s: "num2" },
      last ? { v: "", s: "text" } : { v: round(((st.cutArea + next.cutArea) / 2) * (next.s - st.s)), s: "num2", f: `(C${row}+C${row + 1})/2*(B${row + 1}-B${row})` },
    ]);
  });
  const sTotal = se.length + 1;
  se.push([{ v: "Average end area volume", s: "totalLabel" }, { v: "", s: "totalLabel" }, { v: "", s: "totalLabel" }, { v: "", s: "totalLabel" }, { v: round(r.check.volume), s: "total2", f: `SUM(E${s0 + 1}:E${sTotal - 1})` }]);
  se.push(blank, [{ v: `PROFILE · ${m.critical.label} (largest cut area)`, s: "section" }], [{ v: "Offset (m)", s: "headerRight" }, { v: "Existing ground (m)", s: "headerRight" }, { v: "Excavated surface (m)", s: "headerRight" }, { v: "Depth (m)", s: "headerRight" }]);
  const p0 = se.length;
  const prof = m.critical.samples.filter((_, i) => i % 2 === 0);
  prof.forEach((p, i) => {
    const row = p0 + i + 1;
    se.push([{ v: round(p.h, 2), s: "num2" }, { v: round(p.eg), s: "num3" }, { v: round(p.ex), s: "num3" }, { v: round(Math.max(0, p.eg - p.ex)), s: "num3", f: `MAX(0,B${row}-C${row})` }]);
  });
  const xs = ref("Sections", 0, p0, 0, p0 + prof.length - 1);
  sheets.push({
    name: "Sections",
    cols: [16, 18, 20, 16, 20],
    rows: se,
    merges: ["A1:E1"],
    landscape: true,
    charts: [
      {
        type: "scatter",
        title: `Section profile · ${m.critical.label}`,
        xTitle: "Offset (m)",
        yTitle: "Elevation (m)",
        series: [
          { name: "Existing ground", color: "1F2A33", cat: xs, val: ref("Sections", 1, p0, 1, p0 + prof.length - 1), catCache: prof.map((p) => round(p.h, 2)), valCache: prof.map((p) => round(p.eg)) },
          { name: "Excavated surface", color: "C0392B", cat: xs, val: ref("Sections", 2, p0, 2, p0 + prof.length - 1), catCache: prof.map((p) => round(p.h, 2)), valCache: prof.map((p) => round(p.ex)), dash: false },
        ],
        from: [6, 3],
        to: [16, 24],
      },
    ],
    tab: "C0392B",
  });

  return writeWorkbook({ title: `Excavation Report · ${m.dataset}`, creator: "Alp Yesilkaya · alpyesilkaya.com", sheets });
}

export function reportFileName(r: EngineResult, date = new Date()) {
  const slug = r.dataset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `excavation-report-${slug}-${formatDate(date)}.xlsx`;
}
