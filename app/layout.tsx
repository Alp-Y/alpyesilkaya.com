import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { jsonLd, rootMeta } from "@/lib/seo";
import SiteHeader from "@/components/SiteHeader";
import StatusBar from "@/components/StatusBar";
import SiteFooter from "@/components/SiteFooter";
import SiteEffects from "@/components/SiteEffects";
import CadCursor from "@/components/CadCursor";
import Drafter from "@/components/Drafter";
import "./globals.css";

/*
 * Fonts are self-hosted from /app/fonts: no request to Google, no layout
 * shift, and they work offline. Geist is open-source (SIL Open Font License).
 */
const geist = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = rootMeta;

export const viewport: Viewport = {
  themeColor: "#07090b",
  colorScheme: "dark",
};

/*
 * Runs before the page paints:
 *  - adds the "js" class so reveal animations can start from hidden,
 *  - restores the GRID on/off choice,
 *  - reveals everything after 3s if the effects script never started.
 */
const bootScript = `(function(){var d=document.documentElement;d.classList.add('js');try{var g=localStorage.getItem('grid');if(g==='off')d.setAttribute('data-grid','off')}catch(e){}setTimeout(function(){if(!d.classList.contains('fx-ready'))d.classList.add('reveal-all')},3000)})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }} />
      </head>
      <body>
        {/* The persistent engineering workspace grid behind every section */}
        <div className="workspace-grid cad-grid" aria-hidden="true" />
        <div className="workspace-light" aria-hidden="true" />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <StatusBar />
        <Drafter />
        <CadCursor />
        <SiteEffects />
      </body>
    </html>
  );
}
