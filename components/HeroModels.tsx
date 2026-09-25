"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HERO_MODELS, setHeroModel } from "@/lib/heroModels";
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
    const touch = () => (lastTouch.current = performance.now());
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
      if (reading || !inView || document.hidden) return;
      if (performance.now() - lastTouch.current < ADVANCE_MS) return;
      const next = (activeRef.current + 1) % HERO_MODELS.length;
      activeRef.current = next;
      setActive(next);
      setHeroModel(HERO_MODELS[next].id);
      touch();
    }, 250);
    return () => {
      window.clearInterval(tick);
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

  // (a click or key press on a tab also restarts the auto-advance wait: the hero hears it)
  const pick = (i: number) => {
    if (i === active) return;
    activeRef.current = i;
    setActive(i);
    setHeroModel(HERO_MODELS[i].id);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (active + (e.key === "ArrowRight" ? 1 : -1) + HERO_MODELS.length) % HERO_MODELS.length;
    pick(next);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  };

  return (
    <>
      <p id="hero-use-cases" className={`mono ${styles.useCases}`} data-hero-exit data-overlay data-reveal="fade" style={{ "--delay": "860ms" } as React.CSSProperties}>
        Use cases <span>· pick one to see it in 3D</span>
      </p>
      <div ref={tabsRef} className={styles.models} role="tablist" aria-labelledby="hero-use-cases" onKeyDown={onKey} data-hero-exit data-overlay data-reveal="fade" style={{ "--delay": "880ms" } as React.CSSProperties}>
        {HERO_MODELS.map((h, i) => (
          <button
            key={h.id}
            type="button"
            role="tab"
            id={`hero-model-${h.id}`}
            aria-selected={i === active}
            aria-controls="hero-model-story"
            tabIndex={i === active ? 0 : -1}
            className={styles.modelTab}
            onClick={() => pick(i)}
          >
            <span className="num">{String(i + 1).padStart(2, "0")}</span>
            {h.tab}
          </button>
        ))}
      </div>

      <div
        ref={storyRef}
        id="hero-model-story"
        role="tabpanel"
        aria-labelledby={`hero-model-${m.id}`}
        className={styles.story}
        data-hero-exit
        data-overlay
        data-reveal="fade"
        style={{ "--delay": "960ms" } as React.CSSProperties}
      >
        <p key={m.id} className={styles.storyLine}>
          <strong>{m.title}</strong> {m.line}
        </p>
        <div className={`mono ${styles.storyMeta}`}>
          {m.keys.map((k) => (
            <span key={k.label} className={styles.storyKey}>
              <i style={{ background: k.color }} aria-hidden="true" />
              {k.label}
            </span>
          ))}
          <Link href={m.tool.href} className={styles.storyTool}>
            {m.tool.name} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </>
  );
}
