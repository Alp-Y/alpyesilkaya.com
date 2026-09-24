/**
 * XYZ SURVEY FILE READER — text / CSV → validated survey points.
 * ------------------------------------------------------------------
 * Accepts the plain formats survey software exports:
 *
 *   X,Y,Z                      512438.214,2761843.552,648.214
 *   POINT_ID,X,Y,Z             P001,512438.214,2761843.552,648.214
 *   tab, semicolon or space separated, with or without a header row
 *
 * X = Easting, Y = Northing, Z = Elevation (metres).
 *
 * Every row is checked; problems are counted and a few examples kept so
 * the interface can explain exactly what was skipped and why. Nothing is
 * sent anywhere: this runs in the browser.
 */

export type XyzPoint = { id: string; x: number; y: number; z: number };

export type XyzIssueKind = "malformed" | "missing-xy" | "missing-z" | "duplicate" | "conflict";

export type XyzIssue = { line: number; kind: XyzIssueKind; text: string };

export type XyzResult = {
  points: XyzPoint[];
  /** Header row that was recognised and skipped (null if none). */
  header: string | null;
  /** Column order found: which field holds the id / x / y / z. */
  columns: { id: number | null; x: number; y: number; z: number };
  counts: Record<XyzIssueKind, number> & { rows: number; accepted: number };
  /** Up to MAX_EXAMPLES issues, in file order, for the message shown to the visitor. */
  examples: XyzIssue[];
  /** A fatal problem: nothing usable could be read. */
  error: string | null;
};

/** Hard limit for the in-browser demo (triangulation time grows with the point count). */
export const MAX_POINTS = 5000;
const MAX_EXAMPLES = 6;
/** Two points closer than this in plan are the same position (1 mm). */
const SAME_XY = 0.001;

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

function split(line: string): string[] {
  const t = line.trim();
  if (t.includes(",")) return t.split(",").map((s) => s.trim());
  if (t.includes(";")) return t.split(";").map((s) => s.trim());
  if (t.includes("\t")) return t.split("\t").map((s) => s.trim());
  return t.split(/\s+/);
}

const isNum = (s: string | undefined) => s !== undefined && NUMBER.test(s);

/** Map header names to columns: X/E/EASTING, Y/N/NORTHING, Z/H/ELEV…, ID/PT/NAME… */
function columnsFromHeader(cells: string[]) {
  const find = (names: RegExp) => cells.findIndex((c) => names.test(c.trim().toLowerCase().replace(/["']/g, "")));
  const x = find(/^(x|e|east|easting|x_coord|x\s*\(m\))$/);
  const y = find(/^(y|n|north|northing|y_coord|y\s*\(m\))$/);
  const z = find(/^(z|h|elev|elevation|level|height|rl|z\s*\(m\))$/);
  const id = find(/^(id|pt|pnt|point|point_id|pointid|name|no|number|pt_id)$/);
  if (x < 0 || y < 0 || z < 0) return null;
  return { id: id >= 0 ? id : null, x, y, z };
}

export function parseXyz(text: string): XyzResult {
  const counts = { rows: 0, accepted: 0, malformed: 0, "missing-xy": 0, "missing-z": 0, duplicate: 0, conflict: 0 };
  const examples: XyzIssue[] = [];
  const points: XyzPoint[] = [];
  const note = (line: number, kind: XyzIssueKind, text: string) => {
    counts[kind]++;
    if (examples.length < MAX_EXAMPLES) examples.push({ line, kind, text });
  };
  const result = (error: string | null, header: string | null, columns: XyzResult["columns"]): XyzResult => ({
    points,
    header,
    columns,
    counts,
    examples,
    error,
  });

  const lines = text.replace(/^﻿/, "").split(/\r\n|\n|\r/);
  let columns: XyzResult["columns"] | null = null;
  let header: string | null = null;

  // ---- find the first real row: a header, or data that tells us the layout ----
  let start = 0;
  for (; start < lines.length; start++) {
    const t = lines[start].trim();
    if (!t || t.startsWith("#") || t.startsWith("//")) continue;
    const cells = split(t);
    const numeric = cells.filter(isNum).length;
    if (numeric < 2) {
      // text row → header?
      const fromHeader = columnsFromHeader(cells);
      if (fromHeader) {
        columns = fromHeader;
        header = t;
        start++;
      }
      break;
    }
    break;
  }
  if (!columns) {
    // No header: infer from the first data row. 4+ cells with a non-numeric
    // first cell → ID,X,Y,Z ; otherwise X,Y,Z (or ID,X,Y,Z if 4 numbers).
    const first = lines.slice(start).find((l) => l.trim() && !l.trim().startsWith("#"));
    if (!first) return result("The file is empty.", null, { id: null, x: 0, y: 1, z: 2 });
    const cells = split(first);
    // ID first when it is text (P001) or a small whole number (a point number);
    // real-world eastings are large, so "512438.214,…" is read as X,Y,Z.
    const idFirst = cells.length >= 4 && isNum(cells[1]) && isNum(cells[2]) && isNum(cells[3]) && (!isNum(cells[0]) || (/^\d+$/.test(cells[0]) && Number(cells[0]) < 100000));
    columns = idFirst ? { id: 0, x: 1, y: 2, z: 3 } : { id: null, x: 0, y: 1, z: 2 };
    if (cells.length < 3 && cells.filter(isNum).length < 3) {
      return result("Couldn’t find X, Y and Z columns. Use one point per line: X,Y,Z (easting, northing, elevation).", null, columns);
    }
  }

  // ---- read the rows ----
  const seen = new Map<string, number>(); // plan position (mm grid) → index in points
  const key = (x: number, y: number) => `${Math.round(x / SAME_XY)},${Math.round(y / SAME_XY)}`;
  for (let i = start; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t || t.startsWith("#") || t.startsWith("//")) continue;
    counts.rows++;
    const line = i + 1;
    const cells = split(t);
    const cx = cells[columns.x];
    const cy = cells[columns.y];
    const cz = cells[columns.z];
    if (cells.every((c) => !isNum(c))) {
      note(line, "malformed", t);
      continue;
    }
    if (!isNum(cx) || !isNum(cy)) {
      note(line, cx === undefined || cy === undefined || cx === "" || cy === "" ? "missing-xy" : "malformed", t);
      continue;
    }
    if (!isNum(cz)) {
      note(line, cz === undefined || cz === "" ? "missing-z" : "malformed", t);
      continue;
    }
    const x = Number(cx);
    const y = Number(cy);
    const z = Number(cz);
    if (![x, y, z].every(Number.isFinite)) {
      note(line, "malformed", t);
      continue;
    }
    const k = key(x, y);
    const prev = seen.get(k);
    if (prev !== undefined) {
      // Same position twice: identical → ignored; different level → first kept, flagged
      note(line, Math.abs(points[prev].z - z) > 0.0005 ? "conflict" : "duplicate", t);
      continue;
    }
    if (points.length >= MAX_POINTS) {
      return result(
        `This demo triangulates up to ${MAX_POINTS.toLocaleString("en-GB")} points in the browser. Your file has more: thin it out, or send it to me for the full tool.`,
        header,
        columns,
      );
    }
    const id = (columns.id !== null ? cells[columns.id] : "") || `P${String(points.length + 1).padStart(3, "0")}`;
    seen.set(k, points.length);
    points.push({ id, x, y, z });
    counts.accepted++;
  }

  if (points.length < 3) {
    return result(
      counts.rows === 0
        ? "No data rows found. Use one point per line: X,Y,Z (easting, northing, elevation)."
        : `Only ${points.length} valid point${points.length === 1 ? "" : "s"}: a surface needs at least 3.`,
      header,
      columns,
    );
  }
  // All points on one line (or nearly): no area to triangulate
  if (collinear(points)) return result("The points lie on a single line, so they don’t describe a surface.", header, columns);

  return result(null, header, columns);
}

function collinear(pts: XyzPoint[]) {
  const a = pts[0];
  let far = pts[1];
  for (const p of pts) if (Math.hypot(p.x - a.x, p.y - a.y) > Math.hypot(far.x - a.x, far.y - a.y)) far = p;
  const L = Math.hypot(far.x - a.x, far.y - a.y);
  if (L === 0) return true;
  let maxOff = 0;
  for (const p of pts) maxOff = Math.max(maxOff, Math.abs((far.x - a.x) * (p.y - a.y) - (far.y - a.y) * (p.x - a.x)) / L);
  return maxOff < Math.max(0.01, L * 0.001);
}

/** Human summary of what was skipped, e.g. "2 malformed rows, 1 duplicate point skipped". */
export function describeIssues(r: XyzResult): string | null {
  const parts: string[] = [];
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  if (r.counts.malformed) parts.push(plural(r.counts.malformed, "malformed row"));
  if (r.counts["missing-xy"]) parts.push(plural(r.counts["missing-xy"], "row without X/Y", "rows without X/Y"));
  if (r.counts["missing-z"]) parts.push(plural(r.counts["missing-z"], "row without an elevation", "rows without an elevation"));
  if (r.counts.duplicate) parts.push(plural(r.counts.duplicate, "duplicate point"));
  if (r.counts.conflict) parts.push(plural(r.counts.conflict, "repeated position with a different level", "repeated positions with a different level"));
  return parts.length ? `${parts.join(", ")} skipped.` : null;
}

export const ISSUE_LABEL: Record<XyzIssueKind, string> = {
  malformed: "Not a number",
  "missing-xy": "Missing X or Y",
  "missing-z": "Missing elevation",
  duplicate: "Duplicate point",
  conflict: "Same X,Y, different Z (first kept)",
};

/** The template offered for download. */
export const XYZ_TEMPLATE = `X,Y,Z
512438.214,2761843.552,648.214
512442.781,2761846.128,647.936
512447.106,2761848.923,647.521
512451.622,2761852.347,646.884
`;
