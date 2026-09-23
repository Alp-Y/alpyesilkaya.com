/**
 * A tiny front-matter reader for the Markdown files in /content.
 *
 * Front matter is the block between the two `---` lines at the top of a
 * Markdown file. This parser understands the simple YAML used in this
 * project:
 *
 *   title: Alignment Checker          → string
 *   order: 1                          → number
 *   placeholder: true                 → boolean
 *   stack: [C#, .NET, Civil 3D API]   → list (inline)
 *   features:                         → list (one item per line)
 *     - Checks design speeds
 *     - Exports a report
 *
 * Wrap a value in quotes if it contains a colon or starts with [ or -.
 */

export type FrontmatterValue = string | number | boolean | string[];
export type Frontmatter = Record<string, FrontmatterValue>;

function parseScalar(raw: string): string | number | boolean {
  const value = raw.trim();
  if (value === "") return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value) && !/^0\d/.test(value)) return Number(value);
  return unquote(value);
}

function unquote(value: string): string {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseInlineList(raw: string): string[] {
  const inner = raw.trim().slice(1, -1).trim();
  if (!inner) return [];
  // Split on commas that are not inside quotes.
  const items: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (const ch of inner) {
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ",") {
      items.push(unquote(current));
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) items.push(unquote(current));
  return items;
}

export function parseFrontmatter(source: string): { data: Frontmatter; body: string } {
  const text = source.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!match) return { data: {}, body: text };

  const [, block, body] = match;
  const data: Frontmatter = {};
  let listKey: string | null = null;

  for (const line of block.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const listItem = /^\s+-\s+(.*)$/.exec(line) ?? /^-\s+(.*)$/.exec(line);
    if (listItem && listKey) {
      (data[listKey] as string[]).push(unquote(listItem[1]));
      continue;
    }

    const pair = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const [, key, rawValue] = pair;

    if (rawValue.trim() === "") {
      // Either an empty value or the start of a multi-line list.
      data[key] = [];
      listKey = key;
    } else if (rawValue.trim().startsWith("[") && rawValue.trim().endsWith("]")) {
      data[key] = parseInlineList(rawValue);
      listKey = null;
    } else {
      data[key] = parseScalar(rawValue);
      listKey = null;
    }
  }

  // Turn empty lists that were really "no value" into empty strings.
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value) && value.length === 0) data[key] = "";
  }

  return { data, body: body.trim() };
}
