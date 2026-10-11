import { build } from "esbuild";
await build({
  entryPoints: ["scripts/email-worker.mts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: ".next/email-worker.mjs",
  external: ["pg"],
  banner: {
    js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);",
  },
});
await build({
  entryPoints: ["scripts/member-import-worker.mts"], bundle: true, platform: "node",
  target: "node24", format: "esm", outfile: ".next/member-import-worker.mjs",
  external: ["pg"], conditions: ["react-server"],
  banner: {js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},
});
