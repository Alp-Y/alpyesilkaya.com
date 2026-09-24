/**
 * PROGRESS DRAWINGS — the example data for the Drawing Comparison demo.
 *
 * A simplified road scheme (synthetic) drawn in four progress updates,
 * two weeks apart. Each update is what a progress drawing would hold on
 * that date: the work recorded as done, by layer.
 *
 * Between updates the work grows, and some things are also taken out:
 *   PU-06  a kerb run drawn before it was built (taken out in PU-07,
 *          added again in PU-08 once it was installed)
 *   PU-08  a bus bay: the straight kerb is taken out and replaced,
 *          and one street light is moved clear of it
 *
 * Drawing units are metres. Chainage 0+000 is at x = 20.
 * The road: a dual carriageway with a central median, a storm drain in
 * the south verge, street lights in the north verge, and a side road.
 */

export type Kind = "asphalt" | "kerb" | "pipe" | "manhole" | "light";
export type Pt = [number, number];
export type Geom = { t: "poly"; pts: Pt[]; closed?: boolean } | { t: "sym"; at: Pt };

export type Entity = {
  /** layer + geometry: how the demo recognises the same object in two drawings */
  key: string;
  kind: Kind;
  geom: Geom;
  /** m², lm or 1 (count) */
  qty: number;
  /** where it is, in words (chainage) */
  where: string;
};

export type Update = { index: number; id: string; date: string; file: string; entities: Entity[] };

export type Unit = "m²" | "lm" | "nr";
export const ITEMS: Record<Kind, { label: string; short: string; layer: string; unit: Unit }> = {
  asphalt: { label: "Asphalt wearing course", short: "Asphalt", layer: "PRG-ASPHALT", unit: "m²" },
  kerb: { label: "Kerbs", short: "Kerbs", layer: "PRG-KERB", unit: "lm" },
  pipe: { label: "Storm drain pipe", short: "Storm pipe", layer: "PRG-STORM-PIPE", unit: "lm" },
  manhole: { label: "Manholes", short: "Manholes", layer: "PRG-STORM-MH", unit: "nr" },
  light: { label: "Street lights", short: "Lights", layer: "PRG-LIGHTING", unit: "nr" },
};
export const KINDS: Kind[] = ["asphalt", "kerb", "pipe", "manhole", "light"];

export const UPDATES_META = [
  { id: "PU-05", date: "13 Aug 2026" },
  { id: "PU-06", date: "27 Aug 2026" },
  { id: "PU-07", date: "10 Sep 2026" },
  { id: "PU-08", date: "24 Sep 2026" },
];

/* ---------- geometry ---------- */

export function length(pts: Pt[]) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}
export function area(pts: Pt[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/* ---------- the scheme ---------- */

const X0 = 20; // chainage 0+000
const SEG = 40;
// dual carriageway, y (m): south kerb | carriageway | median | carriageway | north kerb
const S_EDGE = 86;
const MED_S = 97;
const MED_N = 101;
const N_EDGE = 112;
const MED_CL = (MED_S + MED_N) / 2;
const JX0 = 262; // side road, west edge
const JX1 = 273; // side road, east edge
const SIDE_SEG = 25;
const PIPE_Y = 80;
const LIGHT_Y = 118;

/** the drawing's extents (y), for the sheet */
export const EXTENT = { minY: 70, maxY: 166 };

export const REFERENCE = {
  centreline: [
    [X0, MED_CL],
    [X0 + SEG * 10, MED_CL],
  ] as Pt[],
  sideCentreline: [
    [(JX0 + JX1) / 2, N_EDGE],
    [(JX0 + JX1) / 2, N_EDGE + 2 * SIDE_SEG],
  ] as Pt[],
  chainageY: MED_CL,
  labelY: 73,
  chainages: Array.from({ length: 11 }, (_, i) => ({ x: X0 + i * SEG, label: ch(X0 + i * SEG) })),
};

function ch(x: number) {
  const m = Math.round(x - X0);
  return `${Math.floor(m / 1000)}+${String(m % 1000).padStart(3, "0")}`;
}
const span = (x0: number, x1: number) => `Ch ${ch(x0)}–${ch(x1)}`;

type Planned = Entity & { from: number; until?: number };

function keyOf(kind: Kind, g: Geom) {
  const r = (v: number) => v.toFixed(2);
  const body = g.t === "poly" ? g.pts.map(([x, y]) => `${r(x)},${r(y)}`).join(";") : `${r(g.at[0])},${r(g.at[1])}`;
  return `${ITEMS[kind].layer}|${body}`;
}

function build(): Planned[] {
  const out: Planned[] = [];
  const add = (kind: Kind, geom: Geom, from: number, where: string, until?: number) => {
    if (from < 0) return;
    const qty = kind === "asphalt" && geom.t === "poly" ? area(geom.pts) : geom.t === "poly" ? length(geom.pts) : 1;
    out.push({ key: keyOf(kind, geom), kind, geom, qty, where, from, until });
  };
  const line = (x0: number, y0: number, x1: number, y1: number): Geom => ({
    t: "poly",
    pts: [
      [x0, y0],
      [x1, y1],
    ],
  });
  const rect = (x0: number, y0: number, x1: number, y1: number): Geom => ({
    t: "poly",
    closed: true,
    pts: [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
  });

  // the update each piece first appears in (-1 = not built yet, -2 = handled below)
  const asphaltSouth = [1, 1, 2, 2, 2, 3, 3, 3, -1, -1];
  const asphaltNorth = [1, 2, 2, 2, 3, 3, 3, -1, -1, -1];
  const kerbSouth = [0, 0, 1, 1, 1, 2, 2, 3, 3, 3];
  const kerbMedS = [0, 0, 1, 1, 2, 2, 3, 3, 3, -1];
  const kerbMedN = [0, 1, 1, 1, 2, 2, 3, 3, -1, -1];
  const kerbNorth = [0, 1, 1, -2, 2, -2, 3, 3, 3, -1];
  const pipeFrom = [0, 0, 0, 0, 1, 1, 1, 2, 2, 3];
  const lightFrom = [1, 1, 1, 2, 2, 2, 3, 3, 3, -1];

  for (let i = 0; i < 10; i++) {
    const x0 = X0 + i * SEG;
    const x1 = x0 + SEG;
    add("asphalt", rect(x0, S_EDGE, x1, MED_S), asphaltSouth[i], `Southbound carriageway, ${span(x0, x1)}`);
    add("asphalt", rect(x0, MED_N, x1, N_EDGE), asphaltNorth[i], `Northbound carriageway, ${span(x0, x1)}`);
    add("kerb", line(x0, S_EDGE, x1, S_EDGE), kerbSouth[i], `South kerb, ${span(x0, x1)}`);
    add("kerb", line(x0, MED_S, x1, MED_S), kerbMedS[i], `Median kerb (south), ${span(x0, x1)}`);
    add("kerb", line(x0, MED_N, x1, MED_N), kerbMedN[i], `Median kerb (north), ${span(x0, x1)}`);
    if (kerbNorth[i] >= 0) {
      // the side road opens the north kerb between JX0 and JX1
      const a = x0 < JX1 && x1 > JX0 ? JX1 : x0;
      if (x0 < JX0 && x1 > JX0) add("kerb", line(x0, N_EDGE, JX0, N_EDGE), kerbNorth[i], `North kerb, ${span(x0, JX0)}`);
      add("kerb", line(a, N_EDGE, x1, N_EDGE), kerbNorth[i], `North kerb, ${span(a, x1)}`);
    }
    add("pipe", line(x0, PIPE_Y, x1, PIPE_Y), pipeFrom[i], `Storm drain, MH${String(i + 1).padStart(2, "0")}–MH${String(i + 2).padStart(2, "0")}`);
  }
  // manholes: built with the pipe that reaches them
  for (let j = 0; j <= 10; j++) {
    const from = Math.min(j > 0 ? pipeFrom[j - 1] : 99, j < 10 ? pipeFrom[j] : 99);
    add("manhole", { t: "sym", at: [X0 + j * SEG, PIPE_Y] }, from, `MH${String(j + 1).padStart(2, "0")}, Ch ${ch(X0 + j * SEG)}`);
  }
  // street lights (north verge)
  for (let k = 0; k < 10; k++) {
    const x = 40 + k * SEG;
    add("light", { t: "sym", at: [x, LIGHT_Y] }, lightFrom[k], `SL${String(k + 1).padStart(2, "0")}, Ch ${ch(x)}`, k === 3 ? 3 : undefined);
  }

  // north kerb 0+120–0+160: straight until PU-08, then a bus bay replaces it
  add("kerb", line(140, N_EDGE, 180, N_EDGE), 1, `North kerb, ${span(140, 180)}`, 3);
  const bay: Pt[] = [
    [140, N_EDGE],
    [148, N_EDGE + 3.5],
    [172, N_EDGE + 3.5],
    [180, N_EDGE],
  ];
  add("kerb", { t: "poly", pts: bay }, 3, `Bus bay kerb, ${span(140, 180)}`);
  add("asphalt", { t: "poly", pts: bay, closed: true }, 3, `Bus bay, ${span(140, 180)}`);
  add("light", { t: "sym", at: [188, LIGHT_Y] }, 3, `SL04, moved clear of the bus bay, Ch ${ch(188)}`);

  // north kerb 0+200–0+240: drawn in PU-06 before it was built, taken out in PU-07, back in PU-08
  add("kerb", line(220, N_EDGE, 260, N_EDGE), 1, `North kerb, ${span(220, 260)}`, 2);
  add("kerb", line(220, N_EDGE, 260, N_EDGE), 3, `North kerb, ${span(220, 260)}`);

  // side road (first 50 m)
  for (let s = 0; s < 2; s++) {
    const y0 = N_EDGE + s * SIDE_SEG;
    const y1 = y0 + SIDE_SEG;
    const where = `Side road, ${s === 0 ? "0+000–0+025" : "0+025–0+050"}`;
    add("kerb", line(JX0, y0, JX0, y1), s === 0 ? 2 : 3, `${where}, west kerb`);
    add("kerb", line(JX1, y0, JX1, y1), s === 0 ? 2 : 3, `${where}, east kerb`);
    if (s === 0) add("asphalt", rect(JX0, y0, JX1, y1), 3, where);
  }

  return out;
}

let cache: Update[] | null = null;

/** The four progress drawings, oldest first. */
export function getUpdates(): Update[] {
  if (cache) return cache;
  const planned = build();
  cache = UPDATES_META.map((m, index) => ({
    index,
    id: m.id,
    date: m.date,
    file: `Progress_${m.id}.dwg`,
    entities: planned
      .filter((p) => p.from >= 0 && p.from <= index && (p.until === undefined || index < p.until))
      .map(({ key, kind, geom, qty, where }) => ({ key, kind, geom, qty, where })),
  }));
  return cache;
}
