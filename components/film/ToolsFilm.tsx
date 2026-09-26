"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAPTERS, type ChapterId } from "./chapters";
import type { FilmPlayer } from "./player";
import styles from "./ToolsFilm.module.css";

/**
 * THE TOOLS FILM — a ~70 s demonstration of the engineering tools, drawn
 * live on a canvas from real geometry (see components/film/ and lib/film/).
 *
 *   · nothing loads until the film is about to scroll into view
 *   · it plays while at least a third of it is on screen, and pauses when not
 *   · Reduce motion: it never plays by itself; chapters show still frames
 *   · `chapters` plays a subset on a loop (e.g. just "surfaces" elsewhere)
 *
 * Until the canvas has drawn, a static title frame holds the space, so the
 * page never shifts.
 */
export default function ToolsFilm({ chapters, ctaHref = "#tools-list" }: { chapters?: ChapterId[]; ctaHref?: string }) {
  const figRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<FilmPlayer | null>(null);
  const userPaused = useRef(false);
  const visible = useRef(false);
  const reduced = useRef(false);
  const list = CHAPTERS.filter((c) => !chapters || chapters.includes(c.id));
  const total = list.reduce((a, c) => a + c.dur, 0);
  const loop = !!chapters;

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [scene, setScene] = useState(0);
  const [cta, setCta] = useState(false);
  const progRef = useRef<HTMLOListElement>(null);

  // progress fill of the chapter bar, updated without re-rendering React every frame
  const onTime = useCallback(
    (t: number, i: number) => {
      setScene((s) => (s === i ? s : i));
      const bar = progRef.current;
      if (bar) {
        let acc = 0;
        list.forEach((c, k) => {
          const el = bar.children[k] as HTMLElement | undefined;
          el?.style.setProperty("--p", String(Math.max(0, Math.min(1, (t - acc) / c.dur))));
          acc += c.dur;
        });
      }
      // the call to action only in the last seconds of the whole film
      setCta((v) => {
        const on = !loop && t > total - 2.2;
        return v === on ? v : on;
      });
    },
    // list/total are stable for a given `chapters`
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loop, total],
  );

  const syncPlaying = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    const should = visible.current && !document.hidden && !userPaused.current && !reduced.current;
    if (should && !p.isPlaying) {
      if (p.time >= p.duration - 0.01 && !loop) return; // ended: wait for Replay
      p.play();
    } else if (!should && p.isPlaying) p.pause();
    setPlaying(p.isPlaying);
  }, [loop]);

  // load the film when it comes near, start it when it is on screen
  useEffect(() => {
    const fig = figRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!fig || !stage || !canvas) return;
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    const load = async () => {
      const [{ FilmPlayer }] = await Promise.all([import("./player"), document.fonts?.ready]);
      if (cancelled) return;
      const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
      const low = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 || !!nav.connection?.saveData;
      const probe = document.createElement("span");
      probe.style.fontFamily = "var(--font-mono)";
      stage.appendChild(probe);
      const fonts = { sans: getComputedStyle(stage).fontFamily, mono: getComputedStyle(probe).fontFamily };
      probe.remove();
      const player = new FilmPlayer(canvas, {
        chapters,
        loop,
        low,
        fonts,
        onTime,
        onEnd: () => {
          setPlaying(false);
          setEnded(true);
        },
      });
      playerRef.current = player;
      // development only: lets the film be scrubbed from the console (window.__film.seek(12))
      if (process.env.NODE_ENV !== "production")
        Object.assign(window, {
          __film: player,
          __at: (t: number) => {
            userPaused.current = true;
            player.pause();
            player.seek(t);
            setPlaying(false);
          },
        });
      // Reduce motion: a still of the report, the film's payoff
      if (reduced.current) player.seek(loop ? 0 : (player.scenes.find((s) => s.id === "report")?.start ?? 0) + 6.5);
      ro = new ResizeObserver(([e]) => player.resize(e.contentRect.width, e.contentRect.height));
      ro.observe(stage);
      setReady(true);
      syncPlaying();
    };

    const near = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          near.disconnect();
          void load();
        }
      },
      { rootMargin: "400px 0px" },
    );
    near.observe(fig);
    const onScreen = new IntersectionObserver(
      ([e]) => {
        visible.current = e.isIntersecting;
        syncPlaying();
      },
      { threshold: 0.35 },
    );
    onScreen.observe(stage);
    const vis = () => syncPlaying();
    document.addEventListener("visibilitychange", vis);
    return () => {
      cancelled = true;
      near.disconnect();
      onScreen.disconnect();
      ro?.disconnect();
      document.removeEventListener("visibilitychange", vis);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // mounted once per film
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const p = playerRef.current;
    if (!p) return;
    if (ended) {
      setEnded(false);
      userPaused.current = false;
      reduced.current = false; // an explicit Play overrides the preference for this film
      p.seek(0);
      p.play();
      setPlaying(true);
      return;
    }
    if (p.isPlaying) {
      userPaused.current = true;
      p.pause();
      setPlaying(false);
    } else {
      userPaused.current = false;
      reduced.current = false;
      p.play();
      setPlaying(true);
    }
  };

  const goTo = (i: number) => {
    const p = playerRef.current;
    if (!p) return;
    setEnded(false);
    // a still that shows what the chapter is about, when not playing
    p.seekScene(i, p.isPlaying ? 0 : Math.min(list[i].dur * 0.72, list[i].dur - 0.5));
    if (!p.isPlaying && !reduced.current && !userPaused.current) syncPlaying();
  };

  const label = ended ? "Replay" : playing ? "Pause" : "Play";
  return (
    <figure ref={figRef} className={styles.film} aria-label="Film: engineering tools demonstration" data-ready={ready}>
      <div ref={stageRef} className={styles.stage}>
        {/* holds the space and says what this is before the canvas draws (and without JavaScript) */}
        <div className={styles.poster} aria-hidden="true">
          <span className="mono">Engineering tools · demonstration</span>
          <strong>Civil engineering workflows, automated.</strong>
          <span className="mono">Draw · Measure · Classify · Compare · Report</span>
        </div>
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        <a className={styles.cta} href={ctaHref} data-show={cta} tabIndex={cta ? 0 : -1}>
          Explore the tools <span className="arrow" aria-hidden="true">→</span>
        </a>
        <span className={styles.example}>Example data</span>
      </div>

      <figcaption className={styles.bar}>
        <button type="button" className={styles.play} onClick={toggle} disabled={!ready} aria-label={`${label} the film`}>
          {ended ? (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3M3.5 2.5v2.6h2.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          ) : playing ? (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M5 3.2v9.6L12.5 8z" fill="currentColor" />
            </svg>
          )}
          <span>{label}</span>
        </button>
        <span className={styles.now} aria-hidden="true">
          {list[scene]?.label}
        </span>
        <ol ref={progRef} className={styles.chapters}>
          {list.map((c, i) => (
            <li key={c.id} style={{ flexGrow: c.dur }} data-on={i === scene}>
              <button type="button" onClick={() => goTo(i)} disabled={!ready} aria-current={i === scene ? "step" : undefined}>
                <span className={styles.chapterLabel}>{c.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </figcaption>
      {/* the film, in words */}
      <ol className="sr-only">
        {list.map((c) => (
          <li key={c.id}>
            {c.label}. {c.text}
          </li>
        ))}
      </ol>
    </figure>
  );
}
