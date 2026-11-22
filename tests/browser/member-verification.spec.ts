import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";

test.use({
  launchOptions: {
    executablePath: process.env.TPA_BROWSER_EXECUTABLE || undefined,
  },
});
let bundle: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `
      import React,{useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {MemberVerificationReview} from './src/components/member-verification-review';
      function Fixture(){const [approved,setApproved]=useState(false);return <>
        <MemberVerificationReview personId="member-1" userId="account-1" name="Sample Member"
          verified={false} disabled={location.search.includes('disabled')}
          onApproved={async()=>{setApproved(true)}} />
        {approved && <p>Directory refreshed after approval</p>}
      </>};createRoot(document.getElementById('root')).render(<Fixture/>);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    loader: { ".css": "empty", ".module.css": "empty" },
    write: false,
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  bundle = result.outputFiles[0].text;
});

const review = {
  id: "submission-1",
  person_id: "member-1",
  version: 4,
  status: "pending",
  requirement_version: 2,
  snapshot: { details: { fullName: "Sample Member", evidence: "document-1" } },
  requirement_fields: [
    { id: "fullName", label: "Full name", type: "text", step: 0 },
    {
      id: "evidence",
      label: "Qualification evidence",
      type: "document",
      step: 0,
    },
  ],
};
async function fixture(
  page: Page,
  options: {
    pending?: boolean;
    admin?: boolean;
    stale?: boolean;
    disabled?: boolean;
  } = {},
) {
  const writes: unknown[] = [];
  await page.route("http://portal.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<html><body><div id="root"></div></body></html>',
    }),
  );
  await page.route("**/api/staff/verification**", async (route) => {
    if (route.request().method() === "POST") {
      writes.push(route.request().postDataJSON());
      await route.fulfill(
        options.stale
          ? { status: 409, json: { error: "Review changed. Reload." } }
          : { json: { saved: true } },
      );
    } else {
      expect(new URL(route.request().url()).searchParams.get("personId")).toBe(
        "member-1",
      );
      expect(new URL(route.request().url()).searchParams.get("status")).toBe(
        "pending",
      );
      await route.fulfill({
        json: {
          admin: options.admin !== false,
          reviews: options.pending === false ? [] : [review],
        },
      });
    }
  });
  await page.goto(
    "http://portal.test/" + (options.disabled ? "?disabled" : ""),
  );
  await page.addScriptTag({ content: bundle });
  return writes;
}

test("member detail reviews evidence and approves the exact submission version", async ({
  page,
}) => {
  const writes = await fixture(page);
  await page
    .getByRole("button", { name: "Approve profile verification", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "View private evidence" }),
  ).toHaveAttribute("href", "/api/documents/document-1");
  expect(writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Approve account", exact: true })
    .click();
  await expect(page.locator("textarea")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Confirm account approval", exact: true })
    .click();
  await expect(
    page.getByText("Directory refreshed after approval"),
  ).toBeVisible();
  expect(writes).toEqual([
    {
      action: "approve",
      id: "submission-1",
      version: 4,
      reason: "",
    },
  ]);
});
test("no submission explains the prerequisite without allowing approval", async ({
  page,
}) => {
  const writes = await fixture(page, { pending: false });
  await page
    .getByRole("button", { name: "Approve profile verification", exact: true })
    .click();
  await expect(
    page.getByText(/No pending verification submission/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Confirm account approval",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(writes).toHaveLength(0);
});
test("non-administrator cannot approve from the detail review", async ({
  page,
}) => {
  await fixture(page, { admin: false });
  await page
    .getByRole("button", { name: "Approve profile verification", exact: true })
    .click();
  await expect(
    page.getByText(
      "Only an administrator can approve or reject an application.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Confirm account approval",
      exact: true,
    }),
  ).toHaveCount(0);
});
test("stale submission stays open and shows the server error", async ({
  page,
}) => {
  await fixture(page, { stale: true });
  await page
    .getByRole("button", { name: "Approve profile verification", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve account", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm account approval", exact: true })
    .click();
  await expect(page.getByText("Review changed. Reload.")).toBeVisible();
  await expect(
    page.getByText("Directory refreshed after approval"),
  ).toHaveCount(0);
});
test("closing a review makes no approval request", async ({ page }) => {
  const writes = await fixture(page);
  await page
    .getByRole("button", { name: "Approve profile verification", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close verification review", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Confirm account approval",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(writes).toHaveLength(0);
});
test("unsaved profile changes disable opening an approval review", async ({
  page,
}) => {
  await fixture(page, { disabled: true });
  await expect(
    page.getByRole("button", {
      name: "Approve profile verification",
      exact: true,
    }),
  ).toBeDisabled();
});
