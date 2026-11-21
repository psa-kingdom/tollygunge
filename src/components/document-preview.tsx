"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { api } from "./operations-client";
export function DocumentPreview({ id, label }: { id: string; label: string }) {
  const [image, setImage] = useState(false);
  useEffect(() => {
    let active = true;
    api<{ id: string; content_type: string }[]>("/api/documents").then(rows => {
      if (active) setImage(rows.some(row => row.id === id && row.content_type.startsWith("image/")));
    }).catch(() => {});
    return () => { active = false; };
  }, [id]);
  return <div className="application-document-preview">
    {image && <Image unoptimized src={`/api/documents/${id}`} alt={label} width={240} height={180} style={{ objectFit: "contain" }} />}
    <a href={`/api/documents/${id}`} target="_blank" rel="noreferrer">View {label.toLowerCase()}</a>
  </div>;
}
