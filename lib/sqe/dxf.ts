/**
 * DXF IMPORT — runs entirely in the browser; the file never leaves the device.
 * ------------------------------------------------------------------
 * Supported entities (ENTITIES section):
 *   LWPOLYLINE   closed → region, open → linear geometry
 *   POLYLINE     (2D, with VERTEX … SEQEND)
 *   LINE         lines whose endpoints join up into closed loops become regions
 * Everything else is counted and ignored — never an error.
 *
 * Layer names decide the role: a layer containing a work type name or
 * code (e.g. "ASPHALT", "C-EXC", "STORMWATER") becomes work geometry.
 * Closed regions on layers named …BOUNDARY… / …AREA… / …ZONE… become
 * project boundaries (if there are no such layers, every other closed
 * region is used).
 * DWG files are NOT supported (DWG is a closed binary format).
 */

import { absArea, type Point } from "./geometry";
import { WORK_TYPES, workTypeForLayer } from "./workTypes";
import type { Boundary, Project, WorkItem } from "./types";

export type ImportSummary = {
  regions: number;
  work: number;
  ignored: number;
  ignoredTypes: string[];
  fileName: string;
};

type Shape = { layer: string; points: Point[]; closed: boolean };

export function parseDxf(text: string, fileName: string): { project: Project | null; summary: ImportSummary; error?: string } {
  const summary: ImportSummary = { regions: 0, work: 0, ignored: 0, ignoredTypes: [], fileName };
  const pairs = toPairs(text);
  if (!pairs.length) return { project: null, summary, error: "This file doesn't look like a DXF (no group codes found)." };

  // Find the ENTITIES section
  let i = pairs.findIndex((p, k) => p.code === 0 && p.value === "SECTION" && pairs[k + 1]?.code === 2 && pairs[k + 1]?.value === "ENTITIES");
  if (i < 0) return { project: null, summary, error: "No ENTITIES section found in this DXF." };
  i += 2;

  const shapes: Shape[] = [];
  const lines: { layer: string; a: Point; b: Point }[] = [];
  const ignored = new Set<string>();

  while (i < pairs.length) {
    const p = pairs[i];
    if (p.code === 0 && p.value === "ENDSEC") break;
    if (p.code !== 0) {
      i++;
      continue;
    }
    const type = p.value;
    const start = i + 1;
    let end = start;
    while (end < pairs.length && pairs[end].code !== 0) end++;
    const body = pairs.slice(start, end);
    const layer = body.find((g) => g.code === 8)?.value ?? "0";

    if (type === "LWPOLYLINE") {
      const flags = Number(body.find((g) => g.code === 70)?.value ?? 0);
      const pts: Point[] = [];
      for (let k = 0; k < body.length; k++) {
        if (body[k].code === 10) {
          const y = body.slice(k + 1).find((g) => g.code === 20);
          pts.push([Number(body[k].value), Number(y?.value ?? 0)]);
        }
      }
      if (pts.length >= 2) shapes.push({ layer, points: pts, closed: (flags & 1) === 1 || samePoint(pts[0], pts[pts.length - 1]) });
      i = end;
    } else if (type === "POLYLINE") {
      const flags = Number(body.find((g) => g.code === 70)?.value ?? 0);
      const pts: Point[] = [];
      let k = end;
      while (k < pairs.length && !(pairs[k].code === 0 && pairs[k].value === "SEQEND")) {
        if (pairs[k].code === 0 && pairs[k].value === "VERTEX") {
          let m = k + 1;
          let x = 0;
          let y = 0;
          while (m < pairs.length && pairs[m].code !== 0) {
            if (pairs[m].code === 10) x = Number(pairs[m].value);
            if (pairs[m].code === 20) y = Number(pairs[m].value);
            m++;
          }
          pts.push([x, y]);
          k = m;
        } else k++;
      }
      if (pts.length >= 2) shapes.push({ layer, points: pts, closed: (flags & 1) === 1 || samePoint(pts[0], pts[pts.length - 1]) });
      i = k + 1;
    } else if (type === "LINE") {
      const get = (c: number) => Number(body.find((g) => g.code === c)?.value ?? NaN);
      const a: Point = [get(10), get(20)];
      const b: Point = [get(11), get(21)];
      if ([...a, ...b].every(Number.isFinite)) lines.push({ layer, a, b });
      i = end;
    } else {
      summary.ignored++;
      ignored.add(type);
      i = end;
    }
  }

  // Join LINE segments into closed loops (per layer)
  shapes.push(...chainLines(lines));

  const valid = shapes.filter((s) => s.points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
  // If the drawing has dedicated boundary layers (…BOUNDARY…, …AREA…, …ZONE…), only those define areas
  const isBoundaryLayer = (layer: string) => /BOUND|AREA|ZONE/i.test(layer);
  const hasBoundaryLayers = valid.some((s) => s.closed && isBoundaryLayer(s.layer));
  const boundaries: Boundary[] = [];
  const work: WorkItem[] = [];
  const context: { points: Point[]; style: "context" }[] = [];
  const counters: Record<string, number> = {};

  for (const s of valid) {
    const wt = workTypeForLayer(s.layer);
    const pts = s.closed && samePoint(s.points[0], s.points[s.points.length - 1]) ? s.points.slice(0, -1) : s.points;
    if (wt) {
      const t = WORK_TYPES[wt];
      if (t.measure !== "length" && !s.closed) continue; // open shape on an area/volume layer: not usable
      counters[wt] = (counters[wt] ?? 0) + 1;
      const code = `${t.code}-${String(counters[wt]).padStart(2, "0")}`;
      work.push({
        code,
        type: wt,
        geometry: t.measure === "length" ? { kind: "polyline", points: s.points } : { kind: "polygon", points: pts },
      });
    } else if (s.closed && pts.length >= 3 && absArea(pts) > 1e-6 && (!hasBoundaryLayers || isBoundaryLayer(s.layer))) {
      boundaries.push({ key: `B${String(boundaries.length + 1).padStart(2, "0")}`, polygon: pts, meta: null });
    } else {
      // Anything else is shown as reference linework only
      context.push({ points: s.points, style: "context" });
    }
  }

  summary.regions = boundaries.length;
  summary.work = work.length;
  summary.ignoredTypes = [...ignored].slice(0, 6);

  if (!boundaries.length) {
    return { project: null, summary, error: "No closed polylines found to use as project boundaries." };
  }
  return {
    project: { name: fileName.replace(/\.dxf$/i, ""), source: "dxf", boundaries, work, context, stations: [] },
    summary,
  };
}

function toPairs(text: string): { code: number; value: string }[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: { code: number; value: string }[] = [];
  for (let k = 0; k + 1 < lines.length; k += 2) {
    const code = Number(lines[k].trim());
    if (!Number.isInteger(code)) return out.length ? out : [];
    out.push({ code, value: lines[k + 1].trim() });
  }
  return out;
}

function samePoint(a: Point, b: Point, tol = 1e-6) {
  return Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol;
}

function chainLines(lines: { layer: string; a: Point; b: Point }[]): Shape[] {
  const shapes: Shape[] = [];
  const remaining = [...lines];
  const tol = 1e-4;
  while (remaining.length) {
    const first = remaining.shift()!;
    const pts: Point[] = [first.a, first.b];
    let extended = true;
    while (extended) {
      extended = false;
      for (let k = 0; k < remaining.length; k++) {
        const l = remaining[k];
        if (l.layer !== first.layer) continue;
        const tail = pts[pts.length - 1];
        if (samePoint(l.a, tail, tol)) pts.push(l.b);
        else if (samePoint(l.b, tail, tol)) pts.push(l.a);
        else continue;
        remaining.splice(k, 1);
        extended = true;
        break;
      }
    }
    const closed = pts.length > 3 && samePoint(pts[0], pts[pts.length - 1], tol);
    shapes.push({ layer: first.layer, points: pts, closed });
  }
  return shapes;
}
