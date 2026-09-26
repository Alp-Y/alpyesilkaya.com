/**
 * Chapter list — kept apart from the drawing code so the page can render
 * the chapter bar and its text description before the film itself loads.
 */

export type ChapterId = "overview" | "quantities" | "surfaces" | "drainage" | "progress" | "traceability" | "report" | "summary";

export const CHAPTERS: { id: ChapterId; label: string; dur: number; text: string }[] = [
  {
    id: "overview",
    label: "Overview",
    dur: 7.5,
    text: "The YTQTY command runs on an example road drawing. An alignment is drawn, then project areas, a survey, a triangulated surface and a storm drain build up into one project.",
  },
  {
    id: "quantities",
    label: "Quantities",
    dur: 10,
    text: "Quantity by Area: areas A01 to A06, north and south. Asphalt, kerbs, pipes, manholes and a demolition polygon are measured inside each area. Objects that cross a boundary are split, and the quantities are grouped by section, area, sub-area and work type.",
  },
  {
    id: "surfaces",
    label: "Surfaces",
    dur: 16.5,
    text: "Excavation volume: X,Y,Z survey rows become points, then a TIN, contours and a terrain surface. The excavated surface is compared with existing ground, a section is cut, cross sections and the cut volume are calculated, and an Excel-style report is built.",
  },
  {
    id: "drainage",
    label: "Drainage",
    dur: 9,
    text: "Stormwater: manholes MHL1-12 to MHL1-18 and the pipes between them are read from the drawing with diameter, material, length, slope, ground and invert levels, and collected into a network table.",
  },
  {
    id: "progress",
    label: "Progress",
    dur: 8.5,
    text: "Weekly comparison with YTCOMPARE: the previous and current progress drawings are overlaid. A lay-by grows from 100 to 150 square metres, so only the new 50 square metres counts as added work. A removed kerb and a new manhole are classified too, then grouped by section, area and work type.",
  },
  {
    id: "traceability",
    label: "Traceability",
    dur: 6.5,
    text: "A selected asphalt polygon is classified from the project's work-type configuration, then linked through its area, work item and BOQ code to a WIR and an interim payment certificate.",
  },
  {
    id: "report",
    label: "Report",
    dur: 7.5,
    text: "Everything measured comes together in a structured quantity report: project, section, area, work type, description, unit, quantity, previous, current and change, with percent complete by item.",
  },
  {
    id: "summary",
    label: "Summary",
    dur: 8,
    text: "Draw, measure, classify, compare, report, automatically. Civil engineering workflows, automated. Alp Yesilkaya, civil engineer, engineering tools and AI.",
  },
];
