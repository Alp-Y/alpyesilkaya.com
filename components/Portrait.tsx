import Image from "next/image";
import { site } from "@/site.config";
import styles from "./Portrait.module.css";

/** Portrait inside a frame with crop marks. Uncovers with a wipe from the bottom. */
export default function Portrait({ priority = false }: { priority?: boolean }) {
  const { src, alt, isPlaceholder } = site.portrait;
  return (
    <figure className={styles.portrait} data-observe>
      <div className={styles.frame}>
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={1500}
          sizes="(min-width: 900px) 40vw, 100vw"
          priority={priority}
          unoptimized={src.endsWith(".svg")}
          className={styles.image}
        />
      </div>
      <span className={`${styles.crop} ${styles.tl}`} aria-hidden="true" />
      <span className={`${styles.crop} ${styles.tr}`} aria-hidden="true" />
      <span className={`${styles.crop} ${styles.bl}`} aria-hidden="true" />
      <span className={`${styles.crop} ${styles.br}`} aria-hidden="true" />
      <figcaption className={styles.caption}>
        <span className="mono">Fig. 01 / The engineer</span>
        {isPlaceholder && <span className="placeholder-tag">Photo placeholder</span>}
      </figcaption>
    </figure>
  );
}
