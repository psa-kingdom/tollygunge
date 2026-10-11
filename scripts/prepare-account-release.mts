// Capture only runtime source, never private operational evidence or credentials.
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, dirname, resolve } from "node:path";
const folder = resolve(".local/account-batch/release-" + Date.now());
const rootFiles = new Set([
  "Dockerfile",
  ".dockerignore",
  "package.json",
  "package-lock.json",
  "next.config.mjs",
  "tsconfig.json",
  "eslint.config.mjs",
  "AGENTS.md",
]);
const runtimeScripts = new Set([
  "scripts/build-worker.mjs",
  "scripts/email-worker.mts",
  "scripts/member-import-worker.mts",
  "scripts/start-runtime.mjs",
  "scripts/migrate.mjs",
  "scripts/provision-postal.mts",
]);
const files = [
  ...new Set(
    execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
      encoding: "utf8",
    })
      .trim()
      .split(/\r?\n/),
  ),
]
  .filter(
    (file) =>
      rootFiles.has(file) ||
      runtimeScripts.has(file) ||
      /^(src|migrations|public|data)\//.test(file),
  )
  .sort();
const manifest: Record<string, string> = {};
for (const file of files) {
  if (
    file.split("/").includes("..") ||
    /(^|\/)(\.env[^/]*|Credential\.md|credentials?\.json|[^/]*\.(pem|key|p12))$/i.test(
      file,
    )
  )
    throw Error("Unexpected sensitive runtime path");
  const bytes = await readFile(file);
  manifest[file] = createHash("sha256").update(bytes).digest("hex");
  await mkdir(dirname(join(folder, file)), { recursive: true });
  await copyFile(file, join(folder, file));
}
const hash = createHash("sha256")
  .update(JSON.stringify(manifest))
  .digest("hex");
await writeFile(
  ".local/account-batch/release-manifest.json",
  JSON.stringify({ folder, hash, files: manifest }, null, 2),
);
console.log(JSON.stringify({ snapshot: folder, files: files.length, hash }));
