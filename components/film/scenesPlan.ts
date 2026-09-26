/**
 * SCENES 1–2 — the opening (the project builds itself) and the Quantity by
 * Area Calculator (areas → work clipped per area → grouped table).
 */

import { AREAS, DEMOLITION_SO, QUANTITIES, WORK, alignAt, chainage, polyArea, so, soPoly, type QtyRow, type XY } from "@/lib/film/project";
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
  fitPanel,
  flyer,
  hatch,
  lerp,
  marker,
  mono,
  monoSize,
  n2,
  nq,
  panel,
  pathPoly,
  seg,
  stroke,
  table,
  tag,
  track,
  view,
  type Cam,
  type Col,
  type Frame,
} from "./draw";
import { SHOTS, drawProject, shot, stag } from "./plan";

/* ================================================================== */
/* 1 · OPENING                                                          */
/* ================================================================== */

const FOLLOW_SPAN = [220, 460];
function followCam(f: Frame, k: number): Cam {
  const { p } = alignAt(900 * easeInOut(k));
  const span = lerp(FOLLOW_SPAN[0], FOLLOW_SPAN[1], k) * (f.tall ? 0.5 : 1);
  return { x: p[0] - span * (f.tall ? 0.05 : 0.18), y: p[1] * 0.85, span, r: lerp(-0.06, 0, k) };
}

export function openScene(f: Frame) {
  const lt = f.lt;
  clear(f);
  const LINE = [1.25, 2.65];
  let cam: Cam;
  if (lt < LINE[1]) cam = followCam(f, seg(lt, LINE[0], LINE[1]));
  else
    cam = track(
      [
        { at: LINE[1], cam: followCam(f, 1) },
        { at: 4.5, cam: f.tall ? { x: 330, y: -12, span: 380 } : { x: 420, y: 0, span: 700 } },
        { at: 6.4, cam: shot(f, SHOTS.full) },
      ],
      lt,
    );
  const V = view(f, cam);
  drawProject(f, V, {
    grid: env(lt, 0, 0.6),
    align: easeInOut(seg(lt, LINE[0], LINE[1])),
    head: 1 - seg(lt, LINE[1], LINE[1] + 0.35),
    stations: env(lt, 2.5, 3.1),
    edges: seg(lt, 2.7, 3.6),
    areas: seg(lt, 3.3, 4.7),
    areaLabels: seg(lt, 3.9, 4.8),
    basin: env(lt, 4.0, 4.3),
    basinPoints: seg(lt, 4.0, 4.7),
    basinTin: env(lt, 4.5, 5.0) * (1 - 0.4 * seg(lt, 5.4, 6)),
    drainage: seg(lt, 4.6, 5.9),
    asphalt: seg(lt, 5.0, 5.8),
    kerbs: seg(lt, 5.1, 5.8),
    demolition: seg(lt, 5.2, 5.9),
    lights: seg(lt, 5.3, 5.9),
    typed: seg(lt, 5.4, 6.2),
  });

  // quantities start counting on the drawing, then the camera pulls up
  const qk = seg(lt, 5.4, 6.6);
  if (qk > 0) {
    const picks: [string, keyof typeof WORK][] = f.tall
      ? [
          ["A02-N", "asphalt"],
          ["A03-S", "pipe"],
        ]
      : [
          ["A02-N", "asphalt"],
          ["A03-S", "pipe"],
          ["A04-N", "kerb"],
          ["A05-S", "asphalt"],
        ];
    picks.forEach(([id, kind], i) => {
      const row = QUANTITIES.find((r) => r.area === id && r.kind === kind);
      const a = AREAS.find((x) => x.id === id);
      if (!row || !a) return;
      const p = V.P(so(a.rect.s0 + 75, a.sub === "N" ? 22 : -24));
      const k = stag(qk, i, picks.length, 0.5);
      tag(f, `${WORK[kind].label.toUpperCase()} ${nq(countTo(row.qty, k), row.unit)} ${row.unit}`, p[0], p[1], {
        align: "center",
        alpha: easeOut(k) * env(lt, 5.4, 5.7, 7.0, 7.5),
        color: C.text1,
      });
    });
  }

  commandLine(f, "YTQTY", 0.3, "Reading drawing · 12 project areas", env(lt, 0, 0.2, 3.0, 3.4));
  caption(f, ["Engineering data,", "automated."], env(lt, 5.7, 6.3, 7.1, 7.5), f.tall ? "tl" : "bl");
}

/* ================================================================== */
/* 2 · QUANTITY BY AREA                                                 */
/* ================================================================== */

const SCAN = [1.7, 5.3];
const FOCUS_ZONES = ["A02", "A03"];
const SPLIT_TICKS: XY[] = (() => {
  // where work crosses a boundary: kerbs at every chainage boundary, the demolition polygon at 300 and at the centreline
  const t: XY[] = [];
  for (const s of [150, 300, 450]) t.push([s, 11.5], [s, -11.5]);
  const poly = DEMOLITION_SO;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    for (const [axis, v] of [
      [0, 300],
      [1, 0],
    ] as const) {
      if ((a[axis] - v) * (b[axis] - v) < 0) {
        const k = (v - a[axis]) / (b[axis] - a[axis]);
        t.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
      }
    }
  }
  return t;
})();

/** The rows the table groups: what the scan found in A02 and A03. */
const TABLE_KINDS: Record<"wide" | "tall", [string, keyof typeof WORK][]> = {
  wide: [
    ["A02-N", "asphalt"],
    ["A02-N", "kerb"],
    ["A02-N", "light"],
    ["A02-N", "demolition"],
    ["A02-S", "pipe"],
    ["A02-S", "manhole"],
    ["A02-S", "demolition"],
    ["A03-N", "demolition"],
    ["A03-S", "demolition"],
  ],
  tall: [
    ["A02-N", "asphalt"],
    ["A02-N", "kerb"],
    ["A02-S", "manhole"],
    ["A02-N", "demolition"],
    ["A02-S", "demolition"],
    ["A03-N", "demolition"],
    ["A03-S", "demolition"],
  ],
};
const DEMOLITION_TOTAL = polyArea(soPoly(DEMOLITION_SO, 1));

function areasLayout(f: Frame) {
  if (f.tall) {
    const top = f.H * 0.44;
    return { ox: 0, oy: -f.H * 0.26, panel: { x: 12, y: top, w: f.W - 24, h: f.H - top - 12 } };
  }
  const w = Math.min(f.W * 0.47, 620);
  return { ox: -f.W * 0.25, oy: 0, panel: { x: f.W - w - Math.max(20, f.W * 0.022), y: f.H * 0.12, w, h: f.H * 0.76 } };
}

export function areasScene(f: Frame) {
  const lt = f.lt;
  clear(f);
  const L = areasLayout(f);
  const make = seg(lt, 5.6, 6.5);
  const cam = track(
    [
      { at: 0, cam: shot(f, SHOTS.full) },
      { at: 1.3, cam: shot(f, SHOTS.areas) },
    ],
    lt,
  );
  const V = view(f, cam, L.ox * easeInOut(make), L.oy * easeInOut(make));
  const scanS = lerp(80, 520, easeInOut(seg(lt, SCAN[0], SCAN[1])));
  const scanning = lt > SCAN[0];

  drawProject(f, V, {
    align: 1,
    stations: 1,
    edges: 1,
    areas: 1,
    areaLabels: 1,
    asphalt: 0.8,
    kerbs: 0.9,
    demolition: 1,
    lights: 1,
    drainage: 1,
    basin: 0.5,
    typed: 0,
    dim: 1 - 0.25 * seg(lt, 6.5, 7.5),
  });

  // the scan: each area's own share of every object, clipped and coloured
  if (scanning) {
    const { ctx } = f;
    for (const r of QUANTITIES) {
      const a = AREAS.find((x) => x.id === r.area)!;
      const k = seg(scanS, a.rect.s0, a.rect.s0 + 60);
      if (k <= 0) continue;
      const w = WORK[r.kind];
      ctx.save();
      ctx.globalAlpha = easeOut(k);
      for (const piece of r.pieces) {
        if (w.unit === "m²") {
          pathPoly(ctx, piece, V.P);
          hatch(f, w.color, 0.9, r.kind === "demolition" ? 5 : 6, r.kind === "demolition" ? -Math.PI / 4 : Math.PI / 4, 0.1);
          pathPoly(ctx, piece, V.P);
          stroke(ctx, w.color, 1);
        } else {
          pathPoly(ctx, piece, V.P, false);
          stroke(ctx, w.color, 2);
        }
      }
      ctx.restore();
    }
    // scan line across the drawing
    const sa = env(lt, SCAN[0], SCAN[0] + 0.2, SCAN[1] - 0.2, SCAN[1]);
    if (sa > 0) {
      const a = V.P(so(scanS, 34));
      const b = V.P(so(scanS, -34));
      f.ctx.save();
      f.ctx.globalAlpha = sa;
      f.ctx.beginPath();
      f.ctx.moveTo(a[0], a[1]);
      f.ctx.lineTo(b[0], b[1]);
      stroke(f.ctx, C.accent, 1.2);
      mono(f, `CH ${chainage(Math.floor(scanS / 10) * 10)}`, a[0] + 6, a[1] - 6, { color: C.accent });
      f.ctx.restore();
    }
    // boundary crossings: the object is split exactly where it crosses
    for (const [s, o] of SPLIT_TICKS) {
      const k = seg(scanS, s - 5, s + 25);
      if (k <= 0) continue;
      const [x, y] = V.P(so(s, o));
      const pulse = 1 - seg(scanS, s + 5, s + 60);
      const r = 4 + 6 * pulse;
      f.ctx.save();
      f.ctx.globalAlpha = easeOut(k) * (0.5 + 0.5 * pulse) * (1 - seg(lt, 6.5, 7.2) * 0.6);
      f.ctx.beginPath();
      f.ctx.arc(x, y, r, 0, Math.PI * 2);
      stroke(f.ctx, C.accent, 1);
      f.ctx.beginPath();
      f.ctx.moveTo(x - 3, y - 3);
      f.ctx.lineTo(x + 3, y + 3);
      f.ctx.moveTo(x + 3, y - 3);
      f.ctx.lineTo(x - 3, y + 3);
      stroke(f.ctx, C.text1, 1);
      f.ctx.restore();
    }
  }

  // per-area callouts for the focus zones
  const callouts = new Map<string, XY>();
  const cfade = 1 - seg(lt, 7.6, 8.6);
  for (const a of AREAS) {
    if (!FOCUS_ZONES.includes(a.zone)) continue;
    const k = seg(scanS, a.rect.s0 + 40, a.rect.s0 + 110);
    const rows = QUANTITIES.filter((r) => r.area === a.id && (f.tall ? ["asphalt", "demolition", "manhole"] : ["asphalt", "kerb", "demolition", "pipe", "manhole"]).includes(r.kind));
    const p = V.P(so(a.rect.s0 + 75, a.sub === "N" ? 44 : -44));
    callouts.set(a.id, p);
    if (k <= 0 || cfade <= 0) continue;
    stackLabel(
      f,
      a.id,
      rows.map((r) => [WORK[r.kind].label.toUpperCase(), `${nq(countTo(r.qty, k), r.unit)} ${r.unit}`]),
      p,
      easeOut(k) * cfade,
      a.sub === "N" ? "up" : "down",
    );
  }

  // the table: every quantity grouped by section, area and sub-area
  const pk = env(lt, 5.9, 6.6);
  const P0 = fitPanel(f, L.panel, TABLE_KINDS[f.tall ? "tall" : "wide"].length + 1, 1, 2.35);
  panel(f, P0.x, P0.y, P0.w, P0.h, pk, "QUANTITIES BY AREA", "YTQTY");
  if (pk > 0) {
    const size = monoSize(f);
    const cols: Col[] = f.tall
      ? [
          { label: "AREA", w: 1.1 },
          { label: "WORK TYPE", w: 1.5 },
          { label: "QTY", w: 1.3, align: "right" },
          { label: "UNIT", w: 0.6 },
        ]
      : [
          { label: "SECTION", w: 1 },
          { label: "AREA", w: 0.8 },
          { label: "SUB-AREA", w: 1 },
          { label: "WORK TYPE", w: 1.5 },
          { label: "QUANTITY", w: 1.4, align: "right" },
          { label: "UNIT", w: 0.6 },
        ];
    const picks = TABLE_KINDS[f.tall ? "tall" : "wide"];
    const rows = picks.map(([id, kind]) => QUANTITIES.find((r) => r.area === id && r.kind === kind)).filter(Boolean) as QtyRow[];
    const rowH = size * 2.35;
    const tx = P0.x + size * 0.6;
    const ty = P0.y + size * 3.4;
    const tw = P0.w - size * 1.2;
    const rowAt = (i: number) => 6.7 + i * 0.2;
    const res = table(
      f,
      cols,
      rows.map((r) =>
        f.tall
          ? [r.area, WORK[r.kind].label, nq(r.qty, r.unit), r.unit]
          : [r.section, r.zone, r.sub === "N" ? "North" : "South", WORK[r.kind].label, nq(r.qty, r.unit), r.unit],
      ),
      {
        x: tx,
        y: ty,
        w: tw,
        rowH,
        headIn: seg(lt, 6.3, 6.8),
        rowIn: (i) => seg(lt, rowAt(i) + 0.3, rowAt(i) + 0.55),
        highlight: (i) => (rows[i].kind === "demolition" ? seg(lt, 8.9, 9.3) : 0),
        size,
        colors: (i, c) => (c === (f.tall ? 1 : 3) ? WORK[rows[i].kind].color : undefined),
      },
    );
    // values fly from their area on the drawing into their row
    rows.forEach((r, i) => {
      const from = callouts.get(r.area);
      if (!from) return;
      const to: XY = [res.xs[res.xs.length - 2] + res.cell(res.xs.length - 2) / 2, ty + rowH * (i + 1.5)];
      flyer(f, `${nq(r.qty, r.unit)} ${r.unit}`, from, to, seg(lt, rowAt(i) - 0.15, rowAt(i) + 0.45), WORK[r.kind].color);
    });
    // the check: the four demolition parts add up to the polygon
    const ck = seg(lt, 9.0, 9.4);
    if (ck > 0) {
      const sum = QUANTITIES.filter((r) => r.kind === "demolition").reduce((a, r) => a + r.qty, 0);
      const y = res.bottom + size * 1.8;
      const text = f.tall ? `Σ 4 PARTS ${n2(sum)} = POLYGON ${n2(DEMOLITION_TOTAL)} m² ✓` : `Σ DEMOLITION, 4 AREAS  ${n2(sum)} m²  =  POLYGON ${n2(DEMOLITION_TOTAL)} m²  ✓`;
      mono(f, text, tx + size * 0.7, y, { alpha: easeOut(ck), color: C.accent, size: size * (f.tall ? 0.8 : 0.95), spacing: f.tall ? 0.2 : undefined });
    }
  }

  commandLine(f, "YTQTY", 0.55, "12 areas · 6 work types · crossings split", env(lt, 0.2, 0.4, 3.4, 3.8));
  caption(f, ["From drawings", "to quantities."], env(lt, 1.6, 2.2, 5.2, 5.7));
  const sub = env(lt, 7.2, 7.8);
  if (sub > 0) {
    const x = f.tall ? 18 : Math.max(24, f.W * 0.028);
    const y = f.tall ? 44 : f.H - Math.max(24, f.W * 0.028) - 8;
    if (f.tall) {
      mono(f, "Define the project structure once.", x, y - 17, { alpha: sub, color: C.text2 });
      mono(f, "Let the tool organise the quantities.", x, y, { alpha: sub, color: C.text1 });
    } else mono(f, "Define the project structure once · let the tool organise the quantities", x, y, { alpha: sub, color: C.text2 });
  }
  marker(f, "T-01 · QUANTITY BY AREA", env(lt, 1, 1.5, 9.4, 10));
}

/** A small stacked data label with a leader line (area id + quantities). */
export function stackLabel(f: Frame, title: string, lines: [string, string][], [x, y]: XY, a: number, dir: "up" | "down" = "up") {
  if (a <= 0) return;
  const { ctx } = f;
  const size = Math.max(9.5, 9.8 * f.u);
  const lh = size * 1.55;
  const w = size * (f.tall ? 17 : 19);
  const h = lh * (lines.length + 1) + size * 0.8;
  const x0 = clamp(x - w / 2, 6, f.W - w - 6);
  const y0 = dir === "up" ? y - h : y;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = "rgba(7, 9, 11, 0.9)";
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = "rgba(62, 224, 143, 0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.round(w) - 1, Math.round(h) - 1);
  mono(f, title, x0 + size * 0.7, y0 + lh * 0.85, { size, color: C.accent });
  lines.forEach(([k, v], i) => {
    mono(f, k, x0 + size * 0.7, y0 + lh * (i + 1.85), { size: size * 0.92, color: C.text3 });
    mono(f, v, x0 + w - size * 0.7, y0 + lh * (i + 1.85), { size, color: C.text1, align: "right", spacing: 0 });
  });
  ctx.restore();
}

export { clamp };
