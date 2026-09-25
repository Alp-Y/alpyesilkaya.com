import Image from "next/image";
import { site } from "@/site.config";
import styles from "./Portrait.module.css";

type Photo = {
  src: string;
  alt: string;
  /** e.g. "Fig. 01 / The engineer" */
  caption?: string;
  /** CSS object-position: which part of the photo stays in the frame */
  focus?: string;
  /** Frame shape (CSS aspect-ratio), e.g. "3 / 4". Default: 4 / 5 (square on phones). */
  aspect?: string;
  isPlaceholder?: boolean;
  width?: number;
  height?: number;
  /**
   * A cut-out photo that fades into the page's drawing grid, with this label
   * beside the file name (e.g. "Engineer · 1 selected").
   */
  selected?: string;
};

/**
 * A photo inside a frame with crop marks. Uncovers with a wipe from the bottom.
 * Defaults to the portrait in site.config; pass `photo` for another one.
 * A cut-out with `selected` sits straight on the drawing grid, marked only by small
 * corner ticks; its soft edges are baked into the image itself.
 */
export default function Portrait({ priority = false, photo }: { priority?: boolean; photo?: Photo }) {
  const p: Photo = photo ?? site.portrait;
  const selected = !!p.selected;
  return (
    <figure className={`${styles.portrait} ${selected ? styles.selected : ""}`} data-observe>
      <div className={styles.plate}>
        <div className={styles.frame} style={p.aspect ? { aspectRatio: p.aspect } : undefined}>
          <Image
            src={p.src}
            alt={p.alt}
            width={p.width ?? 1200}
            height={p.height ?? 1500}
            sizes="(min-width: 900px) 40vw, 100vw"
            priority={priority}
            unoptimized={p.src.endsWith(".svg")}
            className={styles.image}
            style={p.focus ? { objectPosition: p.focus } : undefined}
          />
        </div>
        <span className={`${styles.crop} ${styles.tl}`} aria-hidden="true" />
        <span className={`${styles.crop} ${styles.tr}`} aria-hidden="true" />
        <span className={`${styles.crop} ${styles.bl}`} aria-hidden="true" />
        <span className={`${styles.crop} ${styles.br}`} aria-hidden="true" />
      </div>
      <figcaption className={styles.caption}>
        <span className="mono">{p.caption ?? "Fig. 01 / The engineer"}</span>
        {selected && (
          <span className={`mono ${styles.selectedLabel}`}>
            <i aria-hidden="true" />
            {p.selected}
          </span>
        )}
        {p.isPlaceholder && <span className="placeholder-tag">Photo placeholder</span>}
      </figcaption>
    </figure>
  );
}
