/**
 * Mirrors a few workspace values onto <html> as data attributes, so plain
 * CSS can react to them (e.g. [data-overlays="off"] hides annotations).
 */

import { getState, subscribe } from "./store";

export function initWorkspaceDom(): () => void {
  const root = document.documentElement;
  const apply = () => {
    const { viewport } = getState();
    const overlays = viewport.overlaysVisible ? "on" : "off";
    // After the first toggle, entrance-reveal delays must not slow the clean-view switch
    if (root.dataset.overlays && root.dataset.overlays !== overlays) root.dataset.overlaysTouched = "";
    root.dataset.overlays = overlays;
    root.dataset.displayMode = viewport.displayMode;
    root.dataset.orientation = viewport.orientation;
  };
  apply();
  return subscribe(apply);
}
