// Read-only hosted privacy and secret-exclusion checks; never print configurations.
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = "https://tpassociation.org",
  cli =
    "C:/Users/savag/AppData/Roaming/npm/node_modules/@railway/cli/bin/railway.js";
let configuration: Record<string, string>;
try {
  configuration = JSON.parse(
    execFileSync(
      process.execPath,
      [
        cli,
        "variables",
        "--service",
        "tpa-web",
        "--environment",
        "production",
        "--json",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    ).toString(),
  );
} catch {
  throw Error(
    "Configuration check unavailable; sensitive diagnostics suppressed.",
  );
}
const secrets = Object.entries(configuration)
  .filter(
    ([key, value]) =>
      /SECRET|PASSWORD|TOKEN|API_KEY|ACCESS_KEY|DATABASE_URL/.test(key) &&
      typeof value === "string" &&
      value.length >= 12,
  )
  .map(([, value]) => value);
const check = (contents: string) => {
  for (const value of secrets)
    assert.ok(
      ![
        value,
        JSON.stringify(value).slice(1, -1),
        encodeURIComponent(value),
      ].some((v) => contents.includes(v)),
      "Hosted browser response contains server configuration",
    );
};
const scripts = new Set<string>();
for (const path of ["/governance", "/login", "/join"]) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200);
  const html = await response.text();
  check(html);
  for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    const url = new URL(match[1], base);
    if (url.origin === base) scripts.add(url.href);
  }
}
for (const url of scripts) {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  check(await response.text());
}
const denied: Record<string, number> = {};
for (const path of [
  "/api/staff/members",
  "/api/staff/onboarding-import",
  "/api/staff/governance",
  "/api/member/payment-details",
]) {
  const response = await fetch(base + path);
  denied[path] = response.status;
  assert.equal(response.status, 401);
}
const report = {
  hostedScriptsScanned: scripts.size,
  hostedConfigurationValuesChecked: secrets.length,
  leaks: 0,
  anonymousPrivateRoutes: denied,
};
await writeFile(
  ".local/real-data/hosted-protection-results.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
