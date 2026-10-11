"use client";
import Image from "next/image";
import { useState } from "react";
export function GovernancePortrait({
  src,
  name,
  alt,
}: {
  src?: string;
  name: string;
  alt?: string;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  if (!src || failedSource === src)
    return (
      <span
        className="person-avatar"
        role="img"
        aria-label={`Photograph unavailable for ${name}`}
      >
        {name
          .split(/\s+/)
          .filter((n) => !["CA", "Dr.", "Dr"].includes(n))
          .slice(0, 2)
          .map((n) => n[0])
          .join("")}
      </span>
    );
  return (
    <Image
      unoptimized
      src={src}
      width={160}
      height={160}
      loading="lazy"
      alt={alt ?? name}
      onError={() => setFailedSource(src)}
      style={{
        aspectRatio: "1",
        objectFit: "cover",
        objectPosition: "center 25%",
      }}
    />
  );
}
