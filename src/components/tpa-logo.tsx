"use client";

import styles from "./tpa-logo.module.css";

/** Presentation only: safe in CMS previews and the independent recovery shell. */
export function TpaLogo({
  src = "/design/tpa-logo-256.webp",
  alt = "",
}: {
  src?: string;
  alt?: string;
}) {
  return (
    <span className={styles.frame}>
      {/* Direct static/media URL also works when image optimisation is unavailable. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        data-tpa-logo
        src={src}
        alt={alt}
        width={1139}
        height={1280}
        className={styles.image}
        decoding="sync"
        ref={(image) => {
          if (image?.complete && image.naturalWidth === 0) showFallbackLogo(image);
        }}
        onError={({ currentTarget }) => showFallbackLogo(currentTarget)}
      />
    </span>
  );
}

function showFallbackLogo(image: HTMLImageElement) {
  if (image.getAttribute("src") !== "/design/tpa-logo.png")
    image.src = "/design/tpa-logo.png";
}
