"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Drives a looping preview: which phase is showing and how far into it
 * (0 → 1). Time only runs while the preview is on screen and the tab is
 * visible, so an off-screen preview costs nothing. With reduced motion
 * the preview holds its last phase and does not move.
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
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (visible && !document.hidden && !raf) {
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
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      setRunning(visible);
      kick();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", kick);
    return () => {
      io.disconnect();
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
