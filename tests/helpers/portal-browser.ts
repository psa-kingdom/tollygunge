import { expect, type Page, type BrowserContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { roles } from "../../src/domain/access";
type Cookies = Awaited<ReturnType<BrowserContext["cookies"]>>;
const sessions = new Map<string, Cookies>();
export type PortalRole = (typeof roles)[number] | "member";
export async function signInPortal(page: Page, role: PortalRole) {
  const origin = new URL(process.env.TPA_TEST_URL || "http://127.0.0.1:3112");
  expect(["localhost", "127.0.0.1"]).toContain(origin.hostname);
  expect(process.env.TPA_MAIL_SINK).toBe("true");
  const key =
    role === "administrator" ? "ADMIN" : role === "member" ? "MEMBER" : role;
  if (!sessions.size && process.env.TPA_BROWSER_SESSION_FILE) {
    const saved = JSON.parse(
      await readFile(process.env.TPA_BROWSER_SESSION_FILE, "utf8"),
    );
    for (const [kind, cookies] of Object.entries(saved))
      sessions.set(kind, cookies as Cookies);
  }
  const destination = role === "member" ? "/member" : "/admin";
  if (sessions.has(key)) {
    await page.context().addCookies(sessions.get(key)!);
    await page.goto(destination);
    await expect(page.locator(".portal-navigation")).toBeVisible();
    return;
  }
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(
      role === "administrator"
        ? process.env.TPA_UI_ADMIN_EMAIL!
        : role === "member"
          ? process.env.TPA_UI_MEMBER_EMAIL!
          : `portal-${role}@example.invalid`,
    );
  await page
    .getByLabel("Password", { exact: true })
    .fill(
      role === "member"
        ? process.env.TPA_UI_MEMBER_PASSWORD!
        : process.env.TPA_UI_ADMIN_PASSWORD!,
    );
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = page.waitForResponse((response) =>
      response.url().endsWith("/api/onboarding/sign-in"),
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const result = await response;
    if (result.status() !== 429) {
      expect(result.status()).toBe(200);
      break;
    }
    expect(attempt, "The synthetic sign-in rate limit did not recover").toBe(0);
    const seconds = Number(result.headers()["retry-after"]) || 60;
    console.log(`Respecting synthetic sign-in rate limit (${seconds}s).`);
    await page.waitForTimeout(seconds * 1000);
  }
  await page.waitForURL((url) => url.pathname === destination);
  await expect(page.locator(".portal-navigation")).toBeVisible();
  sessions.set(key, await page.context().cookies());
}
