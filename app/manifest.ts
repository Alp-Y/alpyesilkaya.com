import type { MetadataRoute } from "next";
import { site } from "@/site.config";

export const dynamic = "force-static";

/** /manifest.webmanifest — the name and icon used when the site is saved to a phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: "A. Yesilkaya",
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#07090b",
    theme_color: "#07090b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
