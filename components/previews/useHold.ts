"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Holding" a preview pauses its looping story, so the visitor can look at it
 * without it changing under them.
 *   "hover" (default): while the pointer is over it, or a finger is on it
 *                      plus a few seconds after (for previews you turn by dragging).
 *   "press":           only while it is pressed and held; a quick click or tap
 *                      does not pause, and letting go plays on.
 */
const PRESS_DELAY = 180; // ms of pressing before it counts as holding

export function useHold(ref: React.RefObject<HTMLElement | null>, mode: "hover" | "press" = "hover") {
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    const set = (v: boolean) => {
      heldRef.current = v;
      setHeld(v);
    };
    const enter = (e: PointerEvent) => {
      if (mode === "hover" && e.pointerType === "mouse") set(true);
    };
    const leave = (e: PointerEvent) => {
      if (mode === "press") {
        // let go outside the preview: it plays on
        clearTimeout(timer);
        set(false);
      } else if (e.pointerType === "mouse") set(false);
    };
    const down = (e: PointerEvent) => {
      clearTimeout(timer);
      if (mode === "press") {
        if (e.button !== 0) return;
        timer = window.setTimeout(() => set(true), PRESS_DELAY);
      } else set(true);
    };
    const up = (e: PointerEvent) => {
      clearTimeout(timer);
      if (mode === "press") set(false);
      else if (e.pointerType !== "mouse") timer = window.setTimeout(() => set(false), 4000);
    };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      clearTimeout(timer);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [ref, mode]);

  return { held, heldRef };
}
