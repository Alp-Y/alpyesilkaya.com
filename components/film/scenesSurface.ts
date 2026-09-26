/**
 * SCENE 3 — the Excavation Volume Calculator, the film's hero:
 *   XYZ text → survey points → TIN → terrain (2.5D, contours)
 *   → excavated surface → a section slice → cross sections → volume → report.
 * Every surface, section, area and volume here comes from the site's own
 * engine (lib/excavation) run on the basin survey (lib/film/terrain.ts).
 */

import { BASIN_ORIGIN, type XY } from "@/lib/film/project";
import { REPORT_SHEETS } from "@/lib/excavation/reportModel";
import { section, type SectionProfile } from "@/lib/excavation/volume";
import {
  C,
  caption,
  clamp,
  clear,
  commandLine,
  countTo,
  easeInOut,
  easeOut,
  env,
  lerp,
  marker,
  mono,
  monoSize,
  n2,
  num,
  panel,
  screenGrid,
  seg,
  stroke,
  track,
  view,
  type Frame,
} from "./draw";
import { SHOTS, drawProject, shot } from "./plan";

/* ---------- 2.5D projection ---------- */

type Proj = { cx: number; cy: number; s: number; yaw: number; pitch: number; ez: number; zc: number; tx: number; ty: number };
function project(p: Proj) {
  const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw), cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
  return (x: number, y: number, z: number): [number, number, number] => {
    const dx = x - p.tx;
    const dy = y - p.ty;
    const xr = dx * cy + dy * sy;
    const yr = -dx * sy + dy * cy;
    const zz = (z - p.zc) * p.ez;
    return [p.cx + xr * p.s, p.cy - (yr * cp + zz * sp) * p.s, -yr * sp + zz * cp];
  };
}

/* ---------- timing ---------- */

const T = {
  fly: [0, 1.0],
  txt: [0.7, 2.5],
  rows: [2.4, 4.2],
  tin: [4.1, 5.7],
  tilt: [5.6, 7.6],
  contours: [6.4, 7.6],
  cmd: 7.6,
  dig: [8.9, 10.3],
  slice: [10.3, 11.5],
  toSection: [11.5, 12.8],
  series: [13.3, 14.8],
  report: [14.8, 16.0],
};

/* ---------- layout ---------- */

function layout(f: Frame) {
  const pad = f.tall ? 12 : Math.max(24, f.W * 0.028);
  const txt = f.tall
    ? { x: pad, y: f.H * 0.19, w: f.W - pad * 2, h: f.H * 0.3 }
    : { x: pad, y: f.H * 0.24, w: Math.min(f.W * 0.29, 340), h: f.H * 0.56 };
  const report = f.tall
    ? { x: pad, y: f.H * 0.19, w: f.W - pad * 2, h: f.H * 0.78 }
    : { x: f.W * 0.34, y: f.H * 0.09, w: f.W * 0.66 - pad, h: f.H * 0.82 };
  // where the section series sits: full stage first, then the report's section block
  const seriesFull = f.tall ? { x: pad, y: f.H * 0.2, w: f.W - pad * 2, h: f.H * 0.62 } : { x: f.W * 0.1, y: f.H * 0.2, w: f.W * 0.8, h: f.H * 0.6 };
  const size = monoSize(f);
  const seriesReport = f.tall
    ? { x: report.x + size, y: report.y + report.h * 0.4, w: report.w - size * 2, h: report.h * 0.56 }
    : { x: report.x + report.w * 0.44, y: report.y + size * 6.2, w: report.w * 0.56 - size, h: report.h * 0.62 };
  const hero = f.tall ? { x: pad + 4, y: f.H * 0.4, w: f.W - pad * 2 - 8, h: f.H * 0.3 } : { x: f.W * 0.16, y: f.H * 0.26, w: f.W * 0.68, h: f.H * 0.5 };
  return { pad, txt, report, seriesFull, seriesReport, hero };
}
type Rect = { x: number; y: number; w: number; h: number };
const lerpRect = (a: Rect, b: Rect, k: number): Rect => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });
function cells(r: Rect, n: number, cols: number, gap: number): Rect[] {
  const rows = Math.ceil(n / cols);
  const w = (r.w - gap * (cols - 1)) / cols;
  const h = (r.h - gap * (rows - 1)) / rows;
  return Array.from({ length: n }, (_, i) => ({ x: r.x + (i % cols) * (w + gap), y: r.y + Math.floor(i / cols) * (h + gap), w, h }));
}

/* ---------- the scene ---------- */

export function surfaceScene(f: Frame) {
  const lt = f.lt;
  const { ctx } = f;
  const TR = f.data.terrain;
  const { eg, c } = TR;
  const Lo = layout(f);
  clear(f);

  // 0 → 1 s: the plan camera flies into the basin, then the scene takes over in local metres
  if (lt < T.fly[1] + 0.2) {
    const cam = track(
      [
        { at: 0, cam: shot(f, SHOTS.areas) },
        { at: T.fly[1], cam: shot(f, SHOTS.basin) },
      ],
      lt,
    );
    const k = easeInOut(seg(lt, T.fly[0], T.fly[1]));
    const V = view(f, cam, (f.tall ? 0 : f.W * 0.16) * k, (f.tall ? f.H * 0.2 : 0) * k);
    drawProject(f, V, { align: 1, stations: 1, edges: 1, areas: 1, areaLabels: 1, asphalt: 0.8, kerbs: 0.9, demolition: 1, lights: 1, drainage: 1, basin: 1, dim: 1 - seg(lt, 0.6, 1.2) });
  }

  // projection over the scene
  const base = f.W / (f.tall ? 172 : 200);
  const tilt = easeInOut(seg(lt, T.tilt[0], T.tilt[1]));
  const off = 1 - easeInOut(seg(lt, T.tin[1] - 0.2, T.tilt[0] + 0.8));
  const spin = lt > T.tilt[0] ? -0.05 * (lt - T.tilt[0]) : 0;
  const proj: Proj = {
    cx: f.W / 2 + (f.tall ? 0 : f.W * 0.16) * off,
    cy: f.H / 2 + (f.tall ? f.H * 0.2 : 0) * off + tilt * f.H * 0.05,
    s: base * (1 + (f.tall ? 0.08 : 0.25) * tilt),
    yaw: -0.42 * tilt + spin,
    pitch: 1.0 * tilt,
    ez: 2.4,
    zc: (TR.zMin + TR.zMax) / 2,
    tx: 60,
    ty: 35,
  };
  // toward the section view: yaw along the section, pitch to a side elevation
  const sec = easeInOut(seg(lt, T.toSection[0], T.toSection[1]));
  const { axis } = c;
  let yawSec = Math.atan2(axis.normal[1], axis.normal[0]);
  let front = 1; // +1: the viewer looks toward increasing chainage
  const cand = [yawSec, yawSec - 2 * Math.PI, yawSec + Math.PI, yawSec - Math.PI];
  const yNow = -0.42 + -0.05 * (T.toSection[0] - T.tilt[0]);
  let best = cand[0];
  for (const y of cand) if (Math.abs(y - yNow) < Math.abs(best - yNow)) best = y;
  if (Math.abs(((best - yawSec) % (2 * Math.PI)) + 0) > 1) front = -1;
  yawSec = best;
  if (lt > T.toSection[0]) {
    const spinEnd = -0.05 * (T.toSection[0] - T.tilt[0]);
    proj.yaw = lerp(-0.42 + spinEnd, yawSec, sec);
    proj.pitch = lerp(1.0, Math.PI / 2, sec);
  }
  const P = project(proj);

  const dig = easeInOut(seg(lt, T.dig[0], T.dig[1]));
  const s0 = axis.cutS[0];
  const heroAt = TR.hero.at;
  const slicePos = lt < T.slice[0] ? null : lerp(s0 - 4, heroAt, easeInOut(seg(lt, T.slice[0], T.slice[1])));
  const chain = (x: number, y: number) => (x - axis.origin[0]) * axis.dir[0] + (y - axis.origin[1]) * axis.dir[1];
  const terrainFade = 1 - seg(lt, T.toSection[0] + 0.2, T.toSection[1] - 0.1);

  if (lt > T.fly[1] - 0.2 && terrainFade > 0) {
    const fadeIn = seg(lt, T.fly[1] - 0.2, T.fly[1] + 0.3);
    screenGrid(f, 24, fadeIn * (1 - tilt * 0.6));
    ctx.save();
    ctx.globalAlpha = terrainFade;
    const shade = seg(lt, T.tilt[0] + 0.3, T.tilt[1]);
    const tinK = seg(lt, T.tin[0], T.tin[1]);
    if (shade > 0 || dig > 0) drawFaces(f, P, proj, shade, dig, slicePos === null ? null : (x, y) => front * (chain(x, y) - slicePos) < 0);
    // TIN wireframe drawn as a wave from the middle of the survey (plan), then on the faces
    if (tinK > 0 && shade < 1) drawTinWave(f, P, tinK, 1 - shade);
    // contours
    const ck = seg(lt, T.contours[0], T.contours[1]) * (1 - dig * 0.85);
    if (ck > 0) {
      ctx.beginPath();
      for (const [x1, y1, x2, y2, z] of TR.contours) {
        if (slicePos !== null && front * (chain((x1 + x2) / 2, (y1 + y2) / 2) - slicePos) < 0) continue;
        const a = P(x1, y1, z);
        const b = P(x2, y2, z);
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      stroke(ctx, `rgba(62, 224, 143, ${0.4 * ck})`, 0.9);
    }
    // survey points
    const pk = seg(lt, T.rows[0] + 0.2, T.rows[1]);
    if (pk > 0 && dig < 1) {
      const r = f.tall ? 1.3 : 1.6;
      ctx.fillStyle = C.text1;
      eg.points.forEach((p) => {
        const k = clamp((pk - (p.x / 120) * 0.7) / 0.3);
        if (k <= 0) return;
        const [x, y] = P(p.x, p.y, p.z);
        ctx.globalAlpha = terrainFade * k * (1 - shade * 0.6) * (1 - dig);
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      });
      ctx.globalAlpha = terrainFade;
    }
    // the slicing plane
    if (slicePos !== null) {
      const sa = env(lt, T.slice[0], T.slice[0] + 0.3, T.toSection[0] + 0.3, T.toSection[0] + 0.8);
      const at = (o: number, z: number) => {
        const x = axis.origin[0] + axis.dir[0] * slicePos + axis.normal[0] * o;
        const y = axis.origin[1] + axis.dir[1] * slicePos + axis.normal[1] * o;
        return P(x, y, z);
      };
      const corners = [at(axis.oMin - 3, TR.zMin - 2), at(axis.oMax + 3, TR.zMin - 2), at(axis.oMax + 3, TR.zMax + 2), at(axis.oMin - 3, TR.zMax + 2)];
      ctx.save();
      ctx.globalAlpha = sa;
      ctx.beginPath();
      corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = "rgba(62, 224, 143, 0.07)";
      ctx.fill();
      stroke(ctx, "rgba(62, 224, 143, 0.7)", 1);
      ctx.restore();
      // the live cut face at the plane
      const live = lt < T.slice[1] ? section(c, "cross", slicePos, 1) : TR.hero;
      drawProfile3D(f, live, P, 1);
    }
    ctx.restore();
  }

  // the TXT file and its rows flying into place
  drawTxt(f, Lo, P);

  // the section: from the 3D slice into a 2D drawing, then the series, then the report
  if (lt > T.toSection[0]) sectionPhase(f, Lo, P);

  // readouts
  const meta: [number, number, string][] = [
    [2.2, 4.3, `EG SURVEY · ${eg.points.length} POINTS`],
    [4.3, 5.9, `TIN · ${eg.tris.length} TRIANGLES`],
    [5.9, 8.9, `EXISTING GROUND · ${n2(eg.zMin)} – ${n2(eg.zMax)}`],
    [8.9, 11.4, `EXCAVATED SURFACE · BASE ${n2(c.exZMin)}`],
  ];
  for (const [a, b, text] of meta) {
    const k = env(lt, a, a + 0.25, b - 0.2, b);
    if (k > 0) mono(f, text, f.W - Lo.pad, f.tall ? f.H - 72 : Lo.pad + 30, { align: "right", color: C.text2, alpha: k });
  }
  if (dig > 0 && lt < T.toSection[1]) {
    const k = env(lt, T.dig[0], T.dig[0] + 0.3, T.toSection[0], T.toSection[0] + 0.4);
    num(f, `CUT ${n2(countTo(c.cut, dig))} m³`, f.W - Lo.pad, f.tall ? f.H - 92 : Lo.pad + 52, { align: "right", color: C.cut, alpha: k, size: monoSize(f) * 1.25 });
  }

  commandLine(f, "VOLUMESUMMARY", T.cmd, "EG ↔ as-dug · composite TIN · per-triangle cut / fill", env(lt, T.cmd - 0.3, T.cmd, 10.6, 11));
  caption(f, ["From coordinates", "to surfaces."], env(lt, 0.9, 1.5, 5.3, 5.8));
  caption(f, ["Coordinates to a deliverable,", "in seconds."], env(lt, T.report[0] + 0.4, T.report[1]), f.tall ? "tl" : "bl", f.tall ? undefined : f.W * 0.3);
  marker(f, "T-02 · EXCAVATION VOLUME", env(lt, 1, 1.5, 16, 16.5));
}

/* ---------- terrain faces ---------- */

const LIGHT = (() => {
  const v = [-0.45, 0.55, 0.7];
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
})();

function drawFaces(f: Frame, P: ReturnType<typeof project>, proj: Proj, shade: number, dig: number, cutAway: ((x: number, y: number) => boolean) | null) {
  const { ctx } = f;
  const TR = f.data.terrain;
  const { eg } = TR;
  type Face = { pts: [number, number, number][]; depth: number; col: string; wire: number };
  const faces: Face[] = [];
  const zr = TR.zMax - TR.zMin || 1;
  const faceColor = (a: number[], b: number[], d: number[], cutDepth: number) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = (b[2] - a[2]) * proj.ez;
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = (d[2] - a[2]) * proj.ez;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    if (nz < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const lam = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
    const t = ((a[2] + b[2] + d[2]) / 3 - TR.zMin) / zr;
    let r = 20 + 16 * t + 34 * lam;
    let g = 27 + 20 * t + 38 * lam;
    let bl = 34 + 22 * t + 40 * lam;
    if (cutDepth > 0.03) {
      const k = clamp(cutDepth / 3) * 0.8;
      r = lerp(r, 78 + 56 * lam, k);
      g = lerp(g, 66 + 46 * lam, k);
      bl = lerp(bl, 44 + 26 * lam, k);
    }
    return `rgb(${r | 0}, ${g | 0}, ${bl | 0})`;
  };
  const add = (a: [number, number, number], b: [number, number, number], d: [number, number, number], cutDepth: number) => {
    const cx = (a[0] + b[0] + d[0]) / 3;
    const cy = (a[1] + b[1] + d[1]) / 3;
    if (cutAway?.(cx, cy)) return;
    const pa = P(...a), pb = P(...b), pd = P(...d);
    faces.push({ pts: [pa, pb, pd], depth: (pa[2] + pb[2] + pd[2]) / 3, col: faceColor(a, b, d, cutDepth), wire: cutDepth > 0.03 ? 0.2 : 0.12 });
  };
  if (dig <= 0) {
    const EP = eg.points;
    for (const [i, j, k] of eg.tris) {
      const a = EP[i], b = EP[j], d = EP[k];
      add([a.x, a.y, a.z], [b.x, b.y, b.z], [d.x, d.y, d.z], 0);
    }
  } else {
    // the existing ground sinks to the excavated surface: one mesh, both levels at every vertex
    const M = TR.mesh;
    const z = (v: (typeof M)[number]) => lerp(v.eg, v.ex, dig);
    for (const [i, j, k] of TR.meshTris) {
      const a = M[i], b = M[j], d = M[k];
      const depth = (a.eg - z(a) + b.eg - z(b) + d.eg - z(d)) / 3;
      add([a.x, a.y, z(a)], [b.x, b.y, z(b)], [d.x, d.y, z(d)], depth);
    }
  }
  faces.sort((p, q) => p.depth - q.depth);
  ctx.save();
  ctx.lineJoin = "round";
  for (const fc of faces) {
    ctx.beginPath();
    ctx.moveTo(fc.pts[0][0], fc.pts[0][1]);
    ctx.lineTo(fc.pts[1][0], fc.pts[1][1]);
    ctx.lineTo(fc.pts[2][0], fc.pts[2][1]);
    ctx.closePath();
    ctx.globalAlpha = shade;
    ctx.fillStyle = fc.col;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(170, 190, 210, ${fc.wire * Math.max(shade, 0.4)})`;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  ctx.restore();
}

let waveCache: { edges: [number, number][]; d: number[] } | null = null;
function drawTinWave(f: Frame, P: ReturnType<typeof project>, k: number, a: number) {
  const { ctx } = f;
  const { eg } = f.data.terrain;
  if (!waveCache || waveCache.edges.length === 0 || (waveCache as unknown as { src: unknown }).src !== eg) {
    const edges = eg.edges();
    const d = edges.map(([i, j]) => Math.hypot((eg.points[i].x + eg.points[j].x) / 2 - 60, (eg.points[i].y + eg.points[j].y) / 2 - 35));
    waveCache = { edges, d };
    (waveCache as unknown as { src: unknown }).src = eg;
  }
  const r = k * 72;
  ctx.save();
  ctx.lineWidth = 0.8;
  // the wavefront is brighter than the settled mesh
  for (const pass of [0, 1]) {
    ctx.beginPath();
    waveCache.edges.forEach(([i, j], n) => {
      const d = waveCache!.d[n];
      if (d > r) return;
      const front = d > r - 8;
      if ((pass === 1) !== front) return;
      const p = eg.points[i];
      const q = eg.points[j];
      const A = P(p.x, p.y, p.z);
      const B = P(q.x, q.y, q.z);
      ctx.moveTo(A[0], A[1]);
      ctx.lineTo(B[0], B[1]);
    });
    stroke(ctx, pass ? `rgba(62, 224, 143, ${0.8 * a})` : `rgba(170, 190, 210, ${0.36 * a})`, pass ? 1 : 0.8);
  }
  ctx.restore();
}

/** A section profile drawn where it sits in the 3D model. */
function drawProfile3D(f: Frame, prof: SectionProfile, P: ReturnType<typeof project>, a: number) {
  const { ctx } = f;
  const { axis } = f.data.terrain.c;
  const pt = (h: number, z: number) => {
    const x = axis.origin[0] + axis.dir[0] * prof.at + axis.normal[0] * h;
    const y = axis.origin[1] + axis.dir[1] * prof.at + axis.normal[1] * h;
    return P(x, y, z);
  };
  if (prof.samples.length < 2) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.beginPath();
  prof.samples.forEach((s, i) => {
    const [x, y] = pt(s.h, s.eg);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  for (let i = prof.samples.length - 1; i >= 0; i--) {
    const s = prof.samples[i];
    const [x, y] = pt(s.h, Math.min(s.eg, s.ex));
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(207, 174, 106, 0.35)";
  ctx.fill();
  ctx.beginPath();
  prof.samples.forEach((s, i) => {
    const [x, y] = pt(s.h, s.eg);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  stroke(ctx, C.text1, 1.4);
  ctx.beginPath();
  prof.samples.forEach((s, i) => {
    const [x, y] = pt(s.h, Math.min(s.eg, s.ex));
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  stroke(ctx, C.cut, 1.6);
  ctx.restore();
}

/* ---------- the TXT file ---------- */

function drawTxt(f: Frame, Lo: ReturnType<typeof layout>, P: ReturnType<typeof project>) {
  const lt = f.lt;
  const a = env(lt, T.txt[0], T.txt[0] + 0.4, T.rows[1] - 0.4, T.rows[1]);
  if (a <= 0) return;
  const { ctx } = f;
  const { rows } = f.data.terrain;
  const { eg } = f.data.terrain;
  const r = Lo.txt;
  const size = Math.max(10, (f.tall ? 10.5 : 11) * f.u);
  const lh = size * 1.6;
  panel(f, r.x, r.y, r.w, r.h, a, "EG_SURVEY.TXT", `${rows.length} PTS`);
  const top = r.y + size * 2.6 + lh;
  const visible = Math.floor((r.h - size * 2.6 - lh * 1.8) / lh);
  // the file scrolls while it is read, then stops for the rows to leave
  const scroll = Math.floor(easeInOut(seg(lt, T.txt[0] + 0.3, T.rows[0])) * Math.min(60, rows.length - visible));
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, top - lh * 0.2, r.w, visible * lh + lh * 0.4);
  ctx.globalAlpha = a;
  mono(f, "X,Y,Z", r.x + size, top, { size, color: C.accent, spacing: 0.5 });
  ctx.clip();
  for (let i = 0; i < visible; i++) {
    const idx = scroll + i;
    const text = rows[idx];
    if (!text) continue;
    const y0 = top + lh * (i + 1);
    const fk = seg(lt, T.rows[0] + i * 0.05, T.rows[0] + 0.7 + i * 0.05);
    if (fk <= 0) {
      mono(f, text, r.x + size, y0, { size: size * 0.95, color: C.text2, spacing: 0 });
      continue;
    }
  }
  ctx.restore();
  // rows in flight (outside the clip): text shrinking into its survey point
  for (let i = 0; i < visible; i++) {
    const idx = scroll + i;
    const text = rows[idx];
    const p = eg.points[idx];
    if (!text || !p) continue;
    const fk = seg(lt, T.rows[0] + i * 0.05, T.rows[0] + 0.7 + i * 0.05);
    if (fk <= 0 || fk >= 1) continue;
    const e = easeInOut(fk);
    const from: XY = [r.x + size, top + lh * (i + 1)];
    const [tx, ty] = P(p.x, p.y, p.z);
    const x = lerp(from[0], tx, e);
    const y = lerp(from[1], ty, e);
    mono(f, text, x, y, { size: size * 0.95 * (1 - 0.75 * e), color: e > 0.5 ? C.accent : C.text1, spacing: 0, alpha: 1 - e * 0.6 });
    ctx.fillStyle = C.accent;
    ctx.globalAlpha = e;
    ctx.fillRect(x - 2, y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }
}

/* ---------- sections, series, report ---------- */

function sectionPhase(f: Frame, Lo: ReturnType<typeof layout>, P: ReturnType<typeof project>) {
  const lt = f.lt;
  const TR = f.data.terrain;
  const { c, hero, series } = TR;
  const { axis } = c;
  const size = monoSize(f);

  // one vertical scale for every section, so they compare at a glance
  let zLo = Infinity, zHi = -Infinity;
  for (const s of [hero, ...series]) for (const p of s.samples) {
    zLo = Math.min(zLo, p.ex, p.eg);
    zHi = Math.max(zHi, p.eg);
  }
  zLo = Math.floor(zLo - 0.5);
  zHi = Math.ceil(zHi + 0.5);
  const h0 = axis.oMin;
  const h1 = axis.oMax;
  const chartPt = (r: Rect) => (h: number, z: number): XY => [r.x + ((h - h0) / (h1 - h0)) * r.w, r.y + r.h - ((z - zLo) / (zHi - zLo)) * r.h];

  const toS = easeInOut(seg(lt, T.toSection[0], T.toSection[1]));
  const ser = easeInOut(seg(lt, T.series[0], T.series[1]));
  const rep = easeInOut(seg(lt, T.report[0], T.report[1]));
  const cols = f.tall ? 2 : 3;
  const gridRect = lerpRect(Lo.seriesFull, Lo.seriesReport, rep);
  const cellRects = cells(gridRect, series.length, cols, lerp(f.tall ? 14 : 22, 10, rep));
  // the hero lands in the series cell whose chainage is nearest
  let heroCell = 0;
  series.forEach((s, i) => {
    if (Math.abs(s.at - hero.at) < Math.abs(series[heroCell].at - hero.at)) heroCell = i;
  });
  const heroRect = lerpRect(Lo.hero, cellRects[heroCell], ser);

  // report panel behind the series
  if (rep > 0) drawReport(f, Lo, rep);

  // hero: 3D profile → chart
  const heroPt = chartPt(inner(heroRect, size, ser));
  const pt3 = (h: number, z: number) => {
    const x = axis.origin[0] + axis.dir[0] * hero.at + axis.normal[0] * h;
    const y = axis.origin[1] + axis.dir[1] * hero.at + axis.normal[1] * h;
    const p = P(x, y, z);
    return [p[0], p[1]] as XY;
  };
  const mixPt = (h: number, z: number): XY => {
    if (toS >= 1) return heroPt(h, z);
    const a = pt3(h, z);
    const b = heroPt(h, z);
    return [lerp(a[0], b[0], toS), lerp(a[1], b[1], toS)];
  };
  const axesA = seg(lt, T.toSection[1] - 0.4, T.toSection[1]) * (ser > 0 && ser < 1 ? 1 - Math.sin(ser * Math.PI) * 0.3 : 1);
  drawChart(f, hero, mixPt, inner(heroRect, size, ser), axesA, { zLo, zHi, h0, h1 }, toS, seg(lt, T.toSection[1], T.toSection[1] + 0.6), ser > 0.5);

  // the other sections arrive around it
  if (ser > 0) {
    series.forEach((s, i) => {
      if (i === heroCell) return;
      const k = clamp(ser * 1.4 - (i / series.length) * 0.4);
      if (k <= 0) return;
      const r = inner(cellRects[i], size, 1);
      f.ctx.save();
      f.ctx.globalAlpha = easeOut(k);
      drawChart(f, s, chartPt(r), r, 1, { zLo, zHi, h0, h1 }, 1, 1, true);
      f.ctx.restore();
    });
    // total volume under the series
    const vk = env(lt, T.series[0] + 0.3, T.series[0] + 0.8, T.report[0], T.report[0] + 0.4);
    if (vk > 0) {
      const y = Lo.seriesFull.y + Lo.seriesFull.h + size * 3;
      mono(f, `${series.length} CROSS SECTIONS · CUT VOLUME FROM THE TIN`, Lo.seriesFull.x, y, { alpha: vk });
      num(f, `${n2(countTo(c.cut, seg(lt, T.series[0] + 0.3, T.series[1])))} m³`, Lo.seriesFull.x + Lo.seriesFull.w, y, { align: "right", alpha: vk, size: size * 1.6, color: C.cut });
    }
  }
}
/** A section's drawing area inside its frame (room for the label and axes). */
const inner = (r: Rect, size: number, small: number): Rect => {
  const top = lerp(size * 2.8, size * 1.5, small);
  const left = lerp(size * 4.6, size * 0.3, small);
  const bottom = lerp(size * 2.2, size * 2.1, small);
  return { x: r.x + left, y: r.y + top, w: r.w - left - size * 0.8, h: r.h - top - bottom };
};

function drawChart(
  f: Frame,
  prof: SectionProfile,
  pt: (h: number, z: number) => XY,
  r: Rect,
  axesA: number,
  sc: { zLo: number; zHi: number; h0: number; h1: number },
  fillA: number,
  labelA: number,
  small: boolean,
) {
  const { ctx } = f;
  const size = monoSize(f) * (small ? 0.9 : 1);
  const S = prof.samples;
  if (S.length < 2) return;
  // frame, elevation grid, labels
  if (axesA > 0) {
    ctx.save();
    ctx.globalAlpha *= axesA;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w), Math.round(r.h));
    const step = small ? 4 : 2;
    for (let z = Math.ceil(sc.zLo / step) * step; z <= sc.zHi; z += step) {
      const [, y] = pt(sc.h0, z);
      ctx.fillStyle = C.gridMajor;
      ctx.fillRect(r.x, Math.round(y), r.w, 1);
      if (!small) mono(f, z.toFixed(0), r.x - 8, y + 3.5, { align: "right", size: size * 0.9 });
    }
    if (!small) {
      mono(f, "EG", r.x + r.w + 6, pt(sc.h1, S[S.length - 1].eg)[1] + 3, { size: size * 0.9, color: C.text2 });
      const ex = r.h / (sc.zHi - sc.zLo) / (r.w / (sc.h1 - sc.h0));
      mono(f, `OFFSET ${sc.h0.toFixed(0)} … +${sc.h1.toFixed(0)} m · VERT ×${ex.toFixed(1)}`, r.x, r.y + r.h + size * 1.8, { size: size * 0.9 });
    }
    ctx.restore();
  }
  // cut region between existing ground and excavated surface
  ctx.save();
  ctx.beginPath();
  S.forEach((s, i) => {
    const [x, y] = pt(s.h, s.eg);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  for (let i = S.length - 1; i >= 0; i--) {
    const [x, y] = pt(S[i].h, Math.min(S[i].eg, S[i].ex));
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = `rgba(207, 174, 106, ${0.16 * fillA})`;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = `rgba(207, 174, 106, ${0.55 * fillA})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = r.x - r.h; x < r.x + r.w; x += small ? 5 : 7) {
    ctx.moveTo(x, r.y + r.h);
    ctx.lineTo(x + r.h, r.y);
  }
  ctx.stroke();
  ctx.restore();
  // the two lines
  ctx.beginPath();
  S.forEach((s, i) => {
    const [x, y] = pt(s.h, s.eg);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  stroke(ctx, C.text1, small ? 1 : 1.4);
  ctx.beginPath();
  S.forEach((s, i) => {
    const [x, y] = pt(s.h, Math.min(s.eg, s.ex));
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  stroke(ctx, C.cut, small ? 1.2 : 1.8);
  // label + cut area: beside each other when large, label above / area below when small
  if (labelA > 0) {
    if (small) {
      mono(f, prof.label.replace(/\.\d+$/, ""), r.x, r.y - size * 0.55, { size, color: C.text2, alpha: labelA });
      num(f, `${n2(countTo(prof.cutArea, labelA))} m²`, r.x, r.y + r.h + size * 1.45, { size, color: C.cut, alpha: labelA });
    } else {
      mono(f, prof.label, r.x, r.y - size, { size, color: C.text2, alpha: labelA });
      num(f, `${n2(countTo(prof.cutArea, labelA))} m²`, r.x + r.w, r.y - size, { align: "right", size: size * 1.3, color: C.cut, alpha: labelA });
      mono(f, "CUT AREA", r.x + r.w - textW(f, `${n2(prof.cutArea)} m²`, size * 1.3) - 10, r.y - size, { align: "right", size: size * 0.9, alpha: labelA });
    }
  }
}
const textW = (f: Frame, t: string, size: number) => {
  f.ctx.save();
  f.ctx.font = `450 ${size}px ${f.mono}`;
  const w = f.ctx.measureText(t).width;
  f.ctx.restore();
  return w;
};

function drawReport(f: Frame, Lo: ReturnType<typeof layout>, k: number) {
  const { c, eg } = f.data.terrain;
  const r = Lo.report;
  const size = monoSize(f);
  const { ctx } = f;
  const a = easeOut(k);
  const rr = { x: r.x, y: r.y + (1 - a) * 20, w: r.w, h: r.h };
  panel(f, rr.x, rr.y, rr.w, rr.h, a, "EXCAVATION VOLUME REPORT · BASIN-01", "XLSX");
  ctx.save();
  ctx.globalAlpha *= a;
  // sheet tabs (the real report's sheets)
  let x = rr.x + size;
  const ty = rr.y + size * 4.2;
  REPORT_SHEETS.forEach((s, i) => {
    if (f.tall && i > 2) return;
    const w = textW(f, s.toUpperCase(), size * 0.9) + size * 1.6;
    ctx.fillStyle = i === 0 ? C.accentSoft : "transparent";
    ctx.fillRect(x, ty - size * 1.1, w, size * 1.8);
    mono(f, s.toUpperCase(), x + size * 0.8, ty + size * 0.2, { size: size * 0.9, color: i === 0 ? C.accent : C.text3 });
    x += w + 4;
  });
  // summary values
  const kv: [string, string][] = [
    ["Survey points · EG", String(eg.points.length)],
    ["Composite TIN triangles", String(c.tris.length)],
    ["Compared area", `${n2(c.comparedArea)} m²`],
    ["Cut volume", `${n2(c.cut)} m³`],
    ["Fill volume", `${n2(c.fill)} m³`],
    ["Average depth", `${n2(c.averageDepth)} m`],
    ["Maximum depth", `${n2(c.maxDepth)} m`],
  ];
  // phones: one column, the four numbers that matter
  const rowsKv = f.tall ? kv.filter(([key]) => ["Survey points · EG", "Compared area", "Cut volume", "Average depth"].includes(key)) : kv;
  const colW = f.tall ? rr.w - size * 2 : rr.w * 0.4;
  const lh = size * (f.tall ? 1.8 : 2.2);
  const ky = rr.y + size * 7;
  rowsKv.forEach(([key, v], i) => {
    const kk = seg(k, 0.2 + i * 0.08, 0.5 + i * 0.08);
    if (kk <= 0) return;
    const x0 = rr.x + size;
    const y = ky + i * lh;
    ctx.globalAlpha = a * kk;
    mono(f, key.toUpperCase(), x0, y, { size: size * 0.88 });
    num(f, v, x0 + colW, y, { align: "right", size: size * (f.tall ? 0.95 : 1), color: key.startsWith("Cut") ? C.cut : C.text1 });
    ctx.fillStyle = C.line;
    ctx.fillRect(x0, y + size * 0.7, colW, 1);
  });
  ctx.globalAlpha = a;
  // cut by chainage strip (the report's Area Breakdown)
  if (!f.tall) {
    const zones = c.zones;
    const bx = rr.x + size;
    const by = ky + rowsKv.length * lh + size * 1.5;
    const bw = colW;
    const bh = rr.y + rr.h - by - size * 1.5;
    if (bh > 40) {
      mono(f, "CUT BY CHAINAGE STRIP", bx, by, { size: size * 0.88 });
      const max = Math.max(...zones.map((z) => z.cut), 1);
      const gap = 10;
      const w = Math.min(56, (bw - gap * (zones.length - 1)) / zones.length);
      const chartH = Math.min(bh - size * 3, 150);
      zones.forEach((z, i) => {
        const kk = easeOut(seg(k, 0.45 + i * 0.05, 0.85 + i * 0.05));
        const h = (chartH * z.cut) / max;
        const x0 = bx + i * (w + gap);
        const y0 = by + size * 1.2 + chartH - h * kk;
        num(f, n2(z.cut), x0 + w / 2, y0 - 5, { align: "center", size: size * 0.8, color: C.text2, alpha: kk });
        ctx.fillStyle = "rgba(207, 174, 106, 0.55)";
        ctx.fillRect(x0, y0, w, h * kk);
        mono(f, z.id, x0 + w / 2, by + size * 1.2 + chartH + size * 1.4, { align: "center", size: size * 0.82 });
      });
    }
  }
  ctx.restore();
  void BASIN_ORIGIN;
}
