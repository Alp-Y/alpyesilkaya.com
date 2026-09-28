/**
 * CAD TERMINAL — the example drawing for the demonstration.
 *
 * A simplified road drawing (synthetic), the way drawings usually arrive:
 * plain linework on layer 0, points, two TIN surfaces and a set of survey
 * points with their levels written next to them. Nothing in it knows what
 * it is. CAD Terminal is where you tell it, once:
 *
 *   lines        → kerbs, storm pipes
 *   dots         → manholes, street lights
 *   TIN surfaces → asphalt surface, demolition surface
 *   points + levels → excavation surface
 *
 * Each identified object becomes a project structure with an ID, a zone,
 * a chainage, a status and a quantity. That information is kept with the
 * drawing, so the browser, the search and the export can all use it.
 *
 * Drawing units are metres. Chainage 0+000 is at x = 20.
 * No UI code here: the tool page and the homepage preview both read it.
 */

export type Pt = [number, number];
export type Shape = "line" | "dot" | "tin" | "points";
export type ClassId = "kerb" | "pipe" | "manhole" | "light" | "asphalt" | "demolition" | "excavation";
export type Status = "Proposed" | "In progress" | "Built";
export type Zone = "Zone A" | "Zone B";
export type Unit = "m" | "m²" | "nr";

export const STATUSES: Status[] = ["Proposed", "In progress", "Built"];
export const ZONES: Zone[] = ["Zone A", "Zone B"];

export const CLASSES: Record<ClassId, { label: string; plural: string; prefix: string; shape: Shape; color: string; unit: Unit; pkg: string }> = {
  kerb: { label: "Kerb", plural: "Kerbs", prefix: "K", shape: "line", color: "#7aa8e6", unit: "m", pkg: "Roadworks" },
  pipe: { label: "Storm pipe", plural: "Storm pipes", prefix: "SP", shape: "line", color: "#6fc9c9", unit: "m", pkg: "Storm drainage" },
  manhole: { label: "Manhole", plural: "Manholes", prefix: "MH", shape: "dot", color: "#9fd07a", unit: "nr", pkg: "Storm drainage" },
  light: { label: "Street light", plural: "Street lights", prefix: "SL", shape: "dot", color: "#e8dd8a", unit: "nr", pkg: "Street lighting" },
  asphalt: { label: "Asphalt surface", plural: "Asphalt surfaces", prefix: "AS", shape: "tin", color: "#b59ce6", unit: "m²", pkg: "Roadworks" },
  demolition: { label: "Demolition surface", plural: "Demolition surfaces", prefix: "DM", shape: "tin", color: "#ff5a5f", unit: "m²", pkg: "Demolition" },
  excavation: { label: "Excavation surface", plural: "Excavation surfaces", prefix: "EX", shape: "points", color: "#e07bd0", unit: "m²", pkg: "Earthworks" },
};
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
export const PACKAGES = [...new Set(CLASS_IDS.map((c) => CLASSES[c].pkg))];

/** What a piece of raw geometry can be identified as */
export const OPTIONS: Record<Shape, ClassId[]> = {
  line: ["kerb", "pipe"],
  dot: ["manhole", "light"],
  tin: ["asphalt", "demolition"],
  points: ["excavation"],
};

/** How the raw object reads in a plain CAD drawing */
export const SHAPE_LABEL: Record<Shape, string> = {
  line: "Line",
  dot: "Point",
  tin: "TIN surface",
  points: "Points + level text",
};

export type Level = { at: Pt; z: number };
export type RawEnt = {
  id: string;
  /** the CAD handle, as a plain export would list it */
  handle: string;
  shape: Shape;
  /** the CAD object type */
  cad: string;
  layer: string;
  pts: Pt[];
  tris?: [Pt, Pt, Pt][];
  levels?: Level[];
  /** what it really is in the example (used by "identify the rest" and the preview) */
  truth: ClassId;
  truthStatus: Status;
  /** where its tag sits, relative to its anchor (drawing units) */
  tag: Pt;
};

export type Ident = { cls: ClassId; tag: string; zone: Zone; status: Status };
export type Idents = Record<string, Ident>;

/* ---------- geometry helpers ---------- */

export function length(pts: Pt[]) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}
const triArea = ([a, b, c]: [Pt, Pt, Pt]) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;

export function bbox(e: RawEnt) {
  const all = [...e.pts, ...(e.tris?.flat() ?? []), ...(e.levels?.map((l) => l.at) ?? [])];
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** where the object's tag leader starts */
export function anchor(e: RawEnt): Pt {
  if (e.shape === "dot") return e.pts[0];
  if (e.shape === "line") {
    // the middle of the polyline, measured along it
    const half = length(e.pts) / 2;
    let run = 0;
    for (let i = 1; i < e.pts.length; i++) {
      const [a, b] = [e.pts[i - 1], e.pts[i]];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (run + l >= half) {
        const t = (half - run) / l;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      }
      run += l;
    }
    return e.pts[0];
  }
  const b = bbox(e);
  return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
}

export const chainage = (x: number) => {
  const m = Math.max(0, Math.round(x - X0));
  return `${Math.floor(m / 1000)}+${String(m % 1000).padStart(3, "0")}`;
};
export function chainageRange(e: RawEnt) {
  const b = bbox(e);
  const a = chainage(b.x0);
  const z = chainage(b.x1);
  return a === z ? a : `${a} to ${z}`;
}
export const zoneOf = (e: RawEnt): Zone => (anchor(e)[0] < ZONE_X ? "Zone A" : "Zone B");

/** the quantity a structure of this class carries */
export function quantity(e: RawEnt, cls: ClassId): number {
  const unit = CLASSES[cls].unit;
  if (unit === "nr") return 1;
  if (unit === "m") return length(e.pts);
  if (e.tris) return e.tris.reduce((s, t) => s + triArea(t), 0);
  return 0;
}
export function levelRange(e: RawEnt): [number, number] | null {
  if (!e.levels?.length) return null;
  const z = e.levels.map((l) => l.z);
  return [Math.min(...z), Math.max(...z)];
}

/* ---------- the example drawing ---------- */

const X0 = 20;
export const ZONE_X = 220;
export const EXTENT = { x0: 0, y0: 10, x1: 448, y1: 174 };

// a repeatable wobble, so the "survey" looks surveyed and never changes between renders
const jit = (i: number, j: number, k: number) => Math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 0.5;

/** a TIN over a rectangle: a jittered grid of vertices, split into triangles */
function tin(x0: number, x1: number, y0: number, y1: number, nx: number, ny: number, seed: number) {
  const P: Pt[][] = [];
  for (let i = 0; i <= nx; i++) {
    P.push([]);
    for (let j = 0; j <= ny; j++) {
      const edgeX = i === 0 || i === nx;
      const edgeY = j === 0 || j === ny;
      const x = x0 + ((x1 - x0) * i) / nx + (edgeX ? 0 : jit(i, j, seed) * ((x1 - x0) / nx) * 0.5);
      const y = y0 + ((y1 - y0) * j) / ny + (edgeY ? 0 : jit(j, i, seed + 1) * ((y1 - y0) / ny) * 0.5);
      P[i].push([x, y]);
    }
  }
  const tris: [Pt, Pt, Pt][] = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      const [a, b, c, d] = [P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1]];
      if ((i + j) % 2) tris.push([a, b, c], [a, c, d]);
      else tris.push([a, b, d], [b, c, d]);
    }
  const outline: Pt[] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  return { tris, outline };
}

// the road: south kerb | carriageway | north kerb (with a bus bay)
const S_KERB = 50;
const N_KERB = 86;
export const CENTRELINE = (S_KERB + N_KERB) / 2;
const PIPE_Y = 24;
const LIGHT_Y = 104;

function build(): RawEnt[] {
  const ents: RawEnt[] = [];
  let h = 0x2f40;
  const handle = () => (h += 7).toString(16).toUpperCase();
  const add = (e: Omit<RawEnt, "id" | "handle">) => ents.push({ ...e, id: `e${ents.length + 1}`, handle: handle() });

  // kerbs (3 lines)
  add({ shape: "line", cad: "LINE", layer: "0", pts: [[X0, S_KERB], [200, S_KERB]], truth: "kerb", truthStatus: "Built", tag: [-16, -8] });
  add({ shape: "line", cad: "LINE", layer: "0", pts: [[200, S_KERB], [420, S_KERB]], truth: "kerb", truthStatus: "In progress", tag: [16, -8] });
  add({
    shape: "line",
    cad: "LWPOLYLINE",
    layer: "0",
    pts: [[X0, N_KERB], [250, N_KERB], [262, N_KERB + 8], [318, N_KERB + 8], [330, N_KERB], [420, N_KERB]],
    truth: "kerb",
    truthStatus: "Proposed",
    tag: [-16, 8],
  });

  // storm drain: two pipes between three manholes
  const mh: Pt[] = [
    [50, PIPE_Y],
    [190, PIPE_Y],
    [330, PIPE_Y],
  ];
  add({ shape: "line", cad: "LINE", layer: "0", pts: [mh[0], mh[1]], truth: "pipe", truthStatus: "Built", tag: [0, -8] });
  add({ shape: "line", cad: "LINE", layer: "0", pts: [mh[1], mh[2]], truth: "pipe", truthStatus: "In progress", tag: [0, -8] });
  mh.forEach((p, i) => add({ shape: "dot", cad: "POINT", layer: "0", pts: [p], truth: "manhole", truthStatus: i < 2 ? "Built" : "In progress", tag: [0, 8] }));

  // street lights in the north verge
  [70, 170, 290, 380].forEach((x, i) => add({ shape: "dot", cad: "POINT", layer: "0", pts: [[x, LIGHT_Y]], truth: "light", truthStatus: i < 2 ? "Built" : "Proposed", tag: [0, 8] }));

  // two TIN surfaces over the carriageway: the old pavement to break out, and the new wearing course
  const demo = tin(X0 + 2, 150, S_KERB + 1.5, N_KERB - 1.5, 5, 3, 3);
  add({ shape: "tin", cad: "TIN SURFACE", layer: "C-TOPO", pts: demo.outline, tris: demo.tris, truth: "demolition", truthStatus: "Built", tag: [0, 6] });
  const asph = tin(150, 418, S_KERB + 1.5, N_KERB - 1.5, 10, 3, 7);
  add({ shape: "tin", cad: "TIN SURFACE", layer: "C-TOPO", pts: asph.outline, tris: asph.tris, truth: "asphalt", truthStatus: "In progress", tag: [0, 6] });

  // survey points with their levels as text, north of the road
  const levels: Level[] = [];
  const cols = [248, 278, 308, 338, 368];
  const rows = [126, 146, 166];
  cols.forEach((x, i) =>
    rows.forEach((y, j) => {
      const dish = Math.pow((i - 2) / 2, 2) * 0.9 + Math.pow(j - 1, 2) * 0.6; // a dug pit, deepest in the middle
      levels.push({ at: [x + jit(i, j, 5) * 4, y + jit(j, i, 9) * 3], z: +(608.2 + dish * 1.4 + jit(i, j, 2) * 0.3).toFixed(2) });
    }),
  );
  // triangulated the same way as a TIN, once identified
  const exTris: [Pt, Pt, Pt][] = [];
  const P = (i: number, j: number) => levels[i * rows.length + j].at;
  for (let i = 0; i < cols.length - 1; i++)
    for (let j = 0; j < rows.length - 1; j++) exTris.push([P(i, j), P(i + 1, j), P(i + 1, j + 1)], [P(i, j), P(i + 1, j + 1), P(i, j + 1)]);
  add({
    shape: "points",
    cad: "POINT + TEXT",
    layer: "SURVEY",
    pts: levels.map((l) => l.at),
    tris: exTris,
    levels,
    truth: "excavation",
    truthStatus: "In progress",
    tag: [78, 0],
  });

  return ents;
}

let cache: RawEnt[] | null = null;
export function getDrawing(): RawEnt[] {
  return (cache ??= build());
}

/** the order the example identifies things in: linework and points first, then the surfaces */
export function identifyOrder(): RawEnt[] {
  const rank: Record<ClassId, number> = { kerb: 0, pipe: 1, manhole: 2, light: 3, demolition: 4, asphalt: 5, excavation: 6 };
  return [...getDrawing()].sort((a, b) => rank[a.truth] - rank[b.truth] || anchor(a)[0] - anchor(b)[0]);
}

/* ---------- identification ---------- */

/** the next free ID for a class: K-01, K-02… */
export function nextTag(ids: Idents, cls: ClassId) {
  const used = new Set(Object.values(ids).filter((i) => i.cls === cls).map((i) => i.tag));
  for (let n = 1; ; n++) {
    const tag = `${CLASSES[cls].prefix}-${String(n).padStart(2, "0")}`;
    if (!used.has(tag)) return tag;
  }
}

export function identify(ids: Idents, e: RawEnt, cls: ClassId, status?: Status): Idents {
  const prev = ids[e.id];
  const tag = prev && prev.cls === cls ? prev.tag : nextTag(ids, cls);
  return { ...ids, [e.id]: { cls, tag, zone: prev?.zone ?? zoneOf(e), status: status ?? prev?.status ?? e.truthStatus } };
}

/** everything identified the way the example intends */
export function identifyAll(order = identifyOrder()): Idents {
  return order.reduce<Idents>((ids, e) => identify(ids, e, e.truth), {});
}

/* ---------- export rows ---------- */

export type Row = { id: string; tag: string; cls: ClassId; pkg: string; zone: Zone; chainage: string; status: Status; qty: number; unit: Unit; note: string };

export function rows(ids: Idents): Row[] {
  return getDrawing()
    .filter((e) => ids[e.id])
    .map((e) => {
      const i = ids[e.id];
      const c = CLASSES[i.cls];
      const lv = levelRange(e);
      return {
        id: e.id,
        tag: i.tag,
        cls: i.cls,
        pkg: c.pkg,
        zone: i.zone,
        chainage: chainageRange(e),
        status: i.status,
        qty: quantity(e, i.cls),
        unit: c.unit,
        note: lv ? `levels ${lv[0].toFixed(2)} to ${lv[1].toFixed(2)}` : "",
      };
    })
    .sort((a, b) => CLASS_IDS.indexOf(a.cls) - CLASS_IDS.indexOf(b.cls) || a.tag.localeCompare(b.tag));
}

/** what a plain CAD export (data extraction) of the same drawing gives you */
export function rawRows() {
  return getDrawing().map((e) => ({
    handle: e.handle,
    cad: e.cad,
    layer: e.layer,
    value: e.shape === "line" ? `${length(e.pts).toFixed(2)} (length)` : e.shape === "dot" ? `${e.pts[0][0].toFixed(2)}, ${e.pts[0][1].toFixed(2)}` : e.shape === "tin" ? `${e.tris!.length} triangles` : `${e.levels!.length} points`,
  }));
}

export function fmtQty(v: number, unit: Unit) {
  if (unit === "nr") return `${Math.round(v)} nr`;
  return `${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`;
}
