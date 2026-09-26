/**
 * THE FILM'S EXAMPLE PROJECT — one synthetic road scheme that every scene
 * of the tools film draws from, so the plan, the quantities, the drainage
 * table and the report are the same data seen from different sides.
 * ------------------------------------------------------------------
 * Drawing units are metres, x east, y north.
 *
 *   alignment  tangent → curve (R 1200) → tangent, 900 m, chainage 0+000 at (0,0)
 *   areas      A01…A06, 150 m of chainage each, split N / S of the centreline
 *   work       asphalt, kerbs, a demolition polygon, storm drain, street lights
 *   basin      a detention basin excavation south of the road (the terrain scene)
 *
 * Nothing here is measured by hand: every quantity the film shows is
 * computed from this geometry (areas by shoelace, lengths along the
 * polylines, counts by containment) after clipping to each project area.
 */

export type XY = [number, number];

/* ---------- alignment ---------- */

export const ALIGN_LENGTH = 900;
const T1 = 300; // end of the first tangent
const R = 1200;
const T2 = 600; // end of the curve
const DELTA = (T2 - T1) / R;

/** Position and unit heading at chainage s. */
export function alignAt(s: number): { p: XY; h: XY } {
  if (s <= T1) return { p: [s, 0], h: [1, 0] };
  if (s <= T2) {
    const a = (s - T1) / R;
    return { p: [T1 + R * Math.sin(a), R - R * Math.cos(a)], h: [Math.cos(a), Math.sin(a)] };
  }
  const end = alignAt(T2);
  const d = s - T2;
  return { p: [end.p[0] + end.h[0] * d, end.p[1] + end.h[1] * d], h: [Math.cos(DELTA), Math.sin(DELTA)] };
}

/** Chainage + offset (+ = left / north) → plan point. */
export function so(s: number, o: number): XY {
  const { p, h } = alignAt(s);
  return [p[0] - h[1] * o, p[1] + h[0] * o];
}

/** A polyline in (s, o), densified along chainage so curved edges stay curved. */
export function soLine(pts: XY[], step = 6): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    out.push(so(a[0], a[1]));
    const b = pts[i + 1];
    if (!b) break;
    const n = Math.max(1, Math.ceil(Math.abs(b[0] - a[0]) / step));
    for (let k = 1; k < n; k++) out.push(so(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n));
  }
  return out;
}
/** Closed polygon version of soLine (the closing edge is densified too). */
export function soPoly(pts: XY[], step = 6): XY[] {
  return soLine([...pts, pts[0]], step).slice(0, -1);
}

export function chainage(s: number) {
  const km = Math.floor(s / 1000);
  const m = s - km * 1000;
  return `${km}+${m.toFixed(0).padStart(3, "0")}`;
}

/* ---------- plane geometry ---------- */

export function polyArea(pts: XY[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}
export function lineLength(pts: XY[]) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}
export function centroid(pts: XY[]): XY {
  let x = 0, y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
}

type Rect = { s0: number; s1: number; o0: number; o1: number };

/** Sutherland–Hodgman: a polygon in (s, o) clipped to an (s, o) rectangle. */
function clipPoly(poly: XY[], r: Rect): XY[] {
  const edges: [(p: XY) => number, number][] = [
    [(p) => p[0] - r.s0, 0],
    [(p) => r.s1 - p[0], 0],
    [(p) => p[1] - r.o0, 1],
    [(p) => r.o1 - p[1], 1],
  ];
  let out = poly;
  for (const [f] of edges) {
    const inp = out;
    out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i];
      const b = inp[(i + 1) % inp.length];
      const fa = f(a);
      const fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) {
        const t = fa / (fa - fb);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    if (!out.length) break;
  }
  return out;
}

/** A polyline in (s, o) clipped to an (s, o) rectangle → the pieces inside. */
function clipLine(line: XY[], r: Rect): XY[][] {
  const inside = (p: XY) => p[0] >= r.s0 - 1e-9 && p[0] <= r.s1 + 1e-9 && p[1] >= r.o0 - 1e-9 && p[1] <= r.o1 + 1e-9;
  const pieces: XY[][] = [];
  let cur: XY[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    // Liang–Barsky on the segment
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const tests: [number, number][] = [
      [-dx, a[0] - r.s0],
      [dx, r.s1 - a[0]],
      [-dy, a[1] - r.o0],
      [dy, r.o1 - a[1]],
    ];
    let ok = true;
    for (const [p, q] of tests) {
      if (Math.abs(p) < 1e-12) {
        if (q < 0) ok = false;
      } else {
        const t = q / p;
        if (p < 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
      }
    }
    if (!ok || t0 > t1) {
      if (cur.length > 1) pieces.push(cur);
      cur = [];
      continue;
    }
    const pa: XY = [a[0] + dx * t0, a[1] + dy * t0];
    const pb: XY = [a[0] + dx * t1, a[1] + dy * t1];
    if (!cur.length) cur.push(pa);
    cur.push(pb);
    if (t1 < 1 || !inside(b)) {
      if (cur.length > 1) pieces.push(cur);
      cur = [];
    }
  }
  if (cur.length > 1) pieces.push(cur);
  return pieces;
}

/* ---------- project areas ---------- */

export const AREA_HALF = 30; // offset of the project boundary from the centreline

export type Area = {
  id: string; // "A02-N"
  zone: string; // "A02"
  sub: "N" | "S";
  section: "SEC-1" | "SEC-2";
  rect: Rect;
  poly: XY[];
  label: XY;
};

export const AREAS: Area[] = [];
for (let i = 0; i < 6; i++) {
  const s0 = i * 150;
  const s1 = s0 + 150;
  const zone = `A0${i + 1}`;
  for (const sub of ["N", "S"] as const) {
    const [o0, o1] = sub === "N" ? [0, AREA_HALF] : [-AREA_HALF, 0];
    AREAS.push({
      id: `${zone}-${sub}`,
      zone,
      sub,
      section: i < 3 ? "SEC-1" : "SEC-2",
      rect: { s0, s1, o0, o1 },
      poly: soPoly([
        [s0, o0],
        [s1, o0],
        [s1, o1],
        [s0, o1],
      ]),
      label: so(s0 + 12, sub === "N" ? o1 - 5 : o0 + 5),
    });
  }
}
export const areaById = (id: string) => AREAS.find((a) => a.id === id)!;

/* ---------- work geometry ---------- */

export type WorkKind = "asphalt" | "kerb" | "demolition" | "pipe" | "manhole" | "light";
export const WORK: Record<WorkKind, { label: string; desc: string; unit: "m²" | "lm" | "nr"; layer: string; boq: string; code: string; color: string }> = {
  asphalt: { label: "Asphalt", desc: "Asphalt wearing course", unit: "m²", layer: "C-ASPHALT", boq: "04.02.010", code: "ASP-01", color: "#d3d9e0" },
  kerb: { label: "Kerb", desc: "Precast concrete kerb", unit: "lm", layer: "C-KERB", boq: "04.05.020", code: "KRB-01", color: "#d5d79e" },
  demolition: { label: "Demolition", desc: "Break out existing pavement", unit: "m²", layer: "C-DEMOLITION", boq: "01.03.010", code: "DEM-01", color: "#c48a93" },
  pipe: { label: "Storm pipe", desc: "Storm drain pipe, GRP", unit: "lm", layer: "C-STORM-PIPE", boq: "06.01.030", code: "STW-02", color: "#63b6d6" },
  manhole: { label: "Manholes", desc: "Storm manhole, precast", unit: "nr", layer: "C-STORM-MH", boq: "06.03.010", code: "STW-05", color: "#63b6d6" },
  light: { label: "Street lights", desc: "Street light column", unit: "nr", layer: "E-LIGHTING", boq: "08.01.020", code: "ELE-01", color: "#b9a3e0" },
};

/** Work drawn in (s, o). */
export const ASPHALT_SO: XY[][] = [
  [
    [40, 1.5],
    [560, 1.5],
    [560, 11.5],
    [40, 11.5],
  ],
  [
    [20, -11.5],
    [500, -11.5],
    [500, -1.5],
    [20, -1.5],
  ],
];
export const KERB_SO: XY[][] = [
  [
    [60, 11.5],
    [520, 11.5],
  ],
  [
    [20, -11.5],
    [480, -11.5],
  ],
];
/** Existing pavement to break out: crosses A02/A03 and the centreline, so it lands in four areas. */
export const DEMOLITION_SO: XY[] = [
  [258, -16],
  [300, -22],
  [342, -12],
  [346, 8],
  [318, 21],
  [270, 17],
  [252, 2],
];
export const LIGHTS_SO: XY[] = Array.from({ length: 14 }, (_, i) => [30 + i * 40, 17] as XY);

/* ---------- storm drainage ---------- */

export type Structure = { id: string; s: number; o: number; p: XY; gl: number; il: number; depth: number };
export type Pipe = { id: string; from: string; to: string; dia: number; mat: string; length: number; slope: number; ilUp: number; ilDn: number; a: XY; b: XY };

/** Finished road level along the verge (m). */
export const groundLevel = (s: number) => 612.8 - 0.0042 * s + 0.35 * Math.sin(s / 70);

const MH_S = [180, 228, 276, 326, 374, 422, 470];
const DIA = [450, 450, 500, 500, 600, 600, 600];
const SLOPE = [0.009, 0.008, 0.008, 0.007, 0.007, 0.006, 0.01];
export const BASIN_HW: XY = [486, -56];

export const STRUCTURES: Structure[] = [];
export const PIPES: Pipe[] = [];
{
  let il = groundLevel(MH_S[0]) - 1.6;
  for (let i = 0; i < MH_S.length; i++) {
    const s = MH_S[i];
    const p = so(s, -18);
    const gl = groundLevel(s);
    STRUCTURES.push({ id: `MHL1-${12 + i}`, s, o: -18, p, gl, il, depth: gl - il });
    const b = i < MH_S.length - 1 ? so(MH_S[i + 1], -18) : BASIN_HW;
    const length = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ilDn = il - length * SLOPE[i];
    PIPES.push({
      id: `P-${12 + i}`,
      from: `MHL1-${12 + i}`,
      to: i < MH_S.length - 1 ? `MHL1-${13 + i}` : "HW-01",
      dia: DIA[i],
      mat: DIA[i] < 500 ? "uPVC" : "GRP",
      length,
      slope: SLOPE[i],
      ilUp: il,
      ilDn,
      a: p,
      b,
    });
    il = ilDn - 0.02; // 20 mm drop across the next manhole
  }
}
/** Gully inlets at the kerb, each with a short lateral into a manhole. */
export const INLETS = [1, 3, 5].map((i, k) => ({ id: `GI-0${k + 3}`, p: so(MH_S[i] - 6, -11.5), to: STRUCTURES[i].p }));

/* ---------- quantities by area ---------- */

export type QtyRow = { section: string; area: string; zone: string; sub: string; kind: WorkKind; qty: number; unit: string; pieces: XY[][] };

function measureArea(a: Area): QtyRow[] {
  const rows: QtyRow[] = [];
  const add = (kind: WorkKind, qty: number, pieces: XY[][]) => {
    if (qty > 0.004) rows.push({ section: a.section, area: a.id, zone: a.zone, sub: a.sub, kind, qty, unit: WORK[kind].unit, pieces });
  };
  // polygons: clip in (s, o), densify, measure in plan
  const polys = (list: XY[][]) => {
    let q = 0;
    const pieces: XY[][] = [];
    for (const p of list) {
      const c = clipPoly(p, a.rect);
      if (c.length < 3) continue;
      const plan = soPoly(c, 3);
      q += polyArea(plan);
      pieces.push(plan);
    }
    return { q, pieces };
  };
  const lines = (list: XY[][]) => {
    let q = 0;
    const pieces: XY[][] = [];
    for (const l of list)
      for (const c of clipLine(l, a.rect)) {
        const plan = soLine(c, 3);
        q += lineLength(plan);
        pieces.push(plan);
      }
    return { q, pieces };
  };
  const asp = polys(ASPHALT_SO);
  add("asphalt", asp.q, asp.pieces);
  const kerb = lines(KERB_SO);
  add("kerb", kerb.q, kerb.pieces);
  const dem = polys([DEMOLITION_SO]);
  add("demolition", dem.q, dem.pieces);
  // storm pipes are drawn in plan: measure them in (s, o) of their end points (the verge run is parallel to the centreline)
  const pipeSO: XY[][] = PIPES.slice(0, -1).map((p) => {
    const i = STRUCTURES.findIndex((s) => s.id === p.from);
    return [
      [STRUCTURES[i].s, -18],
      [STRUCTURES[i + 1].s, -18],
    ];
  });
  const pipe = lines(pipeSO);
  add("pipe", pipe.q, pipe.pieces);
  const inRect = (s: number, o: number) => s >= a.rect.s0 && s < a.rect.s1 && o >= a.rect.o0 && o < a.rect.o1;
  add("manhole", STRUCTURES.filter((m) => inRect(m.s, m.o)).length, []);
  add("light", LIGHTS_SO.filter(([s, o]) => inRect(s, o)).length, []);
  return rows;
}

export const QUANTITIES: QtyRow[] = AREAS.flatMap(measureArea);
export const qty = (area: string, kind: WorkKind) => QUANTITIES.find((r) => r.area === area && r.kind === kind);

/* ---------- weekly progress (a lay-by north of A04) ---------- */

/** Local frame at chainage 520: u along the road, v to the north. Areas are preserved exactly. */
const PF = alignAt(520);
export const pf = (u: number, v: number): XY => [PF.p[0] + PF.h[0] * u - PF.h[1] * v, PF.p[1] + PF.h[1] * u + PF.h[0] * v];
const rect = (u0: number, u1: number, v0: number, v1: number): XY[] => [pf(u0, v0), pf(u1, v0), pf(u1, v1), pf(u0, v1)];

export const PROGRESS = {
  frame: PF,
  prevBay: rect(-10, 0, 12, 22),
  currBay: rect(-10, 5, 12, 22),
  addedBay: rect(0, 5, 12, 22),
  kerbKept: [pf(-40, 12), pf(-10, 12)],
  kerbRemoved: [pf(0, 12), pf(24, 12)],
  kerbAdded: [pf(-10, 22), pf(5, 22), pf(5, 12)],
  mhKept: pf(-25, -7),
  mhAdded: pf(15, -7),
  context: [
    [pf(-60, 11.5), pf(60, 11.5)],
    [pf(-60, 1.5), pf(60, 1.5)],
    [pf(-60, -1.5), pf(60, -1.5)],
    [pf(-60, -11.5), pf(60, -11.5)],
  ] as XY[][],
};
export const PROGRESS_ROWS = (() => {
  const prevA = polyArea(PROGRESS.prevBay);
  const currA = polyArea(PROGRESS.currBay);
  const kept = lineLength(PROGRESS.kerbKept);
  const prevK = kept + lineLength(PROGRESS.kerbRemoved);
  const currK = kept + lineLength(PROGRESS.kerbAdded);
  return [
    { section: "SEC-2", area: "A04-N", kind: "asphalt" as WorkKind, prev: prevA, curr: currA },
    { section: "SEC-2", area: "A04-N", kind: "kerb" as WorkKind, prev: prevK, curr: currK },
    { section: "SEC-2", area: "A04-S", kind: "manhole" as WorkKind, prev: 1, curr: 2 },
  ];
})();

/* ---------- the detention basin (terrain scene) ---------- */

/** Plan window of the basin survey, world metres. The terrain scene works in local metres from BASIN_ORIGIN. */
export const BASIN_ORIGIN: XY = [420, -126];
export const BASIN_SIZE: XY = [120, 70];
