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
  isPlaceholder?: boolean;
  width?: number;
  height?: number;
};

/**
 * A photo inside a frame with crop marks. Uncovers with a wipe from the bottom.
 * Defaults to the portrait in site.config; pass `photo` for another one.
 */
export default function Portrait({ priority = false, photo }: { priority?: boolean; photo?: Photo }) {
  const p: Photo = photo ?? site.portrait;
  return (
    <figure className={styles.portrait} data-observe>
      <div className={styles.plate}>
        <div className={styles.frame}>
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
        {p.isPlaceholder && <span className="placeholder-tag">Photo placeholder</span>}
      </figcaption>
    </figure>
  );
}
