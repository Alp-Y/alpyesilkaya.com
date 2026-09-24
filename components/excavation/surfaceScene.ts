/**
 * SURFACE SCENE (Three.js) — draws an Excavation Volume Engine result.
 * ------------------------------------------------------------------
 * A lightweight CAD/GIS viewport: renders on demand only, no animation
 * loop. Layers (each can be toggled):
 *   points     the XYZ survey shots (excavated + existing ground)
 *   tin        the triangulation edges
 *   existing   the existing ground surface (TIN, or the constant level)
 *   excavated  the excavated surface, coloured by cut depth
 *   cut        the volume between them: vertical depth lines
 *   + the current section line, cut through both surfaces
 * The build-in (`setBuild(t)`, t 0 → 1) replays the calculation:
 * points → TIN edges → surfaces → cut volume.
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
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  Spherical,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from "three";
import type { EngineResult } from "@/lib/excavation/engine";
import { levelsAt, type SectionProfile } from "@/lib/excavation/volume";
import { verticalExaggeration } from "./view";

export type Layers = { points: boolean; tin: boolean; existing: boolean; excavated: boolean; cut: boolean };
export type Hit =
  | { kind: "point"; survey: "excavated" | "existing"; index: number }
  | { kind: "surface"; x: number; y: number; eg: number; ex: number }
  | null;

const C = {
  exPoint: new Color("#d9e1ea"),
  egPoint: new Color("#7f8c99"),
  tin: new Color("#8d99a6"),
  ground: new Color("#3a4450"),
  excavated: new Color("#5b6f86"),
  cut: new Color("#e2848c"),
  section: new Color("#3ee08f"),
};

const DEFAULT_VIEW = { theta: 0.72, phi: 0.98 };

export class SurfaceScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(30, 1, 0.5, 5000);
  private target = new Vector3();
  private sph = new Spherical(200, DEFAULT_VIEW.phi, DEFAULT_VIEW.theta);
  private home = 200;
  private raycaster = new Raycaster();
  private frame = 0;
  private width = 1;
  private height = 1;

  private data: Group | null = null;
  private sectionGroup = new Group();
  private obj: {
    exPoints?: Points;
    egPoints?: Points;
    exTin?: LineSegments;
    egTin?: LineSegments;
    existing?: Mesh;
    excavated?: Mesh;
    sticks?: LineSegments;
  } = {};
  private depth: Float32Array = new Float32Array(0);
  private maxDepth = 1;
  private layers: Layers = { points: true, tin: true, existing: true, excavated: true, cut: true };
  private build = 1;

  result: EngineResult | null = null;
  /** world units per metre vertically (vertical exaggeration) */
  ve = 1;
  private center: [number, number] = [0, 0];
  private z0 = 0;
  onRender?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.scene.add(new AmbientLight(0xffffff, 0.75));
    const sun = new DirectionalLight(0xffffff, 1.1);
    sun.position.set(-60, 120, -40);
    this.scene.add(sun);
    this.scene.add(this.sectionGroup);
  }

  /* ---------------- data ---------------- */

  setData(r: EngineResult) {
    this.clearGroup(this.data);
    this.clearGroup(this.sectionGroup, false);
    this.result = r;
    const c = r.comparison;
    const data = new Group();
    this.data = data;
    this.obj = {};

    // frame: centre of the compared area, datum at the lowest level, auto V.E.
    const xs = c.vertices.map((v) => v.x);
    const ys = c.vertices.map((v) => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    this.center = [(minX + maxX) / 2, (minY + maxY) / 2];
    const span = Math.max(maxX - minX, maxY - minY, 1);
    const zMin = Math.min(c.exZMin, c.egZMin);
    this.z0 = zMin;
    this.ve = verticalExaggeration(c);
    this.home = span * 1.55;
    this.maxDepth = Math.max(0.01, c.maxDepth);

    const P = (x: number, y: number, z: number) => this.world(x, y, z);
    const n = c.vertices.length;
    const eg = new Float32Array(n * 3);
    const ex = new Float32Array(n * 3);
    this.depth = new Float32Array(n);
    c.vertices.forEach((v, i) => {
      eg.set(P(v.x, v.y, v.eg).toArray(), i * 3);
      ex.set(P(v.x, v.y, v.ex).toArray(), i * 3);
      this.depth[i] = Math.max(0, v.eg - v.ex);
    });
    const index = c.tris.flat();

    // surfaces
    const existing = this.mesh(eg, index, C.ground, 0.42);
    const excavated = this.mesh(ex, index, C.excavated, 0.8, true);
    this.obj.existing = existing;
    this.obj.excavated = excavated;

    // survey points (as surveyed, not the composite)
    const pointCloud = (pts: { x: number; y: number; z: number }[], color: Color, size: number) => {
      const pos = new Float32Array(pts.length * 3);
      // arrival order: a stable shuffle, so points appear across the whole site
      const order = [...pts.keys()].sort((a, b) => ((a * 7919) % pts.length) - ((b * 7919) % pts.length));
      order.forEach((src, i) => pos.set(P(pts[src].x, pts[src].y, pts[src].z).toArray(), i * 3));
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(pos, 3));
      const o = new Points(g, new PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false }));
      o.userData.order = order;
      return o;
    };
    this.obj.exPoints = pointCloud(r.excavated.points, C.exPoint, 2.2);
    if (r.existing.points.length) this.obj.egPoints = pointCloud(r.existing.points, C.egPoint, 1.8);

    // TIN edges, sorted along the principal axis so they sweep across the site
    const tinLines = (surface: EngineResult["excavated"]) => {
      const { dir, origin } = c.axis;
      const s = (i: number) => (surface.points[i].x - origin[0]) * dir[0] + (surface.points[i].y - origin[1]) * dir[1];
      const edges = [...surface.edges()].sort((e1, e2) => s(e1[0]) + s(e1[1]) - s(e2[0]) - s(e2[1]));
      const pos = new Float32Array(edges.length * 6);
      edges.forEach(([u, v], i) => {
        pos.set(P(surface.points[u].x, surface.points[u].y, surface.points[u].z).toArray(), i * 6);
        pos.set(P(surface.points[v].x, surface.points[v].y, surface.points[v].z).toArray(), i * 6 + 3);
      });
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(pos, 3));
      return new LineSegments(g, new LineBasicMaterial({ color: C.tin, transparent: true, opacity: 0.32, depthWrite: false }));
    };
    this.obj.exTin = tinLines(r.excavated);
    if (r.existing.tris.length) this.obj.egTin = tinLines(r.existing);

    // the cut volume: vertical depth lines from the excavated surface up to the ground
    const threshold = Math.max(0.05, this.maxDepth * 0.03);
    const stick: number[] = [];
    c.vertices.forEach((v, i) => {
      if (this.depth[i] > threshold) stick.push(...P(v.x, v.y, v.ex).toArray(), ...P(v.x, v.y, v.eg).toArray());
    });
    const sg = new BufferGeometry();
    sg.setAttribute("position", new BufferAttribute(new Float32Array(stick), 3));
    this.obj.sticks = new LineSegments(sg, new LineBasicMaterial({ color: C.cut, transparent: true, opacity: 0.5, depthWrite: false }));

    for (const o of Object.values(this.obj)) if (o) data.add(o);
    this.scene.add(data);
    this.resetView(false);
    this.apply();
  }

  private mesh(pos: Float32Array, index: number[], color: Color, opacity: number, vertexColors = false) {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    if (vertexColors) g.setAttribute("color", new BufferAttribute(new Float32Array((pos.length / 3) * 3), 3));
    return new Mesh(g, new MeshLambertMaterial({ color: vertexColors ? 0xffffff : color, vertexColors, transparent: true, opacity, side: DoubleSide, depthWrite: false }));
  }

  /* ---------------- state ---------------- */

  setLayers(layers: Layers) {
    this.layers = { ...layers };
    this.apply();
  }

  /** Build-in progress 0 → 1 (points → TIN → surfaces → cut). */
  setBuild(t: number) {
    this.build = Math.max(0, Math.min(1, t));
    this.apply();
  }

  private apply() {
    const o = this.obj;
    const L = this.layers;
    const t = this.build;
    const seg = (a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
    const pPts = seg(0, 0.3), pTin = seg(0.18, 0.5), pSurf = seg(0.42, 0.7), pCut = seg(0.66, 0.95);
    const op = (m: { material: Material | Material[] }, v: number) => ((m.material as Material).opacity = v);

    for (const pts of [o.exPoints, o.egPoints]) {
      if (!pts) continue;
      const count = pts.geometry.attributes.position.count;
      pts.visible = L.points && pPts > 0;
      pts.geometry.setDrawRange(0, Math.round(count * pPts));
      op(pts, (pts === o.exPoints ? 0.9 : 0.6) * (t >= 1 ? (L.excavated || L.existing ? 0.7 : 1) : 1));
    }
    for (const tin of [o.exTin, o.egTin]) {
      if (!tin) continue;
      const count = tin.geometry.attributes.position.count;
      const surfaceOn = tin === o.exTin ? L.excavated || !L.existing : L.existing;
      tin.visible = L.tin && pTin > 0 && surfaceOn;
      tin.geometry.setDrawRange(0, Math.round(count * pTin));
      op(tin, tin === o.egTin ? 0.2 : 0.3);
    }
    if (o.existing) {
      o.existing.visible = L.existing && pSurf > 0;
      op(o.existing, 0.4 * pSurf);
    }
    if (o.excavated) {
      o.excavated.visible = L.excavated && pSurf > 0;
      op(o.excavated, 0.85 * pSurf);
      // depth colour: steel → cut red, faded in with the cut stage
      const col = o.excavated.geometry.attributes.color as BufferAttribute;
      const k = L.cut ? pCut : 0;
      const tmp = new Color();
      for (let i = 0; i < this.depth.length; i++) {
        const d = this.depth[i] / this.maxDepth;
        tmp.copy(C.excavated).lerp(C.cut, d > 0.005 ? (0.3 + 0.7 * d) * k : 0);
        col.setXYZ(i, tmp.r, tmp.g, tmp.b);
      }
      col.needsUpdate = true;
    }
    if (o.sticks) {
      const count = o.sticks.geometry.attributes.position.count;
      o.sticks.visible = L.cut && pCut > 0;
      o.sticks.geometry.setDrawRange(0, Math.round(count * pCut));
    }
    this.requestRender();
  }

  /** Show the current section: its line on both surfaces + the vertical cut plane. */
  setSection(profile: SectionProfile | null) {
    this.clearGroup(this.sectionGroup, false);
    if (!profile || !this.result || profile.samples.length < 2) return this.requestRender();
    const { axis } = this.result.comparison;
    const P = (h: number, z: number) => {
      const [x, y] = profile.kind === "cross" ? [axis.origin[0] + axis.dir[0] * profile.at + axis.normal[0] * h, axis.origin[1] + axis.dir[1] * profile.at + axis.normal[1] * h] : [axis.origin[0] + axis.dir[0] * h + axis.normal[0] * profile.at, axis.origin[1] + axis.dir[1] * h + axis.normal[1] * profile.at];
      return this.world(x, y, z);
    };
    const line = (key: "eg" | "ex", color: Color, opacity: number) => {
      const pts: number[] = [];
      for (const s of profile.samples) pts.push(...P(s.h, s[key] + 0.05).toArray());
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
      return new Line(g, new LineBasicMaterial({ color, transparent: true, opacity, depthTest: false }));
    };
    // the cut face between the two profiles
    const face: number[] = [];
    for (let i = 1; i < profile.samples.length; i++) {
      const a = profile.samples[i - 1], b = profile.samples[i];
      if (a.eg - a.ex < 0.005 && b.eg - b.ex < 0.005) continue;
      const a1 = P(a.h, a.eg), a0 = P(a.h, a.ex), b1 = P(b.h, b.eg), b0 = P(b.h, b.ex);
      face.push(...a1.toArray(), ...a0.toArray(), ...b1.toArray(), ...b1.toArray(), ...a0.toArray(), ...b0.toArray());
    }
    const fg = new BufferGeometry();
    fg.setAttribute("position", new BufferAttribute(new Float32Array(face), 3));
    const faceMesh = new Mesh(fg, new MeshLambertMaterial({ color: C.section, transparent: true, opacity: 0.28, side: DoubleSide, depthWrite: false }));
    this.sectionGroup.add(faceMesh, line("eg", C.section, 0.95), line("ex", C.cut, 0.95));
    this.requestRender();
  }

  /* ---------------- camera ---------------- */

  world(x: number, y: number, z: number) {
    return new Vector3(x - this.center[0], (z - this.z0) * this.ve, -(y - this.center[1]));
  }

  orbit(dx: number, dy: number) {
    this.sph.theta -= dx * 0.006;
    this.sph.phi = Math.min(1.5, Math.max(0.02, this.sph.phi - dy * 0.006));
    this.updateCamera();
  }
  zoom(f: number) {
    this.sph.radius = Math.min(this.home * 3, Math.max(this.home * 0.25, this.sph.radius * f));
    this.updateCamera();
  }
  pan(dx: number, dy: number) {
    const k = (this.sph.radius / this.height) * 0.9;
    const right = new Vector3().setFromMatrixColumn(this.camera.matrix, 0);
    const up = new Vector3().setFromMatrixColumn(this.camera.matrix, 1);
    this.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
    this.updateCamera();
  }
  resetView(render = true) {
    this.target.set(0, (this.result ? (this.result.comparison.egZMax - this.z0) * this.ve * 0.3 : 0), 0);
    this.sph.set(this.fitRadius(), DEFAULT_VIEW.phi, DEFAULT_VIEW.theta);
    if (render) this.updateCamera();
    else this.syncCamera();
  }
  /** Plan view (looking straight down, north up). */
  topView() {
    this.target.set(0, 0, 0);
    this.sph.set(this.fitRadius() * 1.05, 0.02, 0);
    this.updateCamera();
  }
  private fitRadius() {
    // narrow viewports need more distance to keep the whole site in view
    const aspect = this.width / this.height;
    return this.home * (aspect < 1 ? 1.45 / Math.max(aspect, 0.55) : aspect < 1.45 ? 1.4 : 1);
  }
  private syncCamera() {
    this.camera.position.setFromSpherical(this.sph).add(this.target);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }
  private updateCamera() {
    this.syncCamera();
    this.requestRender();
  }

  resize(w: number, h: number) {
    const first = this.width === 1;
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    if (first) this.sph.radius = this.fitRadius();
    this.updateCamera();
  }

  /** Screen position (CSS px) of a local point, for HTML labels. null if behind the camera. */
  project(x: number, y: number, z: number) {
    const v = this.world(x, y, z).project(this.camera);
    if (v.z > 1) return null;
    return { x: ((v.x + 1) / 2) * this.width, y: ((1 - v.y) / 2) * this.height };
  }

  /** What is under the pointer: a survey point or a surface position. */
  pick(px: number, py: number): Hit {
    if (!this.result) return null;
    this.raycaster.setFromCamera(new Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1), this.camera);
    this.raycaster.params.Points = { threshold: this.home / 180 };
    const o = this.obj;
    for (const [pts, survey] of [[o.exPoints, "excavated"], [o.egPoints, "existing"]] as const) {
      if (!pts?.visible) continue;
      const hit = this.raycaster.intersectObject(pts, false)[0];
      if (hit?.index !== undefined && hit.index < pts.geometry.drawRange.count) return { kind: "point", survey, index: (pts.userData.order as number[])[hit.index] };
    }
    const meshes = [o.excavated, o.existing].filter((m): m is Mesh => !!m?.visible);
    const hs = this.raycaster.intersectObjects(meshes, false)[0];
    if (!hs) return null;
    const x = hs.point.x + this.center[0];
    const y = -hs.point.z + this.center[1];
    const l = levelsAt(this.result.comparison, x, y);
    return l ? { kind: "surface", x, y, eg: l.eg, ex: l.ex } : null;
  }

  requestRender() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderer.render(this.scene, this.camera);
      this.onRender?.();
    });
  }

  private clearGroup(g: Object3D | null, detach = true) {
    if (!g) return;
    g.traverse((o) => {
      const m = o as Mesh;
      if (m !== g) {
        m.geometry?.dispose();
        (m.material as Material | undefined)?.dispose?.();
      }
    });
    if (detach) g.removeFromParent();
    else g.clear();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.clearGroup(this.data);
    this.clearGroup(this.sectionGroup);
    this.renderer.dispose();
  }
}
