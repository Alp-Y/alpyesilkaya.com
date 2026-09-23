/**
 * A small, dependency-free Markdown → HTML converter for the body of
 * your tool and case-study files.
 *
 * Supported:
 *   ## Heading / ### Subheading
 *   Paragraphs, **bold**, *italic*, `code`, [links](https://…)
 *   ![Image alt](/images/…)            → figure (alt text becomes the caption)
 *   - bullet lists / 1. numbered lists
 *   > quotes
 *   ``` code blocks ```
 *   ---                                 → divider
 *
 * If you later need more (tables, footnotes…), install a full library
 * such as `marked` and swap it in here — nothing else needs to change.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(url: string): string {
  const u = url.trim();
  if (/^(https?:|mailto:|\/|#|\.)/i.test(u)) return escapeHtml(u);
  return "#";
}

function inline(text: string): string {
  // Protect inline code first so its contents are not formatted.
  const codes: string[] = [];
  let out = text.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });

  out = escapeHtml(out);

  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt: string, src: string) =>
    `<img src="${safeUrl(src)}" alt="${alt}" loading="lazy" />`,
  );
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => {
    const external = /^https?:/i.test(href);
    return `<a href="${safeUrl(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");

  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[Number(i)]);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export type Heading = { id: string; text: string; level: 2 | 3 };

export function renderMarkdown(source: string): { html: string; headings: Heading[] } {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  const headings: Heading[] = [];
  let i = 0;

  const isBlockStart = (line: string) =>
    /^(#{2,4})\s/.test(line) ||
    /^\s*[-*]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^```/.test(line) ||
    /^---+\s*$/.test(line) ||
    /^!\[[^\]]*\]\([^)]+\)\s*$/.test(line);

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Code block
    if (/^```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    // Headings
    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text);
      if (level <= 3) headings.push({ id, text, level: level as 2 | 3 });
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    // Divider
    if (/^---+\s*$/.test(line)) {
      html.push("<hr />");
      i++;
      continue;
    }

    // Standalone image → figure
    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line);
    if (image) {
      const [, alt, src] = image;
      html.push(
        `<figure><img src="${safeUrl(src)}" alt="${escapeHtml(alt)}" loading="lazy" />${
          alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : ""
        }</figure>`,
      );
      i++;
      continue;
    }

    // Quote
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      html.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      continue;
    }

    // Lists
    const ordered = /^\s*\d+\.\s+/.test(line);
    if (ordered || /^\s*[-*]\s+/.test(line)) {
      const pattern = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*]\s+(.*)$/;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(`<li>${inline(pattern.exec(lines[i])![1])}</li>`);
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      html.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    // Paragraph: gather lines until a blank line or another block.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) para.push(lines[i++].trim());
    html.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return { html: html.join("\n"), headings };
}
