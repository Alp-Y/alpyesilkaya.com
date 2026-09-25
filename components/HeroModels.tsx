"use client";

import Link from "next/link";
import { useState } from "react";
import { HERO_MODELS, setHeroModel } from "@/lib/heroModels";
import styles from "./Hero.module.css";

/**
 * The hero viewport's model tabs, and the line under the model that says
 * what the matching tool does in that scene. Desktop: the tabs sit under the
 * viewport controls and the line along the bottom of the viewport. Phones and
 * tablets: both follow the model.
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
      <div className={styles.models} role="tablist" aria-label="Model" onKeyDown={onKey} data-hero-exit data-reveal="rise" style={{ "--delay": "750ms" } as React.CSSProperties}>
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
        data-reveal="rise"
        style={{ "--delay": "850ms" } as React.CSSProperties}
      >
        <p key={m.id} className={styles.storyLine}>
          {m.line}
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
