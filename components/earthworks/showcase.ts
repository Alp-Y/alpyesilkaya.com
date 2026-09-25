/**
 * SHOWCASE MODELS (Three.js) — the other scenes the hero viewport can show,
 * drawn in the same language as the earthworks model: see-through volumes,
 * fine CAD edges, a survey grid that fades out at its edges.
 *
 *   basement   a basement excavation under a ghosted building (Excavation Volume Calculator)
 *   progress   a road built in stages: unchanged, added, taken out (DWG Comparison Tool)
 *   areas      one asphalt layer and a pipe trench split by project area (Quantity by Area Calculator)
 *
 * Every model fits the same 120 × 64 m footprint as the earthworks model,
 * so the scale bar and the fit stay the same when you switch.
 */

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  Points,
  PointsMaterial,
} from "three";
import { AREA_COLORS, CUT, FILL, LINE } from "@/lib/heroModels";
import type { DisplayMode } from "./scene";

const HALF_L = 60;
const HALF_W = 32;

export type ShowcaseModel = {
  group: Group;
  /** What a pointer press can grab to turn the model */
  pick: Object3D[];
  setMode: (mode: DisplayMode) => void;
};

/** Materials by role, so the display mode can restyle a whole model at once. */
type Kit = {
  faces: MeshLambertMaterial[];
  edges: LineBasicMaterial[];
  ghosts: LineBasicMaterial[];
  pick: Object3D[];
};

const newKit = (): Kit => ({ faces: [], edges: [], ghosts: [], pick: [] });

function styleKit(kit: Kit, mode: DisplayMode) {
  const shaded = mode === "shaded";
  const analysis = mode === "analysis";
  for (const m of kit.faces) m.opacity = (m.userData.base as number) * (analysis ? 2.2 : shaded ? 1.7 : 1);
  for (const m of kit.edges) m.opacity = shaded ? 0.6 : 0.85;
  for (const m of kit.ghosts) m.opacity = (m.userData.base as number) * (analysis ? 0.6 : 1);
}

/* ------------------------------------------------------------------ */
/* building blocks                                                     */
/* ------------------------------------------------------------------ */

function faceMat(kit: Kit, color: string, opacity: number) {
  const m = new MeshLambertMaterial({ color, transparent: true, opacity, depthWrite: false, side: DoubleSide });
  m.userData.base = opacity;
  kit.faces.push(m);
  return m;
}
function edgeMat(kit: Kit, color: string) {
  const c = new Color(color).lerp(new Color("#ffffff"), 0.2);
  const m = new LineBasicMaterial({ color: c, transparent: true, opacity: 0.85 });
  kit.edges.push(m);
  return m;
}
function ghostMat(kit: Kit, opacity: number, color = LINE) {
  const m = new LineBasicMaterial({ color, transparent: true, opacity });
  m.userData.base = opacity;
  kit.ghosts.push(m);
  return m;
}

/** A solid drawn as a volume: faint faces and crisp edges. */
function solid(kit: Kit, geo: BufferGeometry, color: string, opacity = 0.18) {
  const g = new Group();
  const mesh = new Mesh(geo, faceMat(kit, color, opacity));
  kit.pick.push(mesh);
  g.add(mesh, new LineSegments(new EdgesGeometry(geo, 20), edgeMat(kit, color)));
  return g;
}

/** An axis-aligned box from its min corner to its max corner. */
function box(kit: Kit, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string, opacity?: number) {
  const geo = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return solid(kit, geo, color, opacity);
}

/** A thin box along a straight line on plan (kerbs, trenches): width across, height up from y0. */
function strip(kit: Kit, ax: number, az: number, bx: number, bz: number, width: number, y0: number, height: number, color: string, opacity?: number) {
  const len = Math.hypot(bx - ax, bz - az);
  const geo = new BoxGeometry(len, height, width);
  geo.rotateY(-Math.atan2(bz - az, bx - ax));
  geo.translate((ax + bx) / 2, y0 + height / 2, (az + bz) / 2);
  return solid(kit, geo, color, opacity);
}

/** Frustum (a pit with sloped sides): top rectangle at yTop(x, z), bottom rectangle at yBottom. */
function pit(kit: Kit, top: [number, number], bottom: [number, number], yTop: (x: number, z: number) => number, yBottom: number, color: string) {
  const [tx, tz] = [top[0] / 2, top[1] / 2];
  const [bx, bz] = [bottom[0] / 2, bottom[1] / 2];
  const T = [
    [-tx, -tz],
    [tx, -tz],
    [tx, tz],
    [-tx, tz],
  ].map(([x, z]) => [x, yTop(x, z), z]);
  const B = [
    [-bx, -bz],
    [bx, -bz],
    [bx, bz],
    [-bx, bz],
  ].map(([x, z]) => [x, yBottom, z]);
  const tri: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => tri.push(...a, ...b, ...c, ...a, ...c, ...d);
  quad(T[0], T[1], T[2], T[3]);
  quad(B[3], B[2], B[1], B[0]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(T[i], B[i], B[j], T[j]);
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(tri), 3));
  geo.computeVertexNormals();
  return solid(kit, geo, color, 0.2);
}

/** Survey grid lines on a ground surface, fading out towards the edges; `skip` leaves holes. */
function groundGrid(kit: Kit, y: (x: number, z: number) => number, step = 4, skip?: (x: number, z: number) => boolean) {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new Color("#8d99a6");
  const add = (x: number, z: number) => {
    pos.push(x, y(x, z), z);
    const r = Math.min(1, Math.hypot((x / HALF_L) * 0.92, z / HALF_W));
    const a = r < 0.62 ? 1 : Math.max(0, 1 - (r - 0.62) / 0.38);
    col.push(c.r, c.g, c.b, a * a);
  };
  const seg = (x0: number, z0: number, x1: number, z1: number) => {
    if (skip?.((x0 + x1) / 2, (z0 + z1) / 2)) return;
    add(x0, z0);
    add(x1, z1);
  };
  for (let z = -HALF_W; z <= HALF_W; z += step) for (let x = -HALF_L; x < HALF_L; x += 2) seg(x, z, x + 2, z);
  for (let x = -HALF_L; x <= HALF_L; x += step) for (let z = -HALF_W; z < HALF_W; z += 2) seg(x, z, x, z + 2);
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute("color", new BufferAttribute(new Float32Array(col), 4));
  const m = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3 });
  m.userData.base = 0.3;
  kit.ghosts.push(m);
  return new LineSegments(geo, m);
}

/** A closed outline through points (plan polygons, floor plates). */
function outline(points: [number, number, number][], mat: LineBasicMaterial) {
  const p: number[] = [];
  for (let i = 0; i < points.length; i++) p.push(...points[i], ...points[(i + 1) % points.length]);
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(p), 3));
  return new LineSegments(geo, mat);
}

/** Invisible plate that makes the whole footprint grabbable (so a drag works between the objects). */
function pickPlate(kit: Kit, y = 0) {
  const geo = new BoxGeometry(HALF_L * 2, 0.1, HALF_W * 2);
  geo.translate(0, y, 0);
  const m = new Mesh(geo, new MeshLambertMaterial({ visible: false }));
  kit.pick.push(m);
  return m;
}

function finish(kit: Kit, group: Group): ShowcaseModel {
  return { group, pick: kit.pick, setMode: (mode) => styleKit(kit, mode) };
}

/* ------------------------------------------------------------------ */
/* the models                                                          */
/* ------------------------------------------------------------------ */

/** A basement excavation under the building it is dug for. */
function basement(): ShowcaseModel {
  const kit = newKit();
  const g = new Group();
  // gently falling ground, like a real site (levels ×1.4 so the relief reads)
  const ground = (x: number, z: number) => 1.4 * (0.035 * x + 0.6 * Math.sin(z / 9) + 0.4 * Math.cos(x / 14));
  const TOP: [number, number] = [56, 32];
  const BOTTOM: [number, number] = [44, 20];
  const DEPTH = -12;
  const inPit = (x: number, z: number) => Math.abs(x) < TOP[0] / 2 && Math.abs(z) < TOP[1] / 2;

  g.add(groundGrid(kit, ground, 4, inPit));
  g.add(pit(kit, TOP, BOTTOM, ground, DEPTH, CUT));

  // survey points: on the ground around the pit, and on the dug surface
  const pts: number[] = [];
  for (let x = -54; x <= 54; x += 6)
    for (let z = -28; z <= 28; z += 6) if (!inPit(x, z)) pts.push(x, ground(x, z) + 0.2, z);
  for (let x = -20; x <= 20; x += 4) for (let z = -8; z <= 8; z += 4) pts.push(x, DEPTH + 0.2, z);
  const pgeo = new BufferGeometry();
  pgeo.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
  const pmat = new PointsMaterial({ color: LINE, size: 2.5, sizeAttenuation: false, transparent: true, opacity: 0.7 });
  g.add(new Points(pgeo, pmat));

  // the building it is dug for: floor plates, corners and a column grid, as a ghost
  const plate = ghostMat(kit, 0.4);
  const faint = ghostMat(kit, 0.16);
  const [hx, hz] = [BOTTOM[0] / 2, BOTTOM[1] / 2];
  const floors = 6;
  const storey = 4.2;
  const base = DEPTH;
  for (let k = 0; k <= floors; k++) {
    const y = base + 3 + k * storey + (k > 0 ? 9 : 0); // basement level, then the floors above ground
    g.add(
      outline(
        [
          [-hx, y, -hz],
          [hx, y, -hz],
          [hx, y, hz],
          [-hx, y, hz],
        ],
        k === 0 ? faint : plate,
      ),
    );
  }
  const topY = base + 3 + floors * storey + 9;
  const cols: number[] = [];
  for (let x = -hx; x <= hx + 0.01; x += 11)
    for (const z of [-hz, 0, hz]) cols.push(x, base, z, x, topY, z);
  const cgeo = new BufferGeometry();
  cgeo.setAttribute("position", new BufferAttribute(new Float32Array(cols), 3));
  g.add(new LineSegments(cgeo, faint));

  g.add(pickPlate(kit, 0));
  return finish(kit, g);
}

/** A road built in stages, as two progress drawings see it. */
function progress(): ShowcaseModel {
  const kit = newKit();
  const g = new Group();
  g.add(groundGrid(kit, () => 0, 4));
  const H = 1.4; // pavement, drawn thicker than it is so it reads
  const K = 1.1; // kerb height above the pavement
  const W = 6; // half-width of the carriageway
  const grey = "#8d99a6";

  // pavement: built before (unchanged), this period (added), still to come (outline only)
  for (let x = -56; x < 8; x += 8) g.add(box(kit, x, 0, -W, x + 8, H, W, grey, 0.12));
  for (let x = 8; x < 40; x += 8) g.add(box(kit, x, 0, -W, x + 8, H, W, FILL, 0.22));
  const future = ghostMat(kit, 0.22);
  g.add(
    outline(
      [
        [40, H, -W],
        [56, H, -W],
        [56, H, W],
        [40, H, W],
      ],
      future,
    ),
  );

  // kerbs: south side straight all the way that is built
  g.add(strip(kit, -56, -W - 0.3, 8, -W - 0.3, 0.6, 0, H + K, grey, 0.14));
  g.add(strip(kit, 8, -W - 0.3, 40, -W - 0.3, 0.6, 0, H + K, FILL, 0.22));
  // north side: a straight kerb was taken out, and a bus bay built in its place
  g.add(strip(kit, -56, W + 0.3, -34, W + 0.3, 0.6, 0, H + K, grey, 0.14));
  g.add(strip(kit, -34, W + 0.3, -8, W + 0.3, 0.6, 0, H + K, CUT, 0.26));
  g.add(strip(kit, -8, W + 0.3, 8, W + 0.3, 0.6, 0, H + K, grey, 0.14));
  g.add(strip(kit, 8, W + 0.3, 40, W + 0.3, 0.6, 0, H + K, FILL, 0.22));
  const BAY = W + 4;
  const bay: [number, number][] = [
    [-34, W + 0.3],
    [-28, BAY],
    [-14, BAY],
    [-8, W + 0.3],
  ];
  for (let i = 0; i < bay.length - 1; i++) g.add(strip(kit, bay[i][0], bay[i][1], bay[i + 1][0], bay[i + 1][1], 0.6, 0, H + K, FILL, 0.22));
  g.add(box(kit, -28, 0, W + 0.6, -14, H, BAY - 0.3, FILL, 0.22));

  g.add(pickPlate(kit, 0.5));
  return finish(kit, g);
}

/** One layer of work, attributed to every project area it crosses. */
function areas(): ShowcaseModel {
  const kit = newKit();
  const g = new Group();
  g.add(groundGrid(kit, () => 0, 4));
  const bounds = [-56, -18, 20, 56]; // A | B | C along the road
  const Z = 28;

  bounds.slice(0, 3).forEach((x0, i) => {
    const x1 = bounds[i + 1];
    const c = AREA_COLORS[i];
    // the area itself: a faint floor and a coloured boundary
    const floor = new BoxGeometry(x1 - x0 - 0.8, 0.05, Z * 2);
    floor.translate((x0 + x1) / 2, 0.02, 0);
    g.add(new Mesh(floor, faceMat(kit, c, 0.05)));
    g.add(
      outline(
        [
          [x0 + 0.4, 0.05, -Z],
          [x1 - 0.4, 0.05, -Z],
          [x1 - 0.4, 0.05, Z],
          [x0 + 0.4, 0.05, Z],
        ],
        ghostMat(kit, 0.55, c),
      ),
    );
    // the asphalt layer, cut at the area boundary
    const a0 = Math.max(x0, -52);
    const a1 = Math.min(x1, 52);
    g.add(box(kit, a0 + 0.3, 0, -5, a1 - 0.3, 1.8, 5, c, 0.22));
  });

  // a pipe trench on the skew, split where it crosses from area A into area B
  const [p0, p1]: [number, number][] = [
    [-46, -22],
    [2, 20],
  ];
  const t = (bounds[1] - p0[0]) / (p1[0] - p0[0]);
  const mid: [number, number] = [bounds[1], p0[1] + (p1[1] - p0[1]) * t];
  // a small gap either side of the boundary, along the trench
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const [ux, uz] = [((p1[0] - p0[0]) / len) * 0.4, ((p1[1] - p0[1]) / len) * 0.4];
  g.add(strip(kit, p0[0], p0[1], mid[0] - ux, mid[1] - uz, 2.2, -4, 4, AREA_COLORS[0], 0.2));
  g.add(strip(kit, mid[0] + ux, mid[1] + uz, p1[0], p1[1], 2.2, -4, 4, AREA_COLORS[1], 0.2));

  g.add(pickPlate(kit, 0));
  return finish(kit, g);
}

export const SHOWCASE: Record<"basement" | "progress" | "areas", () => ShowcaseModel> = {
  basement,
  progress,
  areas,
};
