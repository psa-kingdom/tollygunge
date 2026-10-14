import Image from "next/image";
import Link from "next/link";
import { getDatabase } from "@/lib/database";
import {homeDefaults} from '@/domain/website-home';
export async function HomepageMedia({copy=homeDefaults.media}:{copy?:typeof homeDefaults.media}={}) {
  if (!process.env.DATABASE_URL) return null;
  const { rows } = await getDatabase().query(
    "SELECT id,published,width,height FROM tpa.public_media WHERE published->>'homepageFeatured'='true' ORDER BY coalesce((published->>'displayOrder')::int,0),created_at DESC,id LIMIT 3",
  );
  if (!rows.length) return null;
  return (
    <section
      id="community-media"
      className="section"
      aria-label="Community photographs"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">{copy.eyebrow}</span>
          <h2>{copy.heading}</h2>
        </div>
        <Link className="text-link" href={copy.linkHref}>
          {copy.linkLabel}
        </Link>
      </div>
      <div className="media-gallery">
        {rows.map((asset) => (
          <figure key={asset.id}>
            <Image
              unoptimized
              src={`/media/${asset.id}`}
              width={asset.width}
              height={asset.height}
              alt={asset.published.altText}
            />
            <figcaption>
              <strong>{asset.published.title}</strong>
              <span>{asset.published.category}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
