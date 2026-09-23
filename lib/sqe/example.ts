/**
 * EXAMPLE PROJECT — a simplified road scheme, generated procedurally.
 * ------------------------------------------------------------------
 * Main road on a gently curving alignment, a service road, an interchange
 * and a diversion. 7 project boundaries, and work geometry that crosses
 * boundaries on purpose, so one piece of work is attributed to several
 * areas. Coordinates are metres (a local grid starting at E 3000, N 1000).
 *
 * All values are illustrative — this is demonstration data.
 */

import type { Point, Polygon } from "./geometry";
import type { Boundary, ContextLine, Project, Station, WorkItem } from "./types";

const E0 = 3000;
const N0 = 1000;
const P = (x: number, y: number): Point => [E0 + x, N0 + y];

/** Main road centreline: a gentle S-curve. */
const cl = (x: number) => 150 + 14 * Math.sin(((x - 40) / 520) * Math.PI);

/** A band along the centreline between two offsets, from x0 to x1. */
function band(x0: number, x1: number, off0: number, off1: number, step = 10): Polygon {
  const top: Point[] = [];
  const bottom: Point[] = [];
  for (let x = x0; x <= x1 + 1e-9; x += step) {
    const xx = Math.min(x, x1);
    top.push(P(xx, cl(xx) + off1));
    bottom.push(P(xx, cl(xx) + off0));
  }
  if (top[top.length - 1][0] !== E0 + x1) {
    top.push(P(x1, cl(x1) + off1));
    bottom.push(P(x1, cl(x1) + off0));
  }
  return [...bottom, ...top.reverse()];
}

function line(x0: number, x1: number, off: number, step = 10): Point[] {
  const pts: Point[] = [];
  for (let x = x0; x <= x1 + 1e-9; x += step) pts.push(P(x, cl(x) + off));
  return pts;
}

/** Diversion centreline */
const dv = (x: number) => 72 - 18 * Math.sin(((x - 60) / 270) * Math.PI);
function diversionBand(off0: number, off1: number): Polygon {
  const top: Point[] = [];
  const bottom: Point[] = [];
  for (let x = 60; x <= 330; x += 10) {
    top.push(P(x, dv(x) + off1));
    bottom.push(P(x, dv(x) + off0));
  }
  return [...bottom, ...top.reverse()];
}

const meta = (areaId: string, name: string, section: string, side: string) => ({ areaId, name, section, side });

export function exampleProject(): Project {
  const boundaries: Boundary[] = [
    { key: "B01", polygon: band(20, 200, 0, 42), meta: null, suggested: meta("A01-N", "Main Road North", "Main Road", "North") },
    { key: "B02", polygon: band(20, 200, -42, 0), meta: null, suggested: meta("A01-S", "Main Road South", "Main Road", "South") },
    { key: "B03", polygon: band(200, 380, 0, 42), meta: null, suggested: meta("A02-N", "Main Road North", "Main Road", "North") },
    { key: "B04", polygon: band(200, 380, -42, 0), meta: null, suggested: meta("A02-S", "Main Road South", "Main Road", "South") },
    { key: "B05", polygon: band(380, 470, -42, 42), meta: null, suggested: meta("A03", "Main Road East", "Main Road", "Both") },
    {
      key: "B06",
      polygon: [P(470, 102), P(545, 84), P(598, 116), P(598, 206), P(552, 236), P(470, 216)],
      meta: null,
      suggested: meta("IC01", "Interchange", "Interchange", "—"),
    },
    { key: "B07", polygon: diversionBand(-14, 14), meta: null, suggested: meta("DIV01", "Diversion", "Diversion", "—") },
  ];

  const work: WorkItem[] = [
    // Existing pavement to break out — wholly inside one area
    { code: "DEM-01", type: "DEMOLITION", geometry: { kind: "polygon", points: band(40, 170, -30, -8) } },
    // Excavation box crossing four areas (both sides of the centreline, two chainage blocks)
    { code: "EXC-01", type: "EXCAVATION", geometry: { kind: "polygon", points: band(120, 330, -22, 28) } },
    // New northbound carriageway: crosses A01-N, A02-N, A03 and runs into the interchange
    { code: "ASP-01", type: "ASPHALT", geometry: { kind: "polygon", points: band(150, 520, 2, 14) } },
    { code: "SUB-01", type: "SUBBASE", geometry: { kind: "polygon", points: band(150, 520, 0, 16) } },
    // Embankment fill for the interchange loop, partly inside A03
    {
      code: "FIL-01",
      type: "FILL",
      geometry: { kind: "polygon", points: [P(448, 176), P(512, 188), P(560, 214), P(540, 228), P(478, 214), P(440, 196)] },
    },
    // Diversion basecourse — inside the diversion area
    { code: "BAS-01", type: "BASECOURSE", geometry: { kind: "polygon", points: diversionBand(-6, 6) } },
    // Linear work
    { code: "CRB-01", type: "CURB", geometry: { kind: "polyline", points: line(150, 520, 14) } },
    {
      code: "STW-01",
      type: "STORMWATER",
      spec: "Ø600",
      geometry: { kind: "polyline", points: [...line(220, 470, 26, 25), P(505, 196), P(548, 214), P(580, 190)] },
    },
  ];

  const context: ContextLine[] = [
    { points: line(0, 600, 0, 10), style: "centre" },
    { points: line(0, 600, 16, 10), style: "edge" },
    { points: line(0, 600, -16, 10), style: "edge" },
    // Service road to the north
    { points: [P(150, 248), P(260, 252), P(420, 246)], style: "context" },
    { points: [P(150, 262), P(260, 266), P(420, 260)], style: "context" },
    // Interchange loop ramp
    {
      points: Array.from({ length: 33 }, (_, i) => {
        const a = (i / 32) * Math.PI * 2;
        return P(532 + 32 * Math.cos(a), 170 + 26 * Math.sin(a));
      }),
      style: "context",
    },
    // Diversion edges
    { points: Array.from({ length: 28 }, (_, i) => P(60 + i * 10, dv(60 + i * 10) + 7)), style: "edge" },
    { points: Array.from({ length: 28 }, (_, i) => P(60 + i * 10, dv(60 + i * 10) - 7)), style: "edge" },
  ];

  const stations: Station[] = [];
  for (let x = 0; x <= 600; x += 100) {
    const slope = (cl(x + 1) - cl(x - 1)) / 2;
    stations.push({ at: P(x, cl(x)), label: `0+${String(x).padStart(3, "0")}`, angle: Math.atan(slope) });
  }

  return { name: "Example road scheme", source: "example", boundaries, work, context, stations };
}
