/**
 * ROAD BUILD SCRIPT: how the drafter (lib/workspace/drafter.ts) constructs
 * the hero's road model. Two plain steps:
 *
 *   1. POINTS    the survey comes in as a field of points across the site
 *   2. MODEL     the 3D model sweeps in over them, and the points give way to it
 *
 * No labels, no mesh and no running numbers: just the points, then the model.
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
    // ----- sketch elements -----
    const cloud = document.createElementNS(NS, "path");
    cloud.dataset.s = "cloud";

    // ----- state: how far each sweep has got -----
    let ptFront: number | null = null; // points west of this have come in

    let rect = canvas.getBoundingClientRect();
    const at = (x: number, level: number, z: number): Pt => {
      const p = scene.project([x, level, z]);
      return { x: rect.left + p.x, y: rect.top + p.y };
    };
    
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
          svg.append(cloud);
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
