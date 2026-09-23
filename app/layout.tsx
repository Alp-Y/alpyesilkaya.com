import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { site } from "@/site.config";
import SiteHeader from "@/components/SiteHeader";
import StatusBar from "@/components/StatusBar";
import SiteFooter from "@/components/SiteFooter";
import SiteEffects from "@/components/SiteEffects";
import CadCursor from "@/components/CadCursor";
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

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — Civil Engineering · Software · Automation`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.name,
    title: `${site.name} — Civil Engineering · Software · Automation`,
    description: site.description,
    // Link-preview image (1200×630) in /public — regenerate it if the name or tagline changes
    images: [{ url: "/og.png", width: 1200, height: 630, alt: `${site.name} — Civil Engineering · Software · Automation` }],
  },
  twitter: { card: "summary_large_image" },
};

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
        <CadCursor />
        <SiteEffects />
      </body>
    </html>
  );
}
