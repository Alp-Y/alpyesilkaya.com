/**
 * ROAD BUILD SCRIPT: how the drafter (lib/workspace/drafter.ts) constructs
 * the hero's road model, in the order the work is really done:
 *
 *   1. POINTS     the survey comes in: a field of XYZ points across the site
 *   2. SURFACE    the points are triangulated into a TIN of the existing ground
 *   3. ALIGNMENT  the road is set out: centreline and formation edges on its grade
 *   4. VOLUME     cross-sections are cut station by station while the 3D cut and
 *                 fill sweep in, and the volumes count up to the model's totals
 *
 * Every position is projected from the 3D scene each frame, so the sketch sits
 * on the model and turns with it. Levels, sections and volumes all come from
 * lib/earthworks/model.ts (a demonstration surface, not a real site).
 */

import type { DraftScript, Pt, Step } from "@/lib/workspace/drafter";
import { HALF_FORMATION, LENGTH, NX, NZ, designLevel, groundLevel, roadLevel } from "@/lib/earthworks/model";
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
const COLS = 9;
const ROWS = 5;
/** Stations (m along the road, from its centre) where a cross-section is cut. */
const SECTIONS = [-40, -20, 0, 20, 40];
const num = (v: number) => Math.round(v).toLocaleString("en-US");
const station = (x: number) => `0+${String(Math.round(x + HALF)).padStart(3, "0")}`;

export function roadBuildScript(ctx: Ctx): DraftScript {
  return ({ svg, reveal }) => {
    const { scene, canvas } = ctx;

    // ----- the survey: a loose grid of points (never perfectly regular on site) -----
    type P = { x: number; z: number; y: number };
    const pts: P[] = [];
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        const x = -56 + i * 14 + 3.2 * Math.sin(i * 12.99 + j * 78.23);
        const z = -28 + j * 14 + 3.2 * Math.sin(i * 39.35 + j * 11.14);
        pts.push({ x, z, y: groundLevel(x, z) });
      }
    // ----- the TIN: two triangles per grid cell -----
    const edges: [number, number][] = [];
    const id = (i: number, j: number) => j * COLS + i;
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        if (i < COLS - 1) edges.push([id(i, j), id(i + 1, j)]);
        if (j < ROWS - 1) edges.push([id(i, j), id(i, j + 1)]);
        if (i < COLS - 1 && j < ROWS - 1) edges.push((i + j) % 2 ? [id(i, j), id(i + 1, j + 1)] : [id(i + 1, j), id(i, j + 1)]);
      }
    const TRIANGLES = (COLS - 1) * (ROWS - 1) * 2;
    /** Points that carry their level as a label (a few, so it stays readable). */
    const labelled = [1, 3, 5, 7].map((i) => id(i, 2));

    // ----- cumulative cut / fill along the road (the model's own grid method) -----
    const m = scene.model;
    const cutTo = new Float64Array(NX);
    const fillTo = new Float64Array(NX);
    for (let ix = 0; ix < NX - 1; ix++) {
      let c = 0;
      let f = 0;
      for (let iz = 0; iz < NZ - 1; iz++) {
        const a = iz * NX + ix;
        for (const k of [a, a + 1, a + NX, a + NX + 1]) {
          c += Math.max(0, m.depth[k]) / 4;
          f += Math.max(0, -m.depth[k]) / 4;
        }
      }
      cutTo[ix + 1] = cutTo[ix] + c;
      fillTo[ix + 1] = fillTo[ix] + f;
    }
    const volumeAt = (x: number, t: number) => {
      if (t >= 1) return { cut: m.cut, fill: m.fill };
      const ix = Math.min(NX - 1, Math.max(0, Math.round(x + HALF)));
      return { cut: cutTo[ix], fill: fillTo[ix] };
    };

    // ----- sketch elements -----
    const el = <K extends keyof SVGElementTagNameMap>(tag: K, kind: string, parent: Element) => {
      const n = document.createElementNS(NS, tag);
      n.dataset.s = kind;
      parent.appendChild(n);
      return n;
    };
    const survey = document.createElementNS(NS, "g");
    const design = document.createElementNS(NS, "g");
    const tin = el("path", "tin", survey);
    const cloud = el("path", "cloud", survey);
    const levels = labelled.map((k) => {
      const t = el("text", "lvl", survey);
      t.textContent = pts[k].y.toFixed(2);
      return t;
    });
    const edgeLines = el("path", "edge", design);
    const centre = el("path", "dg", design);
    const sections = SECTIONS.map((x) => ({
      x,
      ground: el("path", "sec-g", design),
      formation: el("path", "sec-d", design),
      label: el("text", "sta", design),
    }));
    sections.forEach((sct) => (sct.label.textContent = station(sct.x)));

    // ----- state: how far each sweep has got -----
    let ptFront: number | null = null; // points west of this have been imported
    let tinFront: number | null = null; // the TIN grows from the east back to this
    let dgX: number | null = null; // the alignment has been set out up to here
    let volX: number | null = null; // sections and volumes have reached here

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
        labelled.forEach((k, n) => {
          const shown = pts[k].x <= ptFront!;
          levels[n].style.display = shown ? "" : "none";
          if (!shown) return;
          levels[n].setAttribute("x", pp[k].x.toFixed(1));
          levels[n].setAttribute("y", (pp[k].y - 9).toFixed(1));
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

      if (dgX !== null) {
        const line = (z: number) => `M${xy(at(-HALF, roadLevel(-HALF), z))}L${xy(at(dgX!, roadLevel(dgX!), z))}`;
        centre.setAttribute("d", line(0));
        edgeLines.setAttribute("d", line(-HALF_FORMATION) + line(HALF_FORMATION));
      }

      for (const sct of sections) {
        const shown = volX !== null && sct.x <= volX;
        const vis = shown ? "" : "none";
        sct.ground.style.display = sct.formation.style.display = sct.label.style.display = vis;
        if (!shown) continue;
        let g = "";
        let f = "";
        for (let z = -24; z <= 24; z += 3) {
          const gl = groundLevel(sct.x, z);
          g += `${g ? "L" : "M"}${xy(at(sct.x, gl, z))}`;
          f += `${f ? "L" : "M"}${xy(at(sct.x, designLevel(sct.x, z, gl), z))}`;
        }
        sct.ground.setAttribute("d", g);
        sct.formation.setAttribute("d", f);
        const tag = at(sct.x, groundLevel(sct.x, 27), 27);
        sct.label.setAttribute("x", tag.x.toFixed(1));
        sct.label.setAttribute("y", (tag.y + 3).toFixed(1));
      }
    };
    /** The cursor rides the road's centreline at ground or design level. */
    const onGround = (x: number) => at(x, groundLevel(x, 0), 0);
    const onDesign = (x: number) => at(x, roadLevel(x), 0);

    const steps: Step[] = [
      {
        cmd: "POINTS",
        ms: 850,
        fixed: true,
        begin: () => {
          ctx.hold();
          ctx.start();
          scene.setReveal(0);
          svg.append(survey, design);
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
        draw: () => `XYZ  ${pts.filter((p) => p.x <= (ptFront ?? -HALF)).length} / ${pts.length}`,
      },
      {
        cmd: "SURFACE",
        ms: 900,
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
        draw: (t) => `TIN  ${Math.round(TRIANGLES * t)} / ${TRIANGLES} triangles`,
      },
      {
        cmd: "ALIGNMENT",
        ms: 650,
        fixed: true,
        begin: ctx.hold,
        from: () => {
          sync();
          return onDesign(-HALF);
        },
        path: (t) => {
          dgX = -HALF + LENGTH * t;
          sync();
          return onDesign(dgX);
        },
        draw: () => `STA ${station(dgX ?? -HALF)}  +2.0%`,
      },
      {
        cmd: "VOLUME",
        ms: 1650,
        fixed: true,
        begin: ctx.hold,
        from: () => {
          sync();
          return onDesign(-HALF);
        },
        path: (t) => {
          volX = -HALF + LENGTH * t;
          sync();
          const gone = ctx.aborted();
          if (!gone) scene.setReveal(t);
          // the survey sketch gives way to the model; sections and alignment hold, then follow
          survey.style.opacity = gone ? "0" : String(Math.max(0, 1 - t * 1.2));
          design.style.opacity = gone ? "0" : String(t < 0.75 ? 1 : Math.max(0, 1 - (t - 0.75) / 0.25));
          return onDesign(volX);
        },
        draw: (t) => {
          const v = volumeAt(volX ?? -HALF, t);
          return `CUT ${num(v.cut)} m³  FILL ${num(v.fill)} m³`;
        },
        end: ctx.done,
      },
    ];
    return steps;
  };
}
