import { runEngine } from "@/lib/excavation/engine";
import { buildWorkbook } from "@/lib/excavation/report";
import { DEFAULT_SAMPLE, getSample } from "@/lib/excavation/samples";

/**
 * /downloads/example-excavation-report.xlsx — written at build time by the
 * same engine and report writer the demo uses in the browser, so the
 * example file always matches the sample results on the page.
 */
export const dynamic = "force-static";

export async function GET() {
  const result = runEngine({ dataset: getSample(DEFAULT_SAMPLE), ground: { kind: "sample" } });
  const bytes = await buildWorkbook(result);
  return new Response(new Blob([bytes as BlobPart]), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  });
}
