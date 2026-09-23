import Link from "next/link";
import { site, nav } from "@/site.config";
import LogoMark from "./LogoMark";
import styles from "./SiteFooter.module.css";

/** Footer laid out like the title block of an engineering drawing. */
export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.block} data-reveal="rise">
          <div className={`${styles.cell} ${styles.brand}`}>
            <LogoMark className={styles.mark} />
            <div>
              <p className={styles.name}>{site.name}</p>
              <p className={styles.sub}>{site.disciplines.join(" · ")}</p>
            </div>
          </div>

          <Cell label="Project" value={site.domain} />
          <Cell label="Drawn by" value={site.shortName} />
          <Cell label="Location" value={site.location} />
          <Cell label="Revision" value={`${site.revision.code} — ${site.revision.date}`} />

          <div className={`${styles.cell} ${styles.navCell}`}>
            <span className="mono">Index</span>
            <ul>
              {nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={`${styles.cell} ${styles.navCell}`}>
            <span className="mono">Links</span>
            <ul>
              <li>
                <a href={site.links.github} target="_blank" rel="noopener noreferrer">
                  GitHub ↗
                </a>
              </li>
              <li>
                <a href={site.links.linkedin} target="_blank" rel="noopener noreferrer">
                  LinkedIn ↗
                </a>
              </li>
              <li>
                <a href={`mailto:${site.email}`}>Email ↗</a>
              </li>
            </ul>
          </div>

          <Cell label="Scale" value="1:1" />
          <Cell label="Dwg no." value="AY-001" />
        </div>

        <div className={styles.notes}>
          <span className="mono">© {year} {site.name}</span>
          <span className="mono">Do not scale from this website</span>
        </div>
      </div>
    </footer>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.cell}>
      <span className="mono">{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}
