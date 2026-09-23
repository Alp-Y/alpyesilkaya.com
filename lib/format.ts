/**
 * ENGINEERING FORMATTING — one place for units and precision.
 *
 *   coordinates, lengths, areas, volumes → 2 decimals
 *   angles                               → 1 decimal
 *   thousands separator                  → "1,842.32"
 *
 * Always display numbers with `font-variant-numeric: tabular-nums`
 * (the `.num` class) so changing values don't jitter.
 */

export type Unit = "m" | "m²" | "m³" | "lm" | "°";

const fixed2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fixed1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 1842.3249 → "1,842.32" (−0.00 is shown as 0.00) */
export function num(value: number, decimals: 1 | 2 = 2): string {
  const v = Math.abs(value) < (decimals === 2 ? 0.005 : 0.05) ? 0 : value;
  return (decimals === 2 ? fixed2 : fixed1).format(v);
}

/** 1842.32, "m²" → "1,842.32 m²" ; angles → "42.3°" */
export function quantity(value: number, unit: Unit): string {
  if (unit === "°") return `${num(value, 1)}°`;
  return `${num(value, 2)} ${unit}`;
}

/** Drawing coordinate → "102.01" */
export function coord(value: number): string {
  return num(value, 2);
}

export function angle(value: number): string {
  return `${num(value, 1)}°`;
}
