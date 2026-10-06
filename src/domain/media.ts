import sharp from "sharp";
import { matchesFileSignature, MAX_DOCUMENT_BYTES } from "./documents";
import { record, text, uuid } from "./operations";
export function mediaDetails(value: unknown) {
  const body = record(value);
  if (
    body.homepageFeatured !== undefined &&
    typeof body.homepageFeatured !== "boolean"
  )
    throw new Error("Choose a valid homepage placement.");
  return {
    title: text(body.title, "Title", 120, 3),
    altText: text(body.altText, "Image description", 240, 5),
    category: text(body.category, "Category", 60, 3),
    homepageFeatured: body.homepageFeatured === true,
  };
}
export function mediaObjectKey(id: string) {
  return `tpa/editorial/media/${uuid(id)}`;
}
export async function normalizeMedia(bytes: Uint8Array, contentType: string) {
  if (
    !bytes.length ||
    bytes.length > MAX_DOCUMENT_BYTES ||
    !["image/jpeg", "image/png"].includes(contentType) ||
    !matchesFileSignature(bytes, contentType)
  )
    throw new Error("Use JPEG or PNG up to 5 MB.");
  const image = sharp(bytes, { limitInputPixels: 20000000, failOn: "warning" });
  const metadata = await image.metadata();
  if (
    (metadata.pages ?? 1) !== 1 ||
    !["jpeg", "png"].includes(metadata.format ?? "")
  )
    throw new Error("Use a static JPEG or PNG.");
  // Re-encoding drops EXIF/GPS, comments and appended data; never retain the original.
  const output = await image
    .rotate()
    .resize({
      width: 2400,
      height: 2400,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });
  if (output.data.length > MAX_DOCUMENT_BYTES)
    throw new Error("Image output is too large.");
  return {
    bytes: output.data,
    width: output.info.width,
    height: output.info.height,
    contentType: "image/webp",
  };
}
