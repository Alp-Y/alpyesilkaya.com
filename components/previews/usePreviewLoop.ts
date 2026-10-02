"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Drives a looping preview: which phase is showing and how far into it
 * (0 → 1). A preview waits at the start of its story, plays by itself once it
 * is properly on screen (or while the visitor points at it or has focus in
 * it), and simply pauses where it is when it scrolls away. Coming back, it
 * carries on from there. It never jumps to another point of its story, so
 * scrolling past a page of tools is seamless. With reduced motion it holds
 * its last phase and does not move.
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
    // "On screen" leaves out a strip at the top and bottom edge, so a preview starts
    // just after it has come into view and pauses just before it leaves.
    let primed = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!primed) {
          // before it has ever played it waits at the start of its story, so the
          // first thing the visitor sees is the beginning, not the end
          primed = true;
          shown = 0;
          setPhase(0);
          tickRef.current?.(0, 0, 0, false);
        }
        visible = e.isIntersecting;
        setRunning(visible);
        kick();
      },
      { rootMargin: "-10% 0px -10% 0px" },
    );
    io.observe(el);
    const engage = () => {
      engaged = true;
      kick();
    };
    const release = () => {
      engaged = el.matches(":hover") || el.contains(document.activeElement);
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
