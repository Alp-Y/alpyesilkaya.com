/**
 * Outlines traced from the About photo, in the photo's own pixels. They are
 * what the drafter's cursor draws when it "builds" the picture
 * (components/photoBuild/PhotoBuild.tsx). A new photo needs new outlines:
 * without them the photo simply appears with the usual wipe.
 */
export type PhotoGeometry = {
  /** The photo's size in pixels: the outlines are in these units. */
  width: number;
  height: number;
  /**
   * Closed outline of the figure, "x,y x,y …", starting at the top of the head.
   * It follows the boots closely and stops at their soles: the rock is not part of it.
   */
  person: string;
  /** The skyline (ridge), left edge to right edge, "x,y x,y …". */
  ridge: string;
};

export const PHOTO_GEOMETRY: Record<string, PhotoGeometry> = {
  // public/images/about-mountain.jpg
  mountain: {
    width: 1400,
    height: 2100,
    person:
      "733,1101 711,1114 710,1121 697,1132 696,1149 683,1163 682,1180 689,1188 706,1192 706,1206 670,1218 673,1252 661,1270 654,1297 646,1370 631,1436 630,1498 647,1499 661,1552 662,1633 674,1646 677,1686 688,1695 688,1746 705,1817 716,1836 712,1852 698,1868 678,1879 668,1888 669,1896 680,1898 705,1893 740,1885 775,1880 800,1882 825,1876 843,1866 848,1854 842,1840 834,1826 829,1808 830,1789 813,1741 799,1647 788,1643 785,1604 793,1601 803,1534 817,1511 826,1450 822,1406 837,1326 835,1251 844,1245 844,1239 816,1224 809,1215 809,1201 823,1193 825,1181 823,1164 812,1157 801,1147 799,1135 793,1122 783,1111 770,1104 752,1100",
    ridge:
      "0,1004 16,1003 48,993 96,966 320,814 504,703 608,623 640,607 688,569 704,564 744,573 808,614 880,651 904,671 944,720 968,740 1008,752 1080,782 1160,806 1184,820 1232,858 1288,886 1336,925 1360,932 1392,934 1400,934",
  },
};

/* ---------- the land as a TIN surface ---------- */

type P = { x: number; y: number };

export type Tin = {
  /** Survey points, in the photo's pixels, with when they appear (0 → 1) and how near they are (0 far → 1 near). */
  points: { x: number; y: number; at: number; near: number }[];
  /**
   * Triangles: `wire` is the drawn edge, `fill` the same triangle a touch larger
   * (no seams between neighbours), `tone` how brightly its facet is shaded (0 → 1).
   */
  triangles: { wire: string; fill: string; at: number; tone: number }[];
  /** The highest point of the skyline. */
  peak: P;
  /** How far down the slope (0 = the skyline, 1 = the bottom edge) the surface has got to at t (0 → 1). */
  frontAt: (t: number) => number;
};

/**
 * DEPTH. The mountain is far away and the grass is at the viewer's feet, so the
 * surface is laid out in perspective: many thin rows of small triangles on the
 * mountain, a few deep rows of large ones in the foreground.
 * Each row: how far down the slope it sits (0 = the skyline, 1 = the bottom
 * edge) and how many triangles wide it is.
 */
const TIN_ROWS: { down: number; cols: number }[] = [
  { down: 0, cols: 18 },
  { down: 0.04, cols: 18 },
  { down: 0.09, cols: 16 },
  { down: 0.15, cols: 14 },
  { down: 0.22, cols: 12 },
  { down: 0.31, cols: 10 },
  { down: 0.42, cols: 8 },
  { down: 0.56, cols: 6 },
  { down: 0.75, cols: 5 },
  { down: 1, cols: 4 },
];
/**
 * PACE. Every row takes about the same time, so the surface creeps over the
 * small far triangles and sweeps through the large near ones. Below 1, the far
 * rows get an even larger share of the time (1 = equal time per row).
 */
const TIN_PACE = 0.82;
/** The share of the timing that goes to "down the slope"; the rest lets the middle run a little ahead of the sides. */
const TIN_DOWN = 0.8;

/**
 * Lays survey points over the land (rows that follow the skyline down to the
 * bottom edge) and joins them into triangles, like a TIN surface in Civil 3D.
 * The same input always gives the same surface: nothing here is random, so the
 * server and the browser draw identical triangles.
 */
export function buildTin({ width: W, height: H, ridge }: PhotoGeometry): Tin {
  const sky = ridge.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
  const peak = sky.reduce((a, b) => (b[1] < a[1] ? b : a));
  /** The skyline's height at x. */
  const skyY = (x: number) => {
    for (let i = 1; i < sky.length; i++) {
      const [x0, y0] = sky[i - 1];
      const [x1, y1] = sky[i];
      if (x <= x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return sky[sky.length - 1][1];
  };
  /** A steady pseudo-random number in 0 → 1 for a grid position. */
  const noise = (i: number, k: number, salt: number) => ((Math.imul(i + 1, 73856093) ^ Math.imul(k + 1, 19349663) ^ Math.imul(salt, 83492791)) >>> 0) % 1000 / 1000;

  const last = TIN_ROWS.length - 1;
  const grid: P[][] = TIN_ROWS.map(({ down, cols }, k) => {
    const colW = W / cols;
    return Array.from({ length: cols + 1 }, (_, i) => {
      const edgeX = i === 0 || i === cols;
      const edgeY = k === 0 || k === last;
      // points on the frame's edges stay on them; the rest are nudged so the mesh looks surveyed, not ruled
      const x = Math.round(i * colW + (edgeX ? 0 : (noise(i, k, 1) - 0.5) * colW * 0.5));
      const top = skyY(x);
      const gap = (H - top) * ((TIN_ROWS[Math.min(k + 1, last)].down - TIN_ROWS[Math.max(k - 1, 0)].down) / 2);
      const y = Math.round(top + (H - top) * down + (edgeY ? 0 : (noise(i, k, 2) - 0.5) * gap * 0.4));
      return { x, y };
    });
  });

  /** When something at this level (0 = the skyline row, 1 = the bottom row) and x appears. */
  const when = (level: number, x: number) => Math.min(1, Math.pow(level, TIN_PACE) * TIN_DOWN + (Math.abs(x - peak[0]) / W) * (1 - TIN_DOWN));

  const points: Tin["points"] = [];
  grid.forEach((row, k) => row.forEach((p) => points.push({ ...p, at: when(k / last, p.x), near: TIN_ROWS[k].down })));

  /**
   * Which way a face leans, -1 (towards the left) → 1 (towards the right), read from
   * the surface it sits on: the mountain falls away to both sides of its peak.
   */
  const lean = (a: P, b: P, c: P) => {
    const xs = [a.x, b.x, c.x];
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const drop = skyY(right) - skyY(left); // > 0: the ground falls to the right here
    return Math.max(-1, Math.min(1, drop / Math.max(1, right - left) / 0.6));
  };

  const triangles: Tin["triangles"] = [];
  const add = (a: P, b: P, c: P, level: number) => {
    const n = triangles.length;
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const grow = (p: P) => `${(cx + (p.x - cx) * 1.03).toFixed(1)},${(cy + (p.y - cy) * 1.03).toFixed(1)}`;
    triangles.push({
      wire: `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`,
      fill: `${grow(a)} ${grow(b)} ${grow(c)}`,
      at: when(level, cx),
      // shaded like a faceted model lit from the upper left: faces that lean towards the
      // light are brighter, and every face differs a little from its neighbours
      tone: Math.max(0, Math.min(1, 0.5 - lean(a, b, c) * 0.24 + (noise(n, 7, 3) - 0.5) * 0.5)),
    });
  };
  // Join each row to the one below. The rows have different numbers of points, so
  // walk along both at once and always close the triangle that reaches less far across.
  for (let k = 0; k < last; k++) {
    const upper = grid[k];
    const lower = grid[k + 1];
    let i = 0;
    let j = 0;
    while (i < upper.length - 1 || j < lower.length - 1) {
      const stepUpper = j === lower.length - 1 || (i < upper.length - 1 && (i + 1) / (upper.length - 1) <= (j + 1) / (lower.length - 1));
      if (stepUpper) {
        add(upper[i], upper[i + 1], lower[j], (k + 0.35) / last);
        i++;
      } else {
        add(upper[i], lower[j + 1], lower[j], (k + 0.7) / last);
        j++;
      }
    }
  }

  /** The row level (0 → 1) as a distance down the slope, between the rows' own positions. */
  const downAt = (level: number) => {
    const at = Math.max(0, Math.min(1, level)) * last;
    const k = Math.min(last - 1, Math.floor(at));
    return TIN_ROWS[k].down + (TIN_ROWS[k + 1].down - TIN_ROWS[k].down) * (at - k);
  };
  const frontAt = (t: number) => downAt(Math.pow(Math.max(0, Math.min(1, t / TIN_DOWN)), 1 / TIN_PACE));

  return { points, triangles, peak: { x: peak[0], y: peak[1] }, frontAt };
}
