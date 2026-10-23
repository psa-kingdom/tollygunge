import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const directories = new Set([
  ".github", "data", "docs", "migrations", "public", "scripts", "src", "tests",
]);
const rootFiles = new Set([
  ".dockerignore", ".env.example", ".gitignore", "AGENTS.md", "CLAUDE.md",
  "Dockerfile", "eslint.config.mjs", "next-env.d.ts", "next.config.mjs",
  "package-lock.json", "package.json", "playwright.config.ts", "README.md",
  "tsconfig.json", "WORKSPACE_UX_RELEASE.md",
]);
const generatedDirectories = new Set([
  "node_modules", ".next", "out", "playwright-report", "test-results",
]);
const privateDirectories = new Set([".local", ".vercel", ".railway"]);

/** Path policy only: never reads file contents. Input uses Git's slash separators. */
export function validatePaths(paths) {
  const errors = [];
  for (const path of paths) {
    const parts = path.split("/");
    const lower = parts.map((part) => part.toLowerCase());
    const name = lower.at(-1);
    let reason;
    if (lower.some((part) => privateDirectories.has(part)) || lower[0] === "references") {
      reason = "private/local material belongs outside tracked source";
    } else if (lower.some((part) => generatedDirectories.has(part)) ||
      (lower[0] === "output" && lower[1] === "playwright") || name.endsWith(".tsbuildinfo")) {
      reason = "generated output must remain ignored; preserve existing evidence on disk";
    } else if ((name.startsWith(".env") && path !== ".env.example") ||
      name === "credential.md" || /\.(pem|key|p12|pfx|crt|cer|der)$/.test(name)) {
      reason = "environment, credential or certificate material must not be tracked";
    } else if (parts.length === 1 ? !rootFiles.has(path) : !directories.has(parts[0])) {
      reason = "unapproved top-level destination; document its purpose and update the placement policy/checker";
    }
    if (reason) errors.push({ path, reason });
  }
  return errors;
}

export function checkRepository(cwd = process.cwd()) {
  // The index includes staged additions, even force-added ignored files. NUL framing
  // handles spaces/newlines; do not use ignore filters that could hide violations.
  const paths = execFileSync("git", ["ls-files", "--cached", "-z"], {
    cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
  }).split("\0").filter(Boolean);
  return { count: paths.length, errors: validatePaths(paths) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { count, errors } = checkRepository();
    for (const { path, reason } of errors) console.error(`${JSON.stringify(path)}: ${reason}`);
    if (errors.length) {
      console.error(`Repository structure: FAIL (${errors.length} path violations). See docs/engineering/REPOSITORY_STRUCTURE.md.`);
      process.exitCode = 1;
    } else console.log(`Repository structure: PASS (${count} indexed paths; untracked files and contents are not scanned).`);
  } catch {
    console.error("Repository structure: unable to read the Git index. Run from the repository root with Git installed.");
    process.exitCode = 1;
  }
}
