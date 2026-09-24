/**
 * XLSX WORKBOOK WRITER — a small, dependency-free Office Open XML writer.
 * ------------------------------------------------------------------
 * Supports what an engineering report needs and nothing more:
 *   sheets · text / numbers / formulas (with cached values) · a fixed set
 *   of cell styles · column widths · merged cells · frozen panes ·
 *   auto-filter · native Excel charts (column and XY-scatter).
 * Runs in the browser (Export Results) and at build time (the example
 * report), so both produce identical files.
 */

import { zip } from "./zip";

export type StyleName =
  | "default"
  | "title"
  | "subtitle"
  | "label"
  | "value"
  | "header"
  | "headerRight"
  | "text"
  | "int"
  | "num2"
  | "num3"
  | "pct"
  | "totalLabel"
  | "total2"
  | "totalPct"
  | "kpiLabel"
  | "kpi"
  | "coord"
  | "note"
  | "section";

export type Cell = { v: string | number; s?: StyleName; f?: string } | string | number | null | undefined;

export type ChartSeries = {
  name: string;
  color: string; // hex, no #
  /** category labels (column chart) or X values (scatter): sheet range, e.g. "'Area Breakdown'!$A$6:$A$9" */
  cat: string;
  val: string;
  catCache: (string | number)[];
  valCache: number[];
  /** scatter only: line dash */
  dash?: boolean;
};

export type Chart = {
  type: "column" | "scatter";
  title: string;
  xTitle?: string;
  yTitle?: string;
  yFormat?: string;
  series: ChartSeries[];
  /** top-left and bottom-right cell (0-based col, row) */
  from: [number, number];
  to: [number, number];
};

export type Sheet = {
  name: string;
  rows: Cell[][];
  cols?: number[];
  merges?: string[];
  freeze?: { row: number; col?: number };
  autoFilter?: string;
  charts?: Chart[];
  /** landscape A4 for printing */
  landscape?: boolean;
  tab?: string;
};

export type Workbook = { title: string; creator: string; sheets: Sheet[] };

/* ---------------- styles ---------------- */

const INK = "1F2A33";
const MUTED = "5F6B76";
const ACCENT = "1E7A4E";
const RULE = "BFC7CE";
const FILL = "EEF1F3";

const FONTS = [
  `<font><sz val="10"/><color rgb="FF${INK}"/><name val="Arial"/><family val="2"/></font>`, // 0 body
  `<font><b/><sz val="16"/><color rgb="FF${INK}"/><name val="Arial"/><family val="2"/></font>`, // 1 title
  `<font><sz val="10"/><color rgb="FF${MUTED}"/><name val="Arial"/><family val="2"/></font>`, // 2 muted
  `<font><b/><sz val="10"/><color rgb="FF${INK}"/><name val="Arial"/><family val="2"/></font>`, // 3 bold
  `<font><b/><sz val="18"/><color rgb="FF${INK}"/><name val="Arial"/><family val="2"/></font>`, // 4 kpi
  `<font><i/><sz val="9"/><color rgb="FF${MUTED}"/><name val="Arial"/><family val="2"/></font>`, // 5 note
  `<font><b/><sz val="9"/><color rgb="FF${ACCENT}"/><name val="Arial"/><family val="2"/></font>`, // 6 section
  `<font><b/><sz val="9"/><color rgb="FF${MUTED}"/><name val="Arial"/><family val="2"/></font>`, // 7 header
];
const FILLS = [`<fill><patternFill patternType="none"/></fill>`, `<fill><patternFill patternType="gray125"/></fill>`, `<fill><patternFill patternType="solid"><fgColor rgb="FF${FILL}"/><bgColor indexed="64"/></patternFill></fill>`];
const BORDERS = [
  `<border><left/><right/><top/><bottom/><diagonal/></border>`,
  `<border><left/><right/><top/><bottom style="thin"><color rgb="FF${RULE}"/></bottom><diagonal/></border>`, // 1 hairline under
  `<border><left/><right/><top style="thin"><color rgb="FF${INK}"/></top><bottom style="thin"><color rgb="FF${INK}"/></bottom><diagonal/></border>`, // 2 total
  `<border><left/><right/><top/><bottom style="medium"><color rgb="FF${ACCENT}"/></bottom><diagonal/></border>`, // 3 title rule
];
const NUMFMTS: [number, string][] = [
  [164, "#,##0.00"],
  [165, "#,##0.000"],
  [166, "0.0%"],
  [167, "#,##0"],
  [168, "0.000"],
  [169, '#,##0.00" m³"'],
];

/** xf: [numFmtId, fontId, fillId, borderId, align?] */
const XF: Record<StyleName, [number, number, number, number, string?]> = {
  default: [0, 0, 0, 0],
  title: [0, 1, 0, 3],
  subtitle: [0, 2, 0, 0],
  label: [0, 2, 0, 1],
  value: [0, 0, 0, 1],
  header: [0, 7, 2, 1],
  headerRight: [0, 7, 2, 1, `<alignment horizontal="right"/>`],
  text: [0, 0, 0, 1],
  int: [167, 0, 0, 1],
  num2: [164, 0, 0, 1],
  num3: [165, 0, 0, 1],
  pct: [166, 0, 0, 1],
  totalLabel: [0, 3, 0, 2],
  total2: [164, 3, 0, 2],
  totalPct: [166, 3, 0, 2],
  kpiLabel: [0, 7, 0, 0],
  kpi: [169, 4, 0, 0, `<alignment horizontal="left"/>`],
  coord: [168, 0, 0, 1],
  note: [0, 5, 0, 0, `<alignment wrapText="1" vertical="top"/>`],
  section: [0, 6, 0, 0],
};
const STYLE_ORDER = Object.keys(XF) as StyleName[];
const styleIndex = (s: StyleName) => STYLE_ORDER.indexOf(s);

function stylesXml() {
  const xfs = STYLE_ORDER.map((k) => {
    const [numFmt, font, fill, border, align] = XF[k];
    const attrs = `numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"${numFmt ? ' applyNumberFormat="1"' : ""} applyFont="1"${fill ? ' applyFill="1"' : ""}${border ? ' applyBorder="1"' : ""}${align ? ' applyAlignment="1"' : ""}`;
    return align ? `<xf ${attrs}>${align}</xf>` : `<xf ${attrs}/>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="${NUMFMTS.length}">${NUMFMTS.map(([id, code]) => `<numFmt numFmtId="${id}" formatCode="${esc(code)}"/>`).join("")}</numFmts>
<fonts count="${FONTS.length}">${FONTS.join("")}</fonts>
<fills count="${FILLS.length}">${FILLS.join("")}</fills>
<borders count="${BORDERS.length}">${BORDERS.join("")}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

/* ---------------- helpers ---------------- */

export function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 0 → A, 27 → AB */
export function colName(i: number) {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Absolute range on a sheet, e.g. ref("Summary", 1, 5, 1, 9) → 'Summary'!$B$6:$B$10 */
export function ref(sheet: string, c0: number, r0: number, c1 = c0, r1 = r0) {
  return `'${sheet.replace(/'/g, "''")}'!$${colName(c0)}$${r0 + 1}:$${colName(c1)}$${r1 + 1}`;
}

const cellRef = (c: number, r: number) => `${colName(c)}${r + 1}`;

function cellXml(cell: Cell, c: number, r: number) {
  if (cell === null || cell === undefined || cell === "") return "";
  const o = typeof cell === "object" ? cell : { v: cell };
  const s = o.s ? ` s="${styleIndex(o.s)}"` : typeof o.v === "number" ? ` s="${styleIndex("num2")}"` : "";
  const at = cellRef(c, r);
  if (o.f) {
    const cached = typeof o.v === "number" && Number.isFinite(o.v) ? `<v>${o.v}</v>` : "";
    return `<c r="${at}"${s}><f>${esc(o.f)}</f>${cached}</c>`;
  }
  if (typeof o.v === "number") return Number.isFinite(o.v) ? `<c r="${at}"${s}><v>${o.v}</v></c>` : "";
  return `<c r="${at}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(o.v)}</t></is></c>`;
}

function sheetXml(sheet: Sheet, hasDrawing: boolean) {
  const rows = sheet.rows
    .map((row, r) => {
      if (!row || !row.length) return "";
      const cells = row.map((cell, c) => cellXml(cell, c, r)).join("");
      return cells ? `<row r="${r + 1}">${cells}</row>` : "";
    })
    .join("");
  const cols = sheet.cols?.length ? `<cols>${sheet.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
  const f = sheet.freeze;
  const pane = f
    ? `<pane${f.col ? ` xSplit="${f.col}"` : ""} ySplit="${f.row}" topLeftCell="${cellRef(f.col ?? 0, f.row)}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="${cellRef(f.col ?? 0, f.row)}" sqref="${cellRef(f.col ?? 0, f.row)}"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${sheet.tab ? `<sheetPr><tabColor rgb="FF${sheet.tab}"/><pageSetUpPr fitToPage="1"/></sheetPr>` : `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`}
<sheetViews><sheetView workbookViewId="0" showGridLines="0">${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${cols}
<sheetData>${rows}</sheetData>
${sheet.autoFilter ? `<autoFilter ref="${sheet.autoFilter}"/>` : ""}
${sheet.merges?.length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : ""}
<pageMargins left="0.6" right="0.6" top="0.7" bottom="0.7" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="${sheet.landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/>
${hasDrawing ? `<drawing r:id="rId1"/>` : ""}
</worksheet>`;
}

/* ---------------- charts ---------------- */

const A = `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"`;

function rich(text: string, size: number, bold: boolean) {
  return `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="${bold ? 1 : 0}"/></a:pPr><a:r><a:rPr lang="en-GB" sz="${size}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${INK}"/></a:solidFill></a:rPr><a:t>${esc(text)}</a:t></a:r></a:p></c:rich></c:tx>`;
}
const axisTitle = (t?: string) => (t ? `<c:title>${rich(t, 900, false)}<c:overlay val="0"/></c:title>` : "");
const txPr = `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"><a:solidFill><a:srgbClr val="${MUTED}"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="en-GB"/></a:p></c:txPr>`;
const axisLine = `<c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="${RULE}"/></a:solidFill></a:ln></c:spPr>`;
const grid = `<c:majorGridlines><c:spPr><a:ln w="3175"><a:solidFill><a:srgbClr val="E3E7EA"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>`;

function strCache(values: (string | number)[]) {
  return `<c:ptCount val="${values.length}"/>${values.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(String(v))}</c:v></c:pt>`).join("")}`;
}
function numCache(values: (string | number)[], fmt = "General") {
  return `<c:formatCode>${esc(fmt)}</c:formatCode><c:ptCount val="${values.length}"/>${values.map((v, i) => `<c:pt idx="${i}"><c:v>${Number(v)}</c:v></c:pt>`).join("")}`;
}

function chartXml(ch: Chart) {
  const series = ch.series
    .map((s, i) => {
      const tx = `<c:tx><c:v>${esc(s.name)}</c:v></c:tx>`;
      if (ch.type === "column") {
        return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}<c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/><c:dLbls><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr}<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls><c:cat><c:strRef><c:f>${esc(s.cat)}</c:f><c:strCache>${strCache(s.catCache)}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>${esc(s.val)}</c:f><c:numCache>${numCache(s.valCache)}</c:numCache></c:numRef></c:val></c:ser>`;
      }
      const ln = `<a:ln w="19050" cap="rnd"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill>${s.dash ? `<a:prstDash val="dash"/>` : ""}<a:round/></a:ln>`;
      return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}<c:spPr>${ln}</c:spPr><c:marker><c:symbol val="none"/></c:marker><c:xVal><c:numRef><c:f>${esc(s.cat)}</c:f><c:numCache>${numCache(s.catCache)}</c:numCache></c:numRef></c:xVal><c:yVal><c:numRef><c:f>${esc(s.val)}</c:f><c:numCache>${numCache(s.valCache)}</c:numCache></c:numRef></c:yVal><c:smooth val="0"/></c:ser>`;
    })
    .join("");
  const legend = ch.series.length > 1 ? `<c:legend><c:legendPos val="b"/><c:overlay val="0"/>${txPr}</c:legend>` : "";
  let plot: string;
  if (ch.type === "column") {
    plot = `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}<c:gapWidth val="70"/><c:axId val="5001"/><c:axId val="5002"/></c:barChart>
<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>${axisTitle(ch.xTitle)}<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${axisLine}${txPr}<c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>
<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="l"/>${grid}${axisTitle(ch.yTitle)}<c:numFmt formatCode="${esc(ch.yFormat ?? "#,##0")}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txPr}<c:crossAx val="5001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  } else {
    const ys = ch.series.flatMap((s) => s.valCache);
    const yMin = Math.floor(Math.min(...ys) - 0.5);
    const yMax = Math.ceil(Math.max(...ys) + 0.5);
    const xs = ch.series.flatMap((s) => s.catCache.map(Number));
    plot = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${series}<c:axId val="6001"/><c:axId val="6002"/></c:scatterChart>
<c:valAx><c:axId val="6001"/><c:scaling><c:orientation val="minMax"/><c:max val="${Math.ceil(Math.max(...xs))}"/><c:min val="${Math.floor(Math.min(...xs))}"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>${axisTitle(ch.xTitle)}<c:numFmt formatCode="0" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/>${axisLine}${txPr}<c:crossAx val="6002"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>
<c:valAx><c:axId val="6002"/><c:scaling><c:orientation val="minMax"/><c:max val="${yMax}"/><c:min val="${yMin}"/></c:scaling><c:delete val="0"/><c:axPos val="l"/>${grid}${axisTitle(ch.yTitle)}<c:numFmt formatCode="${esc(ch.yFormat ?? "0.0")}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txPr}<c:crossAx val="6001"/><c:crosses val="min"/><c:crossBetween val="midCat"/></c:valAx>`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ${A} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<c:roundedCorners val="0"/>
<c:chart><c:title>${rich(ch.title, 1000, true)}<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>
<c:plotArea><c:layout/>${plot}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>
${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>
<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="6350"><a:solidFill><a:srgbClr val="${RULE}"/></a:solidFill></a:ln></c:spPr>
</c:chartSpace>`;
}

function drawingXml(charts: Chart[], firstRid: number) {
  const anchors = charts
    .map(
      (ch, i) => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${ch.from[0]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${ch.from[1]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${ch.to[0]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${ch.to[1]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${firstRid + i}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ${A}>${anchors}</xdr:wsDr>`;
}

/* ---------------- package ---------------- */

const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export function writeWorkbook(wb: Workbook): Promise<Uint8Array> {
  const files: { name: string; data: string }[] = [];
  const overrides: string[] = [];
  let chartNo = 0;
  let drawingNo = 0;

  wb.sheets.forEach((sheet, i) => {
    const n = i + 1;
    const charts = sheet.charts ?? [];
    files.push({ name: `xl/worksheets/sheet${n}.xml`, data: sheetXml(sheet, charts.length > 0) });
    overrides.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    if (!charts.length) return;
    drawingNo++;
    files.push({ name: `xl/worksheets/_rels/sheet${n}.xml.rels`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/drawing" Target="../drawings/drawing${drawingNo}.xml"/></Relationships>` });
    files.push({ name: `xl/drawings/drawing${drawingNo}.xml`, data: drawingXml(charts, 1) });
    overrides.push(`<Override PartName="/xl/drawings/drawing${drawingNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
    const rels: string[] = [];
    charts.forEach((ch, k) => {
      chartNo++;
      files.push({ name: `xl/charts/chart${chartNo}.xml`, data: chartXml(ch) });
      overrides.push(`<Override PartName="/xl/charts/chart${chartNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
      rels.push(`<Relationship Id="rId${k + 1}" Type="${REL}/chart" Target="../charts/chart${chartNo}.xml"/>`);
    });
    files.push({ name: `xl/drawings/_rels/drawing${drawingNo}.xml.rels`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>` });
  });

  const sheetsXml = wb.sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("");
  // Print titles / filters need defined names only for autoFilter
  const names = wb.sheets
    .map((s, i) => (s.autoFilter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(s.name.replace(/'/g, "''"))}'!$${s.autoFilter.replace(":", ":$").replace(/([A-Z]+)(\d+)/g, "$1$$$2")}</definedName>` : ""))
    .join("");
  files.push({
    name: "xl/workbook.xml",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="16000" activeTab="0"/></bookViews><sheets>${sheetsXml}</sheets>${names ? `<definedNames>${names}</definedNames>` : ""}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
  });
  files.push({
    name: "xl/_rels/workbook.xml.rels",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wb.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${wb.sheets.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
  });
  files.push({ name: "xl/styles.xml", data: stylesXml() });
  files.push({
    name: "docProps/core.xml",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(wb.title)}</dc:title><dc:creator>${esc(wb.creator)}</dc:creator></cp:coreProperties>`,
  });
  files.push({
    name: "docProps/app.xml",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>alpyesilkaya.com</Application></Properties>`,
  });
  files.push({
    name: "_rels/.rels",
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  });
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${overrides.join("")}</Types>`;
  // [Content_Types].xml must be first in the archive
  return zip([{ name: "[Content_Types].xml", data: contentTypes }, ...files]);
}
