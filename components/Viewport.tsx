import Image from "next/image";
import styles from "./Viewport.module.css";

/**
 * A screenshot frame styled like a CAD viewport:
 * a thin title strip ("[−][Top][Realistic]"), a subtle inner highlight,
 * and blue selection grips that appear on hover.
 *
 * Screenshots: export at 1600×1000 (16:10) or larger; PNG, JPG or WebP.
 * Next.js automatically resizes and converts them to modern formats.
 */
export default function Viewport({
  src,
  alt,
  label,
  view = "Top",
  mode = "Realistic",
  priority = false,
  sizes = "(min-width: 900px) 60vw, 100vw",
  className = "",
  width = 1600,
  height = 1000,
}: {
  src: string;
  alt: string;
  label?: string;
  view?: string;
  mode?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <figure className={`${styles.viewport} ${className}`} data-viewport>
      <figcaption className={styles.bar}>
        <span>
          [−][{view}][{mode}]
        </span>
        {label && <span>{label}</span>}
      </figcaption>
      <div className={styles.screen}>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          priority={priority}
          unoptimized={src.endsWith(".svg")}
          className={styles.image}
        />
        <span className={styles.sheen} aria-hidden="true" />
      </div>
      <span className={`${styles.grip} ${styles.tl}`} aria-hidden="true" />
      <span className={`${styles.grip} ${styles.tr}`} aria-hidden="true" />
      <span className={`${styles.grip} ${styles.bl}`} aria-hidden="true" />
      <span className={`${styles.grip} ${styles.br}`} aria-hidden="true" />
    </figure>
  );
}
