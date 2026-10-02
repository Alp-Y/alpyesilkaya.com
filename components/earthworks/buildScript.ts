/**
 * ROAD BUILD SCRIPT: how the drafter (lib/workspace/drafter.ts) constructs
 * the hero's road model. Three plain steps, the way the work is really done:
 *
 *   1. POINTS    the survey comes in as a field of points across the site
 *   2. SURFACE   the points are joined into a surface of the existing ground
 *   3. MODEL     the 3D cut and fill sweep in, and the sketch gives way to it
 *
 * No labels and no running numbers: just the points, the mesh and the model.
 * Every position is projected from the 3D scene each frame, so the sketch
 * sits on the model and turns with it. The ground levels come from
 * lib/earthworks/model.ts (a demonstration surface, not a real site).
 */

import type { DraftScript, Pt, Step } from "@/lib/workspace/drafter";
import { LENGTH, groundLevel } from "@/lib/earthworks/model";
import type { EarthworksScene } from "./scene";

type Ctx = {
  scene: EarthworksScene;
  canvas: HTMLCanvasElement;
  /** Called at the start of every step (keeps the hero from switching model meanwhile). */
  hold: () => void;
  /** The visitor switched model while this one was being drawn. */
  aborted: () => boolean;
  start: () => void;
  done: () => void;
};

const NS = "http://www.w3.org/2000/svg";
const HALF = LENGTH / 2;
const COLS = 7;
const ROWS = 4;

export function roadBuildScript(ctx: Ctx): DraftScript {
  return ({ svg, reveal }) => {
    const { scene, canvas } = ctx;

    // ----- the survey: a loose grid of points (never perfectly regular on site) -----
    type P = { x: number; z: number; y: number };
    const pts: P[] = [];
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        const x = -54 + i * 18 + 3.2 * Math.sin(i * 12.99 + j * 78.23);
        const z = -27 + j * 18 + 3.2 * Math.sin(i * 39.35 + j * 11.14);
        pts.push({ x, z, y: groundLevel(x, z) });
      }
    // ----- the surface: two triangles per grid cell -----
    const edges: [number, number][] = [];
    const id = (i: number, j: number) => j * COLS + i;
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        if (i < COLS - 1) edges.push([id(i, j), id(i + 1, j)]);
        if (j < ROWS - 1) edges.push([id(i, j), id(i, j + 1)]);
        if (i < COLS - 1 && j < ROWS - 1) edges.push((i + j) % 2 ? [id(i, j), id(i + 1, j + 1)] : [id(i + 1, j), id(i, j + 1)]);
      }

    // ----- sketch elements -----
    const tin = document.createElementNS(NS, "path");
    const cloud = document.createElementNS(NS, "path");
    tin.dataset.s = "tin";
    cloud.dataset.s = "cloud";

    // ----- state: how far each sweep has got -----
    let ptFront: number | null = null; // points west of this have come in
    let tinFront: number | null = null; // the surface grows from the east back to this

    let rect = canvas.getBoundingClientRect();
    const at = (x: number, level: number, z: number): Pt => {
      const p = scene.project([x, level, z]);
      return { x: rect.left + p.x, y: rect.top + p.y };
    };
    const xy = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;

    /** Redraw the sketch on the model as it is right now (it keeps turning). */
    const sync = () => {
      rect = canvas.getBoundingClientRect();
      const pp = pts.map((p) => at(p.x, p.y, p.z));

      let d = "";
      if (ptFront !== null) {
        pts.forEach((p, k) => {
          if (p.x > ptFront!) return;
          const a = pp[k];
          d += `M${(a.x - 3.5).toFixed(1)} ${a.y.toFixed(1)}h7M${a.x.toFixed(1)} ${(a.y - 3.5).toFixed(1)}v7`;
        });
      }
      cloud.setAttribute("d", d);

      d = "";
      if (tinFront !== null) {
        for (const [a, b] of edges) {
          if ((pts[a].x + pts[b].x) / 2 < tinFront) continue;
          d += `M${xy(pp[a])}L${xy(pp[b])}`;
        }
      }
      tin.setAttribute("d", d);
    };
    /** The cursor rides the ground along the road's centreline. */
    const onGround = (x: number) => at(x, groundLevel(x, 0), 0);

    const steps: Step[] = [
      {
        cmd: "POINTS",
        ms: 900,
        fixed: true,
        begin: () => {
          ctx.hold();
          ctx.start();
          scene.setReveal(0);
          svg.append(tin, cloud);
          sync();
          reveal();
        },
        from: () => {
          sync();
          return onGround(-HALF);
        },
        path: (t) => {
          ptFront = -HALF + LENGTH * t;
          sync();
          return onGround(ptFront);
        },
      },
      {
        cmd: "SURFACE",
        ms: 950,
        fixed: true,
        begin: ctx.hold,
        from: () => {
          sync();
          return onGround(HALF);
        },
        path: (t) => {
          tinFront = HALF - LENGTH * t;
          sync();
          return onGround(tinFront);
        },
      },
      {
        cmd: "MODEL",
        ms: 1600,
        fixed: true,
        begin: ctx.hold,
        from: () => {
          sync();
          return onGround(-HALF);
        },
        path: (t) => {
          sync();
          const gone = ctx.aborted();
          if (!gone) scene.setReveal(t);
          // the sketch gives way to the model as it sweeps in
          svg.style.opacity = gone ? "0" : String(Math.max(0, 1 - t * 1.15));
          return onGround(-HALF + LENGTH * t);
        },
        end: ctx.done,
      },
    ];
    return steps;
  };
}
