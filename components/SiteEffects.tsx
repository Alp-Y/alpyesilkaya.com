"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { initEffects } from "@/lib/effects";
import { registerNavigator } from "@/lib/workspace/actions";

/**
 * Renders nothing. Starts the page-level browser behaviour in lib/effects.ts
 * (reveals, CAD cursor + HUD, command line…) after each page loads and cleans
 * it up on navigation, and gives the workspace actions the Next.js router.
 */
export default function SiteEffects() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    registerNavigator((href) => router.push(href));
  }, [router]);

  useEffect(() => {
    const cleanup = initEffects();
    return cleanup;
  }, [pathname]);

  return null;
}
