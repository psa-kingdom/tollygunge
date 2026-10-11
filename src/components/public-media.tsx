import Image from "next/image";
import Link from "next/link";
import { getDatabase } from "@/lib/database";
export async function HomepageMedia() {
  if (!process.env.DATABASE_URL) return null;
  const { rows } = await getDatabase().query(
    "SELECT id,published,width,height FROM tpa.public_media WHERE published->>'homepageFeatured'='true' ORDER BY created_at DESC,id LIMIT 3",
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
          <span className="eyebrow">OUR COMMUNITY</span>
          <h2>Moments from TPA.</h2>
        </div>
        <Link className="text-link" href="/resources#section-1">
          View media ↗
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
