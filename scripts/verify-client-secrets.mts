import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const secrets = Object.entries(process.env).filter(
  ([key, value]) =>
    /SECRET|PASSWORD|TOKEN|API_KEY|ACCESS_KEY|DATABASE_URL/.test(key) &&
    value &&
    value.length >= 12,
);
let files = 0;
async function scan(folder: string) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      await scan(path);
      continue;
    }
    if (!/\.(js|map|json)$/.test(entry.name)) continue;
    files++;
    const contents = await readFile(path, "utf8");
    for (const [key, value] of secrets) {
      const representations = [
        value!,
        JSON.stringify(value).slice(1, -1),
        encodeURIComponent(value!),
      ];
      if (representations.some((v) => contents.includes(v)))
        throw Error("Server configuration appeared in browser bundle: " + key);
    }
  }
}
await scan(".next/static");
console.log(
  JSON.stringify({
    browserFilesScanned: files,
    configuredSecretValuesChecked: secrets.length,
    leaks: 0,
  }),
);
