/**
 * EXAMPLE PROJECT — a motorway scheme with an interchange.
 * ------------------------------------------------------------------
 * Geometry comes from site.json, generated together with the aerial
 * image by scripts/sqe-site.py, so the CAD overlay lines up with the
 * picture exactly. Coordinates are metres on a local grid; the survey
 * readouts add the grid origin (E 485 000, N 4 512 000).
 *
 * All values are illustrative — this is demonstration data.
 */

import site from "./site.json";
import type { Point } from "./geometry";
import type { Boundary, Project, WorkItem } from "./types";
import type { WorkTypeId } from "./workTypes";

const pts = (p: number[][]): Point[] => p.map(([x, y]) => [x, y] as Point);

export function exampleProject(): Project {
  const boundaries: Boundary[] = site.areas.map((a) => {
    const meta = { areaId: a.id, name: a.name, section: a.section, side: "—" };
    return { key: a.key, polygon: pts(a.polygon), meta, suggested: meta };
  });
  const work: WorkItem[] = site.work.map((w) => ({
    code: w.code,
    type: w.type as WorkTypeId,
    geometry: { kind: "polygon", points: pts(w.polygon) },
  }));

  return {
    name: "Motorway scheme",
    source: "example",
    boundaries,
    work,
    context: [{ points: pts(site.centreline), style: "centre" }],
    stations: site.stations.map((s) => ({ at: [s.x, s.y] as Point, label: s.label, angle: s.angle })),
    site: {
      image: site.image,
      extent: [site.extent[0], site.extent[1]],
      origin: [site.origin[0], site.origin[1]],
      survey: site.survey,
      control: site.control,
      linework: site.linework.map((l) => ({ layer: l.layer, points: pts(l.points) })),
    },
  };
}
