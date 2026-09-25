"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Holding" a preview: while the pointer is over it (or a finger is on it,
 * plus a few seconds after), its looping story pauses so the visitor can
 * turn it and look at it without it changing under them.
 */
export function useHold(ref: React.RefObject<HTMLElement | null>) {
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
      if (e.pointerType === "mouse") set(true);
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType === "mouse") set(false);
    };
    const down = () => {
      clearTimeout(timer);
      set(true);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") {
        clearTimeout(timer);
        timer = window.setTimeout(() => set(false), 4000);
      }
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
  }, [ref]);

  return { held, heldRef };
}
