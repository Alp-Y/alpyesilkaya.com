"use client";

import Link from "next/link";
import { useState } from "react";
import { HERO_MODELS, setHeroModel } from "@/lib/heroModels";
import styles from "./Hero.module.css";

/**
 * The hero viewport's model tabs, and the line that says what the matching
 * tool does in that scene. Desktop: both sit in the viewport's top-left
 * corner, under its controls — read top to bottom. Phones and tablets: both
 * follow the model.
 */
export default function HeroModels() {
  const [active, setActive] = useState(0);
  const m = HERO_MODELS[active];

  const pick = (i: number) => {
    if (i === active) return;
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
      <div className={styles.models} role="tablist" aria-labelledby="hero-use-cases" onKeyDown={onKey} data-hero-exit data-overlay data-reveal="fade" style={{ "--delay": "880ms" } as React.CSSProperties}>
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
