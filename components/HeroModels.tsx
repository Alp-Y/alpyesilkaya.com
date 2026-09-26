"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HERO_MODELS, HERO_TABS, setHeroModel } from "@/lib/heroModels";
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
function resetLine(tabs: HTMLElement | null) {
  if (!tabs) return;
  tabs.dataset.snap = "";
  tabs.style.setProperty("--advance", "0");
}
export default function HeroModels() {
  const [active, setActive] = useState(0);
  const m = HERO_MODELS[active];
  const tabsRef = useRef<HTMLDivElement>(null);
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
    const touch = () => {
      lastTouch.current = performance.now();
      resetLine(tabs);
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
    const reads = [tabsRef.current, storyRef.current].filter(Boolean) as HTMLElement[];
    reads.forEach((el) => {
      el.addEventListener("pointerenter", readOn);
      el.addEventListener("pointerleave", readOff);
    });
    const tick = window.setInterval(() => {
      if (reading || !inView || document.hidden) return; // the line holds where it is
      if (tabs && "snap" in tabs.dataset) delete tabs.dataset.snap; // from here it fills smoothly again
      const waited = performance.now() - lastTouch.current;
      // the active tab's line: how far it is to the next use case
      tabs?.style.setProperty("--advance", String(Math.min(1, waited / ADVANCE_MS)));
      if (waited < ADVANCE_MS) return;
      const next = (activeRef.current + 1) % HERO_MODELS.length;
      resetLine(tabs); // the next tab starts empty
      activeRef.current = next;
      setActive(next);
      setHeroModel(HERO_MODELS[next].id);
      touch();
    }, 250);
    return () => {
      window.clearInterval(tick);
      tabs?.style.removeProperty("--advance");
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

  // (a click or key press on a tab also restarts the auto-advance wait: the hero hears it)
  const pick = (i: number) => {
    if (i === active) return;
    resetLine(tabsRef.current);
    activeRef.current = i;
    setActive(i);
    setHeroModel(HERO_MODELS[i].id);
  };

  // A tab shows its first scene; clicking it again while open steps through its other scenes
  const pickTab = (t: number) => {
    const scenes = HERO_TABS[t].models;
    pick(t === activeTab ? scenes[(scenes.indexOf(active) + 1) % scenes.length] : scenes[0]);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (activeTab + (e.key === "ArrowRight" ? 1 : -1) + HERO_TABS.length) % HERO_TABS.length;
    pickTab(next);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  };

  return (
    <>
      <p id="hero-use-cases" className={`mono ${styles.useCases}`} data-hero-exit data-overlay data-reveal="fade" style={{ "--delay": "860ms" } as React.CSSProperties}>
        Use cases
      </p>
      <div ref={tabsRef} className={styles.models} role="tablist" aria-labelledby="hero-use-cases" onKeyDown={onKey} data-hero-exit data-overlay data-reveal="fade" style={{ "--delay": "880ms" } as React.CSSProperties}>
        {HERO_TABS.map((t, i) => (
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
            <span className="num">{String(i + 1).padStart(2, "0")}</span>
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
        ))}
      </div>

      <div
        ref={storyRef}
        id="hero-model-story"
        role="tabpanel"
        aria-labelledby={`hero-tab-${activeTab}`}
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
    </>
  );
}
