import { runEngine } from "@/lib/excavation/engine";
import { delaunay, type XY } from "@/lib/excavation/delaunay";
import { levelsAt } from "@/lib/excavation/volume";
import { reportModel } from "@/lib/excavation/reportModel";
import { DEFAULT_SAMPLE, getSample } from "@/lib/excavation/samples";
import { num, quantity } from "@/lib/format";
import styles from "./ToolPipeline.module.css";

/**
 * DATA → GEOMETRY → QUANTITY → REPORT
 * The Tools section's opening statement, drawn from a real calculation:
 * the road sample is run through the Excavation Volume Engine at build
 * time, so every number and every triangle here is computed, not drawn.
 * Plays once in view (effects.ts adds .is-in to [data-observe]).
 */
export default function ToolPipeline() {
  const r = runEngine({ dataset: getSample(DEFAULT_SAMPLE), ground: { kind: "sample" } });
  const c = r.comparison;
  const model = reportModel(r);
  const rows = r.dataset.excavated.filter((_, i) => i % 97 === 5).slice(0, 7);
  const tin = planTin(r);
  const maxZone = Math.max(...model.zones.map((z) => z.cut));

  return (
    <div className={styles.pipeline} data-observe>
      <ol className={styles.stages}>
        {/* 01 — data */}
        <li className={styles.stage} style={{ "--s": 0 } as React.CSSProperties}>
          <p className={styles.label}>
            <span className="accent">01</span> Data
          </p>
          <p className={styles.name}>XYZ survey points</p>
          <pre className={`${styles.raw} num`} aria-label="Raw survey data: point id, easting, northing, elevation">
            <span className={styles.rawHead}>POINT_ID,X,Y,Z</span>
            {rows.map((p, i) => (
              <span key={p.id} style={{ "--i": i } as React.CSSProperties}>
                {`${p.id},${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`}
              </span>
            ))}
            <span style={{ "--i": rows.length } as React.CSSProperties}>…</span>
          </pre>
          <p className={styles.foot}>
            <span className="num">{(r.counts.excavated + r.counts.ground).toLocaleString("en-GB")}</span> points · two surveys
          </p>
        </li>

        {/* 02 — geometry */}
        <li className={styles.stage} style={{ "--s": 1 } as React.CSSProperties}>
          <p className={styles.label}>
            <span className="accent">02</span> Geometry
          </p>
          <p className={styles.name}>TIN surfaces</p>
          <svg className={styles.tin} viewBox={`0 0 ${tin.w} ${tin.h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Triangulated surface in plan, shaded by excavation depth">
            {tin.fills.map((d, i) => (
              <path key={i} d={d} className={styles.fill} style={{ "--k": (i + 1) / tin.fills.length } as React.CSSProperties} />
            ))}
            <path d={tin.edges} className={styles.edges} pathLength={1} />
            <path d={tin.points} className={styles.pts} />
          </svg>
          <p className={styles.foot}>
            Delaunay TIN · <span className="num">{c.tris.length.toLocaleString("en-GB")}</span> triangles
          </p>
        </li>

        {/* 03 — quantity */}
        <li className={styles.stage} style={{ "--s": 2 } as React.CSSProperties}>
          <p className={styles.label}>
            <span className="accent">03</span> Quantity
          </p>
          <p className={styles.name}>Existing − excavated</p>
          <p className={styles.volume}>
            <span className="num">{num(c.cut)}</span> <em>m³</em>
          </p>
          <dl className={styles.facts}>
            <div>
              <dt>Area</dt>
              <dd className="num">{quantity(c.cutArea, "m²")}</dd>
            </div>
            <div>
              <dt>Max depth</dt>
              <dd className="num">{quantity(c.maxDepth, "m")}</dd>
            </div>
          </dl>
          <p className={styles.foot}>Excavation volume · exact per triangle</p>
        </li>

        {/* 04 — report */}
        <li className={styles.stage} style={{ "--s": 3 } as React.CSSProperties}>
          <p className={styles.label}>
            <span className="accent">04</span> Report
          </p>
          <p className={styles.name}>Quantity report</p>
          <div className={styles.sheet} aria-label="Excel report: volume by area">
            <div className={styles.sheetHead}>
              <span>Area</span>
              <span>Volume m³</span>
            </div>
            {model.zones.map((z, i) => (
              <div key={z.id} className={styles.sheetRow} style={{ "--i": i, "--w": z.cut / maxZone } as React.CSSProperties}>
                <span>{z.id}</span>
                <i aria-hidden="true" />
                <span className="num">{Math.round(z.cut).toLocaleString("en-GB")}</span>
              </div>
            ))}
          </div>
          <a className={styles.download} href="/downloads/example-excavation-report.xlsx" download>
            <span className={styles.xl} aria-hidden="true">
              XLSX
            </span>
            Download example report
            <span className="arrow" aria-hidden="true">
              ↓
            </span>
          </a>
        </li>
      </ol>
      <p className={styles.caption}>
        <span className="mono">Road Excavation sample · synthetic data · computed by the Excavation Volume Engine (T-02)</span>
      </p>
    </div>
  );
}

/** A light plan-view TIN of the sample (every other survey shot), shaded by cut depth. */
function planTin(r: ReturnType<typeof runEngine>) {
  const w = 320;
  const ground = r.existing.points;
  const xs = ground.map((p) => p.x);
  const ys = ground.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const k = w / (maxX - minX);
  const h = Math.round((maxY - minY) * k);
  // a lighter triangulation for the illustration: every other shot
  const pts = ground.filter((_, i) => i % 2 === 0);
  const tris = delaunay(pts.map((p) => [p.x, p.y] as XY));
  const P = (x: number, y: number) => `${((x - minX) * k).toFixed(1)} ${((maxY - y) * k).toFixed(1)}`;
  const buckets: string[][] = [[], [], [], []];
  const max = r.comparison.maxDepth || 1;
  const edges = new Map<string, [number, number]>();
  for (const [a, b, cc] of tris) {
    const A = pts[a], B = pts[b], C = pts[cc];
    const l = levelsAt(r.comparison, (A.x + B.x + C.x) / 3, (A.y + B.y + C.y) / 3);
    const d = l ? l.eg - l.ex : 0;
    if (d > 0.05) buckets[Math.min(3, Math.floor((d / max) * 4))].push(`M${P(A.x, A.y)}L${P(B.x, B.y)}L${P(C.x, C.y)}Z`);
    for (const [u, v] of [[a, b], [b, cc], [cc, a]]) edges.set(u < v ? `${u},${v}` : `${v},${u}`, [u, v]);
  }
  // west → east, so the drawing sweeps across the site
  const edgePath = [...edges.values()]
    .sort(([a, b], [c2, d2]) => pts[a].x + pts[b].x - pts[c2].x - pts[d2].x)
    .map(([u, v]) => `M${P(pts[u].x, pts[u].y)}L${P(pts[v].x, pts[v].y)}`)
    .join("");
  const points = pts.map((p) => `M${P(p.x, p.y)}h.01`).join("");
  return { w, h, fills: buckets.map((b) => b.join("")), edges: edgePath, points };
}
