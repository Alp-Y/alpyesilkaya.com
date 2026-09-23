import type { NextConfig } from "next";

/**
 * Static export: `npm run build` writes the whole site as plain HTML/CSS/JS
 * into /out. Every page is pre-rendered, so no server is needed and the site
 * can be hosted anywhere (Netlify, Vercel, GitHub Pages, any static host).
 */
const nextConfig: NextConfig = {
  output: "export",
  // Pages are served as /about/index.html etc., which every static host understands.
  trailingSlash: true,
  // Image optimisation needs a server; with static export images are served as-is.
  images: { unoptimized: true },
};

export default nextConfig;
