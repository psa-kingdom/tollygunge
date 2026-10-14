import sharp from "sharp";
import { matchesFileSignature, MAX_DOCUMENT_BYTES } from "./documents";
import { record, text, uuid } from "./operations";
export function mediaDetails(value: unknown) {
  const body = record(value);
  const displayOrder=Number(body.displayOrder??0);if(!Number.isSafeInteger(displayOrder)||displayOrder<0||displayOrder>9999)throw Error('Use an order between 0 and 9999.');
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
    displayOrder,
  };
}
export function mediaObjectKey(id: string) {
  return `tpa/editorial/media/${uuid(id)}`;
}
export async function normalizeMedia(
  bytes: Uint8Array,
  contentType: string,
  crop?: { left: number; top: number; width: number; height: number },
) {
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
  const oriented = image.rotate();
  if (crop) {
    const swapped = (metadata.orientation ?? 1) >= 5;
    const width = (swapped ? metadata.height : metadata.width) ?? 0,
      height = (swapped ? metadata.width : metadata.height) ?? 0;
    if (
      [crop.left, crop.top, crop.width, crop.height].some(
        (v) => !Number.isSafeInteger(v),
      ) ||
      crop.left < 0 ||
      crop.top < 0 ||
      crop.width < 1 ||
      crop.height < 1 ||
      crop.left + crop.width > width ||
      crop.top + crop.height > height
    )
      throw new Error("Choose a crop inside the original photograph.");
    oriented.extract(crop);
  }
  const output = await oriented
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
