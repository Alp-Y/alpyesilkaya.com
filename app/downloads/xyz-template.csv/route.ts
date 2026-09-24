import { XYZ_TEMPLATE } from "@/lib/excavation/xyz";

/** /downloads/xyz-template.csv — the upload format: X,Y,Z (easting, northing, elevation). */
export const dynamic = "force-static";

export function GET() {
  return new Response(XYZ_TEMPLATE, { headers: { "Content-Type": "text/csv; charset=utf-8" } });
}
