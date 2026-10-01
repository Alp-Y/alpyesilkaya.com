"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HERO_MODELS, HERO_TABS, setHeroModel } from "@/lib/heroModels";
import { PLATFORMS } from "@/lib/platforms";
import styles from "./Hero.module.css";

/**
 * The hero viewport's model tabs, and the line that says what the matching
 * tool does in that scene. Desktop: both sit in the viewport's top-left
 * corner, under its controls — read top to bottom. Phones and tablets: both
 * follow the model.
 * Left alone, it moves on to the next use case every 5 s. Any interaction with
 * the hero (a tab, dragging the model or the ViewCube, the wheel, the keyboard)
 * restarts that wait; resting the pointer on the tabs or the line pauses it.
 * Off with reduced motion, while the hero is off screen or the tab is hidden.
 */
const ADVANCE_MS = 5000;

/** The countdown line goes straight back to empty (no shrinking) — before a switch or on interaction. */
function resetLine(...rows: (HTMLElement | null)[]) {
  for (const tabs of rows) {
    if (!tabs) continue;
    tabs.dataset.snap = "";
    tabs.style.setProperty("--advance", "0");
  }
}

export default function HeroModels() {
  const [active, setActive] = useState(0);
  const m = HERO_MODELS[active];
  const tabsRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const lastTouch = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hero = tabsRef.current?.closest<HTMLElement>("[data-hero]");
    if (!hero) return;
    lastTouch.current = performance.now();
    let reading = false;
    let inView = true;
    const tabs = tabsRef.current;
    const sub = subRef.current;
    const touch = () => {
      lastTouch.current = performance.now();
      resetLine(tabs, sub);
    };
    const readOn = () => (reading = true);
    const readOff = () => {
      reading = false;
      touch();
    };
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      touch();
    }, { threshold: 0.35 });
    io.observe(hero);
    const opts = { passive: true } as const;
    hero.addEventListener("pointerdown", touch, opts);
    hero.addEventListener("wheel", touch, opts);
    hero.addEventListener("keydown", touch);
    const reads = [tabsRef.current, subRef.current, storyRef.current].filter(Boolean) as HTMLElement[];
    reads.forEach((el) => {
      el.addEventListener("pointerenter", readOn);
      el.addEventListener("pointerleave", readOff);
    });
    const tick = window.setInterval(() => {
      if (reading || !inView || document.hidden) return; // the line holds where it is
      const waited = performance.now() - lastTouch.current;
      for (const row of [tabs, sub]) {
        if (!row) continue;
        if ("snap" in row.dataset) delete row.dataset.snap; // from here it fills smoothly again
        // the active tab's line: how far it is to the next use case
        row.style.setProperty("--advance", String(Math.min(1, waited / ADVANCE_MS)));
      }
      if (waited < ADVANCE_MS) return;
      const next = (activeRef.current + 1) % HERO_MODELS.length;
      resetLine(tabs, sub); // the next tab starts empty
      activeRef.current = next;
      setActive(next);
      setHeroModel(HERO_MODELS[next].id);
      touch();
    }, 250);
    return () => {
      window.clearInterval(tick);
      tabs?.style.removeProperty("--advance");
      sub?.style.removeProperty("--advance");
      io.disconnect();
      hero.removeEventListener("pointerdown", touch);
      hero.removeEventListener("wheel", touch);
      hero.removeEventListener("keydown", touch);
      reads.forEach((el) => {
        el.removeEventListener("pointerenter", readOn);
        el.removeEventListener("pointerleave", readOff);
      });
    };
  }, []);

  const activeTab = HERO_TABS.findIndex((t) => t.models.includes(active));
  const platform = HERO_MODELS[active].platform;
  /** the scenes and the tabs of one platform */
  const scenesOf = (short: string) => HERO_MODELS.flatMap((hm, i) => (hm.platform === short ? [i] : []));
  const tabsOf = (short: string) => HERO_TABS.flatMap((t, i) => (t.platform === short ? [i] : []));
  const platformTabs = tabsOf(platform);
  const showTabs = open && platformTabs.length > 1;

  // (a click or key press on a tab also restarts the auto-advance wait: the hero hears it)
  const pick = (i: number) => {
    if (i === active) return;
    resetLine(tabsRef.current, subRef.current);
    activeRef.current = i;
    setActive(i);
    setHeroModel(HERO_MODELS[i].id);
  };

  // A tab shows its first scene; clicking it again while open steps through its other scenes
  const pickTab = (t: number) => {
    const scenes = HERO_TABS[t].models;
    pick(t === activeTab ? scenes[(scenes.indexOf(active) + 1) % scenes.length] : scenes[0]);
  };

  // A platform chip shows that platform's first scene; on the one showing, it opens its use cases (if it has more than one)
  const pickPlatform = (short: string) => {
    if (short !== platform) pick(scenesOf(short)[0]);
    else if (tabsOf(short).length > 1) setOpen((o) => !o);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const at = platformTabs.indexOf(activeTab);
    const next = (at + (e.key === "ArrowRight" ? 1 : -1) + platformTabs.length) % platformTabs.length;
    pickTab(platformTabs[next]);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  };

  const ready = PLATFORMS.filter((p) => p.ready && scenesOf(p.short).length > 0);
  const later = PLATFORMS.filter((p) => !p.ready);

  return (
    <div className={styles.panel}>
      <p id="hero-use-cases" className={`mono ${styles.useCases}`} data-hero-exit data-overlay data-reveal="fade" style={{ "--delay": "860ms" } as React.CSSProperties}>
        Tools in development
      </p>
      {/* the platforms with tools: each shows its scenes (Civil 3D's open one by one); the rest are on the way */}
      <div ref={tabsRef} className={styles.models} data-hero-exit data-overlay data-reveal="fade" style={{ "--delay": "880ms" } as React.CSSProperties}>
        {ready.map((p) => {
          const on = p.short === platform;
          const scenes = scenesOf(p.short);
          const many = tabsOf(p.short).length > 1;
          return (
            <button
              key={p.name}
              type="button"
              className={styles.modelTab}
              data-active={on}
              aria-pressed={on}
              {...(many ? { "aria-expanded": on && open, "aria-controls": "hero-use-case-tabs" } : {})}
              onClick={() => pickPlatform(p.short)}
              title={!on ? `Show ${p.name}` : many ? (open ? "Hide the use cases" : "Show the use cases one by one") : p.name}
            >
              {p.short}
              {/* one mark per scene, the one on screen lit */}
              {scenes.length > 1 && (
                <span className={styles.scenes} aria-hidden="true">
                  {scenes.map((mi) => (
                    <i key={mi} data-on={mi === active} />
                  ))}
                </span>
              )}
              {many && (
                <svg className={styles.chev} viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          );
        })}
        {/* on the way: greyed out, not clickable; pointing at one says so */}
        {later.map((p) => (
          <span key={p.name} className={`${styles.modelTab} ${styles.soon}`} aria-disabled="true" data-tip="Coming soon" data-cursor="cad">
            {p.short}
            <span className="sr-only"> (coming soon)</span>
          </span>
        ))}
      </div>

      <div
        ref={subRef}
        id="hero-use-case-tabs"
        className={styles.subModels}
        role="tablist"
        aria-labelledby="hero-use-cases"
        data-open={showTabs}
        hidden={!showTabs}
        onKeyDown={onKey}
      >
        {platformTabs.map((i, n) => {
          const t = HERO_TABS[i];
          return (
          <button
            key={t.name}
            type="button"
            role="tab"
            id={`hero-tab-${i}`}
            aria-selected={i === activeTab}
            aria-controls="hero-model-story"
            tabIndex={i === activeTab ? 0 : -1}
            className={styles.modelTab}
            onClick={() => pickTab(i)}
          >
            <span className="num">{String(n + 1).padStart(2, "0")}</span>
            {t.name}
            {t.models.length > 1 && (
              /* one mark per scene in this tab, the one on screen lit */
              <span className={styles.scenes} aria-hidden="true">
                {t.models.map((mi) => (
                  <i key={mi} data-on={mi === active} />
                ))}
              </span>
            )}
          </button>
          );
        })}
      </div>

      <div
        ref={storyRef}
        id="hero-model-story"
        role={showTabs ? "tabpanel" : undefined}
        aria-labelledby={showTabs ? `hero-tab-${activeTab}` : undefined}
        className={styles.story}
        data-hero-exit
        data-overlay
        data-reveal="fade"
        style={{ "--delay": "960ms" } as React.CSSProperties}
      >
        <p key={m.id} className={styles.storyLine}>
          <strong>{m.title}</strong> {m.line}{" "}
          <Link href={m.tool.href} className={styles.storyTool}>
            {m.tool.name} <span aria-hidden="true">→</span>
          </Link>
        </p>
      </div>
    </div>
  );
}
