// Read-only hosted browser acceptance. No fixture accounts or content writes.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = "https://tpassociation.org";
const manifest = JSON.parse(
  await readFile(".local/real-data/content-manifest.json", "utf8"),
);
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const [label, width] of [
    ["desktop", 1440],
    ["tablet", 768],
    ["phone", 390],
  ] as const) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(base + "/governance", { waitUntil: "networkidle" });
    for (const person of manifest.people) {
      const card = page.locator(".person-card").filter({
        has: page.getByRole("heading", { name: person.name, exact: true }),
      });
      assert.equal(await card.count(), 1);
      const img = card.locator("img");
      await img.scrollIntoViewIfNeeded();
      await img.evaluate(async (el: HTMLImageElement) => {
        if (!el.complete)
          await new Promise<void>((resolve, reject) => {
            el.onload = () => resolve();
            el.onerror = () => reject(Error("Portrait failed"));
          });
      });
      assert.equal(await img.getAttribute("loading"), "lazy");
      assert.ok(
        await img.evaluate((el: HTMLImageElement) => el.naturalWidth > 0),
      );
      await card.locator("summary").click();
      assert.equal(await card.locator("details").getAttribute("open"), "");
    }
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: `.local/real-data/production-governance-${label}.png`,
      fullPage: true,
    });
    await page.evaluate(() => window.scrollTo(0, 900));
    assert.ok((await page.locator(".site-header").boundingBox())!.y >= -1);
    console.log(
      `${label}: eight portraits, expanded biographies, layout and sticky header passed`,
    );
    const password = /^Password: (.+)$/m.exec(
      await readFile(".local/first-admin-password.txt", "utf8"),
    )?.[1];
    assert.ok(password);
    const login = await page.request.post(base + "/api/auth/sign-in/email", {
      headers: { origin: base },
      data: { email: "tollygungecacpestudycircle@gmail.com", password },
    });
    assert.equal(login.status(), 200);
    try {
      await page.goto(base + "/member/payments", { waitUntil: "networkidle" });
      for (const field of ["payee", "accountNumber", "ifsc", "bank", "branch"])
        assert.ok(
          (await page.locator("main").innerText()).includes(
            manifest.payment[field],
          ),
        );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.screenshot({
        path: `.local/real-data/production-bank-${label}.png`,
        fullPage: true,
      });
      console.log(
        `${label}: exact bank instructions and responsive member display passed`,
      );
    } finally {
      await page.request.post(base + "/api/auth/sign-out", {
        headers: { origin: base },
        data: {},
      });
    }
    await page.close();
  }
} finally {
  await browser.close();
}
