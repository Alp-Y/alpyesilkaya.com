/**
 * THE COMPARISON — previous drawing vs current drawing.
 *
 *   only in the previous drawing  → removed (taken out)
 *   only in the current drawing   → added
 *   in both                       → unchanged
 *
 * Net quantity per item = added − removed, and it always reconciles:
 * previous total + net = current total.
 *
 * In this demonstration an object is "the same" in both drawings when its
 * layer and geometry match.
 */

import { KINDS, type Entity, type Kind, type Update } from "./model";

export type Status = "added" | "removed" | "unchanged";
export type Diffed = Entity & { status: Status };

export type Row = {
  kind: Kind;
  prev: number;
  curr: number;
  added: number;
  removed: number;
  net: number;
  /** previous + net = current */
  reconciles: boolean;
};

export type Comparison = {
  a: Update;
  b: Update;
  items: Diffed[];
  rows: Row[];
  counts: Record<Status, number>;
};

export function compare(a: Update, b: Update): Comparison {
  const inA = new Set(a.entities.map((e) => e.key));
  const inB = new Set(b.entities.map((e) => e.key));
  const items: Diffed[] = [
    ...a.entities.filter((e) => !inB.has(e.key)).map((e) => ({ ...e, status: "removed" as const })),
    ...b.entities.map((e) => ({ ...e, status: inA.has(e.key) ? ("unchanged" as const) : ("added" as const) })),
  ];
  const sum = (list: Entity[], kind: Kind) => list.reduce((s, e) => (e.kind === kind ? s + e.qty : s), 0);
  const rows = KINDS.map((kind) => {
    const prev = sum(a.entities, kind);
    const curr = sum(b.entities, kind);
    const added = sum(
      items.filter((e) => e.status === "added"),
      kind,
    );
    const removed = sum(
      items.filter((e) => e.status === "removed"),
      kind,
    );
    const net = added - removed;
    return { kind, prev, curr, added, removed, net, reconciles: Math.abs(prev + net - curr) < 1e-6 };
  });
  const counts = { added: 0, removed: 0, unchanged: 0 };
  for (const e of items) counts[e.status]++;
  return { a, b, items, rows, counts };
}
