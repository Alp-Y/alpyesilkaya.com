import { num } from "@/lib/format";
import type { Unit } from "./model";

/** 1752 m² → "1,752.00 m²"; counts (nr) as whole numbers */
export function fmt(v: number, unit: Unit, withUnit = true) {
  const s = unit === "nr" ? String(Math.round(v)) : num(v);
  return withUnit ? `${s} ${unit}` : s;
}

/** with a sign: "+1,752.00 m²", "−40.00 lm", "0 nr" */
export function signed(v: number, unit: Unit, withUnit = true) {
  if (Math.abs(v) < 0.005) return withUnit ? `0 ${unit}` : "0";
  return `${v > 0 ? "+" : "−"}${fmt(Math.abs(v), unit, withUnit)}`;
}
