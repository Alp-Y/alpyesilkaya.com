/**
 * SCENES 4–8 — drainage extraction, weekly progress (drawing comparison),
 * traceability to BOQ / WIR / IPC, the automated report, and the finale.
 */

import {
  AREAS,
  PIPES,
  PROGRESS,
  PROGRESS_ROWS,
  QUANTITIES,
  STRUCTURES,
  WORK,
  areaById,
  lineLength,
  pf,
  polyArea,
  qty,
  so,
  type XY,
} from "@/lib/film/project";
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
  flyer,
  grip,
  hatch,
  lerp,
  manhole,
  marker,
  mono,
  monoSize,
  n2,
  nq,
  fitPanel,
  panel,
  pathPoly,
  sans,
  seg,
  signed,
  stroke,
  table,
  tag,
  textWidth,
  track,
  view,
  type Cam,
  type Col,
  type Frame,
  type View,
} from "./draw";
import { SHOTS, basinToWorld, drawDrainage, drawProject, shot, stag } from "./plan";
import { stackLabel } from "./scenesPlan";

const FULL_LAYERS = { align: 1, stations: 1, edges: 1, areas: 1, areaLabels: 1, asphalt: 0.8, kerbs: 0.9, demolition: 1, lights: 1, drainage: 1, basin: 0.6, basinCut: 1, typed: 1 };

/** Side panel (wide: right; tall: bottom) and how far the drawing moves over for it. */
function sidePanel(f: Frame, wFrac = 0.47, tallTop = 0.46) {
  if (f.tall) {
    const top = f.H * tallTop;
    return { ox: 0, oy: -f.H * (1 - tallTop) * 0.5, r: { x: 12, y: top, w: f.W - 24, h: f.H - top - 12 } };
  }
  const pad = Math.max(20, f.W * 0.022);
  const w = Math.min(f.W * wFrac, 640);
  return { ox: -w / 2, oy: 0, r: { x: f.W - w - pad, y: f.H * 0.12, w, h: f.H * 0.76 } };
}

/* ================================================================== */
/* 4 · DRAINAGE                                                          */
/* ================================================================== */

const GROW = [0.9, 4.2];
const ANALYSE = [4.2, 6.0];
const FOCUS_PIPE = 3; // MHL1-15 → MHL1-16

export function drainageScene(f: Frame) {
  const lt = f.lt;
  clear(f);
  const growK = seg(lt, GROW[0], GROW[1]);
  const side = sidePanel(f, 0.5, 0.5);
  const make = easeInOut(seg(lt, 5.9, 6.6));
  let cam: Cam;
  if (f.tall) {
    // phones: the camera follows the network as it grows, then frames it for the table
    const head = STRUCTURES[Math.min(STRUCTURES.length - 1, Math.floor(growK * STRUCTURES.length))].p;
    const follow: Cam = { x: lerp(STRUCTURES[0].p[0] + 50, head[0], 0.7), y: -22, span: 150 };
    cam = track(
      [
        { at: 0, cam: shot(f, SHOTS.basin) },
        { at: 0.9, cam: { x: STRUCTURES[1].p[0], y: -22, span: 150 } },
      ],
      lt,
    );
    if (lt > 0.9) {
      const k = easeInOut(seg(lt, 0.9, 1.5));
      cam = { x: lerp(cam.x, follow.x, k), y: -22, span: 150 };
      // hold on MHL1-15 for its neighbours' levels, then pull back for the table
      if (lt > 4.2) {
        const mid = STRUCTURES[FOCUS_PIPE].p[0];
        const k1 = easeInOut(seg(lt, 4.0, 4.6));
        const k2 = easeInOut(seg(lt, 6.0, 6.8));
        cam = { x: lerp(lerp(follow.x, mid, k1), 330, k2), y: lerp(-20, -26, k2), span: lerp(lerp(150, 175, k1), 330, k2) };
      }
    }
  } else
    cam = track(
      [
        { at: 0, cam: { x: 470, y: -80, span: 420 } },
        { at: 1.0, cam: { x: 300, y: -22, span: 360 } },
        { at: 5.8, cam: { x: 350, y: -22, span: 380 } },
      ],
      lt,
    );
  const V = view(f, cam, side.ox * make, side.oy * make);
  drawProject(f, V, { ...FULL_LAYERS, drainage: 0, typed: 0.35, basinCut: 1, dim: lerp(0.55, 0.4, make) });
  drawDrainage(f, V, growK, env(lt, 1.2, 1.8, 4.0, 4.4), (i) => (i === FOCUS_PIPE ? env(lt, 2.2, 2.6, 3.8, 4.2) : 0));

  // the brief's example: MHL1-15 → Ø500 GRP → MHL1-16
  const fk = env(lt, 2.3, 2.7, 3.9, 4.3);
  const { ctx } = f;
  if (fk > 0) {
    const p = PIPES[FOCUS_PIPE];
    const a = V.P(p.a);
    const b = V.P(p.b);
    const x = (a[0] + b[0]) / 2;
    const y = Math.max(a[1], b[1]) + (f.tall ? 34 : 44);
    const size = monoSize(f);
    const rows: [string, string][] = [
      [p.from, C.text1],
      ["↓", C.text3],
      [`Ø${p.dia} ${p.mat} · ${n2(p.length)} m · ${(p.slope * 100).toFixed(2)} %`, C.accent],
      ["↓", C.text3],
      [p.to, C.text1],
    ];
    const lh = size * 1.55;
    const w = textWidth(f, rows[2][0], size) + size * 2;
    const h = lh * rows.length + size * 0.8;
    ctx.save();
    ctx.globalAlpha = fk;
    ctx.fillStyle = "rgba(7, 9, 11, 0.92)";
    ctx.fillRect(x - w / 2, y - size * 1.4, w, h);
    ctx.strokeStyle = "rgba(62, 224, 143, 0.35)";
    ctx.strokeRect(Math.round(x - w / 2) + 0.5, Math.round(y - size * 1.4) + 0.5, Math.round(w), Math.round(h));
    ctx.restore();
    rows.forEach(([t, col], i) => mono(f, t, x, y + i * lh, { align: "center", color: col, alpha: fk * seg(lt, 2.3 + i * 0.12, 2.55 + i * 0.12), spacing: i === 2 ? 0.3 : undefined }));
  }

  // analysis: GL / IL / DEPTH beside every structure
  const callPos = new Map<string, XY>();
  const aFade = 1 - seg(lt, 6.8, 7.8);
  STRUCTURES.forEach((st, i) => {
    const p = V.P(st.p);
    const up = i % 2 === 0;
    const at: XY = [p[0], p[1] + (up ? -18 : 18)];
    callPos.set(st.id, at);
    const k = stag(seg(lt, ANALYSE[0], ANALYSE[1]), i, STRUCTURES.length, 0.7);
    // phones: only MHL1-15 and its two neighbours, so the labels never overlap
    if (f.tall && Math.abs(i - FOCUS_PIPE) > 1) return;
    if (k <= 0 || aFade <= 0) return;
    if (at[0] < -40 || at[0] > f.W + 40) return;
    f.ctx.save();
    f.ctx.globalAlpha = easeOut(k) * aFade;
    f.ctx.beginPath();
    f.ctx.moveTo(p[0], p[1]);
    f.ctx.lineTo(at[0], at[1]);
    stroke(f.ctx, "rgba(62, 224, 143, 0.5)", 1);
    f.ctx.restore();
    stackLabel(
      f,
      st.id,
      [
        ["GL", n2(st.gl)],
        ["IL", n2(st.il)],
        ["DEPTH", `${n2(countTo(st.depth, k))} m`],
      ],
      at,
      easeOut(k) * aFade,
      up ? "up" : "down",
    );
  });

  // the network, as a table
  const pa = env(lt, 6.2, 6.8);
  const R = fitPanel(f, side.r, PIPES.length, f.tall ? 0.95 : 1, f.tall ? 2.05 : 2.3);
  panel(f, R.x, R.y, R.w, R.h, pa, `STORM NETWORK · ${PIPES.length} PIPES`, "FROM DRAWING");
  if (pa > 0) {
    const size = monoSize(f) * (f.tall ? 0.95 : 1);
    const cols: Col[] = f.tall
      ? [
          { label: "PIPE", w: 0.8 },
          { label: "FROM → TO", w: 1.9 },
          { label: "Ø", w: 0.6, align: "right" },
          { label: "L m", w: 1, align: "right" },
          { label: "S %", w: 0.8, align: "right" },
        ]
      : [
          { label: "PIPE", w: 0.8 },
          { label: "FROM", w: 1.15 },
          { label: "TO", w: 1.15 },
          { label: "Ø MM", w: 0.75, align: "right" },
          { label: "MAT", w: 0.7 },
          { label: "LENGTH", w: 1, align: "right" },
          { label: "SLOPE %", w: 0.95, align: "right" },
          { label: "IL UP", w: 1, align: "right" },
          { label: "IL DN", w: 1, align: "right" },
        ];
    const rows = PIPES.map((p) =>
      f.tall
        ? [p.id, `${p.from} → ${p.to.replace("MHL1-", "")}`, String(p.dia), n2(p.length), (p.slope * 100).toFixed(2)]
        : [p.id, p.from, p.to, String(p.dia), p.mat, n2(p.length), (p.slope * 100).toFixed(2), n2(p.ilUp), n2(p.ilDn)],
    );
    const rowH = size * (f.tall ? 2.05 : 2.3);
    const tx = R.x + size * 0.5;
    const ty = R.y + size * 3.4;
    const rowAt = (i: number) => 6.9 + i * 0.22;
    const res = table(f, cols, rows, {
      x: tx,
      y: ty,
      w: R.w - size,
      rowH,
      headIn: seg(lt, 6.5, 6.9),
      rowIn: (i) => seg(lt, rowAt(i) + 0.3, rowAt(i) + 0.55),
      highlight: (i) => (i === FOCUS_PIPE ? seg(lt, 8.4, 8.7) : 0),
      size,
    });
    PIPES.forEach((p, i) => {
      const from = callPos.get(p.from);
      if (!from) return;
      const to: XY = [res.xs[1] + res.cell(1) / 2, ty + rowH * (i + 1.5)];
      flyer(f, p.id, from, to, seg(lt, rowAt(i) - 0.2, rowAt(i) + 0.45), WORK.pipe.color);
    });
    const ck = seg(lt, 8.5, 8.9);
    if (ck > 0) {
      const total = PIPES.reduce((a, p) => a + p.length, 0);
      const text = f.tall ? `TOTAL ${n2(total)} lm · ${STRUCTURES.length} STRUCTURES` : `TOTAL ${n2(total)} lm · ${STRUCTURES.length} STRUCTURES · NO MANUAL TRANSCRIPTION`;
      mono(f, text, tx + size * 0.7, res.bottom + size * 1.6, { alpha: ck, color: C.accent, size: size * 0.92 });
    }
  }
  caption(f, ["From drawings", "to network data."], env(lt, 1.0, 1.6, 3.8, 4.3));
  marker(f, "STORMWATER · NETWORK EXTRACTION", env(lt, 1, 1.5, 8.4, 9));
}

/* ================================================================== */
/* 5 · WEEKLY PROGRESS                                                   */
/* ================================================================== */

const CMP_CMD = 3.1;
/** turns the plan so the road through the lay-by runs level on screen */
const ROAD_LEVEL = -Math.atan2(PROGRESS.frame.h[1], PROGRESS.frame.h[0]);
const CLASSIFY = 4.2;

function drawProgressDrawing(f: Frame, V: View, which: "prev" | "curr", tone: string, a: number, dash: number[] = []) {
  const { ctx } = f;
  const { P } = V;
  ctx.save();
  ctx.globalAlpha *= a;
  for (const l of PROGRESS.context) {
    pathPoly(ctx, l, P, false);
    stroke(ctx, "rgba(160, 185, 215, 0.28)", 1);
  }
  const bay = which === "prev" ? PROGRESS.prevBay : PROGRESS.currBay;
  pathPoly(ctx, bay, P);
  ctx.fillStyle = which === "prev" ? "rgba(111, 143, 176, 0.08)" : "rgba(232, 236, 240, 0.05)";
  ctx.fill();
  pathPoly(ctx, bay, P);
  stroke(ctx, tone, 1.2, dash);
  const kerbs = which === "prev" ? [PROGRESS.kerbKept, PROGRESS.kerbRemoved] : [PROGRESS.kerbKept, PROGRESS.kerbAdded];
  for (const k of kerbs) {
    pathPoly(ctx, k, P, false);
    stroke(ctx, tone, 2, dash);
  }
  const r = clamp(V.s * 0.8, 4, 8);
  manhole(ctx, P(PROGRESS.mhKept), r, tone);
  if (which === "curr") manhole(ctx, P(PROGRESS.mhAdded), r, tone);
  ctx.restore();
}

export function progressScene(f: Frame) {
  const lt = f.lt;
  const { ctx } = f;
  clear(f);
  const center = f.tall ? pf(0, 12) : pf(0, 5);
  const span = f.tall ? 80 : 120;
  const side = sidePanel(f, 0.5, 0.5);
  const make = easeInOut(seg(lt, 5.7, 6.4));

  // 0 → 0.8: from the drainage table back to the drawing, onto the lay-by
  if (lt < 1.0) {
    const cam = track(
      [
        { at: 0, cam: f.tall ? { x: 330, y: -26, span: 330 } : { x: 350, y: -22, span: 380 } },
        { at: 0.9, cam: { x: center[0], y: center[1], span: span * 2.2, r: ROAD_LEVEL } },
      ],
      lt,
    );
    const V = view(f, cam);
    drawProject(f, V, { ...FULL_LAYERS, typed: 0.35, dim: 0.5 * (1 - seg(lt, 0.5, 1.0)) });
  }

  // two drawings side by side, then overlaid
  const open = easeOut(seg(lt, 0.5, 1.2));
  const merge = easeInOut(seg(lt, 2.2, 3.1));
  const gap = 8;
  const half = f.tall ? { w: f.W, h: (f.H - gap) / 2 } : { w: (f.W - gap) / 2, h: f.H };
  const rects = [0, 1].map((i) => {
    const full = { x: 0, y: 0, w: f.W, h: f.H };
    const split = f.tall ? { x: 0, y: i * (half.h + gap), w: f.W, h: half.h } : { x: i * (half.w + gap), y: 0, w: half.w, h: f.H };
    return {
      x: lerp(split.x, full.x, merge),
      y: lerp(split.y, full.y, merge),
      w: lerp(split.w, full.w, merge),
      h: lerp(split.h, full.h, merge),
    };
  });
  const camSpan = lerp(f.tall ? span * 1.15 : span * 0.62, span, merge);
  // each panel shows the lay-by at the same scale across its own width
  const panelView = (r: { x: number; y: number; w: number; h: number }) =>
    view(f, { x: center[0], y: center[1], span: (camSpan * f.W) / Math.max(1, r.w), r: ROAD_LEVEL }, r.x + r.w / 2 - f.W / 2 + side.ox * make, r.y + r.h / 2 - f.H / 2 + side.oy * make);
  if (open > 0) {
    ["prev", "curr"].forEach((which, i) => {
      const r = rects[i];
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      ctx.globalAlpha = open;
      const V = panelView(r);
      // the drawing sheet of each panel
      ctx.fillStyle = "rgba(11, 14, 18, 0.9)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      if (merge < 1 || which === "curr") {
        const tone = merge > 0.5 ? (which === "prev" ? "rgba(111, 143, 176, 0.9)" : "rgba(232, 236, 240, 0.9)") : "rgba(232, 236, 240, 0.85)";
        const cls = seg(lt, CLASSIFY, CLASSIFY + 0.6);
        drawProgressDrawing(f, V, which as "prev" | "curr", tone, which === "prev" && merge > 0.5 ? 1 - cls : 1 - cls * 0.55, which === "prev" && merge > 0.5 ? [4, 3] : []);
      }
      ctx.restore();
      // panel frame + title
      const la = open * (1 - merge);
      if (la > 0) {
        ctx.save();
        ctx.globalAlpha = la;
        ctx.strokeStyle = C.lineStrong;
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
        ctx.restore();
        const pad = f.tall ? 12 : 20;
        mono(f, i === 0 ? "PREVIOUS WEEK · PU-07" : "CURRENT WEEK · PU-08", r.x + pad, r.y + r.h - pad, { alpha: la, color: i === 0 ? "#8fa9c4" : C.text1 });
      }
    });
  }
  const V = panelView(rects[1]);

  // classification: added / removed / unchanged, by geometry
  const ck = seg(lt, CLASSIFY, CLASSIFY + 1.6);
  if (ck > 0) {
    const { P } = V;
    const fade = 1 - 0.3 * make;
    // unchanged kept grey; the prior bay, a manhole, a kerb run
    ctx.save();
    ctx.globalAlpha = fade;
    pathPoly(ctx, PROGRESS.prevBay, P);
    hatch(f, "#98a3b0", seg(ck, 0, 0.3) * 0.5, 5, Math.PI / 4, 0.05);
    // added region: only the difference emerges (wipe along the road)
    const wipe = easeOut(seg(ck, 0.1, 0.5));
    if (wipe > 0) {
      const w = [pf(0, 12), pf(5 * wipe, 12), pf(5 * wipe, 22), pf(0, 22)];
      pathPoly(ctx, w, P);
      hatch(f, C.accent, 1, 4, Math.PI / 4, 0.2);
      pathPoly(ctx, w, P);
      stroke(ctx, C.accent, 1.2);
    }
    // removed kerb
    const rk = seg(ck, 0.3, 0.55);
    if (rk > 0) {
      pathPoly(ctx, PROGRESS.kerbRemoved, P, false);
      stroke(ctx, `rgba(229, 72, 77, ${0.4 + 0.6 * (1 - seg(ck, 0.55, 0.9)) * 0.6 + 0.3})`, 2.2, [6, 4]);
    }
    // added kerb, added manhole
    const ak = seg(ck, 0.45, 0.7);
    if (ak > 0) {
      ctx.save();
      ctx.globalAlpha *= ak;
      pathPoly(ctx, PROGRESS.kerbAdded, P, false);
      stroke(ctx, C.accent, 2.4);
      manhole(ctx, P(PROGRESS.mhAdded), clamp(V.s * 0.8, 4, 8), C.accent);
      ctx.restore();
    }
    ctx.restore();
    // tags
    const prevA = polyArea(PROGRESS.prevBay);
    const currA = polyArea(PROGRESS.currBay);
    const tags: [number, string, XY, string][] = [
      [0.05, `PREVIOUS ${n2(prevA)} m²`, pf(-5, 26), "#8fa9c4"],
      [0.15, `CURRENT ${n2(currA)} m²`, pf(-5, 31), C.text1],
      [0.35, `+${n2(currA - prevA)} m² ADDED`, f.tall ? pf(-2.5, 27) : pf(2.5, 7), C.accent],
      [0.5, `−${n2(lineLength(PROGRESS.kerbRemoved))} lm REMOVED`, f.tall ? pf(17, 7) : pf(15, 9), C.red],
      [0.65, `+${n2(lineLength(PROGRESS.kerbAdded))} lm`, f.tall ? pf(15, 17) : pf(12, 26), C.accent],
      [0.75, "+1 nr", pf(15, -12), C.accent],
    ];
    for (const [at, text, p, col] of tags) {
      if (f.tall && (text.startsWith("PREVIOUS") || text.startsWith("CURRENT"))) continue;
      const k = seg(ck, at, at + 0.2);
      if (k <= 0) continue;
      const [x, y] = P(p);
      tag(f, text, x, y, { align: "center", color: col, border: col === C.text1 ? C.lineStrong : col, alpha: easeOut(k) * (1 - 0.5 * make) });
    }
    if (f.tall) {
      const k = seg(ck, 0.05, 0.3) * (1 - make);
      mono(f, `PREVIOUS ${n2(prevA)} m² → CURRENT ${n2(currA)} m²`, 18, 48, { alpha: k, color: C.text2 });
    }
    // legend
    const lg = seg(ck, 0.7, 1) * (1 - make);
    if (lg > 0) {
      const size = monoSize(f);
      const pad = f.tall ? 18 : Math.max(24, f.W * 0.028);
      const items: [string, string][] = [
        [C.accent, "ADDED 3"],
        [C.red, "REMOVED 1"],
        ["#98a3b0", "UNCHANGED 3"],
      ];
      let x = pad;
      const y = f.tall ? pad + 10 : pad + 12;
      for (const [col, t] of items) {
        ctx.fillStyle = col;
        ctx.globalAlpha = lg;
        ctx.fillRect(x, y - size * 0.75, size * 0.8, size * 0.8);
        ctx.globalAlpha = 1;
        mono(f, t, x + size * 1.3, y, { alpha: lg, color: C.text2 });
        x += textWidth(f, t, size) + size * 3;
      }
    }
  }

  // aggregated: section · area · work type · previous · current · change
  const pa = env(lt, 5.9, 6.5);
  const R = fitPanel(f, side.r, PROGRESS_ROWS.length, 1, 2.5);
  panel(f, R.x, R.y, R.w, R.h, pa, "WEEKLY PROGRESS · PU-07 → PU-08", "YTCOMPARE");
  if (pa > 0) {
    const size = monoSize(f);
    const cols: Col[] = f.tall
      ? [
          { label: "AREA", w: 1 },
          { label: "WORK", w: 1.1 },
          { label: "PREV", w: 1, align: "right" },
          { label: "CURR", w: 1, align: "right" },
          { label: "CHANGE", w: 1.1, align: "right" },
        ]
      : [
          { label: "SECTION", w: 0.9 },
          { label: "AREA", w: 0.8 },
          { label: "WORK TYPE", w: 1.2 },
          { label: "PREVIOUS", w: 1.05, align: "right" },
          { label: "CURRENT", w: 1.05, align: "right" },
          { label: "CHANGE", w: 1.05, align: "right" },
          { label: "UNIT", w: 0.55 },
        ];
    const rows = PROGRESS_ROWS.map((r) => {
      const u = WORK[r.kind].unit;
      const d = r.kind === "manhole" ? 0 : 2;
      return f.tall
        ? [r.area, WORK[r.kind].label, nq(r.prev, u), nq(r.curr, u), `${signed(r.curr - r.prev, d)} ${u}`]
        : [r.section, r.area, WORK[r.kind].label, nq(r.prev, u), nq(r.curr, u), signed(r.curr - r.prev, d), u];
    });
    const rowH = size * 2.5;
    const res = table(f, cols, rows, {
      x: R.x + size * 0.5,
      y: R.y + size * 3.4,
      w: R.w - size,
      rowH,
      headIn: seg(lt, 6.2, 6.6),
      rowIn: (i) => seg(lt, 6.6 + i * 0.3, 6.95 + i * 0.3),
      size,
      colors: (_i, c) => (c === (f.tall ? 4 : 5) ? C.accent : undefined),
    });
    const k = seg(lt, 7.7, 8.1);
    if (k > 0) {
      mono(f, "PREVIOUS + CHANGE = CURRENT, FOR EVERY ITEM", R.x + size * 1.2, res.bottom + size * 1.8, { alpha: k, color: C.text3, size: size * 0.92 });
    }
  }

  commandLine(f, "YTCOMPARE", CMP_CMD, "PU-07 ↔ PU-08 · geometry compared · 4 changes", env(lt, CMP_CMD - 0.3, CMP_CMD, 5.6, 6.0));
  caption(f, ["From changes", "to progress."], env(lt, 0.9, 1.5, 2.1, 2.5), f.tall ? "tl" : "tl");
  marker(f, "T-03 · DRAWING COMPARISON", env(lt, 1, 1.5, 8, 8.5));
}

/* ================================================================== */
/* 6 · TRACEABILITY                                                      */
/* ================================================================== */

const WIR_CMD = 2.7;
const CHAIN = [
  { k: "GEOMETRY", v: "Polygon · C-ASPHALT" },
  { k: "AREA", v: "A02-N · SEC-1" },
  { k: "WORK ITEM", v: "" },
  { k: "BOQ", v: WORK.asphalt.boq },
  { k: "WIR", v: "WIR-0142 · Approved" },
  { k: "IPC / CLAIM", v: "IPC-07" },
];
const CONFIG: [string, string, string][] = [
  ["C-ASPHALT", WORK.asphalt.desc, WORK.asphalt.boq],
  ["C-KERB", WORK.kerb.desc, WORK.kerb.boq],
  ["C-DEMOLITION", WORK.demolition.desc, WORK.demolition.boq],
  ["C-STORM-PIPE", WORK.pipe.desc, WORK.pipe.boq],
];

export function traceScene(f: Frame) {
  const lt = f.lt;
  const { ctx } = f;
  clear(f);
  const center = pf(0, 5);
  const trace = shot(f, SHOTS.trace);
  const cam = track(
    [
      { at: 0, cam: { x: center[0], y: center[1], span: f.tall ? 80 : 120, r: ROAD_LEVEL } },
      { at: 1.0, cam: f.tall ? { ...trace, y: trace.y - 32 } : { ...trace, y: trace.y - 30 } },
    ],
    lt,
  );
  const V = view(f, cam);
  const selK = seg(lt, 1.2, 1.5);
  drawProject(f, V, { ...FULL_LAYERS, progress: 1, focusArea: "A02-N", focus: env(lt, 1.8, 2.2), dim: lerp(1, 0.55, selK) * env(lt, 0, 0.4) });

  // the selected object: asphalt inside A02-N
  const row = qty("A02-N", "asphalt")!;
  const piece = row.pieces[0];
  const corners: XY[] = [so(150, 1.5), so(300, 1.5), so(300, 11.5), so(150, 11.5)];
  const cursorAt = V.P(so(232, 6.5));
  const ca = env(lt, 0.8, 1.0, 1.7, 2.0);
  if (ca > 0) {
    // CAD cursor moving in and picking the object
    const from: XY = [cursorAt[0] + 90, cursorAt[1] + 70];
    const k = easeInOut(seg(lt, 0.8, 1.2));
    const [x, y] = [lerp(from[0], cursorAt[0], k), lerp(from[1], cursorAt[1], k)];
    ctx.save();
    ctx.globalAlpha = ca;
    ctx.beginPath();
    ctx.moveTo(x - 22, y);
    ctx.lineTo(x + 22, y);
    ctx.moveTo(x, y - 22);
    ctx.lineTo(x, y + 22);
    stroke(ctx, C.text1, 1);
    ctx.strokeRect(x - 4.5, y - 4.5, 9, 9);
    ctx.restore();
  }
  if (selK > 0) {
    ctx.save();
    ctx.globalAlpha = selK;
    pathPoly(ctx, piece, V.P);
    hatch(f, WORK.asphalt.color, 0.9, 5, Math.PI / 4, 0.12);
    pathPoly(ctx, piece, V.P);
    stroke(ctx, C.grip, 1.4, [6, 4]);
    for (const c of corners) grip(ctx, V.P(c));
    ctx.restore();
    const p = V.P(so(225, 18));
    tag(f, `C-ASPHALT · ${n2(row.qty)} m²`, p[0], p[1] - 4, { align: "center", color: C.text1, border: C.grip, alpha: selK * (1 - seg(lt, 5.8, 6.3)) });
  }

  // the controlled reference: the project's work-type configuration, not colour or appearance
  const size = monoSize(f);
  const pad = f.tall ? 12 : Math.max(20, f.W * 0.022);
  const lk = env(lt, 1.6, 2.0);
  if (lk > 0) {
    if (f.tall) {
      const y = f.H * 0.47;
      const hl = seg(lt, 2.1, 2.4);
      ctx.save();
      ctx.globalAlpha = lk;
      ctx.fillStyle = `rgba(62, 224, 143, ${0.1 * hl})`;
      ctx.fillRect(pad, y - size * 1.3, f.W - pad * 2, size * 3.6);
      ctx.restore();
      mono(f, "PROJECT CONFIG · WORK TYPES", pad + 6, y, { alpha: lk, size: size * 0.9 });
      mono(f, `C-ASPHALT → ${WORK.asphalt.desc.toUpperCase()}`, pad + 6, y + size * 1.6, { alpha: lk, color: C.text1, size: size * 0.9 });
    } else {
      const w = Math.min(f.W * 0.4, 480);
      const r = { x: f.W - w - pad, y: f.H * 0.1, w, h: size * 2.6 + size * 2.3 * (CONFIG.length + 1) + size };
      panel(f, r.x, r.y, r.w, r.h, lk, "PROJECT CONFIG · WORK TYPES", "REFERENCE");
      table(
        f,
        [
          { label: "LAYER", w: 1.1 },
          { label: "WORK TYPE", w: 1.9 },
          { label: "BOQ", w: 0.9, align: "right" },
        ],
        CONFIG.map((c) => [...c]),
        {
          x: r.x + size * 0.5,
          y: r.y + size * 2.9,
          w: r.w - size,
          rowH: size * 2.3,
          headIn: seg(lt, 1.8, 2.1),
          rowIn: (i) => seg(lt, 1.85 + i * 0.06, 2.1 + i * 0.06),
          highlight: (i) => (i === 0 ? seg(lt, 2.2, 2.5) : 0),
          size,
        },
      );
    }
  }

  // the chain, from the drawing to the claim
  const chainK = seg(lt, 3.0, 5.4);
  if (chainK > 0) {
    const n = CHAIN.length;
    const values = CHAIN.map((c) => (c.k === "WORK ITEM" ? `${WORK.asphalt.code} · ${n2(row.qty)} m²` : c.v));
    const nodes: { x: number; y: number; w: number; h: number }[] = [];
    if (f.tall) {
      const top = f.H * 0.55;
      const h = (f.H - top - 14) / n - 6;
      for (let i = 0; i < n; i++) nodes.push({ x: pad + 26, y: top + i * (h + 6), w: f.W - pad * 2 - 26, h });
    } else {
      const y = f.H * 0.7;
      const gap = 16;
      const w = (f.W - pad * 2 - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) nodes.push({ x: pad + i * (w + gap), y, w, h: size * 4.6 });
    }
    // leader from the selected object to the first node
    const first = nodes[0];
    ctx.save();
    ctx.globalAlpha = seg(chainK, 0, 0.1);
    ctx.beginPath();
    ctx.moveTo(cursorAt[0], cursorAt[1]);
    ctx.lineTo(first.x + (f.tall ? -14 : first.w / 2), f.tall ? first.y + first.h / 2 : first.y);
    stroke(ctx, "rgba(77, 141, 255, 0.6)", 1, [3, 3]);
    ctx.restore();
    nodes.forEach((r, i) => {
      const k = stag(chainK, i, n, 0.75);
      if (k <= 0) return;
      const live = i >= 4 ? seg(lt, WIR_CMD + 1.3, WIR_CMD + 1.7) : 1;
      ctx.save();
      ctx.globalAlpha = easeOut(k);
      ctx.fillStyle = C.panel;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = i === n - 1 && live > 0.5 ? "rgba(62, 224, 143, 0.6)" : C.lineStrong;
      ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w) - 1, Math.round(r.h) - 1);
      ctx.restore();
      if (f.tall) {
        mono(f, CHAIN[i].k, r.x + 10, r.y + r.h / 2 + size * 0.35, { alpha: easeOut(k), size: size * 0.9 });
        mono(f, live > 0.5 ? values[i] : "…", r.x + r.w - 10, r.y + r.h / 2 + size * 0.35, { align: "right", alpha: easeOut(k), color: C.text1, spacing: 0.2, size: size * 0.95 });
      } else {
        mono(f, CHAIN[i].k, r.x + size, r.y + size * 1.7, { alpha: easeOut(k), size: size * 0.9 });
        mono(f, live > 0.5 ? values[i] : "…", r.x + size, r.y + size * 3.4, { alpha: easeOut(k), color: i >= 4 ? C.accent : C.text1, spacing: 0.2, size: size * (values[i].length > 20 ? 0.86 : 0.95) });
      }
      // connector to the next node
      if (i < n - 1) {
        const nk = seg(chainK, (i + 0.8) / n, (i + 1.1) / n);
        if (nk > 0) {
          const nx = nodes[i + 1];
          ctx.save();
          ctx.strokeStyle = C.accent;
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (f.tall) {
            const x = r.x - 12;
            ctx.moveTo(x, r.y + r.h / 2);
            ctx.lineTo(x, lerp(r.y + r.h / 2, nx.y + nx.h / 2, nk));
          } else {
            const y = r.y + r.h / 2;
            ctx.moveTo(r.x + r.w, y);
            ctx.lineTo(lerp(r.x + r.w, nx.x, nk), y);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
      if (f.tall) {
        ctx.fillStyle = C.accent;
        ctx.globalAlpha = easeOut(k);
        ctx.fillRect(r.x - 14.5, r.y + r.h / 2 - 2.5, 5, 5);
        ctx.globalAlpha = 1;
      }
    });
  }

  commandLine(f, "WIRIMPORT", WIR_CMD, "WIR register read · records linked by BOQ item", env(lt, WIR_CMD - 0.3, WIR_CMD, 4.4, 4.8) * (f.tall ? 0 : 1));
  caption(f, ["From geometry", "to records."], f.tall ? env(lt, 0.6, 1.2, 2.5, 2.9) : env(lt, 0.6, 1.2, 5.8, 6.4), "bl", f.tall ? undefined : f.W * 0.4);
  marker(f, "TRACEABILITY · BOQ · WIR · IPC", env(lt, 1, 1.5, 6, 6.5));
}

/* ================================================================== */
/* 7 · REPORT                                                            */
/* ================================================================== */

/** Where the drawing sits while the report is up: its centre on screen. */
const planSpot = (f: Frame): XY => (f.tall ? [f.W / 2, f.H * 0.25] : [(f.W * 0.33) / 2, f.H / 2]);

type ReportRow = { section: string; area: string; kind: keyof typeof WORK | "excavation"; desc: string; unit: string; q: number; prev: number; curr: number; from?: XY };

function reportRows(f: Frame): ReportRow[] {
  const q = (area: string, kind: keyof typeof WORK) => qty(area, kind)?.qty ?? 0;
  const cut = f.data.terrain.c.cut;
  const bay = PROGRESS_ROWS[0];
  const kerb = PROGRESS_ROWS[1];
  const aspA02 = q("A02-N", "asphalt");
  const kerbA02 = q("A02-N", "kerb");
  const pipeA02 = q("A02-S", "pipe");
  const demA03 = q("A03-N", "demolition");
  return [
    { section: "SEC-1", area: "A02-N", kind: "asphalt", desc: WORK.asphalt.desc, unit: "m²", q: aspA02, prev: aspA02 * 0.6, curr: aspA02 * 0.8, from: areaById("A02-N").label },
    { section: "SEC-1", area: "A02-N", kind: "kerb", desc: WORK.kerb.desc, unit: "lm", q: kerbA02, prev: kerbA02 * 0.5, curr: kerbA02 * 0.7 },
    { section: "SEC-1", area: "A02-S", kind: "pipe", desc: WORK.pipe.desc, unit: "lm", q: pipeA02, prev: pipeA02 * 0.66, curr: pipeA02 },
    { section: "SEC-1", area: "A02-S", kind: "manhole", desc: WORK.manhole.desc, unit: "nr", q: 3, prev: 2, curr: 3 },
    { section: "SEC-1", area: "A03-N", kind: "demolition", desc: WORK.demolition.desc, unit: "m²", q: demA03, prev: demA03, curr: demA03 },
    { section: "SEC-2", area: "A04-N", kind: "asphalt", desc: "Lay-by asphalt", unit: "m²", q: 150, prev: bay.prev, curr: bay.curr, from: pf(0, 17) },
    { section: "SEC-2", area: "A04-N", kind: "kerb", desc: WORK.kerb.desc, unit: "lm", q: 60, prev: kerb.prev, curr: kerb.curr },
    { section: "SEC-2", area: "BASIN-01", kind: "excavation", desc: "Basin excavation (TIN)", unit: "m³", q: cut, prev: cut * 0.64, curr: cut, from: basinToWorld(60, 35) },
  ];
}

export function reportScene(f: Frame) {
  const lt = f.lt;
  const { ctx } = f;
  clear(f);
  const pad = f.tall ? 12 : Math.max(20, f.W * 0.022);
  const move = easeInOut(seg(lt, 0.2, 1.4));
  // the drawing moves aside: wide → left third, tall → top quarter
  const planW = f.W * 0.33;
  const spot = planSpot(f);
  const cam = track(
    [
      { at: 0, cam: f.tall ? { ...shot(f, SHOTS.trace), y: shot(f, SHOTS.trace).y - 32 } : { ...shot(f, SHOTS.trace), y: shot(f, SHOTS.trace).y - 30 } },
      { at: 1.4, cam: f.tall ? { x: 380, y: -40, span: 620 } : { x: 400, y: -30, span: 1180 } },
    ],
    lt,
  );
  const V = view(f, cam, (spot[0] - f.W / 2) * move, (spot[1] - f.H / 2) * move);
  drawProject(f, V, { ...FULL_LAYERS, progress: 1, areaLabels: 1 - move, stations: 1 - move, dim: 0.9 });

  const R = f.tall ? { x: pad, y: f.H * 0.37, w: f.W - pad * 2, h: f.H * 0.63 - pad } : { x: planW + pad * 0.5, y: f.H * 0.07, w: f.W - planW - pad * 1.5, h: f.H * 0.86 };
  const pk = easeOut(seg(lt, 0.8, 1.6));
  const rr = { ...R, x: R.x + (1 - pk) * 30 };
  panel(f, rr.x, rr.y, rr.w, rr.h, pk, "QUANTITY_REPORT_PU-08.XLSX", "EXAMPLE DATA");
  if (pk <= 0) return;
  const size = monoSize(f) * (f.tall ? 0.92 : 0.95);

  // sheet tabs
  const tabs = ["Summary", "Quantities", "Sections", "Drainage", "Progress"];
  let x = rr.x + size;
  const ty = rr.y + size * 4.1;
  tabs.forEach((t, i) => {
    if (f.tall && i > 3) return;
    const w = textWidth(f, t.toUpperCase(), size * 0.88) + size * 1.4;
    ctx.save();
    ctx.globalAlpha = pk * seg(lt, 1.0 + i * 0.06, 1.3 + i * 0.06);
    ctx.fillStyle = i === 1 ? C.accentSoft : "transparent";
    ctx.fillRect(x, ty - size * 1.05, w, size * 1.75);
    ctx.restore();
    mono(f, t.toUpperCase(), x + size * 0.7, ty + size * 0.2, { size: size * 0.88, color: i === 1 ? C.accent : C.text3, alpha: pk * seg(lt, 1.0 + i * 0.06, 1.3 + i * 0.06) });
    x += w + 3;
  });

  const rows = reportRows(f);
  const cols: Col[] = f.tall
    ? [
        { label: "AREA", w: 1.05 },
        { label: "WORK TYPE", w: 1.25 },
        { label: "CURRENT", w: 1.2, align: "right" },
        { label: "CHANGE", w: 1.05, align: "right" },
        { label: "UNIT", w: 0.5 },
      ]
    : [
        { label: "PROJECT", w: 0.72 },
        { label: "SECTION", w: 0.72 },
        { label: "AREA", w: 0.95 },
        { label: "WORK TYPE", w: 1.3 },
        { label: "DESCRIPTION", w: 1.85 },
        { label: "UNIT", w: 0.45 },
        { label: "QUANTITY", w: 1.05, align: "right" },
        { label: "PREVIOUS", w: 1.05, align: "right" },
        { label: "CURRENT", w: 1.05, align: "right" },
        { label: "CHANGE", w: 1, align: "right" },
      ];
  const label = (r: ReportRow) => (r.kind === "excavation" ? "Excavation" : WORK[r.kind].label);
  const d = (r: ReportRow) => (r.unit === "nr" ? 0 : 2);
  const cells = rows.map((r) =>
    f.tall
      ? [r.area, label(r), nq(r.curr, r.unit), signed(r.curr - r.prev, d(r)), r.unit]
      : ["RD-01", r.section, r.area, label(r), r.desc, r.unit, nq(r.q, r.unit), nq(r.prev, r.unit), nq(r.curr, r.unit), signed(r.curr - r.prev, d(r))],
  );
  const rowH = size * (f.tall ? 2.25 : 2.35);
  const tX = rr.x + size * 0.4;
  const tY = rr.y + size * 5.6;
  const tW = rr.w - size * 0.8;
  const rowAt = (i: number) => 1.6 + i * 0.2;
  const res = table(f, cols, cells, {
    x: tX,
    y: tY,
    w: tW,
    rowH,
    headIn: seg(lt, 1.3, 1.7),
    rowIn: (i) => seg(lt, rowAt(i) + 0.25, rowAt(i) + 0.5),
    size,
    colors: (i, c) => {
      if (c === cols.length - (f.tall ? 2 : 1)) return rows[i].curr - rows[i].prev > 0.004 ? C.accent : C.text3;
      if (c === (f.tall ? 1 : 3)) return rows[i].kind === "excavation" ? C.cut : WORK[rows[i].kind].color;
      return undefined;
    },
  });
  // values from the drawing, into their cells
  rows.forEach((r, i) => {
    if (!r.from) return;
    const from = V.P(r.from);
    const ci = f.tall ? 2 : 8;
    const to: XY = [res.xs[ci] + res.cell(ci) / 2, tY + rowH * (i + 1.5)];
    flyer(f, `${nq(r.curr, r.unit)} ${r.unit}`, from, to, seg(lt, rowAt(i) - 0.25, rowAt(i) + 0.5), r.kind === "excavation" ? C.cut : C.accent);
  });

  // % complete by item: the chart under the table
  const ch = seg(lt, 3.6, 4.2);
  const y0 = res.bottom + size * 2.2;
  const avail = rr.y + rr.h - y0 - size * (f.tall ? 3.4 : 3.6);
  // the chart only where there is room for it (not on small phones)
  if (ch > 0 && avail > 70) {
    mono(f, "% COMPLETE · CURRENT / QUANTITY", tX + size * 0.7, y0, { alpha: ch, size: size * 0.9 });
    {
      const n = rows.length;
      const slot = (tW - size * 1.4) / n;
      const bw = Math.min(slot * 0.42, 22);
      const bh = Math.min(avail - size * 1.8, 96);
      rows.forEach((r, i) => {
        const k = easeOut(seg(lt, 3.8 + i * 0.07, 4.5 + i * 0.07));
        const pctPrev = clamp(r.prev / r.q);
        const pct = clamp(r.curr / r.q);
        const cx = tX + size * 0.7 + slot * (i + 0.5);
        const bx = cx - bw / 2;
        const by = y0 + size * 1.2;
        ctx.save();
        ctx.globalAlpha = ch;
        ctx.fillStyle = "rgba(160, 185, 215, 0.05)";
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = "rgba(160, 185, 215, 0.22)";
        ctx.fillRect(bx, by + bh * (1 - pctPrev * k), bw, bh * pctPrev * k);
        ctx.fillStyle = "rgba(62, 224, 143, 0.75)";
        ctx.fillRect(bx, by + bh * (1 - pct * k), bw, bh * (pct - pctPrev) * k);
        ctx.restore();
        mono(f, `${Math.round(pct * 100 * k)}%`, cx, by + bh + size * 1.3, { align: "center", alpha: ch, size: size * 0.82, color: C.text2, spacing: 0 });
        mono(f, r.area, cx, by + bh + size * 2.5, { align: "center", alpha: ch * 0.8, size: size * 0.74, spacing: 0 });
      });
      // key
      const kx = tX + tW - size * 0.7;
      mono(f, "■ TO DATE", kx, y0, { align: "right", alpha: ch, size: size * 0.8, color: C.accent });
      mono(f, "■ PREVIOUS", kx - textWidth(f, "■ TO DATE", size * 0.8) - size * 1.2, y0, { align: "right", alpha: ch, size: size * 0.8, color: "#8a96a3" });
    }
  }
  // the summary line: everything the film measured
  const sk = seg(lt, 4.8, 5.3);
  if (sk > 0) {
    const cut = f.data.terrain.c.cut;
    const parts = f.tall
      ? [`${AREAS.length} AREAS`, `${PIPES.length} PIPES`, `${n2(cut)} m³`]
      : [`${AREAS.length} AREAS`, `${new Set(QUANTITIES.map((q) => q.kind)).size} WORK TYPES`, `${PIPES.length} PIPES · ${STRUCTURES.length} STRUCTURES`, `${n2(cut)} m³ CUT`, "4 CHANGES"];
    mono(f, parts.join("  ·  "), tX + size * 0.7, rr.y + rr.h - size * 1.3, { alpha: sk, color: C.text2, size: size * 0.92 });
  }
  caption(f, ["From geometry", "to reports."], env(lt, 1.8, 2.4, 6.9, 7.4), f.tall ? "tl" : "bl", f.tall ? undefined : planW - pad * 2);
}

/* ================================================================== */
/* 8 · FINALE                                                            */
/* ================================================================== */

const WORDS = ["Draw.", "Measure.", "Classify.", "Compare.", "Report."];
const WORD_AT = 1.0;
const WORD_STEP = 0.62;

export function finaleScene(f: Frame) {
  const lt = f.lt;
  const { ctx } = f;
  clear(f);
  const cam = track(
    [
      { at: 0, cam: f.tall ? { x: 380, y: -40, span: 620 } : { x: 400, y: -30, span: 1180 } },
      { at: 1.2, cam: shot(f, SHOTS.full) },
      { at: 8, cam: { ...shot(f, SHOTS.full), span: shot(f, SHOTS.full).span * 1.06 } },
    ],
    lt,
  );
  const spot = planSpot(f);
  const back = 1 - easeInOut(seg(lt, 0, 1.2));
  // phones: the drawing sits low while the words stack above it, then centres for the end frame
  const low = f.tall ? f.H * 0.2 * easeInOut(seg(lt, 0.2, 1.2)) * (1 - easeInOut(seg(lt, 4.8, 5.8))) : 0;
  const V = view(f, cam, (spot[0] - f.W / 2) * back, (spot[1] - f.H / 2) * back + low);
  const w = (i: number) => seg(lt, WORD_AT + i * WORD_STEP, WORD_AT + i * WORD_STEP + 0.4);
  const simplify = easeInOut(seg(lt, 4.7, 5.6));
  const act = (i: number) => w(i) * (1 - simplify);
  drawProject(f, V, {
    align: 1,
    head: 0,
    stations: 0.6 * (1 - simplify),
    edges: 1,
    areas: 0.5 + 0.5 * act(1),
    areaLabels: act(1),
    asphalt: 0.6 + 0.4 * act(1),
    kerbs: 0.7,
    demolition: 0.6 + 0.4 * act(2),
    lights: 0.8,
    drainage: 1,
    basin: 0.5,
    basinCut: act(3) || 0.3 * (1 - simplify),
    progress: act(3),
    typed: act(2),
    dim: lerp(1, 0.16, simplify),
  });
  // DRAW: the alignment retraced
  const dk = seg(lt, WORD_AT, WORD_AT + 0.9);
  if (dk > 0 && dk < 1) {
    ctx.save();
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 1 - dk * 0.3;
    const cl = Array.from({ length: 151 }, (_, i) => so(i * 6, 0));
    const head = (() => {
      const pts = cl.map(V.P);
      const n = Math.floor(dk * (pts.length - 1));
      ctx.beginPath();
      pts.slice(0, n + 1).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      return pts[n];
    })();
    const g = ctx.createRadialGradient(head[0], head[1], 0, head[0], head[1], 24);
    g.addColorStop(0, "rgba(62, 224, 143, 0.5)");
    g.addColorStop(1, "rgba(62, 224, 143, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(head[0] - 24, head[1] - 24, 48, 48);
    ctx.restore();
  }
  // REPORT: a handful of quantities lift off the drawing
  const rk = seg(lt, WORD_AT + 4 * WORD_STEP, WORD_AT + 4 * WORD_STEP + 1.0);
  if (rk > 0 && rk < 1) {
    const picks: [XY, string][] = [
      [areaById("A02-N").label, `${n2(qty("A02-N", "asphalt")!.qty)} m²`],
      [basinToWorld(60, 35), `${n2(f.data.terrain.c.cut)} m³`],
      [pf(0, 17), "+50.00 m²"],
      [STRUCTURES[3].p, `${PIPES.length} pipes`],
    ];
    picks.forEach(([p, t], i) => {
      const from = V.P(p);
      flyer(f, t, from, [f.W - 60 - i * 8, 40 + i * 6], clamp(rk * 1.3 - i * 0.1), C.accent);
    });
  }

  // the words, stacked
  const size = f.tall ? Math.min(30, f.W * 0.08) : clamp(f.W * 0.036, 26, 46);
  const pad = f.tall ? 18 : Math.max(24, f.W * 0.028);
  const wordsOut = 1 - seg(lt, 4.9, 5.4);
  const x0 = pad;
  const yBase = f.tall ? pad + size : f.H * 0.2;
  WORDS.forEach((word, i) => {
    const k = w(i);
    if (k <= 0 || wordsOut <= 0) return;
    const current = lt < WORD_AT + (i + 1) * WORD_STEP;
    const y = yBase + i * size * 1.05 + (1 - easeOut(k)) * 8;
    sans(f, word, x0, y, { size, alpha: easeOut(k) * wordsOut, color: current ? C.text1 : C.text3 });
  });
  const auto = seg(lt, WORD_AT + 5 * WORD_STEP, WORD_AT + 5 * WORD_STEP + 0.4) * wordsOut;
  if (auto > 0) sans(f, "Automatically.", x0, yBase + 5 * size * 1.05 + 6, { size, alpha: easeOut(auto), color: C.accent });

  // final frame
  const fin = env(lt, 5.5, 6.3);
  if (fin > 0) {
    const tsize = f.tall ? Math.min(28, f.W * 0.074) : clamp(f.W * 0.036, 26, 48);
    const cy = f.H * (f.tall ? 0.4 : 0.42);
    const lines = f.tall ? ["Civil engineering", "workflows, automated."] : ["Civil engineering workflows, automated."];
    lines.forEach((l, i) => sans(f, l, f.W / 2, cy + i * tsize * 1.08 + (1 - easeOut(fin)) * 10, { size: tsize, align: "center", alpha: fin }));
    const sub = env(lt, 6.0, 6.6);
    const my = cy + lines.length * tsize * 1.08 + tsize * 0.4;
    if (f.tall) {
      mono(f, "ALP YESILKAYA · CIVIL ENGINEER", f.W / 2, my, { align: "center", alpha: sub, color: C.text2 });
      mono(f, "ENGINEERING TOOLS + AI", f.W / 2, my + 18, { align: "center", alpha: sub, color: C.accent });
    } else {
      const t = "ALP YESILKAYA  ·  CIVIL ENGINEER  ·  ";
      const t2 = "ENGINEERING TOOLS + AI";
      const size2 = monoSize(f) * 1.05;
      const wA = textWidth(f, t, size2);
      const wB = textWidth(f, t2, size2);
      mono(f, t, f.W / 2 - (wA + wB) / 2, my, { alpha: sub, color: C.text2, size: size2 });
      mono(f, t2, f.W / 2 - (wA + wB) / 2 + wA, my, { alpha: sub, color: C.accent, size: size2 });
    }
  }
}
