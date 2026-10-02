"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Drives a looping preview: which phase is showing and how far into it
 * (0 → 1). A preview plays by itself while it is in the middle band of the
 * screen (or while the visitor points at it or has focus in it), and rests on
 * its finished picture otherwise. So scrolling down a page of tools, the one
 * you are looking at is alive and the rest are still. With reduced motion it
 * holds its last phase and does not move.
 */
export function usePreviewLoop(
  ref: React.RefObject<HTMLElement | null>,
  durations: number[],
  /** `wrapped` is true on the frame the story comes round to the start by itself */
  onTick?: (phase: number, t: number, dt: number, wrapped: boolean) => void,
  /** while true the story holds where it is (the visitor is handling the preview) */
  pausedRef?: React.RefObject<boolean>,
) {
  const [phase, setPhase] = useState(durations.length - 1);
  const [running, setRunning] = useState(false);
  const tickRef = useRef(onTick);
  const seekRef = useRef<((p: number) => void) | null>(null);
  useEffect(() => {
    tickRef.current = onTick;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let visible = false;
    let engaged = false; // pointer over it, or focus inside it
    const active = () => !document.hidden && (visible || engaged);
    let raf = 0;
    let last = 0;
    let clock = 0;
    let shown = -1;
    const total = durations.reduce((a, b) => a + b, 0);
    const frame = (now: number) => {
      raf = 0;
      const dt = pausedRef?.current ? 0 : last ? Math.min(64, now - last) : 16;
      last = now;
      const wrapped = clock + dt >= total;
      clock = (clock + dt) % total;
      let t = clock;
      let p = 0;
      while (t >= durations[p]) t -= durations[p++];
      if (p !== shown) setPhase((shown = p));
      tickRef.current?.(p, t / durations[p], dt, wrapped);
      if (active()) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (active() && !raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    // jump to the start of a step; the story carries on from there
    seekRef.current = (p: number) => {
      clock = durations.slice(0, p).reduce((a, b) => a + b, 0);
      shown = p;
      setPhase(p);
      kick();
    };
    /** Back to rest: the finished picture. */
    const rest = () => {
      clock = total - 1;
      shown = durations.length - 1;
      setPhase(shown);
      tickRef.current?.(shown, 1, 0, false);
    };
    // "On screen" means in the middle band of the screen, so only the preview the
    // visitor is looking at plays (two short ones can share the band).
    const io = new IntersectionObserver(
      ([e]) => {
        const was = visible;
        visible = e.isIntersecting;
        setRunning(visible);
        if (visible && !was && !engaged) clock = 0; // it tells its story from the start as it arrives
        if (!visible && was && !engaged) rest();
        kick();
      },
      { rootMargin: "-28% 0px -28% 0px" },
    );
    io.observe(el);
    const engage = () => {
      if (engaged) return;
      engaged = true;
      if (!visible) clock = 0; // pointed at while resting: start its story
      kick();
    };
    const release = () => {
      engaged = el.matches(":hover") || el.contains(document.activeElement);
      if (!engaged && !visible) rest();
    };
    el.addEventListener("pointerenter", engage);
    el.addEventListener("pointerleave", release);
    el.addEventListener("focusin", engage);
    el.addEventListener("focusout", release);
    document.addEventListener("visibilitychange", kick);
    return () => {
      io.disconnect();
      el.removeEventListener("pointerenter", engage);
      el.removeEventListener("pointerleave", release);
      el.removeEventListener("focusin", engage);
      el.removeEventListener("focusout", release);
      document.removeEventListener("visibilitychange", kick);
      cancelAnimationFrame(raf);
      seekRef.current = null;
    };
    // durations are constant per preview
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  const seek = useCallback((p: number) => seekRef.current?.(p), []);
  return { phase, running, seek };
}
