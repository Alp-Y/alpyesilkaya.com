/**
 * EXCAVATION SCENE (Three.js) — draws lib/excavation/model.ts.
 * ------------------------------------------------------------------
 * Perspective CAD viewport with its own orbit / zoom / pan. Renders on
 * demand only. Stages:
 *   1 SURVEY    XYZ points appear
 *   2 SURFACES  TIN edges, then the existing ground + the excavated surface
 *   3 BOUNDARY  closed calculation polyline; outside fades
 *   4 VOLUME    surfaces part for a moment; the volume between them glows
 *   5 SECTIONS  section cuts along the road, the chosen one highlighted
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
  LineLoop,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Plane,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  Spherical,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { EXTENT, VE, buildExcavation, inPolygon, type ExcavationModel } from "@/lib/excavation/model";

export type Stage = 1 | 2 | 3 | 4 | 5;

const C = {
  point: new Color("#d9e1ea"),
  tin: new Color("#8d99a6"),
  ground: new Color("#3a4450"),
  excavated: new Color("#5b6f86"),
  volume: new Color("#e2848c"),
  boundary: new Color("#3ee08f"),
  section: new Color("#c9d1da"),
};
const Z0 = 612; // elevation datum for display

export type Hit = { kind: "point"; index: number } | { kind: "surface"; x: number; y: number; eg: number; ex: number } | null;

export class ExcavationScene {
  readonly model: ExcavationModel;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(30, 1, 1, 2000);
  private target = new Vector3(0, 4, 0);
  private sph = new Spherical(215, 1.0, 0.7);
  private root = new Group();
  private points: Points;
  private tin: LineSegments;
  private egIn: Mesh;
  private egOut: Mesh;
  private exMesh: Mesh;
  private walls: Mesh;
  private boundary: LineLoop;
  private sections = new Group();
  private lift = new Group(); // existing ground (+ its TIN) — lifted during the volume stage
  private raycaster = new Raycaster();
  private frame = 0;
  private width = 1;
  private height = 1;
  onRender?: () => void;

  constructor(canvas: HTMLCanvasElement, model: ExcavationModel = buildExcavation()) {
    this.model = model;
    const m = this.model;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.raycaster.params.Points = { threshold: 1.2 };

    const P = (x: number, y: number, z: number) => this.world(x, y, z);
    const n = m.points.length;
    const eg = new Float32Array(n * 3);
    const ex = new Float32Array(n * 3);
    m.points.forEach((p, i) => {
      eg.set(P(p.x, p.y, p.z).toArray(), i * 3);
      ex.set(P(p.x, p.y, p.zx).toArray(), i * 3);
    });

    // ---- survey points (order shuffled so they "arrive" across the site) ----
    const order = [...Array(n).keys()].sort((a, b) => ((a * 7919) % n) - ((b * 7919) % n));
    const ptPos = new Float32Array(n * 3);
    order.forEach((src, i) => ptPos.set(eg.subarray(src * 3, src * 3 + 3), i * 3));
    this.pointOrder = order;
    const pg = new BufferGeometry();
    pg.setAttribute("position", new BufferAttribute(ptPos, 3));
    this.points = new Points(pg, new PointsMaterial({ color: C.point, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.9 }));

    // ---- TIN edges on the existing ground (sorted west → east for a sweep) ----
    const edges = new Map<string, [number, number]>();
    for (const [a, b, c] of m.tris)
      for (const [u, v] of [[a, b], [b, c], [c, a]] as [number, number][]) edges.set(u < v ? `${u},${v}` : `${v},${u}`, [u, v]);
    const edgeList = [...edges.values()].sort((e1, e2) => m.points[e1[0]].x + m.points[e1[1]].x - m.points[e2[0]].x - m.points[e2[1]].x);
    const tp = new Float32Array(edgeList.length * 6);
    edgeList.forEach(([u, v], i) => {
      tp.set(eg.subarray(u * 3, u * 3 + 3), i * 6);
      tp.set(eg.subarray(v * 3, v * 3 + 3), i * 6 + 3);
    });
    const tg = new BufferGeometry();
    tg.setAttribute("position", new BufferAttribute(tp, 3));
    this.tin = new LineSegments(tg, new LineBasicMaterial({ color: C.tin, transparent: true, opacity: 0.35 }));
    this.tinCount = edgeList.length * 2;

    // ---- existing ground: inside / outside the boundary as separate meshes ----
    const mesh = (pos: Float32Array, tris: [number, number, number][], color: Color, opacity: number, depthColors = false) => {
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(pos, 3));
      g.setIndex(tris.flat());
      g.computeVertexNormals();
      if (depthColors) {
        const col = new Float32Array(n * 3);
        const max = m.maxDepth || 1;
        m.points.forEach((p, i) => {
          const t = Math.min(1, Math.max(0, (p.z - p.zx) / max));
          const c = C.ground.clone().lerp(C.volume, t > 0.02 ? 0.35 + 0.65 * t : 0);
          col.set([c.r, c.g, c.b], i * 3);
        });
        g.setAttribute("color", new BufferAttribute(col, 3));
      }
      return new Mesh(
        g,
        new MeshLambertMaterial({ color: depthColors ? 0xffffff : color, vertexColors: depthColors, transparent: true, opacity, side: DoubleSide, depthWrite: false }),
      );
    };
    const inside = m.tris.filter((_, i) => m.triInside[i]);
    const outside = m.tris.filter((_, i) => !m.triInside[i]);
    this.egIn = mesh(eg, inside, C.ground, 0.5, true);
    this.egOut = mesh(eg, outside, C.ground, 0.5);
    this.exMesh = mesh(ex, m.tris, C.excavated, 0.55);

    // ---- the volume's side walls: a curtain along the boundary, existing → excavated ----
    const wall: number[] = [];
    const B = m.boundary;
    for (let i = 0; i < B.length; i++) {
      const [x0, y0] = B[i];
      const [x1, y1] = B[(i + 1) % B.length];
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2);
      for (let k = 0; k < steps; k++) {
        const a = [x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps];
        const b = [x0 + ((x1 - x0) * (k + 1)) / steps, y0 + ((y1 - y0) * (k + 1)) / steps];
        const la = this.levels(a[0], a[1]);
        const lb = this.levels(b[0], b[1]);
        if (!la || !lb) continue;
        const a1 = P(a[0], a[1], la.eg), a0 = P(a[0], a[1], la.ex), b1 = P(b[0], b[1], lb.eg), b0 = P(b[0], b[1], lb.ex);
        wall.push(...a1.toArray(), ...a0.toArray(), ...b1.toArray(), ...b1.toArray(), ...a0.toArray(), ...b0.toArray());
      }
    }
    const wg = new BufferGeometry();
    wg.setAttribute("position", new BufferAttribute(new Float32Array(wall), 3));
    wg.computeVertexNormals();
    this.walls = new Mesh(wg, new MeshLambertMaterial({ color: C.volume, transparent: true, opacity: 0.35, side: DoubleSide, depthWrite: false }));

    // ---- calculation boundary, draped on the existing ground ----
    const bp: number[] = [];
    for (let i = 0; i < B.length; i++) {
      const [x0, y0] = B[i];
      const [x1, y1] = B[(i + 1) % B.length];
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2);
      for (let k = 0; k < steps; k++) {
        const x = x0 + ((x1 - x0) * k) / steps;
        const y = y0 + ((y1 - y0) * k) / steps;
        const l = this.levels(x, y);
        bp.push(...P(x, y, (l?.eg ?? Z0) + 0.15).toArray());
      }
    }
    const bg = new BufferGeometry();
    bg.setAttribute("position", new BufferAttribute(new Float32Array(bp), 3));
    this.boundary = new LineLoop(bg, new LineBasicMaterial({ color: C.boundary, transparent: true, opacity: 0.95 }));

    // ---- sections: existing + excavated profiles at each station ----
    for (const s of m.sections) {
      const g = new Group();
      const [[ax, ay], [bx, by]] = s.line;
      const prof = (key: "eg" | "ex") => {
        const pts: number[] = [];
        for (const smp of s.samples) {
          const t = (smp.o + 36) / 72;
          pts.push(...P(ax + (bx - ax) * t, ay + (by - ay) * t, smp[key] + 0.05).toArray());
        }
        const geo = new BufferGeometry();
        geo.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
        return new Line(geo, new LineBasicMaterial({ color: key === "eg" ? C.section : C.volume, transparent: true, opacity: 0.8 }));
      };
      g.add(prof("eg"), prof("ex"));
      g.userData.station = s.station;
      this.sections.add(g);
    }

    this.lift.add(this.egIn, this.egOut, this.tin);
    this.root.add(this.points, this.lift, this.exMesh, this.walls, this.boundary, this.sections);
    this.scene.add(this.root);
    this.scene.add(new AmbientLight(0xffffff, 0.75));
    const sun = new DirectionalLight(0xffffff, 1.1);
    sun.position.set(-60, 120, -40);
    this.scene.add(sun);
    this.setStage(1, 1);
  }

  private pointOrder: number[] = [];
  private tinCount = 0;
  private stage: Stage = 1;

  /** local (x east, y north, z elevation) → world (x right, y up, z south) */
  world(x: number, y: number, z: number) {
    return new Vector3(x - EXTENT[0] / 2, (z - Z0) * VE, -(y - EXTENT[1] / 2));
  }

  /** Existing / excavated levels at a plan position, interpolated on the TIN. */
  private levels(x: number, y: number) {
    // nearest triangle containing the point
    const m = this.model;
    for (const [a, b, c] of m.tris) {
      const A = m.points[a], B = m.points[b], Cc = m.points[c];
      const det = (B.y - Cc.y) * (A.x - Cc.x) + (Cc.x - B.x) * (A.y - Cc.y);
      const l1 = ((B.y - Cc.y) * (x - Cc.x) + (Cc.x - B.x) * (y - Cc.y)) / det;
      const l2 = ((Cc.y - A.y) * (x - Cc.x) + (A.x - Cc.x) * (y - Cc.y)) / det;
      const l3 = 1 - l1 - l2;
      if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) return { eg: l1 * A.z + l2 * B.z + l3 * Cc.z, ex: l1 * A.zx + l2 * B.zx + l3 * Cc.zx };
    }
    return null;
  }

  /**
   * Show a stage. `t` (0 → 1) is the stage's own build-in progress, so the
   * caller can animate it; 1 = fully shown.
   */
  setStage(stage: Stage, t = 1, section = 80) {
    this.stage = stage;
    const n = this.model.points.length;
    const vis = (o: { visible: boolean }, v: boolean) => (o.visible = v);
    const op = (o: Mesh | Line | Points | LineSegments, v: number) => ((o.material as { opacity: number }).opacity = v);

    // points
    vis(this.points, true);
    this.points.geometry.setDrawRange(0, stage === 1 ? Math.round(n * t) : n);
    op(this.points, stage === 1 ? 0.9 : stage === 2 ? 0.55 : 0.3);

    // TIN + surfaces
    vis(this.tin, stage >= 2);
    this.tin.geometry.setDrawRange(0, stage === 2 ? Math.round(this.tinCount * Math.min(1, t * 1.6)) : this.tinCount);
    const surf = stage === 2 ? Math.max(0, t * 1.6 - 0.6) : 1;
    vis(this.egIn, stage >= 2);
    vis(this.egOut, stage >= 2);
    vis(this.exMesh, stage >= 2);
    const outFade = stage >= 3 ? 1 - 0.75 * (stage === 3 ? t : 1) : 1;
    // from the volume stage on: the ground inside the boundary carries the depth colour, the rest steps back
    op(this.egIn, (stage >= 4 ? 0.72 : 0.5) * surf);
    op(this.egOut, (stage >= 4 ? 0.3 : 0.5) * surf * outFade);
    op(this.tin, stage >= 3 ? 0.18 : 0.35);
    op(this.exMesh, 0.6 * (stage === 2 ? Math.max(0, t * 2 - 1) : 1));

    // boundary
    vis(this.boundary, stage >= 3);
    this.boundary.geometry.setDrawRange(0, stage === 3 ? Math.round((this.boundary.geometry.attributes.position.count) * Math.min(1, t * 1.5)) : Infinity);

    // volume: walls + a brief separation of the surfaces
    vis(this.walls, stage >= 4);
    op(this.walls, stage === 4 ? 0.55 * Math.min(1, t * 2) : 0.4);
    const lift = stage === 4 ? Math.sin(Math.PI * Math.min(1, t)) * 6 : 0;
    this.lift.position.y = lift;
    // sections
    vis(this.sections, stage === 5);
    for (const g of this.sections.children) {
      const on = g.userData.station === section;
      for (const l of g.children) op(l as Line, on ? 1 : 0.28);
    }
    this.requestRender();
  }

  /* ---------------- camera: orbit / zoom / pan ---------------- */

  orbit(dx: number, dy: number) {
    this.sph.theta -= dx * 0.006;
    this.sph.phi = Math.min(1.45, Math.max(0.2, this.sph.phi - dy * 0.006));
    this.updateCamera();
  }
  zoom(f: number) {
    this.sph.radius = Math.min(520, Math.max(90, this.sph.radius * f));
    this.updateCamera();
  }
  pan(dx: number, dy: number) {
    const k = this.sph.radius / this.height;
    const right = new Vector3().setFromMatrixColumn(this.camera.matrix, 0);
    const up = new Vector3().setFromMatrixColumn(this.camera.matrix, 1);
    this.target.addScaledVector(right, -dx * k * 0.5).addScaledVector(up, dy * k * 0.5);
    this.updateCamera();
  }
  resetView() {
    this.target.set(0, 4, 0);
    this.sph.set(215, 1.0, 0.7);
    this.updateCamera();
  }
  private updateCamera() {
    this.camera.position.setFromSpherical(this.sph).add(this.target);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    this.requestRender();
  }

  resize(w: number, h: number) {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    // Keep the whole site in view on narrow screens
    this.sph.radius = Math.max(this.sph.radius, this.camera.aspect < 1.2 ? 330 : 0);
    this.camera.updateProjectionMatrix();
    this.updateCamera();
  }

  /** Screen position (CSS px) of a local point, for HTML labels. null if behind the camera. */
  project(x: number, y: number, z: number) {
    const v = this.world(x, y, z);
    v.project(this.camera);
    if (v.z > 1) return null;
    return { x: ((v.x + 1) / 2) * this.width, y: ((1 - v.y) / 2) * this.height };
  }

  /** What is under the pointer: a survey point (stage 1–2) or the surface. */
  pick(px: number, py: number): Hit {
    const ndc = new Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    if (this.stage <= 2) {
      const hp = this.raycaster.intersectObject(this.points, false)[0];
      if (hp && hp.index !== undefined && hp.index < (this.points.geometry.drawRange.count || Infinity)) return { kind: "point", index: this.pointOrder[hp.index] };
    }
    if (this.stage < 2) return null;
    const hs = this.raycaster.intersectObjects([this.egIn, this.egOut], false)[0];
    if (!hs) return null;
    const x = hs.point.x + EXTENT[0] / 2;
    const y = -hs.point.z + EXTENT[1] / 2;
    const l = this.levels(x, y);
    return l ? { kind: "surface", x, y, eg: l.eg, ex: l.ex } : null;
  }

  /** Plan position under the pointer on a horizontal plane (for the coordinate readout). */
  planAt(px: number, py: number) {
    const ndc = new Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new Vector3();
    if (!this.raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -8), hit)) return null;
    return { x: hit.x + EXTENT[0] / 2, y: -hit.z + EXTENT[1] / 2 };
  }

  isInside(x: number, y: number) {
    return inPolygon([x, y], this.model.boundary);
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
      (mesh.material as { dispose?: () => void } | undefined)?.dispose?.();
    });
    this.renderer.dispose();
  }
}
