import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  normalizeMedia,
  mediaObjectKey,
  mediaDetails,
} from "../src/domain/media";
test("editorial images decode, bound dimensions and remove private metadata", async () => {
  const source = await sharp({
    create: { width: 3000, height: 20, channels: 3, background: "navy" },
  })
    .withMetadata()
    .png()
    .toBuffer();
  const output = await normalizeMedia(source, "image/png"),
    meta = await sharp(output.bytes).metadata();
  assert.equal(output.width, 2400);
  assert.equal(meta.format, "webp");
  assert.equal(meta.exif, undefined);
  assert.equal(meta.icc, undefined);
  await assert.rejects(normalizeMedia(source, "image/jpeg"));
  await assert.rejects(
    normalizeMedia(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      "image/png",
    ),
  );
  await assert.rejects(normalizeMedia(new Uint8Array(5242881), "image/png"));
});
test("editorial keys cannot refer to private document objects", () => {
  assert.equal(
    mediaObjectKey("b2b7d8b3-1b16-4d7f-847c-3715925b5ee9"),
    "tpa/editorial/media/b2b7d8b3-1b16-4d7f-847c-3715925b5ee9",
  );
  assert.throws(() => mediaObjectKey("../private/documents"));
  assert.throws(() =>
    mediaDetails({ title: "Title", altText: "", category: "Event" }),
  );
});
test("portrait crop uses only supplied pixels and rejects out-of-bounds rectangles", async () => {
  const source = await sharp({
    create: { width: 100, height: 80, channels: 3, background: "navy" },
  })
    .png()
    .toBuffer();
  const image = await normalizeMedia(source, "image/png", {
    left: 20,
    top: 10,
    width: 60,
    height: 60,
  });
  assert.equal(image.width, 60);
  assert.equal(image.height, 60);
  await assert.rejects(
    normalizeMedia(source, "image/png", {
      left: 70,
      top: 10,
      width: 60,
      height: 60,
    }),
  );
});
test("homepage media placement is explicit and cannot be enabled by a string", () => {
  const details = {
    title: "Community image",
    altText: "People at a community event",
    category: "Events",
  };
  assert.equal(mediaDetails(details).homepageFeatured, false);
  assert.equal(
    mediaDetails({ ...details, homepageFeatured: true }).homepageFeatured,
    true,
  );
  assert.throws(() => mediaDetails({ ...details, homepageFeatured: "true" }));
});
