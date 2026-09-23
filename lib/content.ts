/**
 * CONTENT
 * ------------------------------------------------------------------
 * Reads your tools and case studies from Markdown files:
 *
 *   /content/tools/<slug>.md
 *   /content/case-studies/<slug>.md
 *
 * To add a new tool: copy an existing file in /content/tools, rename it
 * (the file name becomes the URL, e.g. my-tool.md → /tools/my-tool),
 * edit the text, and drop its screenshot in /public/images/.
 * The homepage, the /tools page and the tool's own page update themselves.
 *
 * This runs only at build time on the server, never in the browser.
 */

import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter, type Frontmatter } from "./frontmatter";
import { renderMarkdown, type Heading } from "./markdown";

const CONTENT_DIR = path.join(process.cwd(), "content");

export type Tool = {
  slug: string;
  order: number;
  title: string;
  summary: string;
  platform: string;
  stack: string[];
  status: string;
  version: string;
  features: string[];
  image: string;
  imageAlt: string;
  /** Link to the download (e.g. a GitHub Release). Empty = not shown. */
  download: string;
  /** Link to documentation. Empty = not shown. */
  docs: string;
  /** Interactive demo to embed on the tool page (e.g. "sqe"). */
  demo: string;
  placeholder: boolean;
  html: string;
  headings: Heading[];
};

export type CaseStudy = {
  slug: string;
  order: number;
  title: string;
  summary: string;
  discipline: string;
  year: string;
  role: string;
  tools: string[];
  /** Headline results, written as "value | label", e.g. "70% | less checking time". */
  results: { value: string; label: string }[];
  image: string;
  imageAlt: string;
  placeholder: boolean;
  html: string;
  headings: Heading[];
};

export type Page = { data: Frontmatter; html: string; headings: Heading[] };

/* ---------- helpers ---------- */

const str = (v: Frontmatter[string] | undefined, fallback = ""): string =>
  v === undefined || v === "" ? fallback : Array.isArray(v) ? v.join(", ") : String(v);

const list = (v: Frontmatter[string] | undefined): string[] =>
  Array.isArray(v) ? v : v === undefined || v === "" ? [] : [String(v)];

const num = (v: Frontmatter[string] | undefined, fallback = 999): number =>
  typeof v === "number" ? v : Number.isFinite(Number(v)) && v !== "" ? Number(v) : fallback;

function readCollection(folder: string) {
  const dir = path.join(CONTENT_DIR, folder);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md") && !file.startsWith("_"))
    .map((file) => {
      const source = fs.readFileSync(path.join(dir, file), "utf8");
      const { data, body } = parseFrontmatter(source);
      const { html, headings } = renderMarkdown(body);
      return { slug: file.replace(/\.md$/, ""), data, html, headings };
    });
}

/* ---------- tools ---------- */

export function getTools(): Tool[] {
  return readCollection("tools")
    .map(({ slug, data, html, headings }) => ({
      slug,
      order: num(data.order),
      title: str(data.title, slug),
      summary: str(data.summary),
      platform: str(data.platform),
      stack: list(data.stack),
      status: str(data.status),
      version: str(data.version),
      features: list(data.features),
      image: str(data.image),
      imageAlt: str(data.imageAlt, `Screenshot of ${str(data.title, slug)}`),
      download: str(data.download),
      docs: str(data.docs),
      demo: str(data.demo),
      placeholder: data.placeholder === true,
      html,
      headings,
    }))
    .sort((a, b) => a.order - b.order);
}

export function getTool(slug: string): Tool | undefined {
  return getTools().find((tool) => tool.slug === slug);
}

/* ---------- case studies ---------- */

export function getCaseStudies(): CaseStudy[] {
  return readCollection("case-studies")
    .map(({ slug, data, html, headings }) => ({
      slug,
      order: num(data.order),
      title: str(data.title, slug),
      summary: str(data.summary),
      discipline: str(data.discipline),
      year: str(data.year),
      role: str(data.role),
      tools: list(data.tools),
      results: list(data.results).map((r) => {
        const [value, ...label] = r.split("|");
        return { value: value.trim(), label: label.join("|").trim() };
      }),
      image: str(data.image, "/images/placeholders/case-generic.svg"),
      imageAlt: str(data.imageAlt, str(data.title, slug)),
      placeholder: data.placeholder === true,
      html,
      headings,
    }))
    .sort((a, b) => a.order - b.order);
}

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return getCaseStudies().find((c) => c.slug === slug);
}

/* ---------- single pages (e.g. /content/about.md) ---------- */

export function getPage(name: string): Page {
  const file = path.join(CONTENT_DIR, `${name}.md`);
  if (!fs.existsSync(file)) return { data: {}, html: "", headings: [] };
  const { data, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  const { html, headings } = renderMarkdown(body);
  return { data, html, headings };
}

/** Two-digit index: 1 → "01". */
export const pad = (n: number) => String(n).padStart(2, "0");
