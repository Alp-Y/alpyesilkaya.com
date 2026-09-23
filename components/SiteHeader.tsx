import Link from "next/link";
import { nav, site } from "@/site.config";
import LogoMark from "./LogoMark";
import styles from "./SiteHeader.module.css";

/**
 * Top bar, styled like a CAD application's ribbon/tab strip.
 * Behaviour (frosted state, hide-on-scroll, active tab, mobile menu)
 * is added by lib/effects.ts through the data-* attributes below.
 */
export default function SiteHeader() {
  return (
    <header className={styles.header} data-header data-state="top" style={{ viewTransitionName: "site-header" }}>
      <div className={styles.bar}>
        <Link href="/" className={styles.brand} aria-label={`${site.name} — home`}>
          <LogoMark className={styles.mark} />
          <span className={styles.brandName}>{site.name}</span>
        </Link>

        <div className={styles.fileTab} aria-hidden="true">
          <span className={styles.fileDot} />
          <span>{site.domain.replace(".com", "")}.dwg</span>
        </div>

        <nav className={styles.nav} aria-label="Main">
          <ul>
            {nav.map((item, i) => (
              <li key={item.href}>
                <Link href={item.href} className={styles.navLink} data-nav-link={item.section}>
                  <span className={styles.navIndex} aria-hidden="true">
                    {String(i + 2).padStart(2, "0")}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          className={styles.menuButton}
          data-menu-toggle
          aria-expanded="false"
          aria-controls="mobile-menu"
        >
          <span className="sr-only">Menu</span>
          <span className={styles.menuIcon} aria-hidden="true" />
        </button>
      </div>

      <div id="mobile-menu" className={styles.sheet} data-menu hidden>
        <nav aria-label="Mobile">
          <ul data-stagger>
            <li>
              <Link href="/" className={styles.sheetLink} data-menu-link>
                <span className="mono">01</span> Home
              </Link>
            </li>
            {nav.map((item, i) => (
              <li key={item.href}>
                <Link href={item.href} className={styles.sheetLink} data-menu-link>
                  <span className="mono">{String(i + 2).padStart(2, "0")}</span> {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.sheetFooter}>
          <a href={`mailto:${site.email}`}>{site.email}</a>
          <div>
            <a href={site.links.github} target="_blank" rel="noopener noreferrer">
              GitHub ↗
            </a>
            <a href={site.links.linkedin} target="_blank" rel="noopener noreferrer">
              LinkedIn ↗
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
