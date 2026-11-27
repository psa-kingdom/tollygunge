import { SiteShell } from "@/components/site-shell";
import { ResourceArchive, ResourceMediaGallery } from "@/components/resource-collections";
import { publicMetadata } from "@/domain/public-metadata";
import { publishedMedia } from "@/lib/public-content";

export const dynamic = "force-dynamic";
export const metadata = publicMetadata("/media", "Media", "Published media from Tollygunge Professional Association.");

export default async function MediaPage() {
  const media = await publishedMedia();
  return (
    <SiteShell>
      <ResourceArchive title="Media">
        {media.length ? <ResourceMediaGallery media={media} /> : <p>No media has been published yet.</p>}
      </ResourceArchive>
    </SiteShell>
  );
}
