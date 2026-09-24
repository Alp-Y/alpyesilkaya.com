import { getSample, toCsv } from "@/lib/excavation/samples";

/**
 * /downloads/sample-xyz-points.csv — the Simple Excavation's excavated-surface
 * survey as a plain file, to try the upload with. Synthetic data.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(toCsv(getSample("simple").excavated), { headers: { "Content-Type": "text/csv; charset=utf-8" } });
}
