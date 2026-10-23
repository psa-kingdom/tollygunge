import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { checkRepository, validatePaths } from "../scripts/check-repository-structure.mjs";

test("placement permits framework, source, public assets and synthetic fixtures", () => {
  assert.deepEqual(validatePaths([
    ".env.example", "Dockerfile", "next-env.d.ts", ".github/workflows/ci.yml",
    "src/app/events/[id]/page.tsx", "src/app/icon.png", "src/app/apple-icon.png",
    "src/components/tpa-logo.tsx", "src/domain/access.ts", "src/lib/database.ts",
    "public/design/tpa-logo.png", "public/design/fonts/jakarta-OFL.txt",
    "tests/fixtures/synthetic-members.json", "scripts/email-worker.mts",
    "migrations/033_website_control.sql", "data/postal/provenance.json",
    "docs/engineering/decisions/0001-example.md",
  ]), []);
});

test("placement rejects local outputs and private paths even under approved roots", () => {
  const paths = [
    "misc/note.md", "new-root.md", "output/playwright/phase8b/index.html",
    "tests/test-results/trace.zip", "src/.next/cache.json", "node_modules/x/index.js",
    "out/index.html", "playwright-report/index.html", "tsconfig.tsbuildinfo",
    ".local/recovery.json", ".vercel/project.json", ".railway/config.json",
    "references/source.docx", ".env.local", "tests/.env.example",
    "docs/Credential.md", "data/client.KEY", "scripts/certificate.pem",
  ];
  assert.deepEqual(validatePaths(paths).map((error) => error.path), paths);
});

test("Git index check catches force-staged ignored files without reading their contents", () => {
  const cwd = mkdtempSync(join(tmpdir(), "tpa-structure-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd, stdio: "pipe" });
  try {
    git("init");
    mkdirSync(join(cwd, "src"));
    writeFileSync(join(cwd, "src/example.ts"), "export {};\n");
    writeFileSync(join(cwd, ".gitignore"), ".env.local\n");
    writeFileSync(join(cwd, ".env.local"), "synthetic fixture only\n");
    writeFileSync(join(cwd, "untracked-note.md"), "not part of index\n");
    git("add", ".gitignore", "src/example.ts");
    assert.equal(checkRepository(cwd).errors.length, 0);
    git("add", "--force", ".env.local");
    assert.deepEqual(checkRepository(cwd).errors.map((error) => error.path), [".env.local"]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
