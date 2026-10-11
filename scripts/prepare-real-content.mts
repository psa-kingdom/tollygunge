// Read supplied content; originals remain unchanged. Outputs contain real data
// and must stay in an ignored, access-restricted directory outside public/.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { normalizeMedia } from "../src/domain/media";
import { paymentDetails } from "../src/domain/payment-details";
const source = resolve(process.argv[2] ?? "../client/Imprtant perosn List"),
  output = resolve(".local/real-data");
await mkdir(output, { recursive: true });
const list = await readFile(join(source, "List.txt"), "utf8");
const blocks = list.trim().split(/\r?\n(?=\d+\. )/);
if (blocks.length !== 8) throw Error("Expected eight supplied biographies.");
const photos = [
  ["R N Singh.jpeg", 240, 70, 700],
  ["Pankaj Verma.jpeg", 390, 40, 850],
  ["Sanjiv Mishra.jpeg", 200, 150, 850],
  ["Lalan Sinha.jpeg", 650, 80, 750],
  ["Sambhu Jha.jpeg", 25, 80, 350],
  ["C B Sinha.jpeg", 40, 70, 360],
  ["P S.jpeg", 255, 390, 235],
  ["Umesh Giri.jpeg", 370, 20, 850],
] as const;
const people = [];
for (const [i, block] of blocks.entries()) {
  const [heading, ...paragraphs] = block.split(/\r?\n/),
    match = /^\d+\. (.+?)\s+—\s+(.+)$/.exec(heading);
  if (!match) throw Error("Check supplied person heading.");
  const [filename, left, top, size] = photos[i],
    bytes = await readFile(join(source, filename));
  const crop = { left, top, width: size, height: size },
    image = await normalizeMedia(bytes, "image/jpeg", crop);
  await writeFile(join(output, `portrait-${i + 1}.webp`), image.bytes);
  people.push({
    name: match[1],
    role: match[2],
    biography: paragraphs.join("\n").trim(),
    filename,
    crop,
    sourceHash: createHash("sha256").update(bytes).digest("hex"),
    preparedHash: createHash("sha256").update(image.bytes).digest("hex"),
    width: image.width,
    height: image.height,
  });
}
const paymentText = await readFile(join(source, "Payments.txt"), "utf8"),
  publicValues: Record<string, string> = {};
const allowed = new Set(["Name", "A/C", "IFSC", "Bank", "Branch"]);
for (const line of paymentText.trim().split(/\r?\n/)) {
  const match = /^([^:]+):\s*(.*)$/.exec(line);
  if (
    !match ||
    !allowed.has(match[1].trim()) ||
    Object.hasOwn(publicValues, match[1].trim())
  )
    throw Error(
      "Unexpected payment field; review classification before publishing.",
    );
  publicValues[match[1].trim()] = match[2].trim();
}
const payment = paymentDetails({
  method: "bank",
  label: "Bank transfer",
  payee: publicValues.Name,
  accountNumber: publicValues["A/C"],
  ifsc: publicValues.IFSC,
  bank: publicValues.Bank,
  branch: publicValues.Branch,
});
await writeFile(
  join(output, "content-manifest.json"),
  JSON.stringify(
    {
      people,
      payment,
      paymentSourceHash: createHash("sha256").update(paymentText).digest("hex"),
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    people: people.length,
    photos: people.length,
    method: payment.method,
    originalsChanged: false,
  }),
);
