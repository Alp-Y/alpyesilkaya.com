/**
 * HERO MODELS — what the hero viewport can show, and which one is showing.
 * Each model is a scene one of the tools is made for, with one sentence on
 * what the tool does there. Keep the sentences to what the tools really do
 * (see content/tools/*.md).
 */

export type HeroModelId = "road" | "basement" | "progress" | "areas";

export type HeroKey = { color: string; label: string };

export type HeroModel = {
  id: HeroModelId;
  /** Tab label */
  tab: string;
  /** What the model shows, leading the sentence */
  title: string;
  /** One specific scenario, in one sentence */
  line: string;
  tool: { name: string; href: string };
  /** Colour key shown under the sentence */
  keys: HeroKey[];
  /** Where the model is shown from, and turns from (degrees) */
  view: { azimuth: number; elevation: number };
};

export const CUT = "#e2848c";
export const FILL = "#7fd3ae";
export const LINE = "#c9d1da";
export const AREA_COLORS = ["#7aa7e0", "#b59ce6", "#6fc9c9"] as const;

export const HERO_MODELS: HeroModel[] = [
  {
    id: "road",
    tab: "Earthworks",
    title: "Road earthworks.",
    line: "Turn XYZ survey points into cut and fill volumes and an Excel report, in seconds.",
    tool: { name: "Excavation Volume Calculator", href: "/tools/excavation-volume-calculator" },
    keys: [
      { color: CUT, label: "Cut" },
      { color: FILL, label: "Fill" },
    ],
    view: { azimuth: 0, elevation: 0 },
  },
  {
    id: "basement",
    tab: "Basement",
    title: "Basement excavation.",
    line: "Measure a basement excavation from the ground survey and the dug surface, with sections to check it.",
    tool: { name: "Excavation Volume Calculator", href: "/tools/excavation-volume-calculator" },
    keys: [
      { color: CUT, label: "Excavation" },
      { color: LINE, label: "Survey points" },
    ],
    view: { azimuth: -35, elevation: 28 },
  },
  {
    id: "progress",
    tab: "Progress",
    title: "Weekly progress.",
    line: "Overlay last week’s and this week’s drawings and get the net quantities for the progress report.",
    tool: { name: "DWG Comparison Tool", href: "/tools/drawing-comparison-tool" },
    keys: [
      { color: FILL, label: "Added" },
      { color: CUT, label: "Taken out" },
      { color: LINE, label: "Unchanged" },
    ],
    view: { azimuth: -30, elevation: 32 },
  },
  {
    id: "areas",
    tab: "Areas",
    title: "Project areas.",
    line: "Split one asphalt layer and a pipe trench that cross three project areas into a quantity for each area.",
    tool: { name: "Quantity by Area Calculator", href: "/tools/quantity-by-area-calculator" },
    keys: [
      { color: AREA_COLORS[0], label: "Area A" },
      { color: AREA_COLORS[1], label: "Area B" },
      { color: AREA_COLORS[2], label: "Area C" },
    ],
    view: { azimuth: -40, elevation: 40 },
  },
];

// Which model is showing (the scene may load after the visitor has already picked one)
let current: HeroModelId = "road";
export function getHeroModel(): HeroModelId {
  return current;
}
export function setHeroModel(id: HeroModelId) {
  current = id;
  document.dispatchEvent(new CustomEvent("hero:model", { detail: { id } }));
}
export function heroModel(id: HeroModelId): HeroModel {
  return HERO_MODELS.find((m) => m.id === id) ?? HERO_MODELS[0];
}
