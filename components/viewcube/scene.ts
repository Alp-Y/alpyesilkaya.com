/**
 * VIEW CUBE SCENE
 * ------------------------------------------------------------------
 * Builds the 3D geometry, all procedurally (no model files):
 *
 *  - The cube: each face is split into a 3×3 grid of "tiles". The middle
 *    tile is the face, the strips along the border are edges and the
 *    squares at the corners are corners. Each tile knows which region
 *    it belongs to, e.g. {x:1, y:1, z:0} = the TOP-RIGHT edge. An edge is
 *    made of two strips (one on each face it joins), a corner of three
 *    squares, so hovering highlights the whole region.
 *  - Visible edges (1 CSS px, crisp on Retina) and dashed hidden edges,
 *    like a CAD hidden-line view.
 *  - Face labels drawn on canvas textures, so they turn with the cube.
 *  - Two compass rings around the cube plus a highlight arc.
 *
 * All colours come from the site's design tokens (read at start-up).
 */

import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  EdgesGeometry,
  Float32BufferAttribute,
  GreaterDepth,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  Vector3,
  type Material,
  type Texture,
} from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { regionKey, type Region } from "./orientation";

export type Palette = {
  face: string;
  faceShaded: string;
  faceHover: string;
  faceActive: string;
  edge: string;
  hidden: string;
  ring: string;
  label: string;
  accent: string;
  font: string;
};

/** Half the cube's size in world units. The cube spans −1 … +1 on every axis. */
export const HALF = 1;
/** Where a face's middle tile ends and the edge strips begin. */
const BAND = 0.6;
/** Compass ring radius. */
export const RING_RADIUS = 2.15;
/**
 * Height of the compass ring. Slightly below the middle of the cube, so in
 * FRONT / SIDE views the ring (seen edge-on as a line) passes under the face label.
 */
export const RING_Y = -0.6;
/** Resting opacity of the outer / inner ring (they brighten while you drag). */
const RING_OPACITY = [0.34, 0.17] as const;
/** Distance of the N/E/S/W labels from the centre. */
export const COMPASS_RADIUS = 2.55;

export const COMPASS_POINTS: { label: "N" | "E" | "S" | "W"; position: Vector3 }[] = [
  { label: "N", position: new Vector3(0, RING_Y, -COMPASS_RADIUS) },
  { label: "E", position: new Vector3(COMPASS_RADIUS, RING_Y, 0) },
  { label: "S", position: new Vector3(0, RING_Y, COMPASS_RADIUS) },
  { label: "W", position: new Vector3(-COMPASS_RADIUS, RING_Y, 0) },
];

type Axis = "x" | "y" | "z";
const AXES: Axis[] = ["x", "y", "z"];

const FACE_LABELS: { normal: Vector3; up: Vector3; text: string }[] = [
  { normal: new Vector3(0, 1, 0), up: new Vector3(0, 0, -1), text: "TOP" },
  { normal: new Vector3(0, -1, 0), up: new Vector3(0, 0, 1), text: "BOTTOM" },
  { normal: new Vector3(0, 0, 1), up: new Vector3(0, 1, 0), text: "FRONT" },
  { normal: new Vector3(0, 0, -1), up: new Vector3(0, 1, 0), text: "BACK" },
  { normal: new Vector3(1, 0, 0), up: new Vector3(0, 1, 0), text: "RIGHT" },
  { normal: new Vector3(-1, 0, 0), up: new Vector3(0, 1, 0), text: "LEFT" },
];

export class ViewCubeScene {
  readonly scene = new Scene();
  readonly root = new Group();
  /** The meshes the raycaster tests against. */
  readonly tiles: Mesh[] = [];

  private readonly tilesByRegion = new Map<string, Mesh[]>();
  private readonly lineMaterials: LineMaterial[] = [];
  private readonly disposables: { dispose(): void }[] = [];

  private readonly baseMat: MeshBasicMaterial;
  private readonly hoverMat: MeshBasicMaterial;
  private readonly activeMat: MeshBasicMaterial;
  private readonly baseColor: Color;
  private readonly hoverColor: Color;
  private readonly activeColor: Color;

  private readonly ringMats: LineMaterial[] = [];
  private hiddenMat!: LineMaterial;
  private accentMat!: LineMaterial;
  private readonly arcMat: LineMaterial;
  private readonly arc: LineSegments2;

  private hoverKey: string | null = null;
  private activeKey: string | null = null;
  private hoverT = 0; // 0 → 1 fade of the hover colour
  private activeT = 0; // 1 → 0 fade of the selection tint
  private ringEmphasis = 0; // current
  private ringEmphasisTarget = 0;
  private arcT = 0;

  constructor(private readonly palette: Palette) {
    this.scene.add(this.root);

    this.baseColor = new Color(palette.face);
    this.hoverColor = new Color(palette.faceHover);
    this.activeColor = new Color(palette.faceActive);
    this.baseMat = this.track(new MeshBasicMaterial({ color: this.baseColor, transparent: true, opacity: 0.9 }));
    this.hoverMat = this.track(new MeshBasicMaterial({ color: this.baseColor.clone(), transparent: true, opacity: 0.95 }));
    this.activeMat = this.track(new MeshBasicMaterial({ color: this.activeColor.clone(), transparent: true, opacity: 0.95 }));

    this.buildTiles();
    this.buildEdges();
    this.buildLabels();
    this.buildRings();

    // Highlight arc on the outer ring (rotated to face the camera during transitions)
    const arcPoints: number[] = [];
    const span = 22 * (Math.PI / 180);
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const a0 = -span + (2 * span * i) / steps;
      const a1 = -span + (2 * span * (i + 1)) / steps;
      arcPoints.push(
        Math.sin(a0) * RING_RADIUS, RING_Y, Math.cos(a0) * RING_RADIUS,
        Math.sin(a1) * RING_RADIUS, RING_Y, Math.cos(a1) * RING_RADIUS,
      );
    }
    this.arcMat = this.lineMaterial({ color: palette.accent, linewidth: 1.5, opacity: 0 });
    const arcGeo = this.track(new LineSegmentsGeometry().setPositions(arcPoints));
    this.arc = new LineSegments2(arcGeo, this.arcMat);
    this.arc.renderOrder = 5;
    this.root.add(this.arc);
  }

  /* ---------------- building ---------------- */

  private buildTiles() {
    const bounds: [number, number, -1 | 0 | 1][] = [
      [-HALF, -BAND, -1],
      [-BAND, BAND, 0],
      [BAND, HALF, 1],
    ];

    for (const axis of AXES) {
      const [u, v] = AXES.filter((a) => a !== axis) as [Axis, Axis];
      for (const sign of [-1, 1] as const) {
        const normal = new Vector3();
        normal[axis] = sign;
        for (const [u0, u1, ru] of bounds) {
          for (const [v0, v1, rv] of bounds) {
            const corner = (cu: number, cv: number) => {
              const p = new Vector3();
              p[axis] = sign * HALF;
              p[u] = cu;
              p[v] = cv;
              return p;
            };
            let quad = [corner(u0, v0), corner(u1, v0), corner(u1, v1), corner(u0, v1)];
            // Wind the quad so its front side faces outwards.
            const n = new Vector3().subVectors(quad[1], quad[0]).cross(new Vector3().subVectors(quad[2], quad[0]));
            if (n.dot(normal) < 0) quad = quad.reverse();

            const geo = new BufferGeometry();
            const [a, b, c, d] = quad;
            geo.setAttribute(
              "position",
              new Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z], 3),
            );
            this.track(geo);

            const region = { x: 0, y: 0, z: 0 } as Region;
            region[axis] = sign;
            region[u] = ru;
            region[v] = rv;

            const mesh = new Mesh(geo, this.baseMat);
            mesh.renderOrder = 0;
            mesh.userData.region = region;
            this.root.add(mesh);
            this.tiles.push(mesh);
            const key = regionKey(region);
            const list = this.tilesByRegion.get(key) ?? [];
            list.push(mesh);
            this.tilesByRegion.set(key, list);
          }
        }
      }
    }
  }

  private buildEdges() {
    const box = new BoxGeometry(HALF * 2, HALF * 2, HALF * 2);
    const edges = new EdgesGeometry(box);
    const positions = Array.from(edges.getAttribute("position").array as Float32Array);
    box.dispose();
    edges.dispose();

    // Visible edges
    const visibleGeo = this.track(new LineSegmentsGeometry().setPositions(positions));
    const visible = new LineSegments2(visibleGeo, this.lineMaterial({ color: this.palette.edge, linewidth: 1, opacity: 0.9 }));
    visible.renderOrder = 2;
    this.root.add(visible);

    // Hidden edges — only drawn where they are behind the cube, dashed
    const hiddenMat = this.lineMaterial({ color: this.palette.hidden, linewidth: 1, opacity: 0.45, dashed: true });
    this.hiddenMat = hiddenMat;
    hiddenMat.dashSize = 0.07;
    hiddenMat.gapSize = 0.07;
    hiddenMat.depthFunc = GreaterDepth;
    hiddenMat.depthWrite = false;
    const hiddenGeo = this.track(new LineSegmentsGeometry().setPositions(positions));
    const hidden = new LineSegments2(hiddenGeo, hiddenMat);
    hidden.computeLineDistances();
    hidden.renderOrder = 3;
    this.root.add(hidden);

    // Accent: the front-right vertical edge, as in the original drawing
    const accentGeo = this.track(new LineSegmentsGeometry().setPositions([HALF, -HALF, HALF, HALF, HALF, HALF]));
    this.accentMat = this.lineMaterial({ color: this.palette.accent, linewidth: 1.25, opacity: 0.6 });
    const accent = new LineSegments2(accentGeo, this.accentMat);
    accent.renderOrder = 4;
    this.root.add(accent);
  }

  private buildLabels() {
    for (const face of FACE_LABELS) {
      const texture = this.labelTexture(face.text);
      const mat = this.track(
        new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.88 }),
      );
      const geo = this.track(new PlaneGeometry(1.4, 0.7));
      const mesh = new Mesh(geo, mat);
      mesh.position.copy(face.normal).multiplyScalar(HALF + 0.004);
      mesh.up.copy(face.up);
      mesh.lookAt(face.normal.clone().multiplyScalar(2));
      mesh.renderOrder = 1;
      mesh.raycast = () => {}; // labels never block the tiles
      this.root.add(mesh);
    }
  }

  private buildRings() {
    const circle = (radius: number, segments = 160) => {
      const pts: number[] = [];
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        pts.push(Math.sin(a0) * radius, RING_Y, Math.cos(a0) * radius, Math.sin(a1) * radius, RING_Y, Math.cos(a1) * radius);
      }
      return pts;
    };
    const outerMat = this.lineMaterial({ color: this.palette.ring, linewidth: 1, opacity: RING_OPACITY[0] });
    const innerMat = this.lineMaterial({ color: this.palette.ring, linewidth: 1, opacity: RING_OPACITY[1] });
    this.ringMats.push(outerMat, innerMat);

    const outer = new LineSegments2(this.track(new LineSegmentsGeometry().setPositions(circle(RING_RADIUS))), outerMat);
    const inner = new LineSegments2(this.track(new LineSegmentsGeometry().setPositions(circle(RING_RADIUS - 0.27))), innerMat);
    outer.renderOrder = inner.renderOrder = 4;
    this.root.add(outer, inner);
  }

  private labelTexture(text: string): Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = this.palette.label;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const size = text.length > 5 ? 74 : 84;
      ctx.font = `500 ${size}px ${this.palette.font}`;
      // Letter-spacing where supported (drawn manually otherwise)
      const spacing = size * 0.12;
      const chars = [...text];
      const widths = chars.map((c) => ctx.measureText(c).width);
      const total = widths.reduce((s, w) => s + w, 0) + spacing * (chars.length - 1);
      let x = canvas.width / 2 - total / 2;
      ctx.textAlign = "left";
      chars.forEach((c, i) => {
        ctx.fillText(c, x, canvas.height / 2 + 4);
        x += widths[i] + spacing;
      });
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return this.track(texture);
  }

  private lineMaterial(opts: { color: string; linewidth: number; opacity: number; dashed?: boolean }): LineMaterial {
    const mat = new LineMaterial({
      color: new Color(opts.color).getHex(),
      linewidth: opts.linewidth,
      transparent: true,
      opacity: opts.opacity,
      dashed: opts.dashed ?? false,
      worldUnits: false,
    });
    this.lineMaterials.push(mat);
    return this.track(mat);
  }

  private track<T extends { dispose(): void }>(obj: T): T {
    this.disposables.push(obj);
    return obj;
  }

  /* ---------------- state ---------------- */

  /** Line widths are in CSS pixels; the line shader needs the canvas size. */
  setResolution(width: number, height: number) {
    for (const m of this.lineMaterials) m.resolution.set(width, height);
  }

  setHover(region: Region | null) {
    const key = region ? regionKey(region) : null;
    if (key === this.hoverKey) return;
    if (this.hoverKey !== this.activeKey) this.applyMaterial(this.hoverKey, this.baseMat);
    this.hoverKey = key;
    this.hoverT = 0;
    this.hoverMat.color.copy(this.baseColor);
    if (key !== this.activeKey) this.applyMaterial(key, this.hoverMat);
  }

  /** Briefly tint the region that was just selected. */
  setActive(region: Region | null) {
    this.applyMaterial(this.activeKey, this.baseMat);
    if (this.hoverKey && this.hoverKey !== (region ? regionKey(region) : null)) this.applyMaterial(this.hoverKey, this.hoverMat);
    this.activeKey = region ? regionKey(region) : null;
    this.activeT = region ? 1 : 0;
    this.activeMat.color.copy(this.activeColor);
    if (this.activeKey) this.applyMaterial(this.activeKey, this.activeMat);
  }

  /**
   * Follow the workspace display mode:
   *   wireframe — translucent faces, dashed hidden edges
   *   shaded    — solid faces, hidden edges off
   *   analysis  — solid faces, the accent edge emphasised
   */
  setDisplayMode(mode: "wireframe" | "shaded" | "analysis") {
    const solid = mode !== "wireframe";
    this.baseColor.set(solid ? this.palette.faceShaded : this.palette.face);
    this.baseMat.color.copy(this.baseColor);
    this.baseMat.opacity = solid ? 0.97 : 0.9;
    this.hiddenMat.opacity = solid ? 0 : 0.45;
    this.hiddenMat.visible = !solid;
    this.accentMat.opacity = mode === "analysis" ? 1 : 0.6;
    this.accentMat.linewidth = mode === "analysis" ? 1.75 : 1.25;
  }

  /** Stronger rings while dragging. */
  setRingEmphasis(on: boolean) {
    this.ringEmphasisTarget = on ? 1 : 0;
  }

  /** Show the highlight arc around the given azimuth (radians). */
  pulseArc(azimuth: number) {
    this.arc.rotation.y = azimuth;
    this.arcT = 1;
  }

  /**
   * Advance hover / selection / ring fades.
   * Returns true while anything is still changing (so the caller keeps rendering).
   */
  update(dtMs: number, settled: boolean): boolean {
    let busy = false;

    if (this.hoverKey && this.hoverT < 1) {
      this.hoverT = Math.min(1, this.hoverT + dtMs / 140);
      this.hoverMat.color.copy(this.baseColor).lerp(this.hoverColor, this.hoverT);
      busy = true;
    }

    if (this.activeKey && settled) {
      this.activeT = Math.max(0, this.activeT - dtMs / 600);
      this.activeMat.color.copy(this.baseColor).lerp(this.activeColor, this.activeT);
      if (this.activeT === 0) this.setActive(null);
      busy = true;
    }

    const re = this.ringEmphasis + (this.ringEmphasisTarget - this.ringEmphasis) * Math.min(1, dtMs / 120);
    if (Math.abs(re - this.ringEmphasis) > 0.001) busy = true;
    this.ringEmphasis = Math.abs(re - this.ringEmphasisTarget) < 0.002 ? this.ringEmphasisTarget : re;
    this.ringMats[0].opacity = RING_OPACITY[0] + 0.3 * this.ringEmphasis;
    this.ringMats[1].opacity = RING_OPACITY[1] + 0.2 * this.ringEmphasis;

    if (this.arcT > 0) {
      if (settled) this.arcT = Math.max(0, this.arcT - dtMs / 700);
      this.arcMat.opacity = 0.85 * Math.sin(Math.min(1, this.arcT) * Math.PI * 0.5);
      busy = true;
    }

    return busy;
  }

  private applyMaterial(key: string | null, mat: Material) {
    if (!key) return;
    for (const mesh of this.tilesByRegion.get(key) ?? []) mesh.material = mat;
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.scene.clear();
  }
}
