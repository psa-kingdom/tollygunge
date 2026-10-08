// No business writes. Optional authentication creates and revokes only its own session.
import { readFile } from "node:fs/promises";
const args = process.argv.slice(2),
  option = (name) => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args[i + 1];
  };
const base = new URL(option("--url") || "https://tpassociation.org");
if (base.username || base.password)
  throw new Error("Use a URL without credentials.");
if (
  base.protocol !== "https:" &&
  !(
    base.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(base.hostname)
  )
)
  throw new Error("Use HTTPS or localhost.");
let cookie = "",
  authenticated = false,
  failures = 0;
async function check(path, statuses, privateRequest = false) {
  try {
    const response = await fetch(new URL(path, base), {
      redirect: "manual",
      headers: privateRequest ? { cookie } : {},
      signal: AbortSignal.timeout(20000),
    });
    const ok = statuses.includes(response.status);
    console.log(
      `${ok ? "PASS" : "FAIL"} ${path.split("?")[0]} (${response.status})`,
    );
    if (!ok) failures++;
    return response;
  } catch {
    console.log(`FAIL ${path.split("?")[0]} (unavailable)`);
    failures++;
    return null;
  }
}
try {
  const health = await check("/api/health", [200]);
  if (health && (await health.json()).status !== "ready") failures++;
  for (const path of [
    "/",
    "/about",
    "/governance",
    "/membership",
    "/events",
    "/resources",
    "/contact",
    "/login",
  ])
    await check(path, [200]);
  for (const path of ["/member", "/admin"]) {
    const response = await check(path, [302, 303, 307, 308]);
    if (response && !response.headers.get("location")?.includes("/login"))
      failures++;
  }
  for (const path of [
    "/api/staff/reports",
    "/api/staff/reports/export?report=accounts&format=xlsx",
    "/api/staff/report-presets",
    "/api/staff/news-sources",
    "/api/documents",
  ])
    await check(path, [401]);
  const login = await fetch(new URL("/login", base)),
    html = await login.text();
  const button = (text, label) =>
    [...text.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find((match) =>
      match[2].replace(/<[^>]*>/g, "").includes(label),
    );
  const google = button(html, "Continue with Google"),
    googleGated = html.includes("Google sign-in is not available yet");
  if (!google || (googleGated && !/disabled/.test(google[1]))) failures++;
  console.log(
    `INFO Google onboarding ${googleGated ? "gated (control disabled)" : "present; provider acceptance remains separate"}`,
  );
  const recovery = await check("/forgot-password", [200]),
    recoveryHtml = recovery ? await recovery.text() : "",
    reset = button(recoveryHtml, "Send reset link");
  if (!reset) failures++;
  console.log(
    `INFO Emailed recovery ${reset && /disabled/.test(reset[1]) ? "gated (control disabled)" : "present; delivery acceptance remains separate"}`,
  );
  if (args.includes("--expect-deferred")) {
    if (!googleGated || !reset || !/disabled/.test(reset[1])) failures++;
  }
  if (args.includes("--expect-recovery-enabled")) {
    if (!reset || /disabled/.test(reset[1])) failures++;
    console.log(
      "INFO Recovery UI acceptance does not establish email delivery.",
    );
  }
  const file = option("--credential-file");
  if (file) {
    const raw = await readFile(file, "utf8"),
      password = /^Password: (.+)$/m.exec(raw)?.[1],
      email = /^Email: (.+)$/m.exec(raw)?.[1] || option("--email");
    if (!password || !email)
      throw new Error(
        "Credential file requires Email and Password fields, or --email.",
      );
    const response = await fetch(new URL("/api/auth/sign-in/email", base), {
      method: "POST",
      headers: { "content-type": "application/json", origin: base.origin },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ email, password }),
      redirect: "manual",
    });
    cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    authenticated = !!cookie;
    if (!response.ok || !cookie)
      throw new Error("Release-check authentication failed.");
    for (const path of [
      "/api/staff/reports",
      "/api/staff/report-presets",
      "/api/staff/news-sources",
    ])
      await check(path, [200], true);
    const media = await check("/api/staff/media", [200], true);
    if (media) {
      const data = await media.json();
      console.log(
        `INFO Hosted editorial uploads ${data.uploadEnabled ? "enabled" : "gated"}`,
      );
      if (args.includes("--expect-storage") && !data.uploadEnabled) failures++;
    }
  }
} catch (error) {
  console.error(
    error instanceof Error &&
      /^(Use|Credential file|Release-check)/.test(error.message)
      ? error.message
      : "Release check failed; diagnostics suppressed.",
  );
  failures++;
} finally {
  if (authenticated) {
    try {
      const response = await fetch(new URL("/api/auth/sign-out", base), {
        method: "POST",
        headers: {
          cookie,
          origin: base.origin,
          "content-type": "application/json",
        },
        body: "{}",
      });
      if (!response.ok) failures++;
      await check("/api/staff/reports", [401], true);
    } catch {
      failures++;
      console.error("Release-check session cleanup failed.");
    }
  }
  cookie = "";
}
console.log(
  `Release check: ${failures ? "FAILED" : "PASSED"}; recovery exercise remains separate.`,
);
process.exitCode = failures ? 1 : 0;
