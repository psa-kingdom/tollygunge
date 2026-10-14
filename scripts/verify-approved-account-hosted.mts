// Read-only authenticated portal acceptance. Never releases a real invitation.
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
const base = "https://tpassociation.org";
const report = JSON.parse(await readFile(".local/account-batch/production-results.json", "utf8"));
assert.equal(report.verified, true);
const password = /^Password: (.+)$/m.exec(await readFile(".local/first-admin-password.txt", "utf8"))?.[1];
assert.ok(password);
const response = await fetch(base + "/api/auth/sign-in/email", {
  method: "POST", headers: { origin: base, "content-type": "application/json" },
  body: JSON.stringify({ email: "tollygungecacpestudycircle@gmail.com", password }),
});
assert.equal(response.status, 200);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies(response.headers.getSetCookie().map(raw => {
    const pair = raw.split(";")[0], separator = pair.indexOf("=");
    return { name: pair.slice(0, separator), value: pair.slice(separator + 1), domain: "tpassociation.org", path: "/", secure: true, httpOnly: true };
  }));
  const page = await context.newPage();
  await page.goto(base + "/admin/workspaces/members");
  await expect(page.getByText("202 members", { exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: /Account linked/ }).first().click();
  const details = page.getByRole("region", { name: "Member details" });
  await expect(details.getByText("Required after activation", { exact: true })).toBeVisible();
  await expect(details.getByText(/invitation held · delivery:/)).toBeVisible();
  await page.screenshot({ path: ".local/account-batch/production-member-register.png", fullPage: true });
  await page.getByRole("button", { name: "Account directory", exact: true }).click();
  await expect(page.getByText(/208 accounts ·/)).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: ".local/account-batch/production-account-directory.png", fullPage: true });
  await writeFile(".local/account-batch/hosted-browser-verification.json", JSON.stringify({ time: new Date().toISOString(), register: 202, accounts: 208, invitationHeldVisible: true, addressCompletionVisible: true, realInvitationsReleased: 0, verified: true }, null, 2));
  console.log("Hosted browser verified: 202 members, 208 accounts, invitation held and address completion visible. No member mutations.");
} finally { await browser.close(); }
