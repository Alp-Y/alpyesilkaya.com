import { ViewTransition } from "react";

/**
 * Gives an element a shared identity across pages. When you click a tool on
 * the homepage, its screenshot (name "tool-<slug>") glides into place on the
 * tool's own page, using the browser's View Transitions API.
 * Browsers without support simply load the page normally.
 */
export default function SharedElement({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <ViewTransition name={name} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
