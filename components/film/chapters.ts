/**
 * Chapter list — kept apart from the drawing code so the page can render
 * the chapter bar and its text description before the film itself loads.
 */

export type ChapterId = "intro" | "zones" | "volume" | "drainage" | "progress" | "report" | "end";

export const CHAPTERS: { id: ChapterId; label: string; dur: number; text: string }[] = [
  { id: "intro", label: "Intro", dur: 7.5, text: "Every drawing holds the answers. These tools find them, measure them and put them in a report, automatically." },
  { id: "zones", label: "Zones", dur: 12, text: "Measure by zone. The project zones are drawn once, and every quantity is sorted into the zone it belongs to, even where the work crosses a boundary." },
  { id: "volume", label: "Volume", dur: 14.5, text: "From survey points to volume. Survey points become a 3D surface, the ground is compared with the excavation, and the volume is worked out." },
  { id: "drainage", label: "Drainage", dur: 11, text: "Read the drainage network. Pipes and manholes are picked up straight from the drawing, with sizes and lengths, without retyping." },
  { id: "progress", label: "Progress", dur: 10.5, text: "See what changed this week. Last week's and this week's drawings are compared, and only the new work is counted as progress." },
  { id: "report", label: "Report", dur: 8.5, text: "Everything, in one report, organised the same way every week and ready to share." },
  { id: "end", label: "End", dur: 7, text: "Civil engineering workflows, automated. Alp Yesilkaya, civil engineer, engineering tools and AI." },
];
