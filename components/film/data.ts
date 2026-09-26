import { buildTerrain, type Terrain } from "@/lib/film/terrain";

/** Everything the film computes once, when it is about to play. */
export type FilmData = { terrain: Terrain };

export function buildData(low: boolean): FilmData {
  return { terrain: buildTerrain(low) };
}
