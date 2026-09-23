/**
 * EARTHWORKS SCENE (Three.js) — draws lib/earthworks/model.ts.
 * ------------------------------------------------------------------
 * Loaded lazily in the browser only. Renders on demand (never a
 * continuous loop): when the ViewCube turns, the display mode changes,
 * the canvas resizes or the hover probe moves.
 *
 *   existing ground   grid lines (wireframe) or a soft shaded surface
 *   design surface    road formation + side slopes
 *   cut               red volume between ground (top) and design (bottom)
 *   fill              green volume between design (top) and ground (bottom)
 */

import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  OrthographicCamera,
  Plane,
  Quaternion,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import {
  HALF_CARRIAGEWAY,
  HALF_FORMATION,
  LENGTH,
  NX,
  NZ,
  VERTICAL_EXAGGERATION,
  WIDTH,
  buildModel,
  roadLevel,
  sample,
  type EarthworksModel,
} from "@/lib/earthworks/model";

export type DisplayMode = "wireframe" | "shaded" | "analysis";

const CAMERA_DISTANCE = 400;

// A restrained palette that sits in the hero: graphite ground, glass volumes, fine coloured edges
const COLORS = {
  cut: new Color("#e2848c"),
  fill: new Color("#7fd3ae"),
  ground: new Color("#8d99a6"),
  groundShaded: new Color("#27303a"),
  road: new Color("#262b31"),
  slope: new Color("#5a6470"),
  line: new Color("#c9d1da"),
};

export type Probe = { x: number; z: number; ground: number; design: number; depth: number } | null;

export class EarthworksScene {
  readonly model: EarthworksModel;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 1, 1000);
  private root = new Group();
  private groundLines: LineSegments;
  private groundMesh: Mesh;
  private design: Mesh;
  private cut: Mesh;
  private fill: Mesh;
  private cutWalls: Mesh;
  private fillWalls: Mesh;
  private cutEdges: LineSegments;
  private fillEdges: LineSegments;
  private edges: Group;
  private raycaster = new Raycaster();
  private frame = 0;
  private width = 1;
  private height = 1;
  private zoom = 1;
  /** Where the model sits on the canvas: centre (px) and scale (px per metre at zoom 1). */
  private anchor = { x: 0.5, y: 0.5, scale: 4 };
  private clip = new Plane(new Vector3(-1, 0, 0), LENGTH);
  private scan: Line;
  onRender?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.model = buildModel();
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);

    const m = this.model;
    const Y = (v: number) => (v - 20) * VERTICAL_EXAGGERATION;

    // ---------- existing ground ----------
    const gPos = new Float32Array(NX * NZ * 3);
    const dPos = new Float32Array(NX * NZ * 3);
    for (let i = 0; i < NX * NZ; i++) {
      gPos.set([m.x[i], Y(m.ground[i]), m.z[i]], i * 3);
      dPos.set([m.x[i], Y(m.design[i]), m.z[i]], i * 3);
    }
    const index: number[] = [];
    for (let iz = 0; iz < NZ - 1; iz++)
      for (let ix = 0; ix < NX - 1; ix++) {
        const a = iz * NX + ix;
        index.push(a, a + NX, a + 1, a + 1, a + NX, a + NX + 1);
      }

    const groundGeo = new BufferGeometry();
    groundGeo.setAttribute("position", new BufferAttribute(gPos, 3));
    groundGeo.setIndex(index);
    groundGeo.computeVertexNormals();
    groundGeo.setAttribute("color", new BufferAttribute(fadeColors(Array.from(gPos), COLORS.groundShaded), 4));
    this.groundMesh = new Mesh(
      groundGeo,
      new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }),
    );

    // Ground as survey grid lines every 4 m (the CAD look)
    const lp: number[] = [];
    const every = 4;
    for (let iz = 0; iz < NZ; iz += every)
      for (let ix = 0; ix < NX - 1; ix++) {
        const a = iz * NX + ix;
        lp.push(m.x[a], Y(m.ground[a]), m.z[a], m.x[a + 1], Y(m.ground[a + 1]), m.z[a + 1]);
      }
    for (let ix = 0; ix < NX; ix += every)
      for (let iz = 0; iz < NZ - 1; iz++) {
        const a = iz * NX + ix;
        const b = a + NX;
        lp.push(m.x[a], Y(m.ground[a]), m.z[a], m.x[b], Y(m.ground[b]), m.z[b]);
      }
    const lineGeo = new BufferGeometry();
    lineGeo.setAttribute("position", new BufferAttribute(new Float32Array(lp), 3));
    lineGeo.setAttribute("color", new BufferAttribute(fadeColors(lp, COLORS.ground), 4));
    // Edges of the survey grid fade out: an object in space, not a picture in a frame
    this.groundLines = new LineSegments(lineGeo, new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32 }));

    // ---------- design surface (only where it differs from the ground, plus the formation) ----------
    const dIndex: number[] = [];
    const dColor = new Float32Array(NX * NZ * 3);
    for (let i = 0; i < NX * NZ; i++) {
      const c = Math.abs(m.z[i]) <= HALF_CARRIAGEWAY ? COLORS.road : Math.abs(m.z[i]) <= HALF_FORMATION ? COLORS.road.clone().lerp(COLORS.slope, 0.4) : COLORS.slope;
      dColor.set([c.r, c.g, c.b], i * 3);
    }
    for (let iz = 0; iz < NZ - 1; iz++)
      for (let ix = 0; ix < NX - 1; ix++) {
        const a = iz * NX + ix;
        const corners = [a, a + 1, a + NX, a + NX + 1];
        const works = corners.some((k) => Math.abs(m.depth[k]) > 0.02 || Math.abs(m.z[k]) <= HALF_FORMATION);
        if (works) dIndex.push(a, a + NX, a + 1, a + 1, a + NX, a + NX + 1);
      }
    const designGeo = new BufferGeometry();
    designGeo.setAttribute("position", new BufferAttribute(dPos, 3));
    designGeo.setAttribute("color", new BufferAttribute(dColor, 3));
    designGeo.setIndex(dIndex);
    designGeo.computeVertexNormals();
    this.design = new Mesh(designGeo, new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }));

    // ---------- cut + fill volumes ----------
    [this.cut, this.cutWalls, this.cutEdges] = this.volume(1, Y);
    [this.fill, this.fillWalls, this.fillEdges] = this.volume(-1, Y);

    // ---------- road linework: edges + centreline on the design surface ----------
    this.edges = new Group();
    const lineMat = new LineBasicMaterial({ color: COLORS.line, transparent: true, opacity: 0.85 });
    for (const off of [-HALF_CARRIAGEWAY, 0, HALF_CARRIAGEWAY]) {
      const p: number[] = [];
      for (let x = -LENGTH / 2; x <= LENGTH / 2; x += 2) p.push(x, Y(roadLevel(x)) + 0.05, off);
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(new Float32Array(p), 3));
      const l = new Line(g, off === 0 ? new LineBasicMaterial({ color: COLORS.line, transparent: true, opacity: 0.4 }) : lineMat);
      this.edges.add(l);
    }

    // Build-in sweep: everything east of the clip plane is hidden, a thin scan line marks the front
    const scanGeo = new BufferGeometry();
    scanGeo.setAttribute("position", new BufferAttribute(new Float32Array([0, -2, -WIDTH / 2, 0, -2, WIDTH / 2]), 3));
    this.scan = new Line(scanGeo, new LineBasicMaterial({ color: COLORS.fill, transparent: true, opacity: 0 }));

    this.root.add(this.groundMesh, this.groundLines, this.design, this.cut, this.fill, this.cutWalls, this.fillWalls, this.cutEdges, this.fillEdges, this.edges, this.scan);
    this.renderer.localClippingEnabled = true;
    this.root.traverse((o) => {
      const mat = (o as Mesh).material as { clippingPlanes?: Plane[] } | undefined;
      if (mat && o !== this.scan) mat.clippingPlanes = [this.clip];
    });
    this.scene.add(this.root);
    // Light from above and the north-west: tops bright, walls in shade — reads as solid
    this.scene.add(new AmbientLight(0xffffff, 0.55));
    const sun = new DirectionalLight(0xffffff, 1.25);
    sun.position.set(-30, 90, -45);
    this.scene.add(sun);
    const bounce = new DirectionalLight(0xffffff, 0.35);
    bounce.position.set(40, 20, 60);
    this.scene.add(bounce);

    this.setMode("wireframe");
  }

  /**
   * A closed solid between the ground and the design where depth·sign > 0,
   * drawn so it reads as a VOLUME, not a coloured surface:
   *   - top + bottom faces, see-through (you look into the block)
   *   - side walls, more opaque and flat-shaded (the block's thickness)
   *   - CAD edges: perimeter at top and bottom, vertical corners, and a
   *     cross-section outline every 10 m, like stations on a drawing
   */
  private volume(sign: 1 | -1, Y: (v: number) => number): [Mesh, Mesh, LineSegments] {
    const m = this.model;
    const member = (k: number) => m.depth[k] * sign > 0.01;
    const cellIn = (ix: number, iz: number) => {
      if (ix < 0 || iz < 0 || ix >= NX - 1 || iz >= NZ - 1) return false;
      const a = iz * NX + ix;
      return member(a) || member(a + 1) || member(a + NX) || member(a + NX + 1);
    };
    const base = sign > 0 ? COLORS.cut : COLORS.fill;
    const maxDepth = sign > 0 ? m.maxCut : m.maxFill;
    // corners outside this volume collapse onto the design surface (no inverted slivers)
    const top = (k: number) => Y(sign > 0 ? (member(k) ? m.ground[k] : m.design[k]) : m.design[k]);
    const bottom = (k: number) => Y(sign > 0 ? m.design[k] : member(k) ? m.ground[k] : m.design[k]);

    const faces = { pos: [] as number[], col: [] as number[] };
    const walls = { pos: [] as number[], col: [] as number[] };
    const push = (buf: typeof faces, k: number, isTop: boolean) => {
      buf.pos.push(m.x[k], isTop ? top(k) : bottom(k), m.z[k]);
      const t = Math.min(1, Math.max(0, (m.depth[k] * sign) / maxDepth)); // colour carries the depth
      const f = 0.75 + 0.25 * t;
      buf.col.push(base.r * f, base.g * f, base.b * f);
    };
    const lines: number[] = [];
    const seg = (k1: number, y1: number, k2: number, y2: number) => lines.push(m.x[k1], y1, m.z[k1], m.x[k2], y2, m.z[k2]);

    let n = 0;
    for (let iz = 0; iz < NZ - 1; iz++)
      for (let ix = 0; ix < NX - 1; ix++) {
        if (!cellIn(ix, iz)) continue;
        const a = iz * NX + ix;
        const b = a + 1;
        const c = a + NX;
        const d = c + 1;
        for (const isTop of [true, false]) {
          push(faces, a, isTop); push(faces, c, isTop); push(faces, b, isTop);
          push(faces, b, isTop); push(faces, c, isTop); push(faces, d, isTop);
        }
        const sides: [number, number, boolean][] = [
          [a, b, !cellIn(ix, iz - 1)],
          [c, d, !cellIn(ix, iz + 1)],
          [a, c, !cellIn(ix - 1, iz)],
          [b, d, !cellIn(ix + 1, iz)],
        ];
        for (const [p, q, open] of sides) {
          if (!open) continue;
          push(walls, p, true); push(walls, q, true); push(walls, p, false);
          push(walls, q, true); push(walls, q, false); push(walls, p, false);
          seg(p, top(p), q, top(q));
          seg(p, bottom(p), q, bottom(q));
          if (n++ % 2 === 0 && top(p) - bottom(p) > 0.3) seg(p, top(p), p, bottom(p));
        }
      }

    // Cross-section outlines every 10 m (top profile, bottom profile, closing verticals)
    for (let ix = 5; ix < NX; ix += 10) {
      for (let iz = 0; iz < NZ - 1; iz++) {
        const p = iz * NX + ix;
        const q = p + NX;
        if (!(member(p) || member(q))) continue;
        seg(p, top(p), q, top(q));
        seg(p, bottom(p), q, bottom(q));
        const before = iz > 0 && member(p - NX);
        if (member(p) && !before) seg(p, top(p), p, bottom(p));
        if (member(q) && !(iz + 2 < NZ && member(q + NX))) seg(q, top(q), q, bottom(q));
      }
    }

    const mesh = (buf: typeof faces, opacity: number) => {
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(new Float32Array(buf.pos), 3));
      g.setAttribute("color", new BufferAttribute(new Float32Array(buf.col), 3));
      g.computeVertexNormals(); // non-indexed → one normal per face: crisp, faceted
      return new Mesh(g, new MeshLambertMaterial({ vertexColors: true, side: DoubleSide, transparent: true, opacity, depthWrite: false }));
    };
    const lg = new BufferGeometry();
    lg.setAttribute("position", new BufferAttribute(new Float32Array(lines), 3));
    const edge = base.clone().lerp(new Color("#ffffff"), 0.25);
    return [mesh(faces, 0.16), mesh(walls, 0.32), new LineSegments(lg, new LineBasicMaterial({ color: edge, transparent: true, opacity: 0.8 }))];
  }

  setMode(mode: DisplayMode) {
    const shaded = mode === "shaded";
    const analysis = mode === "analysis";
    this.groundMesh.visible = shaded;
    this.groundLines.visible = !shaded;
    (this.groundLines.material as LineBasicMaterial).opacity = analysis ? 0.16 : 0.32;
    const design = this.design.material as MeshLambertMaterial;
    design.transparent = analysis;
    design.opacity = analysis ? 0.35 : 1;
    // Glass: faint faces, slightly stronger walls, the shape carried by fine edges
    for (const v of [this.cut, this.fill]) (v.material as MeshLambertMaterial).opacity = analysis ? 0.42 : shaded ? 0.24 : 0.16;
    for (const v of [this.cutWalls, this.fillWalls]) (v.material as MeshLambertMaterial).opacity = analysis ? 0.6 : shaded ? 0.4 : 0.32;
    for (const e of [this.cutEdges, this.fillEdges]) (e.material as LineBasicMaterial).opacity = shaded ? 0.6 : 0.8;
    this.requestRender();
  }

  /** Follow the ViewCube: same orientation, same zoom. */
  setView(q: Quaternion, zoom = 1) {
    this.camera.quaternion.copy(q);
    this.camera.position.set(0, 0, 1).applyQuaternion(q).multiplyScalar(CAMERA_DISTANCE);
    this.zoom = zoom;
    this.fit();
    this.requestRender();
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.fit();
    this.requestRender();
  }

  /**
   * Place the model: its centre at (x, y) CSS px on the canvas, `scale` px per
   * metre. The canvas can be much larger than the model's layout box, so the
   * model is never cut off while it turns.
   */
  setAnchor(x: number, y: number, scale: number) {
    this.anchor = { x, y, scale };
    this.fit();
    this.requestRender();
  }

  /** Build-in: 0 → nothing, 1 → everything. The scan line rides the front. */
  setReveal(t: number) {
    const x = -LENGTH / 2 - 2 + (LENGTH + 4) * t;
    this.clip.constant = x;
    const scanMat = this.scan.material as LineBasicMaterial;
    this.scan.position.x = x;
    scanMat.opacity = t > 0 && t < 1 ? 0.9 * Math.sin(Math.PI * t) : 0;
    this.requestRender();
  }

  private fit() {
    // Zoom scales around the anchor (not the canvas centre), so the model stays put
    const s = this.anchor.scale * this.zoom;
    const { x, y } = this.anchor;
    this.camera.left = -x / s;
    this.camera.right = (this.width - x) / s;
    this.camera.top = y / s;
    this.camera.bottom = -(this.height - y) / s;
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  /** Screen position (CSS px) of a model point — for the HTML labels. */
  project(p: [number, number, number]): { x: number; y: number } {
    const v = new Vector3(p[0], (p[1] - 20) * VERTICAL_EXAGGERATION, p[2]).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.width, y: ((1 - v.y) / 2) * this.height };
  }

  /** What is under the pointer (canvas CSS px) — ground/design levels and depth. */
  probe(px: number, py: number): Probe {
    const ndc = new Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    // (the raycaster ignores visibility, so the shaded ground is always pickable)
    const hits = this.raycaster.intersectObjects([this.design, this.groundMesh], false);
    const hit = hits[0];
    if (!hit) return null;
    const { x, z } = hit.point;
    if (Math.abs(x) > LENGTH / 2 || Math.abs(z) > WIDTH / 2) return null;
    const ground = sample(this.model.ground, x, z);
    const design = sample(this.model.design, x, z);
    return { x, z, ground, design, depth: ground - design };
  }

  requestRender() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderer.render(this.scene, this.camera);
      this.onRender?.();
    });
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.scene.traverse((o) => {
      const mesh = o as Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as { dispose?: () => void } | undefined;
      mat?.dispose?.();
    });
    this.renderer.dispose();
  }
}

/**
 * Per-vertex RGBA: full colour in the middle of the model, fading to
 * transparent towards its outer edge (positions are x, y, z triples).
 */
function fadeColors(positions: ArrayLike<number>, color: Color): Float32Array {
  const n = positions.length / 3;
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3] / (LENGTH / 2);
    const z = positions[i * 3 + 2] / (WIDTH / 2);
    const r = Math.min(1, Math.hypot(x * 0.92, z));
    const a = r < 0.62 ? 1 : Math.max(0, 1 - (r - 0.62) / 0.38);
    out.set([color.r, color.g, color.b, a * a], i * 4);
  }
  return out;
}
