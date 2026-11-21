import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";

let bundle: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {DashboardAttention} from './src/components/dashboard-attention';createRoot(document.getElementById('root')).render(<DashboardAttention live={false} workspaceCount={2} initialItems={[{id:'profile-reviews',label:'1 personal profile changes awaiting review',href:'/admin?review=profile-reviews',category:'Verification',priority:'Normal',count:1}]} />);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    loader: { ".css": "empty", ".module.css": "empty" },
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  bundle = result.outputFiles[0].text;
});
async function fixture(page: Page, stale = false) {
  const writes: unknown[] = [];
  const baseline = { name: "Sample Member", organization: "Current practice" };
  const body = { ...baseline, organization: "Proposed practice" };
  await page.route("http://portal.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<html><body><div id="root"></div></body></html>',
    }),
  );
  await page.route("**/api/attention", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route("**/api/staff/profile-reviews**", async (route) => {
    if (route.request().method() === "POST") {
      writes.push(route.request().postDataJSON());
      await route.fulfill(
        stale
          ? {
              status: 409,
              json: { error: "This review changed. Reload before deciding." },
            }
          : { json: { saved: true } },
      );
    } else if (new URL(route.request().url()).searchParams.has("id")) {
      await route.fulfill({
        json: {
          record: {
            id: "person-1",
            version: 7,
            draft: body,
            accepted: baseline,
            reviews: [
              {
                id: "review-1",
                status: "pending",
                created_at: "2026-11-20",
                body,
                baseline,
              },
            ],
          },
        },
      });
    } else
      await route.fulfill({
        json: {
          records:
            writes.length && !stale
              ? []
              : [
                  {
                    id: "review-1",
                    person_id: "person-1",
                    name: body.name,
                    created_at: "2026-11-20",
                  },
                ],
          hasMore: false,
        },
      });
  });
  await page.goto("http://portal.test/admin");
  await page.addScriptTag({ content: bundle });
  await page.getByRole("button", { name: /Review: 1 personal/ }).click();
  const dialog = page.getByRole("dialog", {
    name: "Review personal profile changes",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Sample Member/ }).click();
  await expect(
    dialog.getByRole("cell", { name: "Current practice", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("cell", { name: "Proposed practice", exact: true }),
  ).toBeVisible();
  expect(page.url()).toBe("http://portal.test/admin");
  return { writes, dialog };
}
test("overview reviews exact profile revision and refreshes alerts without navigation", async ({
  page,
}) => {
  const { writes, dialog } = await fixture(page);
  await dialog
    .getByRole("button", { name: "Approve changes", exact: true })
    .click();
  expect(writes).toHaveLength(0);
  await dialog
    .getByRole("button", { name: "Confirm decision", exact: true })
    .click();
  await expect(
    dialog.getByText("Profile changes approved.", { exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([
    {
      action: "approve",
      id: "person-1",
      version: 7,
      reviewId: "review-1",
      reason: "",
    },
  ]);
  await dialog
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  await expect(
    page.getByText("You’re all caught up", { exact: true }),
  ).toBeVisible();
});
test("rejection requires feedback and stale review stays open", async ({
  page,
}) => {
  const { writes, dialog } = await fixture(page, true);
  await dialog
    .getByRole("button", { name: "Reject changes", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Confirm decision", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Reason (required)", { exact: true })
    .fill("Please confirm the organization name.");
  await dialog
    .getByRole("button", { name: "Confirm decision", exact: true })
    .click();
  await expect(
    dialog.getByText("This review changed. Reload before deciding.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  await expect(
    dialog.getByRole("cell", { name: "Proposed practice", exact: true }),
  ).toBeVisible();
});
