import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import jsQR from "jsqr";
const root = process.argv[2],
  pdfFile = process.argv[3],
  expected = process.env.TPA_FLYER_TEST_EVENT;
if (!root || !pdfFile || !expected)
  throw new Error(
    "Provide explicit synthetic export paths and event identifier.",
  );
for (const name of ["flyer-one-speaker.png", "flyer-two-speakers.png"]) {
  const png = PNG.sync.read(readFileSync(resolve(root, name)));
  assert.equal(png.width, 1080);
  assert.equal(png.height, 1350);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.equal(
    decoded?.data,
    `http://127.0.0.1:3000/events/${expected}`,
    "Export QR must open the intended event",
  );
}
const pdf = readFileSync(pdfFile);
assert.ok(pdf.subarray(0, 8).toString().startsWith("%PDF-"));
assert.ok(pdf.length > 10000);
console.log(
  "One/two-speaker PNG dimensions and decoded event QR verified; downloaded PDF is valid.",
);
