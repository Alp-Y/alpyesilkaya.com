/**
 * EFFECTS
 * ------------------------------------------------------------------
 * All browser-side behaviour in one small, dependency-free module.
 * It works by looking for data-* attributes in the HTML, so components
 * stay simple server-rendered markup.
 *
 *   [data-reveal] / [data-observe]  scroll reveals (adds .is-in)
 *   [data-stagger]                  gives children a --i index
 *   [data-header]                   frosted / hide-on-scroll header, mobile menu
 *   [data-section][data-layer]      active nav tab + status-bar layer
 *   [data-cad-cursor]               the CAD cursor + context HUD (workspace/cadCursor)
 *   [data-coords]                   drawing coordinates in the status bar
 *   [data-ucs]                      UCS icon following the view orientation
 *   [data-proximity]                icons that respond to the pointer nearby
 *   [data-play]                     a mark that plays its sequence once on
 *                                   section activation, and again on hover
 *   [data-cmd]                      the hero command line (workspace actions)
 *   [data-case-register]            case-study hover preview
 *   [data-copy-email]               click-to-copy email
 *   [data-grid-toggle]              GRID on/off
 *
 * initEffects() returns a cleanup function (used when the page changes).
 */

import { coord } from "./format";
import { runCommand } from "./workspace/actions";
import { finePointer, onFrame, reducedMotion } from "./workspace/pointer";
import { getCoords, initCadCursor } from "./workspace/cadCursor";
import { initWorkspaceDom } from "./workspace/dom";
import { initUcs } from "./workspace/ucs";
import { initProximity } from "./workspace/proximity";

type Cleanup = () => void;

export function initEffects(): Cleanup {
  const cleanups: Cleanup[] = [
    initStagger(),
    initReveal(),
    initHeader(),
    initActiveSection(),
    initWorkspaceDom(),
    initCadCursor(),
    initStatusCoords(),
    initUcs(),
    initProximity(),
    initPlay(),
    initCommandLine(),
    initCasePreview(),
    initCopyEmail(),
    initGridToggle(),
  ];
  document.documentElement.classList.add("fx-ready");
  return () => cleanups.forEach((fn) => fn());
}

/* ---------- Stagger: index children for staggered timing ---------- */
function initStagger(): Cleanup {
  document.querySelectorAll<HTMLElement>("[data-stagger]").forEach((parent) => {
    Array.from(parent.children).forEach((child, i) => {
      const el = child as HTMLElement;
      if (!el.style.getPropertyValue("--i")) el.style.setProperty("--i", String(i));
    });
  });
  return () => {};
}

/* ---------- Scroll reveals ---------- */
function initReveal(): Cleanup {
  const targets = document.querySelectorAll<HTMLElement>("[data-reveal], [data-observe]");
  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-in"));
    return () => {};
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0 },
  );
  targets.forEach((el) => {
    if (!el.classList.contains("is-in")) observer.observe(el);
  });
  return () => observer.disconnect();
}

/**
 * Sets --exit (0 → 1) on an element as its bottom edge travels the last
 * `range` px up to the header. `floor` is the lowest opacity it reaches.
 * CSS turns it into opacity (see [data-exit] in globals.css / Hero.module.css).
 */
function fadeOut(el: HTMLElement, barH: number, range: number, floor: number) {
  const bottom = el.getBoundingClientRect().bottom;
  const t = 1 - Math.min(1, Math.max(0, (bottom - barH) / range));
  const exit = (t * t * (3 - 2 * t)) * (1 - floor); // smoothstep: eases in and out
  const value = exit.toFixed(3);
  if (el.style.getPropertyValue("--exit") !== value) el.style.setProperty("--exit", value);
  el.dataset.exit = "";
}

/* ---------- Header + hero hand-off (driven by the shared frame loop) ---------- */
function initHeader(): Cleanup {
  const header = document.querySelector<HTMLElement>("[data-header]");
  if (!header) return () => {};
  const hero = document.querySelector<HTMLElement>("[data-hero]");
  const heroBlocks = hero ? [...hero.querySelectorAll<HTMLElement>("[data-hero-exit]")] : [];
  const sections = [...document.querySelectorAll<HTMLElement>("main > *:not([data-hero])")];

  let lastY = -1;
  const update = () => {
    const y = window.scrollY;
    if (y === lastY) return;
    // Frosted as soon as anything scrolls underneath it — content never collides with the bar
    header.dataset.state = y > 8 ? "scrolled" : "top";

    // Content fades as it slides under the top edge — never while it is still
    // in open view. Measured from the header's height (not its position), so it
    // behaves the same whether the header is shown or tucked away.
    const barH = header.offsetHeight;
    // Hero blocks: a short, clear hand-off
    if (hero && y < hero.offsetHeight + 200) {
      for (const el of heroBlocks) fadeOut(el, barH, Math.min(el.offsetHeight, 220), 0);
    }
    // Every other section: slower and softer — never fully disappears
    for (const el of sections) fadeOut(el, barH, 420, 0.25);

    const menuOpen = header.dataset.menuOpen === "true";
    if (!menuOpen && !reducedMotion() && lastY >= 0) {
      const delta = y - lastY;
      if (y > 400 && delta > 6) header.dataset.hidden = "true";
      else if (delta < -6 || y < 400) header.dataset.hidden = "false";
    }
    lastY = y;
  };
  update();
  const stopFrames = onFrame((p) => {
    if (p.scrolled) update();
  });

  // Mobile menu
  const toggle = header.querySelector<HTMLButtonElement>("[data-menu-toggle]");
  const sheet = header.querySelector<HTMLElement>("[data-menu]");
  const setMenu = (open: boolean) => {
    if (!toggle || !sheet) return;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) {
      sheet.hidden = false;
      header.dataset.hidden = "false";
      requestAnimationFrame(() => (header.dataset.menuOpen = "true"));
      document.body.style.overflow = "hidden";
    } else {
      header.dataset.menuOpen = "false";
      document.body.style.overflow = "";
      window.setTimeout(() => {
        if (header.dataset.menuOpen !== "true") sheet.hidden = true;
      }, 350);
    }
  };
  const onToggle = () => setMenu(header.dataset.menuOpen !== "true");
  const onLink = () => setMenu(false);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && header.dataset.menuOpen === "true") setMenu(false);
  };
  toggle?.addEventListener("click", onToggle);
  const links = header.querySelectorAll("[data-menu-link]");
  links.forEach((l) => l.addEventListener("click", onLink));
  window.addEventListener("keydown", onKey);

  return () => {
    stopFrames();
    toggle?.removeEventListener("click", onToggle);
    links.forEach((l) => l.removeEventListener("click", onLink));
    window.removeEventListener("keydown", onKey);
    document.body.style.overflow = "";
    header.dataset.menuOpen = "false";
    if (sheet) sheet.hidden = true;
    toggle?.setAttribute("aria-expanded", "false");
  };
}

/* ---------- Active section → nav tab + status-bar layer ---------- */
function initActiveSection(): Cleanup {
  const sections = document.querySelectorAll<HTMLElement>("[data-section][data-layer]");
  const links = document.querySelectorAll<HTMLElement>("[data-nav-link]");
  const layerName = document.querySelector<HTMLElement>("[data-layer-name]");

  const setActive = (section: HTMLElement | null) => {
    const id = section?.dataset.section ?? "";
    links.forEach((link) => (link.dataset.active = String(link.dataset.navLink === id)));
    if (layerName) layerName.textContent = section?.dataset.layer ?? document.body.dataset.layer ?? "0";
  };

  if (!sections.length) {
    // Sub-pages: highlight the matching tab from the URL.
    const path = window.location.pathname;
    links.forEach((link) => {
      const key = link.dataset.navLink ?? "";
      link.dataset.active = String(key !== "" && path.startsWith(`/${key}`));
    });
    const pageLayer = document.querySelector<HTMLElement>("[data-page-layer]")?.dataset.pageLayer;
    if (layerName && pageLayer) layerName.textContent = pageLayer;
    return () => {};
  }

  const visible = new Map<HTMLElement, number>();
  const observer = new IntersectionObserver(
    (entries) => {
      // Track how much of each section overlaps the band in the middle of the screen.
      entries.forEach((e) =>
        visible.set(e.target as HTMLElement, e.isIntersecting ? e.intersectionRect.height : 0),
      );
      let best: HTMLElement | null = null;
      let bestHeight = 0;
      for (const [el, height] of visible) {
        if (height > bestHeight) {
          best = el;
          bestHeight = height;
        }
      }
      if (best) setActive(best);
    },
    { rootMargin: "-40% 0px -45% 0px", threshold: [0, 0.01, 0.5, 1] },
  );
  sections.forEach((s) => observer.observe(s));
  return () => observer.disconnect();
}

/* ---------- Marks that play once when their section activates, and on hover ---------- */
function initPlay(): Cleanup {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-play]"));
  if (!els.length || reducedMotion()) return () => {};
  const play = (el: HTMLElement) => {
    el.classList.remove("play");
    void el.offsetWidth; // restart the CSS animation
    el.classList.add("play");
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          play(e.target as HTMLElement);
          io.unobserve(e.target); // once per visit — not replayed while you stay in the section
        }
      }
    },
    { rootMargin: "0px 0px -20% 0px" },
  );
  const onEnter = (e: Event) => play(e.currentTarget as HTMLElement);
  els.forEach((el) => {
    io.observe(el);
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("focus", onEnter);
  });
  return () => {
    io.disconnect();
    els.forEach((el) => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("focus", onEnter);
    });
  };
}

/* ---------- Status-bar coordinates: the same drawing coordinates as the HUD ---------- */
function initStatusCoords(): Cleanup {
  const out = document.querySelector<HTMLElement>("[data-coords]");
  if (!out || !finePointer()) return () => {};
  let last = "";
  return onFrame(() => {
    const c = getCoords();
    const text = c ? `${coord(c.x)}, ${coord(c.y)}` : "—";
    if (text !== last) {
      last = text;
      out.textContent = text;
    }
  });
}

/* ---------- Command line: every command is a workspace action ---------- */
function initCommandLine(): Cleanup {
  const form = document.querySelector<HTMLFormElement>("[data-cmd]");
  if (!form) return () => {};
  const input = form.querySelector<HTMLInputElement>("[data-cmd-input]")!;
  const history = form.querySelector<HTMLElement>("[data-cmd-history]")!;
  const timers: number[] = [];

  const print = (text: string) => {
    const p = document.createElement("p");
    p.textContent = text;
    history.appendChild(p);
    while (history.children.length > 2) history.firstElementChild?.remove();
  };

  // Type out the opening line once, unless reduced motion is on.
  const lines = Array.from(history.querySelectorAll<HTMLElement>("[data-cmd-line]"));
  if (!reducedMotion() && !form.dataset.typed) {
    form.dataset.typed = "true";
    lines.forEach((l) => (l.textContent = "\u00a0"));
    let delay = 1500;
    lines.forEach((line, idx) => {
      const full = line.dataset.cmdLine ?? "";
      if (idx === 0) {
        for (let i = 1; i <= full.length; i++) {
          timers.push(window.setTimeout(() => (line.textContent = full.slice(0, i)), delay + i * 24));
        }
        delay += full.length * 24 + 300;
      } else {
        timers.push(window.setTimeout(() => (line.textContent = full), delay));
      }
    });
  }

  const onSubmit = (e: Event) => {
    e.preventDefault();
    const raw = input.value.trim();
    if (!raw) return;
    input.value = "";
    const cmd = raw.toUpperCase();
    if (cmd === "GRID") {
      print(`Command: ${cmd}`);
      document.querySelector<HTMLButtonElement>("[data-grid-toggle]")?.click();
      print(`Grid ${document.documentElement.dataset.grid === "off" ? "off" : "on"}`);
      return;
    }
    const result = runCommand(raw);
    if (result.clear) {
      history.replaceChildren();
      return;
    }
    print(`Command: ${cmd}`);
    result.lines.forEach(print);
  };

  form.addEventListener("submit", onSubmit);
  return () => {
    form.removeEventListener("submit", onSubmit);
    timers.forEach(clearTimeout);
    lines.forEach((l) => (l.textContent = l.dataset.cmdLine ?? ""));
  };
}

/* ---------- Case-study preview: trails the pointer (shared pointer loop) ---------- */
function initCasePreview(): Cleanup {
  const register = document.querySelector<HTMLElement>("[data-case-register]");
  const preview = register?.querySelector<HTMLElement>("[data-case-preview]");
  const img = preview?.querySelector<HTMLImageElement>("[data-case-preview-img]");
  const label = preview?.querySelector<HTMLElement>("[data-case-preview-label]");
  if (!register || !preview || !img || !finePointer() || window.innerWidth < 900) return () => {};

  const rows = Array.from(register.querySelectorAll<HTMLElement>("[data-case-row]"));
  const list = rows[0]?.closest("ol");
  const reduce = reducedMotion();
  let cx = 0;
  let cy = 0;
  let active = false;
  let currentRow: HTMLElement | null = null;

  // Preload preview images so the swap is instant.
  rows.forEach((row) => {
    if (row.dataset.preview) new Image().src = row.dataset.preview;
  });

  return onFrame((p) => {
    const row = p.inside && !p.scrolled ? p.target?.closest<HTMLElement>("[data-case-row]") : null;
    const isActive = !!row && !!list?.contains(row);
    if (row && row !== currentRow) {
      currentRow = row;
      const src = row.dataset.preview;
      if (src && img.getAttribute("src") !== src) img.src = src;
      if (label) label.textContent = `PREVIEW — ${row.querySelector("[data-case-number]")?.textContent ?? ""}`;
    }
    if (isActive !== active) {
      if (isActive && !active) {
        cx = p.x + 28;
        cy = p.y - 110;
      }
      active = isActive;
      preview.dataset.active = String(active);
      if (!active) currentRow = null;
    }
    if (!active) return false;
    // Trail slightly behind the pointer
    const k = reduce ? 1 : 0.18;
    const tx = p.x + 28;
    const ty = p.y - 110;
    cx += (tx - cx) * k;
    cy += (ty - cy) * k;
    preview.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
    return Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5;
  });
}

/* ---------- Copy email ---------- */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

function initCopyEmail(): Cleanup {
  const status = document.querySelector<HTMLElement>("[data-copy-status]");
  const timers: number[] = [];
  const flash = (el: HTMLElement) => {
    el.dataset.copied = "true";
    if (status) status.textContent = "Email address copied to clipboard";
    timers.push(
      window.setTimeout(() => {
        el.dataset.copied = "false";
        if (status) status.textContent = "";
      }, 2000),
    );
  };

  const links = Array.from(document.querySelectorAll<HTMLElement>("[data-copy-email]"));
  const buttons = Array.from(document.querySelectorAll<HTMLElement>("[data-copy-button]"));

  const onLink = async (e: Event) => {
    // On touch devices, let the mailto: link open the mail app.
    if (!finePointer()) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    if (await copyText(el.dataset.copyEmail ?? "")) flash(el);
    else window.location.href = `mailto:${el.dataset.copyEmail}`;
  };
  const onButton = async (e: Event) => {
    const el = e.currentTarget as HTMLElement;
    if (await copyText(el.dataset.copyButton ?? "")) {
      el.textContent = "Copied ✓";
      flash(el);
      timers.push(window.setTimeout(() => (el.textContent = "Copy"), 2000));
    }
  };

  links.forEach((l) => l.addEventListener("click", onLink));
  buttons.forEach((b) => b.addEventListener("click", onButton));
  return () => {
    links.forEach((l) => l.removeEventListener("click", onLink));
    buttons.forEach((b) => b.removeEventListener("click", onButton));
    timers.forEach(clearTimeout);
  };
}

/* ---------- GRID toggle (remembered for next visit) ---------- */
function initGridToggle(): Cleanup {
  const btn = document.querySelector<HTMLButtonElement>("[data-grid-toggle]");
  if (!btn) return () => {};
  const root = document.documentElement;
  const sync = () => btn.setAttribute("aria-pressed", String(root.dataset.grid !== "off"));
  sync();
  const onClick = () => {
    const off = root.dataset.grid !== "off";
    if (off) root.dataset.grid = "off";
    else delete root.dataset.grid;
    try {
      localStorage.setItem("grid", off ? "off" : "on");
    } catch {
      /* storage unavailable — fine */
    }
    sync();
  };
  btn.addEventListener("click", onClick);
  return () => btn.removeEventListener("click", onClick);
}
