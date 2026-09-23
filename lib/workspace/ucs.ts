/**
 * UCS ICON — follows the ViewCube.
 * ------------------------------------------------------------------
 * The small X / Y / Z axis icon in the hero is a true projection of the
 * drawing axes for the current view (X = east, Y = north, Z = up):
 *   TOP view → X right, Y up (Z points at you, hidden)
 *   ISO      → the three axes of an isometric view
 * It listens to the ViewCube's orientation events, so it moves in step
 * with the cube while you orbit — no loop of its own.
 */

const DEG = Math.PI / 180;
export const UCS_ORIGIN = { x: 14, y: 50 };
const LENGTH = 36;

export type UcsAxis = { x2: number; y2: number; head: string; label: { x: number; y: number }; visible: boolean };

/** Screen geometry of the three axes for azimuth / elevation in degrees. */
export function ucsGeometry(azimuthDeg: number, elevationDeg: number): Record<"x" | "y" | "z", UcsAxis> {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  // Camera basis (see components/viewcube/orientation.ts): right and up vectors
  const right = [Math.cos(az), 0, -Math.sin(az)];
  const up = [-Math.sin(el) * Math.sin(az), Math.cos(el), -Math.sin(el) * Math.cos(az)];
  const project = (v: number[]) => ({
    sx: v[0] * right[0] + v[1] * right[1] + v[2] * right[2],
    sy: v[0] * up[0] + v[1] * up[1] + v[2] * up[2],
  });
  // Drawing axes in Three.js world space: X east = +X, Y north = −Z, Z up = +Y
  const axes = { x: [1, 0, 0], y: [0, 0, -1], z: [0, 1, 0] };
  const out = {} as Record<"x" | "y" | "z", UcsAxis>;
  for (const key of ["x", "y", "z"] as const) {
    const { sx, sy } = project(axes[key]);
    const len = Math.hypot(sx, sy);
    const x2 = UCS_ORIGIN.x + sx * LENGTH;
    const y2 = UCS_ORIGIN.y - sy * LENGTH;
    const ux = len > 1e-6 ? sx / len : 1;
    const uy = len > 1e-6 ? -sy / len : 0;
    // Arrowhead: two short strokes back from the tip
    const hx = x2 - ux * 6;
    const hy = y2 - uy * 6;
    const px = -uy * 3.5;
    const py = ux * 3.5;
    out[key] = {
      x2,
      y2,
      head: `M${(hx + px).toFixed(2)} ${(hy + py).toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}L${(hx - px).toFixed(2)} ${(hy - py).toFixed(2)}`,
      label: { x: x2 + ux * 7, y: y2 + uy * 7 + 3 },
      visible: len > 0.12,
    };
  }
  return out;
}

export function initUcs(): () => void {
  const svg = document.querySelector<SVGSVGElement>("[data-ucs]");
  if (!svg) return () => {};
  const parts = (["x", "y", "z"] as const).map((k) => ({
    key: k,
    line: svg.querySelector<SVGLineElement>(`[data-ucs-line="${k}"]`)!,
    head: svg.querySelector<SVGPathElement>(`[data-ucs-head="${k}"]`)!,
    label: svg.querySelector<SVGTextElement>(`[data-ucs-label="${k}"]`)!,
  }));

  const onOrientation = (e: Event) => {
    const d = (e as CustomEvent<{ azimuth: number; elevation: number }>).detail;
    if (!d) return;
    const g = ucsGeometry(d.azimuth, d.elevation);
    for (const p of parts) {
      const a = g[p.key];
      p.line.setAttribute("x2", a.x2.toFixed(2));
      p.line.setAttribute("y2", a.y2.toFixed(2));
      p.head.setAttribute("d", a.head);
      p.label.setAttribute("x", a.label.x.toFixed(2));
      p.label.setAttribute("y", a.label.y.toFixed(2));
      const opacity = a.visible ? "1" : "0";
      p.line.style.opacity = p.head.style.opacity = p.label.style.opacity = opacity;
    }
  };
  document.addEventListener("viewcube:orientation", onOrientation);
  return () => document.removeEventListener("viewcube:orientation", onOrientation);
}
