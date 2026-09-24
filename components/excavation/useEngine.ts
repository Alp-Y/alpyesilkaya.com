"use client";

import { useEffect, useMemo, useState } from "react";
import { runEngine, type EngineResult, type GroundInput } from "@/lib/excavation/engine";
import { DEFAULT_SAMPLE, getSample, type Dataset, type SampleId } from "@/lib/excavation/samples";
import type { XyzResult } from "@/lib/excavation/xyz";

/** Where the excavated-surface points come from. */
export type Source = { kind: "sample"; id: SampleId } | { kind: "upload"; name: string; parsed: XyzResult };
/** Where the existing ground comes from. */
export type GroundChoice = { kind: "sample" } | { kind: "level"; z: number } | { kind: "points"; name: string; parsed: XyzResult };

export type EngineState = {
  source: Source;
  ground: GroundChoice;
  dataset: Dataset;
  result: EngineResult | null;
  status: "idle" | "calculating" | "ready" | "error";
  error: string | null;
};

export function datasetFor(source: Source): Dataset {
  if (source.kind === "sample") return getSample(source.id);
  const pts = source.parsed.points;
  const zMax = Math.max(...pts.map((p) => p.z));
  return {
    id: "upload",
    name: source.name.replace(/\.[^.]+$/, "") || "Uploaded survey",
    description: `${pts.length.toLocaleString("en-GB")} points from ${source.name}`,
    excavated: pts,
    ground: null,
    groundLevel: Math.ceil(zMax * 10) / 10,
  };
}

function groundInput(g: GroundChoice): GroundInput {
  if (g.kind === "sample") return { kind: "sample" };
  if (g.kind === "level") return { kind: "level", z: g.z };
  return { kind: "points", points: g.parsed.points, name: g.name };
}

/**
 * Engine state for the demo. The calculation runs off the input event
 * (next tick) so the interface can show "Calculating…" first, and only
 * once `active` is true (the demo is near the viewport).
 */
export function useEngine(active: boolean) {
  const [source, setSourceState] = useState<Source>({ kind: "sample", id: DEFAULT_SAMPLE });
  const [ground, setGround] = useState<GroundChoice>({ kind: "sample" });
  // the last calculation: for which inputs, and its outcome
  const [out, setOut] = useState<{ key: object; error: string | null; good: EngineResult | null } | null>(null);
  const key = useMemo(() => ({ source, ground }), [source, ground]);

  const dataset = datasetFor(source);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      try {
        const r = runEngine({ dataset: datasetFor(key.source), ground: groundInput(key.ground) });
        if (!r.comparison.tris.length) {
          setOut((prev) => ({
            key,
            good: prev?.good ?? null,
            error: "The excavated surface and the existing ground don’t overlap in plan, so there is nothing to compare. Check that both files use the same coordinate system.",
          }));
          return;
        }
        setOut({ key, good: r, error: null });
      } catch (e) {
        setOut((prev) => ({ key, good: prev?.good ?? null, error: e instanceof Error ? e.message : "The calculation failed for this data." }));
      }
    }, 30);
    return () => window.clearTimeout(timer);
  }, [active, key]);

  const current = out?.key === key;
  const status: EngineState["status"] = !active ? "idle" : !current ? "calculating" : out?.error ? "error" : "ready";
  const result = out?.good ?? null;
  const error = current ? (out?.error ?? null) : null;

  /** Change the input dataset; the ground choice follows sensibly. */
  const setSource = (next: Source) => {
    setSourceState(next);
    const d = datasetFor(next);
    setGround((g) => {
      if (next.kind === "sample") return g.kind === "level" ? { kind: "level", z: d.groundLevel } : g.kind === "points" ? g : { kind: "sample" };
      // uploaded points have no sample ground: start from a level just above them
      return g.kind === "points" ? g : { kind: "level", z: d.groundLevel };
    });
  };

  return { source, ground, dataset, result, status, error, setSource, setGround };
}
