import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Browser evidence includes generated reports with vendored JavaScript bundles.
  globalIgnores([".next/**", ".local/**", "next-env.d.ts", "references/**", "playwright-report/**", "test-results/**", "output/playwright/**"]),
]);
